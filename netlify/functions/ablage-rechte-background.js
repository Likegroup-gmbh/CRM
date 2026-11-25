// ablage-rechte-background.js
// Rechte-Abgleich CRM -> SharePoint (Background Function, bis zu 15 Minuten). Angestossen von
// ablage-zeitplan (sofort bei rechte_faellig, sonst alle 15 Minuten) und der Admin-Seite,
// geschuetzt ueber x-ablage-secret. Ein Laeufer je Bibliothek (Lease); weitere enden sofort.

const { secretOk } = require('./_shared/ablage/konfig');
const { ablageAusEnv } = require('./_shared/ablage');
const { createRechteAbgleich } = require('./_shared/ablage/rechte');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!secretOk(event)) return { statusCode: 401, body: 'Nicht autorisiert' };

  const ablage = ablageAusEnv();
  if (!ablage) return { statusCode: 200, body: JSON.stringify({ nicht_konfiguriert: true }) };

  try {
    const r = await createRechteAbgleich({ supabase: ablage.supabase, ablage }).lauf();
    console.log(`[ablage-rechte] ${JSON.stringify(r)}`);
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (err) {
    console.error('[ablage-rechte]', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
