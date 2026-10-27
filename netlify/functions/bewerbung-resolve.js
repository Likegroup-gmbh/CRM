// Oeffentlich: Token zeigt Briefing und die eigenen Bewerbungen.

const { getServiceClient, loadByToken, json, parseBody } = require('./_shared/bewerbung');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const body = parseBody(event);
  if (!body?.token) return json(400, { error: 'Link fehlt' });
  try {
    const found = await loadByToken(getServiceClient(), body.token);
    if (!found) return json(404, { error: 'Link ungültig' });
    return json(200, found.payload);
  } catch (err) {
    console.error('[bewerbung-resolve]', err);
    const missing = /Service-Konfiguration/.test(err.message || '');
    return json(500, {
      error: missing
        ? 'Lokal fehlt SUPABASE_URL oder SUPABASE_SERVICE_KEY.'
        : 'Die Seite konnte nicht geladen werden',
    });
  }
};
