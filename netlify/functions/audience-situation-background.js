// audience-situation-background.js
// Nach einem Produkt-Accept: Audience Situations fuer eine Persona, wenn
// noch keine echten Rows existieren (ADR 0016). Schreibt direkt als
// Stammdaten. Fail laesst Seeds stehen.

const { createClient } = require('@supabase/supabase-js');
const { callClaude, MODELS } = require('./_shared/anthropic');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');
const { starteKiRequest } = require('./_shared/ki-log');
const { appendStep } = require('./_shared/thinking');
const {
  istKiBereit,
  SITUATION_TOOL,
  validateSituationen,
  buildPrompt
} = require('./_shared/audience-situation');

const THINKING_LABELS = {
  start: 'Ich lese Persona und Produkt',
  generieren: 'Ich entwerfe Audience Situations',
  schreiben: 'Ich speichere die Situations'
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ audience-situation-background: Supabase-Konfiguration fehlt');
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

  const { data: job } = await supabase.from('audience_situation_jobs')
    .select('id, persona_id, produkt_id, status, input, created_by')
    .eq('id', jobId).single();
  if (!job || job.created_by !== user.id) {
    console.error(`❌ audience-situation-background: Job ${jobId} nicht gefunden oder fremd`);
    return { statusCode: 404 };
  }
  if (job.status !== 'pending') {
    console.warn(`⚠️ audience-situation-background: Job ${jobId} bereits ${job.status}, kein zweiter Lauf`);
    return { statusCode: 409 };
  }

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
      .then(() => supabase.from('audience_situation_jobs').update({
        status: 'running',
        progress_step: step,
        progress_steps: steps
      }).eq('id', jobId))
      .catch((e) => console.error(`[${jobId}] Job-Update fehlgeschlagen:`, e.message));
  };

  schreibeStep('start', `Audience Situations für Persona ${job.persona_id}`);

  let ki = null;
  try {
    const { data: bestehende, error: loadError } = await supabase
      .from('audience_situation')
      .select('id, quelle')
      .eq('persona_id', job.persona_id);
    if (loadError) throw loadError;
    if (!istKiBereit(bestehende || [])) {
      await queue;
      await supabase.from('audience_situation_jobs')
        .update({
          status: 'done',
          progress_step: 'done',
          result: { success: true, skipped: true, grund: 'bereits_echte_situationen' }
        })
        .eq('id', jobId);
      return { statusCode: 200 };
    }

    ki = await starteKiRequest(supabase, {
      userId: user.id,
      feature: 'audience_situation'
    });

    const input = job.input || {};
    schreibeStep('generieren', 'Claude entwirft Audience Situations');
    const { stable, task } = buildPrompt({
      persona: input.persona || {},
      produkt: input.produkt || {}
    });

    const result = await callClaude({
      model: MODELS.persona,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 2500,
      tool: SITUATION_TOOL,
      toolForced: true
    });

    if (!result.json) {
      throw new Error('Die KI hat kein strukturiertes Ergebnis geliefert');
    }

    const geprueft = validateSituationen(result.json);
    if (!geprueft.situationen.length) {
      throw new Error('Die KI konnte keine tragfähigen Audience Situations ableiten');
    }

    schreibeStep('schreiben', `${geprueft.situationen.length} Situations werden gespeichert`);
    const { error: writeError } = await supabase.rpc('replace_audience_situation_seeds', {
      p_persona_id: job.persona_id,
      p_rows: geprueft.situationen
    });
    if (writeError) throw writeError;

    await ki.abschliessen({ model: result.model, usage: result.usage });

    await queue;
    await supabase.from('audience_situation_jobs')
      .update({
        status: 'done',
        progress_step: 'done',
        result: {
          success: true,
          situationen: geprueft.situationen,
          verworfen: geprueft.verworfen
        }
      })
      .eq('id', jobId);
    return { statusCode: 200 };
  } catch (error) {
    console.error(`❌ audience-situation-background [${jobId}]:`, error.message);
    if (ki) await ki.fehlgeschlagen(error);
    try {
      await queue;
      await supabase.from('audience_situation_jobs')
        .update({ status: 'error', error_message: error.message })
        .eq('id', jobId);
    } catch (_) { /* Job-Update selbst fehlgeschlagen */ }
    return { statusCode: 500 };
  }
};
