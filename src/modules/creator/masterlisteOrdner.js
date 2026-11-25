// Ordner der Masterlisten-Übersicht: einer je Unternehmen, dazu
// „Ohne Unternehmen“ für die Listen, die der ganzen Agentur gehören.

export const BASE_PATH = '/creator-lists';
export const OHNE_UNTERNEHMEN = 'ohne';
export const OHNE_UNTERNEHMEN_LABEL = 'Ohne Unternehmen';

/** Ordner einer Liste. Ein Unternehmen, das der Nutzer nicht lesen darf, bleibt ein eigener Ordner. */
export function ordnerDerListe(list) {
  if (!list?.unternehmenId) return { id: OHNE_UNTERNEHMEN, name: OHNE_UNTERNEHMEN_LABEL, logoUrl: '', ohne: true };
  return {
    id: list.unternehmenId,
    name: list.unternehmenName || 'Unternehmen',
    logoUrl: list.unternehmenLogo || '',
    ohne: false
  };
}

/** Unternehmen alphabetisch, „Ohne Unternehmen“ am Ende. */
export function baueOrdner(lists) {
  const map = new Map();
  for (const list of lists || []) {
    const ordner = ordnerDerListe(list);
    if (!map.has(ordner.id)) map.set(ordner.id, { ...ordner, count: 0 });
    map.get(ordner.id).count += 1;
  }
  return [...map.values()].sort((a, b) => {
    if (a.ohne !== b.ohne) return a.ohne ? 1 : -1;
    return a.name.localeCompare(b.name, 'de');
  });
}

export function listenImOrdner(lists, ordnerId) {
  if (!ordnerId) return lists || [];
  return (lists || []).filter(list => ordnerDerListe(list).id === ordnerId);
}

/** ?unternehmen=<id>&unternehmen_name=<name> bzw. ?unternehmen=ohne. null = oberste Ebene. */
export function leseOrdnerQuery(search = '') {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const id = params.get('unternehmen');
  if (!id) return null;
  if (id === OHNE_UNTERNEHMEN) return { id, name: OHNE_UNTERNEHMEN_LABEL, ohne: true };
  return { id, name: params.get('unternehmen_name') || 'Unternehmen', ohne: false };
}

export function ordnerUrl(ordner) {
  if (!ordner?.id) return BASE_PATH;
  const params = new URLSearchParams({ unternehmen: ordner.id });
  if (ordner.id !== OHNE_UNTERNEHMEN && ordner.name) params.set('unternehmen_name', ordner.name);
  return `${BASE_PATH}?${params}`;
}

/** Masterlisten > Ordner > Liste. Ohne detailLabel ist die letzte erreichte Ebene aktuell. */
export function masterlistenCrumbs({ ordner = null, detailLabel = null, detailUrl = null } = {}) {
  const root = { label: 'Masterlisten', url: BASE_PATH, clickable: true };
  const blatt = { label: detailLabel, url: detailUrl, clickable: false };
  if (!ordner?.id) return detailLabel ? [root, blatt] : [{ ...root, clickable: false }];
  const firma = { label: ordner.name, url: ordnerUrl(ordner), clickable: Boolean(detailLabel) };
  return detailLabel ? [root, firma, blatt] : [root, firma];
}
