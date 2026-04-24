import { modularFilterSystem } from '../../core/filters/ModularFilterSystem.js';

export async function loadUnternehmenName(unternehmenId) {
  try {
    const { data, error } = await window.supabase
      .from('unternehmen')
      .select('firmenname')
      .eq('id', unternehmenId)
      .single();

    if (!error && data) return data.firmenname;
    return null;
  } catch (err) {
    console.warn('Unternehmensnamen konnte nicht geladen werden:', err);
    return null;
  }
}

export async function loadUnternehmenFolders() {
  if (!window.supabase) {
    console.warn('⚠️ Supabase nicht verfügbar');
    return [];
  }

  try {
    const { data: sessionData } = await window.supabase.auth.getSession();
    if (!sessionData?.session) {
      return [];
    }
  } catch {
    return [];
  }

  const { data, error } = await window.supabase.rpc('get_unternehmen_folders');

  if (error) {
    if (error.code === 'PGRST301' || error.status === 401 || error.message?.toLowerCase().includes('jwt')) {
      console.warn('⚠️ loadUnternehmenFolders: Auth-Fehler ignoriert (vermutlich Logout-Race)');
      return [];
    }
    throw error;
  }

  return data || [];
}

export async function loadVertraege(unternehmenId, pagination) {
  if (!window.supabase) {
    console.warn('⚠️ Supabase nicht verfügbar');
    return [];
  }

  const { currentPage, itemsPerPage } = pagination.getState();
  const from = (currentPage - 1) * itemsPerPage;
  const to = from + itemsPerPage - 1;

  const filters = modularFilterSystem.getFilters('vertrag');

  let countQuery = window.supabase
    .from('vertraege')
    .select('*', { count: 'exact', head: true })
    .eq('kunde_unternehmen_id', unternehmenId);

  if (filters.typ) countQuery = countQuery.eq('typ', filters.typ);
  if (filters.kampagne_id) countQuery = countQuery.eq('kampagne_id', filters.kampagne_id);
  if (filters.creator_id) countQuery = countQuery.eq('creator_id', filters.creator_id);

  let dataQuery = window.supabase
    .from('vertraege')
    .select(`
      id,
      name,
      typ,
      is_draft,
      datei_url,
      datei_path,
      unterschriebener_vertrag_url,
      dropbox_file_url,
      dropbox_file_path,
      kooperation_id,
      created_at,
      kunde_unternehmen_id,
      kampagne_id,
      creator_id,
      kunde:kunde_unternehmen_id (
        id,
        firmenname
      ),
      kampagne:kampagne_id (
        id,
        kampagnenname,
        eigener_name
      ),
      creator:creator_id (
        id,
        vorname,
        nachname
      )
    `)
    .eq('kunde_unternehmen_id', unternehmenId);

  if (filters.typ) dataQuery = dataQuery.eq('typ', filters.typ);
  if (filters.kampagne_id) dataQuery = dataQuery.eq('kampagne_id', filters.kampagne_id);
  if (filters.creator_id) dataQuery = dataQuery.eq('creator_id', filters.creator_id);

  const [countResult, dataResult] = await Promise.all([
    countQuery,
    dataQuery.order('created_at', { ascending: false }).range(from, to)
  ]);

  const { count } = countResult;
  const { data: vertraege, error } = dataResult;

  pagination.updateTotal(count || 0);
  pagination.render();

  if (error) throw error;
  return vertraege || [];
}
