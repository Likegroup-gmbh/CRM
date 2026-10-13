// _shared/creator-upload-mail.js
// Einladungs-Mail an den Creator ueber Resend. Layout und Texte kommen aus dem
// zentralen Mail-System (templates/creatorUpload.ts), DE zuerst, EN darunter.
// Versand laeuft ueber den zentralen _shared/resend.js Helper.

const { sendResendMail } = require('./resend');
const { creatorUploadMail } = require('./mail-system');

/**
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function sendCreatorUploadMail({ to, creatorVorname, kampagneName, link, expiresAt, basisUrl }) {
  const { betreff, html } = creatorUploadMail({
    creatorVorname,
    kampagneName,
    link,
    expiresAt,
    basisUrl: basisUrl || process.env.APP_BASE_URL || process.env.URL || '',
  });
  return sendResendMail({ to, subject: betreff, html });
}

module.exports = { sendCreatorUploadMail };
