// ablage-webhook.js
// Oeffentlicher Endpunkt fuer Graph-Change-Notifications (driveItem-Abo auf die Bibliothek).
// Validierung: validationToken als text/plain in unter 10 s zurueck.
// Meldungen: clientState pruefen, Abgleich anstossen, 202 in unter 3 s (sonst wiederholt Graph).
// Die Meldung traegt keine Daten; der Abgleich liest den Delta-Feed.

const crypto = require('crypto');
const { sharePointKonfig, serviceClient, anstossen, parseBody } = require('./_shared/ablage/konfig');

function gleich(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

exports.handler = async (event) => {
  const token = event.queryStringParameters?.validationToken;
  if (token) {
    return { statusCode: 200, headers: { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' }, body: token };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' };

  const konfig = sharePointKonfig();
  const meldungen = parseBody(event)?.value;
  const echt = Array.isArray(meldungen) ? meldungen.filter((m) => gleich(m?.clientState, konfig.clientState)) : [];
  if (echt.length) {
    const supabase = serviceClient();
    await Promise.all([
      supabase
        ? supabase.from('ablage_stand').update({ letzte_meldung: new Date().toISOString() }).eq('drive_id', konfig.driveId).then(() => {}, () => {})
        : null,
      anstossen(event, 'ablage-abgleich-background', { grund: 'webhook' }, { timeoutMs: 1500 }),
    ]);
  }
  return { statusCode: 202, body: '' };
};
