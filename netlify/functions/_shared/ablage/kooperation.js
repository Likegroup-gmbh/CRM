// _shared/ablage/kooperation.js
// Kooperation mit Kampagne, Unternehmen, Marke und Produktion: Grundlage fuer die Ordnerkette.

const KOOP_SELECT = `id, name, kampagne_id, creator_id, produktion_id,
  produktion:produktion_id(id, name, kampagne_id),
  kampagne:kampagne_id(id, kampagnenname, eigener_name, unternehmen_id, marke_id,
    unternehmen:unternehmen_id(id, firmenname, ist_test),
    marke:marke_id(id, markenname))`;

async function ladeKooperation(supabase, kooperationId) {
  const { data, error } = await supabase
    .from('kooperationen')
    .select(KOOP_SELECT)
    .eq('id', kooperationId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

module.exports = { ladeKooperation, KOOP_SELECT };
