// Netlify Background Function: Briefing-PDF-Extract (Liky)
// Zwei Modi: extract (PDF -> Felder) und chat (History + formData -> Patches).
// Extract: Formularfelder des Creator-Briefing-PDFs werden direkt übernommen, Claude
// belegt nur den Rest. Ist alles belegt, gibt es keinen Claude-Aufruf.
// Die Spec kommt vom Client (briefingFelder.json). Feature-Key: pdf_briefing.

const { callClaude, extractJson, repairJsonStrings, MODELS } = require('./_shared/anthropic');
const { EXTRACT_TOOL, CHAT_TOOL, buildExtractPrompt, buildChatPrompt } = require('./_shared/briefing-pdf-prompt');
const { formularFelder } = require('./_shared/briefing-pdf-formular');
const { withSkriptHandler } = require('./_shared/skript-handler');
const { createJobUpdater } = require('./_shared/job-updater');
const { starteKiRequest } = require('./_shared/ki-log');

// Modelle liefern offene Maps gelegentlich als JSON-String oder als Array
// (die API validiert tool_use.input nicht gegen input_schema). Einmal
// auspacken. Parse-Fehler duerfen den Payload nicht zu {} machen.
function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (_) { /* weiter */ }
  try {
    return JSON.parse(repairJsonStrings(value));
  } catch (_) { /* weiter */ }
  try {
    return extractJson(value);
  } catch (_) {
    return null;
  }
}

function mapFromArray(items) {
  const out = {};
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const named = String(item.name || item.key || '').trim();
    if (named) {
      const { name: _n, key: _k, ...rest } = item;
      out[named] = rest;
      continue;
    }
    // [{ aktivierung_name: { value, kind, from } }]
    const keys = Object.keys(item).filter((k) => !['kind', 'from', 'value', 'force'].includes(k));
    if (keys.length === 1) out[keys[0]] = item[keys[0]];
  }
  return out;
}

function coerceMap(value, key) {
  if (value == null) return {};
  const parsed = parseMaybeJson(value);
  if (parsed == null) {
    console.warn(`[${key}] String nicht parsebar`);
    return {};
  }
  if (typeof value === 'string') console.warn(`[${key}] als String geliefert, geparst`);
  if (Array.isArray(parsed)) {
    const out = mapFromArray(parsed);
    if (!Object.keys(out).length && parsed.length) {
      console.warn(`[${key}] Array ohne erkennbare Feldnamen (${parsed.length} Items)`);
    }
    return out;
  }
  if (parsed && typeof parsed === 'object') return parsed;
  return {};
}

exports.handler = withSkriptHandler(async ({ supabase, user, payload }) => {
  const { jobId, briefing_id: briefingId, modus, spec, formData, userText, history, pdfPath } = payload;
  if (!jobId) return { statusCode: 400, body: 'jobId fehlt' };
  if (!briefingId) return { statusCode: 400, body: 'briefing_id fehlt' };
  if (!modus || !['extract', 'chat'].includes(modus)) {
    return { statusCode: 400, body: 'modus muss extract oder chat sein' };
  }
  if (modus === 'extract' && !pdfPath) {
    return { statusCode: 400, body: 'pdfPath fehlt' };
  }

  // Job atomar claimen (pending -> running)
  const { data: claimed, error: claimError } = await supabase
    .from('briefing_pdf_jobs')
    .update({ status: 'running' })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (claimError) throw new Error(`Job-Claim fehlgeschlagen: ${claimError.message}`);
  if (!claimed) return { statusCode: 409, body: 'Job laeuft bereits oder ist abgeschlossen' };

  const job = createJobUpdater(supabase, jobId, { table: 'briefing_pdf_jobs', withLogs: false });
  const startTime = Date.now();
  let ki = null;

  try {
    const { data: briefing, error: briefingError } = await supabase
      .from('campaign_briefings')
      .select('id, unternehmen_id, marke_id, bereich, ist_altbestand')
      .eq('id', briefingId)
      .single();
    if (briefingError || !briefing) throw new Error('Briefing nicht gefunden');
    if (briefing.ist_altbestand) throw new Error('Altbestand-Linie ohne Briefing: bitte zuerst das Briefing ausfüllen');

    const unternehmenName = briefing.unternehmen_id
      ? (await supabase.from('unternehmen').select('firmenname').eq('id', briefing.unternehmen_id).maybeSingle()).data?.firmenname || null
      : null;
    const markeName = briefing.marke_id
      ? (await supabase.from('marke').select('markenname').eq('id', briefing.marke_id).maybeSingle()).data?.markenname || null
      : null;

    const model = MODELS.extract_briefing;
    const claude = async (opts) => {
      ki = await starteKiRequest(supabase, { userId: user.id, feature: 'pdf_briefing' });
      const antwort = await callClaude({ model, systemBlocks: [{ text: opts.stable, cache: true }], ...opts.call });
      await ki.abschliessen(antwort);
      const json = antwort.json || extractJson(antwort.text);
      if (!json) throw new Error('Keine strukturierte Antwort von Claude');
      return { json, usage: antwort.usage };
    };

    let json;
    let usage = null;

    if (modus === 'extract') {
      job.step('lesen', 'Ich lese das Kundenbriefing…');

      // PDF serverseitig aus dem Storage laden - der Client schickt nur den
      // Pfad, sonst kollidiert das Base64 mit dem Netlify-Body-Limit (413).
      // Der Pfad muss zum Briefing passen: die Service-Role umgeht die
      // Storage-RLS, ohne Abgleich waere jeder erratene Pfad lesbar.
      const { data: kb } = await supabase
        .from('kundenbriefings')
        .select('storage_path')
        .eq('briefing_id', briefingId)
        .maybeSingle();
      if (!kb || kb.storage_path !== pdfPath || !pdfPath.startsWith('kundenbriefings/')) {
        throw new Error('pdfPath gehoert nicht zu diesem Briefing');
      }

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(pdfPath);
      if (downloadError || !fileData) {
        throw new Error(`PDF nicht lesbar: ${downloadError?.message || 'leer'}`);
      }
      const bytes = Buffer.from(await fileData.arrayBuffer());

      const formular = await formularFelder(bytes);
      const rest = (Array.isArray(spec) ? spec : []).filter((f) => !(f.name in formular));
      if (Object.keys(formular).length) job.step('formular', 'Ich übernehme die Formularfelder…');

      if (rest.length) {
        const { stable, task } = buildExtractPrompt({
          spec: rest, unternehmenName, markeName, schonGelesen: Object.keys(formular)
        });
        job.step('auswerten', 'Ich werte das PDF aus…');
        ({ json, usage } = await claude({
          stable,
          call: {
            userPrompt: task,
            maxTokens: 8192,
            tool: EXTRACT_TOOL,
            timeoutMs: 480000,
            document: { base64: bytes.toString('base64'), mediaType: 'application/pdf' }
          }
        }));
      } else {
        json = { fields: {}, missing: [] };
      }
      json.fields = { ...coerceMap(json.fields, 'fields'), ...formular };
    } else {
      job.step('antworten', 'Ich denke nach…');
      const { stable, task, messages } = buildChatPrompt({ spec, history, formData, userText });
      ({ json, usage } = await claude({
        stable,
        call: { userPrompt: task, messages, maxTokens: 4096, tool: CHAT_TOOL, timeoutMs: 120000 }
      }));
      json.fields = coerceMap(json.fields, 'fields');
      json.patches = coerceMap(json.patches, 'patches');
    }

    await job.flushAndUpdate({
      status: 'done',
      result: {
        success: true,
        modus,
        ...json,
        cost: usage,
        dauer_ms: Date.now() - startTime
      }
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error(`[${jobId}] briefing-pdf-background:`, error);
    if (ki) await ki.fehlgeschlagen(error);
    await job.flushAndUpdate({
      status: 'error',
      error_message: error.message,
      result: { success: false, error: error.message }
    });
    return { statusCode: 500, body: error.message };
  }
});
