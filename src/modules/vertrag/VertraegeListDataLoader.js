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

  const { data, error } = await window.supabase
    .from('vertraege')
    .select(`
      kunde_unternehmen_id,
      kunde:kunde_unternehmen_id (
        id,
        firmenname,
        logo_url
      )
    `)
    .not('kunde_unternehmen_id', 'is', null);

  if (error) throw error;

  const unternehmenMap = new Map();
  (data || []).forEach(v => {
    if (v.kunde?.id) {
      const existing = unternehmenMap.get(v.kunde.id);
      if (existing) {
        existing.count++;
      } else {
        unternehmenMap.set(v.kunde.id, {
          id: v.kunde.id,
          firmenname: v.kunde.firmenname,
          logo_url: v.kunde.logo_url,
          count: 1
        });
      }
    }
  });

  return Array.from(unternehmenMap.values())
    .sort((a, b) => (a.firmenname || '').localeCompare(b.firmenname || '', 'de'));
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

  const { count } = await countQuery;

  let query = window.supabase
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

  if (filters.typ) query = query.eq('typ', filters.typ);
  if (filters.kampagne_id) query = query.eq('kampagne_id', filters.kampagne_id);
  if (filters.creator_id) query = query.eq('creator_id', filters.creator_id);

  const { data: vertraege, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  pagination.updateTotal(count || 0);
  pagination.render();

  if (error) throw error;
  return vertraege || [];
}
