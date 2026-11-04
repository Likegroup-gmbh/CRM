// vorschau-verarbeiten.js
// Konsument der Vorschau-Outbox (ADR 0061). Angestossen vom Supabase Database Webhook
// (INSERT auf kooperation_video_vorschau_auftrag) mit Header x-vorschau-secret. Der
// Inhalt des Webhooks ist egal: die Function claimt faellige Auftraege selbst
// (gedrosselt), ein verlorener Anstoss faellt dem Sweeper zu.

const crypto = require('crypto');
const { vorschauAusEnv } = require('./_shared/vorschau-verarbeitung');

function secretOk(event) {
  const expected = process.env.VORSCHAU_WEBHOOK_SECRET || '';
  const given = String((event.headers || {})['x-vorschau-secret'] || '');
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!secretOk(event)) return json(401, { error: 'Nicht autorisiert' });
  try {
    const results = await vorschauAusEnv().verarbeiteAuftraege();
    return json(200, { results });
  } catch (err) {
    console.error('[vorschau-verarbeiten]', err);
    return json(500, { error: err.message });
  }
};

exports._secretOk = secretOk;
