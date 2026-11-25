// Oeffentlich: weitere Bewerbungen an genau diesen Link haengen. Loeschen gibt es hier nicht.

const { getServiceClient, loadByToken, validateZeile, json, parseBody } = require('./_shared/bewerbung');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const body = parseBody(event);
  if (!body?.token) return json(400, { error: 'Link fehlt' });
  const zeilen = Array.isArray(body.creator) ? body.creator : [];
  if (!zeilen.length) return json(400, { error: 'Mindestens ein Creator ist Pflicht.' });

  try {
    const supabase = getServiceClient();
    const found = await loadByToken(supabase, body.token);
    if (!found) return json(404, { error: 'Link ungültig' });

    const rows = [];
    for (const raw of zeilen) {
      const checked = validateZeile(raw);
      if (!checked.ok) return json(400, { error: checked.error });
      rows.push({
        ...checked.zeile,
        link_id: found.link.id,
        creator_auswahl_id: found.link.creator_auswahl_id,
        management_id: found.link.management_id,
        ansprechpartner_id: found.link.ansprechpartner_id,
      });
    }

    const { error } = await supabase.from('bewerbung').insert(rows);
    if (error) throw error;

    const again = await loadByToken(supabase, body.token);
    return json(200, again.payload);
  } catch (err) {
    console.error('[bewerbung-submit]', err);
    return json(500, { error: 'Die Bewerbung konnte nicht gespeichert werden' });
  }
};
