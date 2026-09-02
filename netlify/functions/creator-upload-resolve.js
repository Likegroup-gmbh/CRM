// creator-upload-resolve.js
// Oeffentlicher Endpoint: Token -> minimale Upload-Uebersicht.
// Kein Anon-Key, keine URLs/Pfade. Einheitliche 404 bei ungueltigem Token.

const {
  getServiceClient,
  resolveToken,
  loadMembership,
  json,
  methodGuard,
  parseBody,
} = require('./_shared/creator-upload');

exports.handler = async (event) => {
  const guard = methodGuard(event);
  if (guard) return guard;

  const body = parseBody(event);
  if (!body) return json(400, { error: 'Ungueltiger Request' });

  try {
    const supabase = getServiceClient();
    const tokenRow = await resolveToken(supabase, body.token);
    if (!tokenRow) return json(404, { error: 'Link ungültig oder abgelaufen' });

    const membership = await loadMembership(supabase, tokenRow);

    const { data: creator } = await supabase
      .from('creator')
      .select('vorname')
      .eq('id', tokenRow.creator_id)
      .maybeSingle();

    return json(200, {
      kampagne: membership.kampagne,
      creatorVorname: creator?.vorname || '',
      expiresAt: tokenRow.expires_at,
      kooperationen: membership.kooperationen,
    });
  } catch (err) {
    console.error('[creator-upload-resolve]', err);
    return json(500, { error: 'Interner Fehler' });
  }
};
