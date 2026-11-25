// ablage-final-spiegel-background.js
// Finale Version im Finder (ADR 0073): Spiegel-Kopien anlegen, nachziehen und aufraeumen
// (Background Function, bis zu 15 Minuten). Angestossen von ablage-zeitplan, sobald Zeilen
// faellig sind, und von der Admin-Seite ("Finale spiegeln"), geschuetzt ueber x-ablage-secret.
// Pausiert bei Notschalter.

const { secretOk } = require('./_shared/ablage/konfig');
const { ablageAusEnv } = require('./_shared/ablage');
const { createFinalSpiegel } = require('./_shared/ablage/final-spiegel');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!secretOk(event)) return { statusCode: 401, body: 'Nicht autorisiert' };

  const ablage = ablageAusEnv();
  if (!ablage) return { statusCode: 200, body: JSON.stringify({ nicht_konfiguriert: true }) };

  try {
    const r = await createFinalSpiegel({ supabase: ablage.supabase, ablage }).lauf();
    console.log(`[ablage-final-spiegel] ${JSON.stringify(r)}`);
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (err) {
    console.error('[ablage-final-spiegel]', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
