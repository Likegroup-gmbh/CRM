// _shared/creator-upload-mail.js
// Einladungs-Mail an den Creator ueber Resend. Bilinguale Platzhalter-Copy
// (DE zuerst, EN darunter) — Philips finale Vorlagen sind Drop-in.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'CreatorJobs24 <uploads@creatorjobs24.de>';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso, locale) {
  try {
    return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function buildMailHtml({ creatorVorname, kampagneName, link, expiresAt }) {
  const name = escapeHtml(creatorVorname || '');
  const kamp = escapeHtml(kampagneName || '');
  const safeLink = escapeHtml(link);
  const dateDe = formatDate(expiresAt, 'de');
  const dateEn = formatDate(expiresAt, 'en');

  return `
<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; line-height: 1.55;">
  <p>Hallo${name ? ` ${name}` : ''},</p>
  <p>für die Kampagne <strong>${kamp}</strong> kannst du dein Rohmaterial jetzt direkt hochladen:</p>
  <p style="margin: 24px 0;">
    <a href="${safeLink}" style="background:#1a1a1a; color:#ffffff; padding:12px 22px; border-radius:8px; text-decoration:none; display:inline-block;">Rohmaterial hochladen</a>
  </p>
  <p>Der Link ist bis zum <strong>${dateDe}</strong> gültig. Du kannst alle Clips auf einmal auswählen — den Schnitt übernehmen wir. Du kannst nichts löschen oder überschreiben.</p>
  <p>Bei Fragen antworte einfach auf diese E-Mail.</p>
  <hr style="border:none; border-top:1px solid #e5e5e5; margin:32px 0;" />
  <p>Hi${name ? ` ${name}` : ''},</p>
  <p>for the campaign <strong>${kamp}</strong> you can now upload your raw footage directly:</p>
  <p style="margin: 24px 0;">
    <a href="${safeLink}" style="background:#1a1a1a; color:#ffffff; padding:12px 22px; border-radius:8px; text-decoration:none; display:inline-block;">Upload raw footage</a>
  </p>
  <p>The link is valid until <strong>${dateEn}</strong>. You can select all your clips at once — we take care of the edit. You cannot delete or overwrite anything.</p>
  <p>If you have any questions, just reply to this email.</p>
</div>`.trim();
}

/**
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function sendCreatorUploadMail({ to, creatorVorname, kampagneName, link, expiresAt }) {
  if (!RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY nicht konfiguriert' };
  }
  const kamp = kampagneName || '';
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject: `Rohmaterial-Upload für ${kamp} / Raw footage upload for ${kamp}`,
      html: buildMailHtml({ creatorVorname, kampagneName, link, expiresAt }),
    }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    console.warn('[creator-upload-mail] Resend fehlgeschlagen:', resp.status, JSON.stringify(data));
    return { ok: false, error: data.message || `Resend ${resp.status}` };
  }
  return { ok: true };
}

module.exports = { sendCreatorUploadMail };
