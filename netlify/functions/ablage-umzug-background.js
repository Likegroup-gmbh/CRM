// ablage-umzug-background.js
// Umzug des Bestands nach SharePoint (Background Function, bis zu 15 Minuten). Angestossen von
// ablage-zeitplan (solange Zeilen offen sind, mehrere Laeufer parallel) und von der Admin-Seite
// ("Bestand umziehen"), geschuetzt ueber x-ablage-secret. Pausiert bei Notschalter.

const { secretOk } = require('./_shared/ablage/konfig');
const { ablageAusEnv } = require('./_shared/ablage');
const { createUmzug } = require('./_shared/ablage/umzug');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!secretOk(event)) return { statusCode: 401, body: 'Nicht autorisiert' };

  const ablage = ablageAusEnv();
  if (!ablage) return { statusCode: 200, body: JSON.stringify({ nicht_konfiguriert: true }) };

  try {
    const r = await createUmzug({ supabase: ablage.supabase, ablage }).lauf();
    console.log(`[ablage-umzug] ${JSON.stringify(r)}`);
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (err) {
    console.error('[ablage-umzug]', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
