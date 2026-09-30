/**
 * Alle Unternehmen für Dropdown abrufen
 */
export async function getAllUnternehmen() {
  const { data, error } = await window.supabase
    .from('unternehmen')
    .select('id, firmenname')
    .order('firmenname');

  if (error) throw error;
  return data;
}

/**
 * Alle Marken für Dropdown abrufen
 */
export async function getAllMarken(unternehmenId = null) {
  let query = window.supabase
    .from('marke')
    .select('id, markenname, unternehmen_id')
    .order('markenname');

  if (unternehmenId) {
    query = query.eq('unternehmen_id', unternehmenId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Alle Kampagnen für Dropdown abrufen
 */
export async function getAllKampagnen(markeId = null) {
  let query = window.supabase
    .from('kampagne')
    .select('id, kampagnenname, marke_id')
    .order('kampagnenname');

  if (markeId) {
    query = query.eq('marke_id', markeId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Alle Aufträge für Dropdown abrufen
 */
export async function getAllAuftraege(unternehmenId = null) {
  let query = window.supabase
    .from('auftrag')
    .select('id, auftragsname, unternehmen_id')
    .order('auftragsname');

  if (unternehmenId) {
    query = query.eq('unternehmen_id', unternehmenId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Creator suchen (für Autocomplete)
 */
export async function searchCreators(searchTerm) {
  const { data, error } = await window.supabase
    .from('creator')
    .select('id, vorname, nachname, instagram, tiktok')
    .or(`vorname.ilike.%${searchTerm}%,nachname.ilike.%${searchTerm}%,instagram.ilike.%${searchTerm}%,tiktok.ilike.%${searchTerm}%`)
    .limit(10);

  if (error) throw error;
  // Füge einen kombinierten Namen hinzu für die Anzeige
  return (data || []).map(c => ({
    ...c,
    name: `${c.vorname || ''} ${c.nachname || ''}`.trim()
  }));
}
