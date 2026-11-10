// Netlify Background Function: Produkt-PDF auslesen.
// Der Client legt eine extract_jobs-Zeile an (url = "pdf:<storage-pfad>"),
// laedt das PDF nach documents/produkt-pdfs/{userId}/ und pollt die Zeile.
// Felder kommen aus derselben Spec wie die Shop-URL (extract-specs.js).

const { createClient } = require('@supabase/supabase-js');
const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');
const { getSpec, hasSpec, buildFieldInstructions } = require('./_shared/extract-specs');
const { normalizeFields, normalizeVarianten } = require('./site-extract-utils/extract-core');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');
const { starteKiRequest } = require('./_shared/ki-log');
const { appendStep } = require('./_shared/thinking');
const { parseProduktPdfPath } = require('./_shared/produkt-pdf-path');

const THINKING_LABELS = {
  start: 'Ich lese das PDF',
  lesen: 'PDF wird geladen',
  auswerten: 'USPs und Pain Points werden durchsucht'
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('produkt-pdf-background: Supabase-Konfiguration fehlt');
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

  const { data: job } = await supabase.from('extract_jobs')
    .select('id, url, entity_type, status, created_by')
    .eq('id', jobId).single();
  if (!job || job.created_by !== user.id) return { statusCode: 404 };
  if (job.status !== 'pending') return { statusCode: 409 };

  const pdfPath = parseProduktPdfPath(job.url, job.created_by);
  if (!pdfPath || job.entity_type !== 'produkt' || !hasSpec('produkt')) {
    await supabase.from('extract_jobs')
      .update({ status: 'error', error_message: 'PDF-Pfad oder Extraktions-Profil ungültig' })
      .eq('id', jobId);
    return { statusCode: 400 };
  }

  let progressSteps = [];
  let queue = Promise.resolve();
  const schreibeStep = (step) => {
    progressSteps = appendStep(progressSteps, {
      step,
      label: THINKING_LABELS[step] || 'Ich arbeite'
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

  schreibeStep('start');

  let ki = null;
  try {
    ki = await starteKiRequest(supabase, { userId: user.id, feature: 'pdf_extract_produkt' });

    schreibeStep('lesen');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(pdfPath);
    if (downloadError || !fileData) {
      throw new Error(`PDF nicht lesbar: ${downloadError?.message || 'leer'}`);
    }
    const pdfBase64 = Buffer.from(await fileData.arrayBuffer()).toString('base64');

    const spec = getSpec('produkt');
    schreibeStep('auswerten');
    const completion = await callClaude({
      model: MODELS[spec.model] || MODELS.extract,
      systemBlocks: [{
        text: 'Du liest ein Produkt-PDF (Datenblatt, Katalog, Kundenunterlage). '
          + 'Antworte nur mit einem JSON-Objekt. Schlüssel sind die Feldnamen, Werte sind Strings. '
          + 'Zahlen als Dezimalzahl mit Punkt, ohne Währung. Was nicht im PDF steht, weglassen. Nichts erfinden.',
        cache: true
      }, {
        text: `Feldkatalog:\n${buildFieldInstructions(spec)}`,
        cache: true
      }],
      userPrompt: 'Lies das angehängte PDF und gib die Felder als JSON zurück.',
      maxTokens: spec.maxTokens || 4000,
      timeoutMs: 180000,
      document: { base64: pdfBase64, mediaType: 'application/pdf' }
    });

    const parsed = extractJson(completion.text);
    if (!parsed || typeof parsed !== 'object') throw new Error('Antwort des Modells nicht lesbar');

    const fields = normalizeFields(parsed, spec);
    const varianten = normalizeVarianten(parsed._varianten, spec);
    await ki.abschliessen(completion);
    await queue;
    await supabase.from('extract_jobs').update({
      status: 'done',
      progress_step: 'done',
      result: { success: true, fields, varianten, images: [], notes: [] }
    }).eq('id', jobId);
    return { statusCode: 200 };
  } catch (error) {
    console.error(`produkt-pdf-background [${jobId}]:`, error.message);
    if (ki) await ki.fehlgeschlagen(error);
    try {
      await queue;
      await supabase.from('extract_jobs')
        .update({ status: 'error', error_message: error.message })
        .eq('id', jobId);
    } catch (_) { /* Job-Update selbst fehlgeschlagen */ }
    return { statusCode: 500 };
  }
};
