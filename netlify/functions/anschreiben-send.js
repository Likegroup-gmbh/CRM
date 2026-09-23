// anschreiben-send.js
// Anschreiben: E-Mail mit PDF-Anhang an adressierbare Empfaenger
// (creator.mail / management.email, am Skript auch ansprechpartner.email).
// Eine Mail pro Empfaenger, kein BCC. Mehrere PDFs sind mehrere Anhaenge
// derselben Mail. Skript haengt die PDFs an den Empfaenger, jeder bekommt
// nur seine Skripte. Briefing und Vertrag bleiben beim gemeinsamen Anhang.
// Server ist Quelle: Empfaenger werden hier per ID aufgeloest und die
// Platzhalter serverseitig gemerged — der Client schickt nur IDs + Template.
//
// Sync Function (nicht background): Background-Invocations sind auf 256 KB
// Payload begrenzt, das PDF-Base64 passt da nicht durch. Log-Zeilen werden
// zuerst pending geschrieben, dann pro Empfaenger aktualisiert.
//
// Der Kern (sendAnschreiben) bekommt seine Abhaengigkeiten injiziert,
// damit er ohne Netlify/Env testbar ist.

const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const { verifyAuth, requireInternal, authErrorBody } = require('./_shared/verify-auth');
const { sendResendMail } = require('./_shared/resend');
const { loadDokumentContext, getDokumentAdapter } = require('./_shared/anschreiben-dokumente');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_PDF_BYTES = 4_500_000; // Base64-Laenge: ~3,3 MB PDF; Netlify Body-Limit sync = 6 MB
const CONCURRENCY = 5;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function getServiceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('Supabase Service-Konfiguration fehlt');
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── Platzhalter (Mini-Mustache: {{var}} + {{#var}}…{{/var}}) ──

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mergeTemplate(template, ctx) {
  let out = String(template || '');
  // Sektionen: nur rendern, wenn der Wert truthy ist
  out = out.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) =>
    ctx[key] ? inner.replace(/\{\{(\w+)\}\}/g, (m, k) => escapeHtml(ctx[k] ?? m)) : '');
  out = out.replace(/\{\{(\w+)\}\}/g, (m, key) =>
    key in ctx ? escapeHtml(ctx[key] ?? '') : m);
  return out;
}

function textToHtml(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// ─── Empfaenger-Aufloesung (Server ist Quelle) ───────────────

async function resolveEmpfaenger(supabase, typ, id) {
  if (typ === 'creator') {
    const { data, error } = await supabase
      .from('creator')
      .select('id, vorname, nachname, mail')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data?.mail) return null;
    return {
      email: data.mail,
      vorname: data.vorname || '',
      name: [data.vorname, data.nachname].filter(Boolean).join(' '),
    };
  }
  if (typ === 'management') {
    const { data, error } = await supabase
      .from('management')
      .select('id, firmenname, email')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data?.email) return null;
    return { email: data.email, vorname: '', name: data.firmenname || '' };
  }
  if (typ === 'ansprechpartner') {
    const { data, error } = await supabase
      .from('ansprechpartner')
      .select('id, vorname, nachname, email')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data?.email) return null;
    return {
      email: data.email,
      vorname: data.vorname || '',
      name: [data.vorname, data.nachname].filter(Boolean).join(' '),
    };
  }
  return null;
}

function attachmentsFromPayload({ pdfs, pdfBase64, dateiname, defaultFilename }) {
  if (Array.isArray(pdfs) && pdfs.length > 0) {
    const list = [];
    for (const item of pdfs) {
      if (!item?.pdfBase64) return { error: 'PDF fehlt' };
      list.push({
        filename: item.dateiname || defaultFilename || 'skript.pdf',
        content: item.pdfBase64,
      });
    }
    return { list };
  }
  if (!pdfBase64) return { error: 'PDF fehlt' };
  return {
    list: [{ filename: dateiname || defaultFilename || 'dokument.pdf', content: pdfBase64 }],
  };
}

// ─── Kern (injizierte Deps, testbar) ─────────────────────────

/**
 * @param {Object} deps
 * @param {Object} deps.supabase - Service-Client
 * @param {(mail: Object) => Promise<{ok: boolean, id?: string, error?: string}>} deps.sendMail
 * @param {string} deps.benutzerId - created_by fuer das Log
 * @param {Object} payload - { dokumentTyp, dokumentId, empfaenger, betreff, body, vorlageId, dateiname, pdfBase64, pdfs }
 * @returns {Promise<{ status: number, body: Object }>}
 */
async function sendAnschreiben({ supabase, sendMail, benutzerId }, payload) {
  const { dokumentTyp, dokumentId, empfaenger, betreff, body: mailBody, vorlageId, dateiname, pdfBase64, pdfs } = payload;
  if (!dokumentTyp || !dokumentId) return { status: 400, body: { error: 'dokumentTyp/dokumentId fehlen' } };
  if (!Array.isArray(empfaenger) || empfaenger.length === 0) return { status: 400, body: { error: 'Keine Empfaenger' } };
  if (!betreff?.trim() || !mailBody?.trim()) return { status: 400, body: { error: 'Betreff/Text fehlen' } };

  const adapter = getDokumentAdapter(dokumentTyp);
  const loaded = await loadDokumentContext(supabase, dokumentTyp, dokumentId);
  const { ctx, error: docError, defaultFilename } = loaded;
  if (docError) return { status: 400, body: { error: docError } };

  // Dedup nach (typ, id) — der Composer dedupt schon, der Server vertraut nicht
  const seen = new Set();
  const uniqueEmpfaenger = empfaenger.filter((e) => {
    const k = `${e.typ}:${e.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const perRecipient = uniqueEmpfaenger.some((e) => Array.isArray(e.pdfs) && e.pdfs.length);
  const attachmentByKey = new Map();
  let sharedAttachment = null;

  if (perRecipient) {
    for (const e of uniqueEmpfaenger) {
      if (!Array.isArray(e.pdfs) || !e.pdfs.length) continue;
      const packed = attachmentsFromPayload({ pdfs: e.pdfs, defaultFilename });
      if (packed.error) return { status: 400, body: { error: packed.error } };
      const bytes = packed.list.reduce((sum, item) => sum + Buffer.byteLength(item.content, 'utf8'), 0);
      if (bytes > MAX_PDF_BYTES) return { status: 413, body: { error: 'PDF zu gross' } };
      attachmentByKey.set(`${e.typ}:${e.id}`, packed.list);
    }
  } else {
    let resolvedPdfs = pdfs;
    let resolvedBase64 = pdfBase64;
    let resolvedName = dateiname;
    if (!(Array.isArray(resolvedPdfs) && resolvedPdfs.length) && !resolvedBase64 && adapter?.downloadPdf) {
      const downloaded = await adapter.downloadPdf(supabase, dokumentId);
      if (downloaded.error) return { status: 400, body: { error: downloaded.error } };
      resolvedBase64 = downloaded.pdfBase64;
      resolvedName = resolvedName || downloaded.dateiname;
    }
    const packed = attachmentsFromPayload({
      pdfs: resolvedPdfs,
      pdfBase64: resolvedBase64,
      dateiname: resolvedName,
      defaultFilename,
    });
    if (packed.error) return { status: 400, body: { error: packed.error } };
    const attachmentBytes = packed.list.reduce((sum, item) => sum + Buffer.byteLength(item.content, 'utf8'), 0);
    if (attachmentBytes > MAX_PDF_BYTES) return { status: 413, body: { error: 'PDF zu gross' } };
    sharedAttachment = packed.list;
  }

  const batchId = randomUUID();

  // Log-Zeilen zuerst pending
  const rows = uniqueEmpfaenger.map((e) => ({
    batch_id: batchId,
    dokument_typ: dokumentTyp,
    dokument_id: dokumentId,
    empfaenger_typ: e.typ,
    empfaenger_id: e.id,
    email: '', // wird nach Aufloesung gesetzt
    vorlage_id: vorlageId || null,
    betreff,
    status: 'pending',
    created_by: benutzerId,
  }));
  const { data: logRows, error: logError } = await supabase
    .from('anschreiben_log')
    .insert(rows)
    .select('id, empfaenger_typ, empfaenger_id');
  if (logError) throw logError;

  const logIdByKey = new Map(
    (logRows || []).map((r) => [`${r.empfaenger_typ}:${r.empfaenger_id}`, r.id])
  );

  let sent = 0;
  let failed = 0;

  const sendOne = async (e) => {
    const logId = logIdByKey.get(`${e.typ}:${e.id}`);
    const update = (fields) =>
      logId ? supabase.from('anschreiben_log').update(fields).eq('id', logId) : null;

    const resolved = await resolveEmpfaenger(supabase, e.typ, e.id);
    if (!resolved) {
      failed += 1;
      await update({ status: 'error', error: 'Keine E-Mail am Datensatz' });
      return;
    }

    const mergedCtx = { ...ctx, vorname: resolved.vorname, name: resolved.name };
    const subject = mergeTemplate(betreff, mergedCtx);
    const html = textToHtml(mergeTemplate(mailBody, mergedCtx));

    const attachment = attachmentByKey.get(`${e.typ}:${e.id}`) || sharedAttachment;
    if (!attachment?.length) {
      failed += 1;
      await update({ status: 'error', error: 'PDF fehlt' });
      return;
    }
    const result = await sendMail({ to: resolved.email, subject, html, attachments: attachment });
    if (result.ok) {
      sent += 1;
      await update({ status: 'sent', email: resolved.email, resend_id: result.id, sent_at: new Date().toISOString() });
    } else {
      failed += 1;
      await update({ status: 'error', email: resolved.email, error: result.error });
    }
  };

  // Concurrency-begrenzt abarbeiten
  for (let i = 0; i < uniqueEmpfaenger.length; i += CONCURRENCY) {
    const chunk = uniqueEmpfaenger.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(chunk.map(sendOne));
    for (const r of results) {
      if (r.status === 'rejected') {
        failed += 1;
        console.error('[anschreiben-send] Empfaenger fehlgeschlagen:', r.reason);
      }
    }
  }

  if (sent > 0 && adapter?.afterSend) {
    await adapter.afterSend(supabase, { dokumentId, sent });
  }

  return { status: 200, body: { batchId, sent, failed, total: uniqueEmpfaenger.length } };
}

// ─── Handler ─────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const supabase = getServiceClient();
    const auth = await verifyAuth(event, supabase);
    if (!auth.user) return json(401, authErrorBody(auth));
    const internal = await requireInternal(supabase, auth.user);
    if (!internal.ok) return internal.response;

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'Ungueltiger Request' });
    }

    const result = await sendAnschreiben(
      { supabase, sendMail: sendResendMail, benutzerId: internal.benutzer.id },
      body
    );
    return json(result.status, result.body);
  } catch (err) {
    console.error('[anschreiben-send]', err);
    return json(500, { error: 'Interner Fehler' });
  }
};

module.exports.sendAnschreiben = sendAnschreiben;
module.exports.mergeTemplate = mergeTemplate;
module.exports.textToHtml = textToHtml;
module.exports.resolveEmpfaenger = resolveEmpfaenger;
module.exports.loadDokumentContext = loadDokumentContext;
