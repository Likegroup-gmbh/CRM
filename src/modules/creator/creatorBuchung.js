// Videozahl: Kooperationsvideos in den letzten 30 oder 90 Tagen, oder insgesamt.
// Gezählt wird der Tag, an dem das Video angelegt wurde.

export const VIDEO_TAGE = [30, 90];
const TAG_MS = 24 * 60 * 60 * 1000;
const ALLE_SEIT = '1970-01-01T00:00:00.000Z';

export const CREATOR_SORTS = [
  { id: 'name', label: 'Name, A–Z' },
  { id: 'follower', label: 'Instagram-Follower' },
  { id: 'video30', label: 'Videos, 30 Tage' },
  { id: 'video90', label: 'Videos, 90 Tage' },
  { id: 'kooperation', label: 'Kooperationsvideos' },
  { id: 'rezension', label: 'Rezension' }
];

export function normalizeSort(value) {
  return CREATOR_SORTS.some((entry) => entry.id === value) ? value : 'name';
}

export function videoSeit(tage, jetzt = Date.now()) {
  return new Date(jetzt - tage * TAG_MS).toISOString();
}

export function anzeigeName(creator) {
  return `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
}

export function vergleicheName(a, b) {
  const left = anzeigeName(a);
  const right = anzeigeName(b);
  if (!left !== !right) return left ? -1 : 1;
  return left.localeCompare(right, 'de');
}

export function sortiereNachName(creators) {
  return [...(creators || [])].sort(vergleicheName);
}

export function sortiereNachVideos(creators, anzahl) {
  const counts = anzahl instanceof Map ? anzahl : new Map();
  return [...(creators || [])]
    .map((creator) => ({
      id: creator.id,
      nachname: creator.nachname || '',
      vorname: creator.vorname || '',
      anzahl: counts.get(creator.id) || 0
    }))
    .sort((a, b) => {
      if (b.anzahl !== a.anzahl) return b.anzahl - a.anzahl;
      return vergleicheName(a, b);
    });
}

export async function ladeVideoAnzahl(supabase, tage, jetzt = Date.now()) {
  const seit = tage === 'alle' ? ALLE_SEIT : videoSeit(tage, jetzt);
  const { data, error } = await supabase.rpc('creator_video_anzahl', {
    seit
  });
  if (error) throw error;
  return new Map((data || []).map((row) => [row.creator_id, Number(row.anzahl) || 0]));
}

export async function ladeKooperationsVideos(supabase, creatorIds) {
  const { data: koops, error } = await supabase
    .from('kooperationen')
    .select('id, creator_id')
    .in('creator_id', creatorIds);
  if (error) throw error;
  const koopToCreator = new Map((koops || []).map((row) => [row.id, row.creator_id]));
  const counts = new Map();
  if (!koopToCreator.size) return counts;
  const { data, error: videoError } = await supabase
    .from('kooperation_videos')
    .select('kooperation_id')
    .in('kooperation_id', [...koopToCreator.keys()]);
  if (videoError) throw videoError;
  for (const row of data || []) {
    const creatorId = koopToCreator.get(row.kooperation_id);
    if (creatorId) counts.set(creatorId, (counts.get(creatorId) || 0) + 1);
  }
  return counts;
}
