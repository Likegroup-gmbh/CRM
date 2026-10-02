// ProfileDetailEntityLoader.js
// Lädt die dem Profil zugeordneten Entitäten (Unternehmen, Marken, Aufträge, Kampagnen, Kooperationen, Videos)

const LIST_LIMIT = 50;
const FETCH_LIMIT = 100;

const KAMPAGNE_SELECT = 'id, kampagnenname, eigener_name, status, created_at, status_ref:status_id(id, name), marke:marke_id(markenname), unternehmen:unternehmen_id(firmenname)';
const KOOPERATION_SELECT = 'id, name, status, created_at, kampagne:kampagne_id(kampagnenname, eigener_name)';
const VIDEO_SELECT = 'id, videoname, status, version, created_at, kooperation:kooperation_id(name)';
const MARKE_SELECT = 'id, markenname, logo_url, unternehmen:unternehmen_id(firmenname)';
const UNTERNEHMEN_SELECT = 'id, firmenname, webseite, logo_url';

/**
 * Dedupliziert nach id, sortiert nach created_at absteigend (neueste zuerst).
 */
export function mergeLatestById(...lists) {
  const map = new Map();
  lists.flat().filter(Boolean).forEach(item => map.set(item.id, item));
  return Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Kampagnen über Marken und/oder Unternehmen, dedupliziert, max. 50 neueste.
 */
export async function fetchKampagnen(markenIds, unternehmenIds) {
  const fetchBy = async (column, ids) => {
    if (!ids.length) return [];
    const { data } = await window.supabase
      .from('kampagne')
      .select(KAMPAGNE_SELECT)
      .in(column, ids)
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT);
    return data || [];
  };

  const [viaMarke, viaUnternehmen] = await Promise.all([
    fetchBy('marke_id', markenIds),
    fetchBy('unternehmen_id', unternehmenIds)
  ]);
  return mergeLatestById(viaMarke, viaUnternehmen).slice(0, LIST_LIMIT);
}

async function fetchKooperationenByKampagnen(kampagnenIds) {
  if (!kampagnenIds.length) return [];
  const { data } = await window.supabase
    .from('kooperationen')
    .select(KOOPERATION_SELECT)
    .in('kampagne_id', kampagnenIds)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  return data || [];
}

async function fetchVideos(kooperationIds) {
  if (!kooperationIds.length) return [];
  const { data } = await window.supabase
    .from('kooperation_video')
    .select(VIDEO_SELECT)
    .in('kooperation_id', kooperationIds)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  return data || [];
}

export async function loadKundeEntities(detail) {
  const { data: unternehmenLinks } = await window.supabase
    .from('kunde_unternehmen')
    .select(`unternehmen:unternehmen_id(${UNTERNEHMEN_SELECT})`)
    .eq('kunde_id', detail.userId);

  detail.unternehmen = (unternehmenLinks || []).map(link => link.unternehmen).filter(Boolean);
  const unternehmenIds = detail.unternehmen.map(u => u.id);

  const { data: markenLinks } = await window.supabase
    .from('kunde_marke')
    .select(`marke:marke_id(${MARKE_SELECT})`)
    .eq('kunde_id', detail.userId);

  let markenViaUnternehmen = [];
  if (unternehmenIds.length > 0) {
    const { data } = await window.supabase
      .from('marke')
      .select(MARKE_SELECT)
      .in('unternehmen_id', unternehmenIds);
    markenViaUnternehmen = data || [];
  }

  // Direkte Zuordnung zuerst, Marken über Unternehmen überschreiben bei gleicher id
  const markenMap = new Map();
  (markenLinks || []).map(link => link.marke).filter(Boolean).forEach(m => markenMap.set(m.id, m));
  markenViaUnternehmen.filter(Boolean).forEach(m => markenMap.set(m.id, m));
  detail.marken = Array.from(markenMap.values());

  detail.kampagnen = await fetchKampagnen(detail.marken.map(m => m.id), unternehmenIds);
  detail.kooperationen = await fetchKooperationenByKampagnen(detail.kampagnen.map(k => k.id));
  detail.videos = await fetchVideos(detail.kooperationen.map(k => k.id));
  detail.auftraege = [];
}

export async function loadMitarbeiterEntities(detail) {
  const { data: unternehmenLinks } = await window.supabase
    .from('mitarbeiter_unternehmen')
    .select(`unternehmen:unternehmen_id(${UNTERNEHMEN_SELECT})`)
    .eq('mitarbeiter_id', detail.userId);

  detail.unternehmen = (unternehmenLinks || []).map(link => link.unternehmen).filter(Boolean);

  const { data: marken } = await window.supabase
    .from('marke_mitarbeiter')
    .select(`marke:marke_id(${MARKE_SELECT})`)
    .eq('mitarbeiter_id', detail.userId);

  detail.marken = (marken || []).map(link => link.marke).filter(Boolean);

  const markenIds = detail.marken.map(m => m.id);
  const unternehmenIds = detail.unternehmen.map(u => u.id);

  detail.auftraege = await fetchAuftraege(markenIds, unternehmenIds);
  detail.kampagnen = await fetchKampagnen(markenIds, unternehmenIds);

  const koopsFromTasks = await fetchKooperationenFromTasks(detail.userId);
  const koopsFromKampagnen = await fetchKooperationenByKampagnen(detail.kampagnen.map(k => k.id));
  const alleKooperationen = mergeLatestById(koopsFromTasks, koopsFromKampagnen);
  detail.kooperationen = alleKooperationen.slice(0, LIST_LIMIT);

  // Videos über alle gefundenen Kooperationen (nicht nur die ersten 50)
  detail.videos = await fetchVideos(alleKooperationen.map(k => k.id));
}

async function fetchAuftraege(markenIds, unternehmenIds) {
  if (markenIds.length === 0 && unternehmenIds.length === 0) return [];

  let query = window.supabase
    .from('auftrag')
    .select('id, auftragsname, status, created_at, marke:marke_id(markenname), unternehmen:unternehmen_id(firmenname)')
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);

  if (markenIds.length > 0) {
    query = query.in('marke_id', markenIds);
  }

  const { data } = await query;
  return data || [];
}

async function fetchKooperationenFromTasks(userId) {
  const { data: assignedTasks } = await window.supabase
    .from('kooperation_task')
    .select('entity_id')
    .eq('entity_type', 'kooperation')
    .eq('assigned_to_user_id', userId);

  const ids = [...new Set((assignedTasks || []).map(t => t.entity_id))];
  if (ids.length === 0) return [];

  const { data } = await window.supabase
    .from('kooperationen')
    .select(KOOPERATION_SELECT)
    .in('id', ids)
    .order('created_at', { ascending: false });
  return data || [];
}
