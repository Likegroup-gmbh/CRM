// _shared/resend.js
// Zentraler Resend-Versand fuer Netlify Functions (Node).
// Deno-Edge (share-list) bleibt unveraendert — eigene Runtime.

const RESEND_API_KEY = process.env.RESEND_API_KEY;

function normalizeFrom(raw) {
  const fallback = 'LikeGroup <uploads@creatorjobs24.de>';
  const value = String(raw || '').trim();
  if (!value) return fallback;
  return value
    .replace(/\bCreatorJobs24\b/gi, 'LikeGroup')
    .replace(/\bnoreply@/gi, 'hello@');
}

function getFrom() {
  return normalizeFrom(process.env.RESEND_FROM);
}

/**
 * Eine Mail ueber Resend senden.
 * @param {Object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {Array<{ filename: string, content: string }>} [opts.attachments] - content = base64
 * @returns {Promise<{ ok: boolean, id?: string, error?: string }>}
 */
async function sendResendMail({ to, subject, html, attachments }) {
  if (!RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY nicht konfiguriert' };
  }
  const from = getFrom();
  const payload = { from, reply_to: from, to: [to], subject, html };
  if (attachments?.length) payload.attachments = attachments;

  let resp;
  try {
    resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { ok: false, error: `Resend nicht erreichbar: ${err?.message || err}` };
  }

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.warn('[resend] Versand fehlgeschlagen:', resp.status, JSON.stringify(data));
    return { ok: false, error: data.message || `Resend ${resp.status}` };
  }
  return { ok: true, id: data.id || null };
}

module.exports = { sendResendMail, normalizeFrom, getFrom };
