// persona-liky-background.js
// Netlify Background Function: Liky-Chat am Persona-Worksheet.
// URL-Extract bleibt auf site-extract-background / extract_jobs.
// Feature-Key: persona_liky.

const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');
const { withSkriptHandler } = require('./_shared/skript-handler');
const { createJobUpdater } = require('./_shared/job-updater');
const { starteKiRequest } = require('./_shared/ki-log');
const { CHAT_TOOL, buildChatPrompt, sanitizeChatResult } = require('./_shared/persona-liky');

exports.handler = withSkriptHandler(async ({ supabase, user, payload }) => {
  const { jobId, userText, formData, history } = payload || {};
  if (!jobId) return { statusCode: 400, body: 'jobId fehlt' };
  if (!String(userText || '').trim()) return { statusCode: 400, body: 'userText fehlt' };

  const { data: claimed, error: claimError } = await supabase
    .from('persona_liky_jobs')
    .update({ status: 'running' })
    .eq('id', jobId)
    .eq('status', 'pending')
    .eq('created_by', user.id)
    .select('id')
    .maybeSingle();
  if (claimError) throw new Error(`Job-Claim fehlgeschlagen: ${claimError.message}`);
  if (!claimed) return { statusCode: 409, body: 'Job laeuft bereits oder ist abgeschlossen' };

  const job = createJobUpdater(supabase, jobId, { table: 'persona_liky_jobs', withLogs: false });
  const startTime = Date.now();
  let ki = null;

  try {
    ki = await starteKiRequest(supabase, { userId: user.id, feature: 'persona_liky' });
    job.step('antworten', 'Ich denke nach…');

    const { stable, task } = buildChatPrompt({
      history: Array.isArray(history) ? history : [],
      formData: formData && typeof formData === 'object' ? formData : {},
      userText: String(userText).trim()
    });

    const result = await callClaude({
      model: MODELS.persona,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 4096,
      tool: CHAT_TOOL,
      timeoutMs: 120000
    });

    await ki.abschliessen(result);

    const json = result.json || extractJson(result.text);
    if (!json) throw new Error('Keine strukturierte Antwort von Claude');

    const cleaned = sanitizeChatResult(json);

    await job.flushAndUpdate({
      status: 'done',
      result: {
        success: true,
        modus: 'chat',
        ...cleaned,
        cost: result.usage,
        dauer_ms: Date.now() - startTime
      }
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error(`[${jobId}] persona-liky-background:`, error);
    if (ki) await ki.fehlgeschlagen(error);
    await job.flushAndUpdate({
      status: 'error',
      error_message: error.message,
      result: { success: false, error: error.message }
    });
    return { statusCode: 500, body: error.message };
  }
});
