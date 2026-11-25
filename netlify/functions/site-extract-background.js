// site-extract-background.js
// Netlify Background Function (Suffix "-background": 15-Minuten-Limit,
// antwortet sofort 202). Loest die alte synchrone site-extract ab, die von
// der Plattform hart nach 30s gekillt wurde (Sandbox.Timedout, 502).
//
// Ablauf: Der Client legt die Zeile in extract_jobs an (RLS: nur eigene Jobs
// lesbar), POSTet { jobId } hierher und pollt danach die Zeile. Diese Function
// schreibt Fortschritt, Ergebnis oder Fehler (inkl. Diagnose) per Service Role
// in die Job-Zeile. Ein Job endet IMMER in done oder error - nie als stumme
// Leiche, dafuer sorgt der catch-Block.

const { createClient } = require('@supabase/supabase-js');
const { hasSpec, getSpec } = require('./_shared/extract-specs');
const { findAgenturHomepage, namenTreffer } = require('./_shared/agentur-resolver');
const { addCosts } = require('./_shared/claude-cost');
const { runExtraction } = require('./site-extract-utils/extract-core');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');
const { starteKiRequest } = require('./_shared/ki-log');
const { appendStep } = require('./_shared/thinking');

const THINKING_LABELS = {
  start: 'Ich schaue mir die Seite an',
  suche: 'Ich suche die Agentur im Netz',
  cache: 'Die Seite kenne ich schon',
  laden: 'Seite wird geladen',
  unterseite: 'Ich gehe die Unterseiten durch',
  auswerten: 'USPs und Pain Points werden durchsucht',
  bilder: 'Produktbilder zusammengesucht'
};

const PERSONA_THINKING_LABELS = {
  ...THINKING_LABELS,
  auswerten: 'Ich leite die Persona aus der Seite ab'
};

/**
 * Name und bis zu zwei Creator-Namen eines Managements. Die Creator dienen
 * der Suche zur Disambiguierung gleichnamiger Firmen.
 */
async function ladeManagement(supabase, id) {
  const { data: management } = await supabase.from('management')
    .select('id, firmenname, webseite')
    .eq('id', id).maybeSingle();
  if (!management) return null;

  const { data: zuordnungen } = await supabase.from('creator_management')
    .select('creator:creator_id (vorname, nachname)')
    .eq('management_id', id).eq('ist_aktiv', true)
    .limit(2);
  const creatorNamen = (zuordnungen || [])
    .map((z) => [z.creator?.vorname, z.creator?.nachname].filter(Boolean).join(' '))
    .filter(Boolean);

  return { ...management, creatorNamen };
}

/** Zusammenfassung von Suche und Gate in den Function-Logs (zweiter Kanal neben der Browser-Console). */
function logAgentur(jobId, agentur) {
  const s = agentur.suche || {};
  if (!agentur.gate) {
    console.log(`[${jobId}] Management "${agentur.firmenname}", Creator: ${agentur.creator.join(', ') || '-'}`);
    if (s.uebersprungen) {
      console.log(`[${jobId}] ${s.uebersprungen}: ${s.gewaehlt}`);
      return;
    }
    console.log(`[${jobId}] Suchen: ${(s.queries || []).map((q) => `"${q}"`).join(', ') || '-'}`);
    console.log(`[${jobId}] Quellen (${(s.quellen || []).length}): ${(s.quellen || []).map((q) => q.host).join(', ') || '-'}`);
    console.log(`[${jobId}] Modell nennt ${s.modellUrl || '-'} (${s.begruendung || 'ohne Begruendung'})`);
    console.log(`[${jobId}] Gewaehlt: ${s.gewaehlt || '-'}${agentur.grund ? ` | abgelehnt: ${agentur.grund}` : ''}`);
    return;
  }
  const g = agentur.gate;
  console.log(`[${jobId}] Namens-Gate: ${g.passt ? 'passt' : 'passt NICHT'} ("${g.stammdatenName}" gegen "${g.extrahierterName || '-'}", Treffer: ${g.treffer.join(', ') || '-'}, Tokens: ${g.stammTokens.join(', ') || '-'})`);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ site-extract-background: Supabase-Konfiguration fehlt');
    return { statusCode: 500 };
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const auth = await verifyAuth(event, supabase);
  if (!auth.user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authErrorBody(auth))
    };
  }
  const { user } = auth;

  let jobId;
  try {
    ({ jobId } = JSON.parse(event.body || '{}'));
  } catch (_) {
    return { statusCode: 400 };
  }
  if (!jobId) return { statusCode: 400 };

  // URL und Entity kommen aus der Job-Zeile, nicht aus dem Body: eine Quelle
  // der Wahrheit, und der Job laesst sich nicht fuer fremde Zeilen missbrauchen
  const { data: job } = await supabase.from('extract_jobs')
    .select('id, url, entity_id, entity_type, status, created_by')
    .eq('id', jobId).single();
  if (!job || job.created_by !== user.id) {
    console.error(`❌ site-extract-background: Job ${jobId} nicht gefunden oder fremd`);
    return { statusCode: 404 };
  }
  if (job.status !== 'pending') {
    console.warn(`⚠️ site-extract-background: Job ${jobId} bereits ${job.status}, kein zweiter Lauf`);
    return { statusCode: 409 };
  }
  // Ohne URL nur erlaubt, wenn die Spec die Homepage selbst sucht (resolveUrl)
  // und der Job auf einen Datensatz zeigt
  const spec = hasSpec(job.entity_type) ? getSpec(job.entity_type) : null;
  const kannSuchen = Boolean(spec?.resolveUrl && job.entity_id);
  if (!spec || (!job.url && !kannSuchen)) {
    await supabase.from('extract_jobs')
      .update({ status: 'error', error_message: `Kein Extraktions-Profil fuer "${job.entity_type}" oder URL fehlt` })
      .eq('id', jobId);
    return { statusCode: 400 };
  }

  // Fortschritts-Schreiber: sequenziell, damit sich Updates nicht ueberholen;
  // ein fehlgeschlagener Zwischenstand darf die Extraktion nicht kippen
  let queue = Promise.resolve();
  let progressSteps = [];
  const labels = job.entity_type === 'persona' ? PERSONA_THINKING_LABELS : THINKING_LABELS;
  const schreibeStep = (step, msg) => {
    if (msg) console.log(`[${jobId}] ${msg}`);
    progressSteps = appendStep(progressSteps, {
      step,
      label: labels[step] || msg || 'Ich arbeite'
    });
    const steps = progressSteps;
    queue = queue
      .then(() => supabase.from('extract_jobs').update({
        status: 'running',
        progress_step: step,
        progress_steps: steps
      }).eq('id', jobId))
      .catch((e) => console.error(`[${jobId}] Job-Update fehlgeschlagen:`, e.message));
  };

  schreibeStep('start', `Extraktion startet: ${job.entity_type} <- ${job.url || `Suche (${job.entity_id})`}`);

  let ki = null;
  try {
    // Frequenz-Limit pruefen + KI-Nutzungsprotokoll (Feature pro Entitaet,
    // damit die Admin-Seite Unternehmen/Marke/Produkt getrennt zeigt)
    ki = await starteKiRequest(supabase, {
      userId: user.id,
      feature: `site_extract_${job.entity_type}`
    });

    // --- Homepage suchen (nur Specs mit resolveUrl, z.B. Management) --------
    let url = job.url;
    let agentur = null;
    let management = null;
    let suchKosten = null;
    if (!url) {
      schreibeStep('suche', `[${jobId}] Suche Homepage zu ${job.entity_type} ${job.entity_id}`);
      management = await ladeManagement(supabase, job.entity_id);
      if (!management) throw new Error('Management nicht gefunden');

      const gefunden = await findAgenturHomepage({
        firmenname: management.firmenname,
        creatorNamen: management.creatorNamen,
        bekannteUrl: management.webseite
      });
      suchKosten = gefunden.cost;
      agentur = {
        firmenname: management.firmenname,
        creator: management.creatorNamen,
        suche: gefunden.suche,
        grund: gefunden.grund
      };
      logAgentur(jobId, agentur);

      if (!gefunden.url) {
        // Kein Fehler: die Suche hat nur nichts Belastbares ergeben
        const result = {
          success: true,
          matched: false,
          fields: {},
          notes: [`Keine passende Homepage gefunden (${gefunden.grund})`],
          cost: suchKosten,
          diagnostics: { agentur }
        };
        await ki.abschliessen({ cost: suchKosten });
        await queue;
        await supabase.from('extract_jobs')
          .update({ status: 'done', progress_step: 'done', result })
          .eq('id', jobId);
        return { statusCode: 200 };
      }

      url = gefunden.url;
      await supabase.from('extract_jobs').update({ url }).eq('id', jobId);
    }

    const result = await runExtraction({
      url,
      entityType: job.entity_type,
      supabase,
      onStep: schreibeStep
    });

    // --- Namens-Gate: gehoert die Seite wirklich zu diesem Management? -------
    if (agentur) {
      const extrahierterName = result.fields?.firmenname?.value || null;
      const gate = namenTreffer(management.firmenname, extrahierterName, url);
      agentur.gate = { ...gate, stammdatenName: management.firmenname, extrahierterName };
      result.matched = gate.passt;
      if (!gate.passt) {
        // Zur Kontrolle in der Console sichtbar, aber nicht anwendbar
        agentur.verworfeneFelder = result.fields;
        result.fields = {};
        result.notes = [...(result.notes || []), 'Firmenname auf der Seite passt nicht zum Management, nichts uebernommen'];
      }
      result.diagnostics = { ...result.diagnostics, agentur };
      logAgentur(jobId, agentur);
    }

    // Kosten/Tokens rechnet extract-core selbst (result.cost aus claude-cost);
    // die Suche kommt dazu
    result.cost = addCosts(result.cost || null, suchKosten);
    await ki.abschliessen({ cost: result.cost || null });

    await queue;
    await supabase.from('extract_jobs')
      .update({ status: 'done', progress_step: 'done', result })
      .eq('id', jobId);
    return { statusCode: 200 };
  } catch (error) {
    console.error(`❌ site-extract-background [${jobId}]:`, error.message);
    if (ki) await ki.fehlgeschlagen(error);
    try {
      await queue;
      await supabase.from('extract_jobs')
        .update({
          status: 'error',
          error_message: error.message,
          // Diagnose auch im Fehlerfall ausliefern - sonst ist im Browser
          // nicht nachvollziehbar, woran es lag
          result: error.diagnostics ? { diagnostics: error.diagnostics } : null
        })
        .eq('id', jobId);
    } catch (_) { /* Job-Update selbst fehlgeschlagen */ }
    return { statusCode: 500 };
  }
};
