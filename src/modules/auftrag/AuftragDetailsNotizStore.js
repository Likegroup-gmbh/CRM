// Lesen und Schreiben der einen Notiz pro Auftragsdetails.
// Der Vergleich auf aktualisiert_am ist die Sperre gegen stilles Überschreiben.

const TABLE = 'auftrag_details_notiz';
const SELECT = 'notiz, aktualisiert_am, aktualisiert_von, autor:benutzer!aktualisiert_von(name)';

export function mapNotizRow(data) {
  if (!data) return { text: '', updatedAt: null, authorName: null };
  const autor = Array.isArray(data.autor) ? data.autor[0] : data.autor;
  return {
    text: data.notiz ?? '',
    updatedAt: data.aktualisiert_am ?? null,
    authorName: autor?.name?.trim() || 'Unbekannt'
  };
}

function isUniqueViolation(error) {
  return error?.code === '23505';
}

export async function loadAuftragNotiz(supabase, detailsId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT)
    .eq('auftrag_details_id', detailsId)
    .maybeSingle();
  if (error) throw error;
  return mapNotizRow(data);
}

export async function writeAuftragNotiz(supabase, { detailsId, userId, baseUpdatedAt, nextText }) {
  if (!nextText && !baseUpdatedAt) {
    return { status: 'noop', row: mapNotizRow(null) };
  }

  if (!nextText) {
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq('auftrag_details_id', detailsId)
      .eq('aktualisiert_am', baseUpdatedAt)
      .select('id');
    if (error) throw error;
    if (data?.length) return { status: 'saved', row: mapNotizRow(null) };
    const current = await loadAuftragNotiz(supabase, detailsId);
    if (!current.updatedAt) return { status: 'saved', row: current };
    return { status: 'conflict', row: current };
  }

  if (!userId) throw new Error('Benutzer fehlt');

  if (!baseUpdatedAt) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        auftrag_details_id: detailsId,
        notiz: nextText,
        aktualisiert_von: userId
      })
      .select(SELECT)
      .maybeSingle();
    if (error) {
      if (!isUniqueViolation(error)) throw error;
      const current = await loadAuftragNotiz(supabase, detailsId);
      return { status: 'conflict', row: current };
    }
    return { status: 'saved', row: mapNotizRow(data) };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({ notiz: nextText, aktualisiert_von: userId })
    .eq('auftrag_details_id', detailsId)
    .eq('aktualisiert_am', baseUpdatedAt)
    .select(SELECT);
  if (error) throw error;
  if (data?.length === 1) return { status: 'saved', row: mapNotizRow(data[0]) };
  const current = await loadAuftragNotiz(supabase, detailsId);
  return { status: 'conflict', row: current };
}
