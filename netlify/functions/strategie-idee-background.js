// strategie-idee-background.js
// Netlify Background Function: Videoidee-Vorschlaege fuer ein Konzept (ADR 0015).
// Muster wie casting-vorschlag-background: der Client legt die Zeile in
// strategie_idee_jobs an, POSTet { jobId } hierher und pollt die Zeile.
// Diese Function schreibt Fortschritt, Ergebnis oder Fehler per Service Role
// und inseriert flagged strategie_items (ist_vorschlag). Additiv, kein Replace.

const { createClient } = require('@supabase/supabase-js');
const { callClaude, MODELS } = require('./_shared/anthropic');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');
const { starteKiRequest } = require('./_shared/ki-log');
const { appendStep } = require('./_shared/thinking');
const {
  ANZAHL,
  KONZEPT_TOOL,
  loadIdeeInput,
  buildPrompt,
  validateIdeen,
  buildVorschlagInsert
} = require('./_shared/strategie-idee');

const THINKING_LABELS = {
  start: 'Ich lese Briefing, Produkt und Personas',
  generieren: 'Ich entwerfe die Videoideen',
  pruefen: 'Ich prüfe die Ideen gegen den Bestand'
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ strategie-idee-background: Supabase-Konfiguration fehlt');
    return { statusCode: 500 };
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  let jobId;
  try {
    ({ jobId } = JSON.parse(event.body || '{}'));
  } catch (_) {
    return { statusCode: 400 };
  }
  if (!jobId) return { statusCode: 400 };

  const markJobError = async (message) => {
    try {
      await supabase.from('strategie_idee_jobs')
        .update({ status: 'error', error_message: message })
        .eq('id', jobId)
        .eq('status', 'pending');
    } catch (e) {
      console.error(`[${jobId}] Job-Fehler konnte nicht geschrieben werden:`, e.message);
    }
  };

  const auth = await verifyAuth(event, supabase);
  if (!auth.user) {
    const body = authErrorBody(auth);
    if (auth.code === 'auth_unavailable') await markJobError(body.error);
    return {
      statusCode: auth.code === 'auth_unavailable' ? 503 : 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    };
  }
  const { user } = auth;

  const { data: job } = await supabase.from('strategie_idee_jobs')
    .select('id, strategie_id, status, created_by')
    .eq('id', jobId).single();
  if (!job || job.created_by !== user.id) {
    console.error(`❌ strategie-idee-background: Job ${jobId} nicht gefunden oder fremd`);
    return { statusCode: 404 };
  }
  if (job.status !== 'pending') {
    console.warn(`⚠️ strategie-idee-background: Job ${jobId} bereits ${job.status}, kein zweiter Lauf`);
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
      .then(() => supabase.from('strategie_idee_jobs').update({
        status: 'running',
        progress_step: step,
        progress_steps: steps
      }).eq('id', jobId))
      .catch((e) => console.error(`[${jobId}] Job-Update fehlgeschlagen:`, e.message));
  };

  schreibeStep('start', 'Videoideen-Vorschläge starten');

  let ki = null;
  try {
    const input = await loadIdeeInput(supabase, job.strategie_id);

    ki = await starteKiRequest(supabase, {
      userId: user.id,
      feature: 'strategie_idee'
    });

    schreibeStep('generieren', `Claude entwirft ${ANZAHL} Videoideen`);
    const { stable, task } = buildPrompt(input);

    const result = await callClaude({
      model: MODELS.konzept,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 8000,
      tool: KONZEPT_TOOL,
      toolForced: true
    });

    if (!result.json) {
      throw new Error('Die KI hat kein strukturiertes Ergebnis geliefert');
    }

    schreibeStep('pruefen', 'Ideen werden validiert');
    const geprueft = validateIdeen(result.json, { ausschluss: input.ausschluss, anzahl: ANZAHL });
    if (!geprueft.ideen.length) {
      throw new Error('Die KI konnte keine tragfähigen Videoideen liefern');
    }

    await ki.abschliessen({ model: result.model, usage: result.usage });

    // strategie_items.created_by -> benutzer(id), nicht auth.users
    const { data: benutzer } = await supabase.from('benutzer')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    const { data: maxRow } = await supabase.from('strategie_items')
      .select('sortierung')
      .eq('strategie_id', job.strategie_id)
      .order('sortierung', { ascending: false })
      .limit(1)
      .maybeSingle();
    let sortierung = Number.isFinite(maxRow?.sortierung) ? maxRow.sortierung + 1 : 0;

    const rows = geprueft.ideen.map((idee) => buildVorschlagInsert({
      strategieId: job.strategie_id,
      idee,
      sortierung: sortierung++,
      createdBy: benutzer?.id || null
    }));

    const { error: insertError } = await supabase.from('strategie_items').insert(rows);
    if (insertError) throw new Error(`Ideen konnten nicht gespeichert werden: ${insertError.message}`);

    const payload = {
      success: true,
      anzahl: rows.length,
      verworfen: geprueft.verworfen
    };

    await queue;
    await supabase.from('strategie_idee_jobs')
      .update({ status: 'done', progress_step: 'done', result: payload })
      .eq('id', jobId);
    return { statusCode: 200 };
  } catch (error) {
    console.error(`❌ strategie-idee-background [${jobId}]:`, error.message);
    if (ki) await ki.fehlgeschlagen(error);
    try {
      await queue;
      await supabase.from('strategie_idee_jobs')
        .update({ status: 'error', error_message: error.message })
        .eq('id', jobId);
    } catch (_) { /* Job-Update selbst fehlgeschlagen */ }
    return { statusCode: 500 };
  }
};
