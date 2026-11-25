// ablage-abgleich-background.js
// Ablage-Abgleich SharePoint -> CRM (Background Function: antwortet sofort 202, laeuft bis zu
// 15 Minuten). Angestossen von ablage-webhook, ablage-zeitplan und der Admin-Seite, geschuetzt
// ueber x-ablage-secret. Ein Laeufer je Bibliothek (Lease); weitere Aufrufe enden sofort.
// Body (optional): { pflege: true } erzwingt Namensabgleich und Aufraeumen.

const { secretOk, parseBody, anstossen } = require('./_shared/ablage/konfig');
const { ablageAusEnv } = require('./_shared/ablage');
const { createAbgleich } = require('./_shared/ablage/abgleich');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!secretOk(event)) return { statusCode: 401, body: 'Nicht autorisiert' };

  const ablage = ablageAusEnv();
  if (!ablage) return { statusCode: 200, body: JSON.stringify({ nicht_konfiguriert: true }) };
  const body = parseBody(event) || {};

  try {
    const r = await createAbgleich({ supabase: ablage.supabase, ablage }).lauf({ pflege: body.pflege === true ? true : 'auto' });
    console.log(`[ablage-abgleich] ${JSON.stringify(r)}`);
    if (r.mehr) await anstossen(event, 'ablage-abgleich-background');
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (err) {
    console.error('[ablage-abgleich]', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
