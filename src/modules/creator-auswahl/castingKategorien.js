// Gruppenachse eines Castings: eigene Kategorien (creator_auswahl.teilbereich,
// kommagetrennt) plus die reservierten Eimer "Ohne Kategorie" und "Nicht umsetzen".
// Loest die Persona-Achse aus ADR 0019 ab (ADR 0049).

export const NICHT_UMSETZEN_KATEGORIE = 'Nicht umsetzen';
export const OHNE_KATEGORIE = 'Ohne Kategorie';
export const OHNE_KATEGORIE_KEY = '__ohne__';
export const NICHT_UMSETZEN_KEY = '__nicht_umsetzen__';

/** "A, B" -> ['A', 'B'] */
export function parseTeilbereiche(csv) {
  if (!csv) return [];
  const seen = new Set();
  const result = [];
  for (const part of String(csv).split(',')) {
    const name = part.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

export function serializeTeilbereiche(kategorien) {
  const list = (kategorien || []).map(k => String(k || '').trim()).filter(Boolean);
  return list.length ? list.join(', ') : null;
}

function normalisiert(name) {
  return String(name || '').trim().toLowerCase();
}

/** Namen, die als eigene Kategorie nicht vergeben werden dürfen. */
export function istReservierterKategorieName(name) {
  const n = normalisiert(name);
  return n === normalisiert(NICHT_UMSETZEN_KATEGORIE) || n === normalisiert(OHNE_KATEGORIE);
}

/**
 * Prüft einen neuen Kategorienamen gegen die vorhandenen.
 * @returns {string|null} Fehlertext oder null
 */
export function pruefeKategorieName(name, vorhandene = [], { ausser = null } = {}) {
  const wert = String(name || '').trim();
  if (!wert) return 'Bitte Kategorie-Name eingeben';
  if (wert.includes(',')) return 'Kommas sind im Kategorienamen nicht erlaubt';
  if (istReservierterKategorieName(wert)) return `"${wert}" ist ein reservierter Name`;
  const duplikat = (vorhandene || []).some(k => (
    normalisiert(k) === normalisiert(wert) && normalisiert(k) !== normalisiert(ausser)
  ));
  if (duplikat) return 'Diese Kategorie existiert bereits';
  return null;
}

export function isNichtUmsetzen(item) {
  return item?.kategorie === NICHT_UMSETZEN_KATEGORIE || item?.nicht_umsetzen === true;
}

export function kategorieGroupKey(item) {
  if (isNichtUmsetzen(item)) return NICHT_UMSETZEN_KEY;
  const kategorie = String(item?.kategorie || '').trim();
  return kategorie || OHNE_KATEGORIE_KEY;
}

/** Felder, die ein Verschieben in die Gruppe schreibt. persona_id bleibt unberührt. */
export function updatesForGroupKey(groupKey) {
  if (groupKey === NICHT_UMSETZEN_KEY || groupKey === NICHT_UMSETZEN_KATEGORIE) {
    return { kategorie: NICHT_UMSETZEN_KATEGORIE, nicht_umsetzen: true };
  }
  if (!groupKey || groupKey === OHNE_KATEGORIE_KEY || groupKey === OHNE_KATEGORIE) {
    return { kategorie: null, nicht_umsetzen: false };
  }
  return { kategorie: groupKey, nicht_umsetzen: false };
}

export function groupItemsByKategorie(items = []) {
  const groups = new Map();
  for (const item of items) {
    const key = kategorieGroupKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

/**
 * Reihenfolge: definierte Kategorien (auch leer) → Kategorien nur an Zeilen →
 * Ohne Kategorie (nur mit Items) → Nicht umsetzen (nur mit Items).
 */
export function orderedKategorieGroups(items = [], teilbereiche = []) {
  const groups = groupItemsByKategorie(items);
  const definiert = new Set(teilbereiche || []);
  const result = [];

  for (const name of teilbereiche || []) {
    result.push({ key: name, label: name, items: groups.get(name) || [], variant: '' });
  }

  for (const [key, groupItems] of groups) {
    if (key === OHNE_KATEGORIE_KEY || key === NICHT_UMSETZEN_KEY || definiert.has(key)) continue;
    result.push({ key, label: key, items: groupItems, variant: '' });
  }

  const ohne = groups.get(OHNE_KATEGORIE_KEY) || [];
  if (ohne.length) {
    result.push({ key: OHNE_KATEGORIE_KEY, label: OHNE_KATEGORIE, items: ohne, variant: 'default' });
  }

  const nichtUmsetzen = groups.get(NICHT_UMSETZEN_KEY) || [];
  if (nichtUmsetzen.length) {
    result.push({
      key: NICHT_UMSETZEN_KEY,
      label: NICHT_UMSETZEN_KATEGORIE,
      items: nichtUmsetzen,
      variant: 'rejected'
    });
  }

  return result;
}

/** Items in Gruppenreihenfolge, mit neu durchnummerierter Sortierung. */
export function reorderCastingItemsByKategorien(items = [], teilbereiche = []) {
  return orderedKategorieGroups(items, teilbereiche)
    .flatMap(group => group.items)
    .map((item, index) => ({ ...item, sortierung: index }));
}

export function applyGroupToItem(item, groupKey) {
  return { ...item, ...updatesForGroupKey(groupKey) };
}
