// persona-liky-background.js
// Netlify Background Function: Liky am Persona-Worksheet.
// Zwei Modi: chat (Freitext) und extract (PDF -> Felder).
// URL-Extract bleibt auf site-extract-background / extract_jobs.
// Feature-Key: persona_liky.

const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');
const { withSkriptHandler } = require('./_shared/skript-handler');
const { createJobUpdater } = require('./_shared/job-updater');
const { starteKiRequest } = require('./_shared/ki-log');
const {
  CHAT_TOOL,
  EXTRACT_TOOL,
  buildChatPrompt,
  buildExtractPrompt,
  sanitizeChatResult,
  sanitizeExtractResult
} = require('./_shared/persona-liky');

const PDF_PREFIX = 'persona-liky/';

exports.handler = withSkriptHandler(async ({ supabase, user, payload }) => {
  const { jobId, userText, formData, history, pdfPath } = payload || {};
  const modus = payload?.modus === 'extract' ? 'extract' : 'chat';
  if (!jobId) return { statusCode: 400, body: 'jobId fehlt' };
  if (modus === 'extract' && !pdfPath) return { statusCode: 400, body: 'pdfPath fehlt' };
  if (modus === 'chat' && !String(userText || '').trim()) {
    return { statusCode: 400, body: 'userText fehlt' };
  }

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

    let result;
    let cleaned;

    if (modus === 'extract') {
      const expectedPrefix = `${PDF_PREFIX}${user.id}/`;
      if (!String(pdfPath).startsWith(expectedPrefix)) {
        throw new Error('pdfPath gehoert nicht zu diesem User');
      }

      job.step('lesen', 'Ich lese das PDF…');
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(pdfPath);
      if (downloadError || !fileData) {
        throw new Error(`PDF nicht lesbar: ${downloadError?.message || 'leer'}`);
      }
      const pdfBase64 = Buffer.from(await fileData.arrayBuffer()).toString('base64');

      const { stable, task } = buildExtractPrompt();
      job.step('auswerten', 'Ich werte das PDF aus…');
      result = await callClaude({
        model: MODELS.persona,
        systemBlocks: [{ text: stable, cache: true }],
        userPrompt: task,
        maxTokens: 4096,
        tool: EXTRACT_TOOL,
        timeoutMs: 180000,
        document: { base64: pdfBase64, mediaType: 'application/pdf' }
      });
      const json = result.json || extractJson(result.text);
      if (!json) throw new Error('Keine strukturierte Antwort von Claude');
      cleaned = sanitizeExtractResult(json);
    } else {
      job.step('antworten', 'Ich denke nach…');
      const { stable, task, messages } = buildChatPrompt({
        history: Array.isArray(history) ? history : [],
        formData: formData && typeof formData === 'object' ? formData : {},
        userText: String(userText).trim()
      });
      result = await callClaude({
        model: MODELS.persona,
        systemBlocks: [{ text: stable, cache: true }],
        userPrompt: task,
        messages,
        maxTokens: 4096,
        tool: CHAT_TOOL,
        timeoutMs: 120000
      });
      const json = result.json || extractJson(result.text);
      if (!json) throw new Error('Keine strukturierte Antwort von Claude');
      cleaned = sanitizeChatResult(json);
    }

    await ki.abschliessen(result);

    await job.flushAndUpdate({
      status: 'done',
      result: {
        success: true,
        modus,
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
