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
const { hasSpec } = require('./_shared/extract-specs');
const { runExtraction } = require('./site-extract-utils/extract-core');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');
const { starteKiRequest } = require('./_shared/ki-log');
const { appendStep } = require('./_shared/thinking');

const THINKING_LABELS = {
  start: 'Ich schaue mir die Seite an',
  cache: 'Die Seite kenne ich schon',
  laden: 'Seite wird geladen',
  unterseite: 'Ich gehe die Unterseiten durch',
  auswerten: 'USPs und Pain Points werden durchsucht',
  bilder: 'Produktbilder zusammengesucht'
};

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
    .select('id, url, entity_type, status, created_by')
    .eq('id', jobId).single();
  if (!job || job.created_by !== user.id) {
    console.error(`❌ site-extract-background: Job ${jobId} nicht gefunden oder fremd`);
    return { statusCode: 404 };
  }
  if (job.status !== 'pending') {
    console.warn(`⚠️ site-extract-background: Job ${jobId} bereits ${job.status}, kein zweiter Lauf`);
    return { statusCode: 409 };
  }
  if (!job.url || !hasSpec(job.entity_type)) {
    await supabase.from('extract_jobs')
      .update({ status: 'error', error_message: `Kein Extraktions-Profil fuer "${job.entity_type}" oder URL fehlt` })
      .eq('id', jobId);
    return { statusCode: 400 };
  }

  // Fortschritts-Schreiber: sequenziell, damit sich Updates nicht ueberholen;
  // ein fehlgeschlagener Zwischenstand darf die Extraktion nicht kippen
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
      .then(() => supabase.from('extract_jobs').update({
        status: 'running',
        progress_step: step,
        progress_steps: steps
      }).eq('id', jobId))
      .catch((e) => console.error(`[${jobId}] Job-Update fehlgeschlagen:`, e.message));
  };

  schreibeStep('start', `Extraktion startet: ${job.entity_type} <- ${job.url}`);

  let ki = null;
  try {
    // Frequenz-Limit pruefen + KI-Nutzungsprotokoll (Feature pro Entitaet,
    // damit die Admin-Seite Unternehmen/Marke/Produkt getrennt zeigt)
    ki = await starteKiRequest(supabase, {
      userId: user.id,
      feature: `site_extract_${job.entity_type}`
    });

    const result = await runExtraction({
      url: job.url,
      entityType: job.entity_type,
      supabase,
      onStep: schreibeStep
    });
    // Kosten/Tokens rechnet extract-core selbst (result.cost aus claude-cost)
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
