// Synchrone Function: Kundenadaption einer Videoreferenz neu schreiben.
// Nutzt gespeichertes Transkript, Caption, Beschreibung und Umsetzungsvorgabe.
// Kein erneutes Scrapen.

const { withSkriptHandler } = require('./_shared/skript-handler');
const { KiLimitError } = require('./_shared/ki-log');
const { ersetzeKundenadaption } = require('./_shared/kundenadaption');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

exports.handler = withSkriptHandler(async ({ supabase, user, payload }) => {
  const itemId = payload?.itemId;
  if (!itemId) {
    return {
      statusCode: 400,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'itemId erforderlich' })
    };
  }

  try {
    const kundenadaption = await ersetzeKundenadaption(supabase, { userId: user.id, itemId });
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ kundenadaption })
    };
  } catch (e) {
    const status = e instanceof KiLimitError ? 429 : 400;
    return {
      statusCode: status,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: e.message || 'Kundenadaption fehlgeschlagen' })
    };
  }
});
