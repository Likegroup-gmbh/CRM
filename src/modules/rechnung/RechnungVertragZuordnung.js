export async function findSignedVertragForKooperation(kooperationId, supabase) {
  const sb = supabase || window.supabase;

  const { data: koop, error: koopError } = await sb
    .from('kooperationen')
    .select('id, creator_id, kampagne_id')
    .eq('id', kooperationId)
    .single();

  if (koopError || !koop) {
    return { ok: false, message: 'Die ausgewaehlte Kooperation konnte nicht geladen werden.', vertragId: null };
  }

  if (!koop.creator_id || !koop.kampagne_id) {
    return { ok: false, message: 'Die Kooperation ist unvollstaendig (Creator oder Kampagne fehlt).', vertragId: null };
  }

  const { data: vertraege, error: vertragError } = await sb
    .from('vertraege')
    .select('id, unterschriebener_vertrag_url, dropbox_file_url')
    .eq('creator_id', koop.creator_id)
    .eq('kampagne_id', koop.kampagne_id)
    .eq('is_draft', false)
    .limit(1);

  if (vertragError) {
    return { ok: false, message: 'Vertrag konnte nicht geprueft werden. Bitte erneut versuchen.', vertragId: null };
  }

  if (!vertraege || vertraege.length === 0) {
    return { ok: false, message: 'Vor der Rechnung muss ein finaler Vertrag angelegt werden.', vertragId: null };
  }

  const vertrag = vertraege[0];
  const isSigned = vertrag.unterschriebener_vertrag_url || vertrag.dropbox_file_url;

  return {
    ok: true,
    vertragId: isSigned ? vertrag.id : null
  };
}
