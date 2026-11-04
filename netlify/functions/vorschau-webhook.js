// vorschau-webhook.js
// Webhook von Cloudflare Stream (Video fertig oder fehlgeschlagen), ADR 0061.
// Prueft die Signatur ueber den rohen Body, dann idempotent: dasselbe Ereignis
// zweimal aendert nichts, ein verspaetetes Ereignis einer alten Revision schreibt
// nur seinen eigenen Datensatz. Cloudflare liefert at-least-once; was hier verloren
// geht, holt der Sweeper per Abgleich nach.

const { streamConfig, verifyWebhookSignature } = require('./_shared/cloudflare-stream');
const { vorschauAusEnv } = require('./_shared/vorschau-verarbeitung');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');
  const headers = event.headers || {};
  const signature = headers['webhook-signature'] || headers['Webhook-Signature'];
  if (!verifyWebhookSignature(streamConfig().webhookSecret, signature, raw)) {
    return json(401, { error: 'Signatur ungueltig' });
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: 'Kein JSON' });
  }

  try {
    const ergebnis = await vorschauAusEnv().webhook(payload);
    console.log(`[vorschau-webhook] ${payload.uid}: ${ergebnis}`);
    return json(200, { ergebnis });
  } catch (err) {
    console.error('[vorschau-webhook]', payload?.uid, err);
    return json(500, { error: err.message });
  }
};
