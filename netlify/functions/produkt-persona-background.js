// produkt-persona-background.js
// Netlify Background Function: Persona- und Use-Case-Vorschlaege aus dem
// Produkt. Muster wie site-extract-background: der Client legt die Zeile in
// produkt_persona_jobs an (inkl. Input-Snapshot der Formularfelder), POSTet
// { jobId } hierher und pollt die Zeile. Diese Function schreibt Fortschritt,
// Ergebnis oder Fehler per Service Role.
//
// Der Job persistiert bewusst NICHTS an Use Cases oder Vorschlaegen: das
// Produktdoc ist ein Worksheet - erst der Save des Produkts schreibt den
// Stand (analog Varianten/Bilder). So gilt ein Code-Pfad fuer Create- und
// Edit-Modus, und ungespeicherte Aenderungen verhalten sich wie ueberall im
// Formular.

const { createClient } = require('@supabase/supabase-js');
const { callClaude, MODELS } = require('./_shared/anthropic');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');
const { starteKiRequest } = require('./_shared/ki-log');
const { appendStep } = require('./_shared/thinking');
const {
  personaTool,
  modusBrauchtUnisexName,
  gefilterteUnisexNamen,
  buildPrompt,
  loadPoolPersonas,
  validateVorschlaege
} = require('./_shared/produkt-persona');
const { passendeNamen } = require('./_shared/unisex-vornamen');
const { fmtCampaignBriefing } = require('./_shared/skript-context/briefing-felder');

/**
 * Briefing der Linie als Prompt-Text (gespeicherter Stand, auch Entwurf).
 * Nur fuer die Namenswahl. Fehlt es, gehoert es einem anderen Unternehmen oder
 * schlaegt das Laden fehl, bleibt der Text leer: Produkt und Marke tragen dann allein.
 */
async function ladeBriefingText(supabase, briefingId, unternehmenId) {
  if (!briefingId) return '';
  try {
    const { data, error } = await supabase.from('campaign_briefings')
      .select('*').eq('id', briefingId).maybeSingle();
    if (error || !data) return '';
    if (unternehmenId && data.unternehmen_id && data.unternehmen_id !== unternehmenId) return '';
    return fmtCampaignBriefing(data).trim();
  } catch (e) {
    console.warn(`⚠️ produkt-persona-background: Briefing ${briefingId} nicht lesbar: ${e.message}`);
    return '';
  }
}

function usageZusammen(a, b) {
  if (!b) return a || null;
  if (!a) return b;
  const sum = { ...b };
  for (const key of ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']) {
    if (typeof a[key] === 'number' || typeof b[key] === 'number') {
      sum[key] = (a[key] || 0) + (b[key] || 0);
    }
  }
  return sum;
}

const THINKING_LABELS = {
  start: 'Ich lese das Produkt',
  pool: 'Ich prüfe die bestehenden Personas',
  generieren: 'Ich entwerfe die Vorschläge',
  pruefen: 'Ich prüfe die Vorschläge gegen den Pool'
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ produkt-persona-background: Supabase-Konfiguration fehlt');
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

  const { data: job } = await supabase.from('produkt_persona_jobs')
    .select('id, produkt_id, unternehmen_id, status, input, created_by')
    .eq('id', jobId).single();
  if (!job || job.created_by !== user.id) {
    console.error(`❌ produkt-persona-background: Job ${jobId} nicht gefunden oder fremd`);
    return { statusCode: 404 };
  }
  if (job.status !== 'pending') {
    console.warn(`⚠️ produkt-persona-background: Job ${jobId} bereits ${job.status}, kein zweiter Lauf`);
    return { statusCode: 409 };
  }

  const input = job.input || {};

  // Fortschritts-Schreiber wie bei site-extract: sequenziell ueber eine Queue
  let queue = Promise.resolve();
  let progressSteps = [];
  const schreibeStep = (step, msg) => {
    if (msg) console.log(`[${jobId}] ${msg}`);
    progressSteps = appendStep(progressSteps, {
      step,
      label: THINKING_LABELS[step] || msg || 'Ich arbeite'
    });
    const steps = progressSteps;
    queue = queue
      .then(() => supabase.from('produkt_persona_jobs').update({
        status: 'running',
        progress_step: step,
        progress_steps: steps
      }).eq('id', jobId))
      .catch((e) => console.error(`[${jobId}] Job-Update fehlgeschlagen:`, e.message));
  };

  schreibeStep('start', `Persona-Generierung startet (Modus: ${input.modus || 'initial'})`);

  let ki = null;
  try {
    // Substance-Gate: ohne Name und ohne USP/Pains gibt es keine fundierte Basis
    const felder = input.felder || {};
    const wert = (f) => {
      const e = felder[f];
      return String((e && typeof e === 'object' ? e.value : e) || '').trim();
    };
    if (!wert('name') || (!wert('usp') && !wert('pain_points') && !wert('kurzbeschreibung'))) {
      throw new Error('Zu wenig Produkt-Substanz: Name plus USP, Pain Points oder Kurzbeschreibung werden gebraucht');
    }

    ki = await starteKiRequest(supabase, {
      userId: user.id,
      feature: 'produkt_persona'
    });

    schreibeStep('pool', 'Bestehende Personas werden geladen');
    const { pool, quelle } = await loadPoolPersonas(supabase, {
      markeIds: input.marke_ids || [],
      unternehmenId: job.unternehmen_id || null
    });

    // Ausgeschlossene Personas (liegen auf Karten oder wurden als Match
    // verworfen) kommen aus dem Pool raus - kein Recyceln, keine Klone
    const ausgeschlossen = new Set(input.ausschluss_persona_ids || []);
    const matchPool = pool.filter(p => !ausgeschlossen.has(p.id));

    schreibeStep('generieren', `Liky entwirft (Pool: ${matchPool.length} aus ${quelle})`);
    const unisexNamen = modusBrauchtUnisexName(input.modus);
    const verworfenerName = input.ersetzteKarte?.name || null;
    const erlaubteNamen = gefilterteUnisexNamen({
      poolNamen: matchPool.map((p) => p.name),
      belegteNamen: (input.behalten || []).map((b) => b?.name),
      verworfenerName
    });
    const briefingText = await ladeBriefingText(supabase, input.briefing_id, job.unternehmen_id);
    const { stable, task } = buildPrompt({ ...input, briefingText }, { pool: matchPool, poolQuelle: quelle });
    const tool = personaTool({ unisexNamen, namen: erlaubteNamen });
    const bestehendeCount = Array.isArray(input.bestehende_use_cases) ? input.bestehende_use_cases.length : 0;

    const entwerfen = async (userPrompt) => {
      const antwort = await callClaude({
        model: MODELS.persona,
        systemBlocks: [{ text: stable, cache: true }],
        userPrompt,
        maxTokens: 8000,
        tool,
        toolForced: true
      });
      if (!antwort.json) {
        throw new Error('Die KI hat kein strukturiertes Ergebnis geliefert');
      }
      return {
        antwort,
        geprueft: validateVorschlaege(antwort.json, {
          useCaseCount: bestehendeCount + (Array.isArray(antwort.json?.use_cases) ? antwort.json.use_cases.length : 0),
          maxVorschlaege: 1,
          unisexNamen
        })
      };
    };

    let { antwort: result, geprueft } = await entwerfen(task);

    const namensGruende = new Set(['kein Unisex-Vorname', 'Name passt nicht zum Register', 'Name passt nicht zum Alter']);
    const namenAbgelehnt = unisexNamen
      && !geprueft.vorschlaege.length
      && geprueft.verworfen.some((v) => namensGruende.has(v.grund));
    if (namenAbgelehnt) {
      const abgelehnte = geprueft.verworfen.filter((v) => namensGruende.has(v.grund) && v.vorschlag);
      const letzter = abgelehnte[0] || null;
      const grund = letzter?.grund === 'Name passt nicht zum Register'
        ? 'passt nicht zum gewaehlten Register'
        : letzter?.grund === 'Name passt nicht zum Alter'
          ? 'passt nicht zum Alter der Persona'
          : 'ist nicht erlaubt';
      const passende = passendeNamen(erlaubteNamen, {
        register: letzter?.register || null,
        alterVon: letzter?.alter_von ?? null,
        alterBis: letzter?.alter_bis ?? null
      });
      const korrektur = `${task}\n\n# KORREKTUR\nDer Vorname ${abgelehnte.map((v) => v.vorschlag).join(', ') || 'des letzten Entwurfs'} ${grund}. `
        + `Nimm genau einen aus dieser Liste: ${passende.join(', ')}. Kein anderer Name.`;
      const zweiter = await entwerfen(korrektur);
      result = { ...zweiter.antwort, usage: usageZusammen(result.usage, zweiter.antwort.usage) };
      geprueft = zweiter.geprueft;
    }

    schreibeStep('pruefen', 'Vorschlaege werden validiert');

    if (!geprueft.vorschlaege.length) {
      throw new Error('Die KI konnte aus den Produktdaten keine tragfähigen Persona-Vorschläge ableiten');
    }

    await ki.abschliessen({ model: result.model, usage: result.usage });

    const payload = {
      success: true,
      modus: input.modus || 'initial',
      use_cases: geprueft.use_cases,
      vorschlaege: geprueft.vorschlaege,
      verworfen: geprueft.verworfen,
      pool_groesse: matchPool.length,
      pool_quelle: quelle
    };

    await queue;
    await supabase.from('produkt_persona_jobs')
      .update({ status: 'done', progress_step: 'done', result: payload })
      .eq('id', jobId);
    return { statusCode: 200 };
  } catch (error) {
    console.error(`❌ produkt-persona-background [${jobId}]:`, error.message);
    if (ki) await ki.fehlgeschlagen(error);
    try {
      await queue;
      await supabase.from('produkt_persona_jobs')
        .update({ status: 'error', error_message: error.message })
        .eq('id', jobId);
    } catch (_) { /* Job-Update selbst fehlgeschlagen */ }
    return { statusCode: 500 };
  }
};
