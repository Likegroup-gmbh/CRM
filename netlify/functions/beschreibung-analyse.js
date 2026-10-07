// Synchrone Function: Beschreibung einer Videoreferenz neu analysieren.
// Nutzt gespeichertes Transkript und Caption. Kein erneutes Scrapen.

const { withSkriptHandler } = require('./_shared/skript-handler');
const { KiLimitError } = require('./_shared/ki-log');
const { ersetzeBeschreibung } = require('./_shared/beschreibung-analyse');

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
    const beschreibung = await ersetzeBeschreibung(supabase, { userId: user.id, itemId });
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ beschreibung })
    };
  } catch (e) {
    const status = e instanceof KiLimitError ? 429 : 400;
    return {
      statusCode: status,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: e.message || 'Analyse fehlgeschlagen' })
    };
  }
});
