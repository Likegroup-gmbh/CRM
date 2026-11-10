// videoBrowserShowcaseLogic.js
// Reine Logik der Showcase-Ansicht (Grid aller Finalen Versionen einer Produktion):
// Finale sammeln, Seitenverhältnis wählen, filtern, gruppieren, flache Anzeigeliste.
// Kein DOM, kein Supabase. Tags und Katalog kommen aus videoBrowserTagLogic (item.tagIds).

import { FINAL_FORMATE, FINAL_ID, plural } from './videoBrowserFormat.js';

/** Datenmenge: nur Finale Versionen oder der aktuelle Stand (Finale, sonst die letzte Runde). */
export const SHOWCASE_INHALT = [
  { value: 'final', label: 'Nur final' },
  { value: 'aktuell', label: 'Aktueller Stand' }
];
export const SHOWCASE_GROUPS = [
  { value: 'creator', label: 'Creator' },
  { value: 'persona', label: 'Persona' },
  { value: 'keine', label: 'Keine' }
];
export const SHOWCASE_RATIOS = FINAL_FORMATE.map(value => ({ value, label: value }));
/** Mindestbreite der Kacheln in px (S, M, L). */
export const SHOWCASE_SIZES = [
  { value: 'S', label: 'S', px: 124 },
  { value: 'M', label: 'M', px: 172 },
  { value: 'L', label: 'L', px: 240 }
];
export const SHOWCASE_TYPES = [
  { id: 'video', label: 'Videos' },
  { id: 'still', label: 'Bilder' },
  { id: 'story', label: 'Stories' }
];
export const PERSONA_GROUP = 'Persona';
export const NO_PERSONA_LABEL = 'Ohne Persona';
/** Ab dieser Kachelzahl wird nicht mehr per Flip umgeordnet, nur eingeblendet. */
export const FLIP_LIMIT = 200;

export const DEFAULT_SHOWCASE = Object.freeze({
  inhalt: 'final', group: 'creator', fmt: '9:16', size: 'M', typ: null, tag: null
});

const TYP_PREFIX = 'typ:';
const TAG_PREFIX = 'tag:';
const byLabel = (a, b) => a.label.localeCompare(b.label, 'de');

/**
 * Alle Finalen Versionen des Baums in Ordneransicht-Reihenfolge:
 * Kooperation, Video, dann Videos, Bilder, Stories.
 * @returns {Array<{ koop: object, row: object, item: object }>}
 */
export function collectFinals(tree) {
  const out = [];
  for (const koop of tree?.kooperationen || []) {
    for (const row of koop.rows || []) {
      const folder = (row.folders || []).find(f => f.id === FINAL_ID || f.kind === 'final');
      for (const item of folder?.items || []) out.push({ koop, row, item });
    }
  }
  return out;
}

const TYPE_RANK = { video: 0, still: 1, story: 2 };

/**
 * Aktueller Stand: je Variante die Finale Version, sonst die Datei der letzten Feedbackschleife.
 * Varianten aus früheren Runden ohne Finale gehören nicht dazu. Reihenfolge wie `collectFinals`:
 * Kooperation, Video, dann Videos, Bilder, Stories (Varianten in der Reihenfolge der Runde).
 * @returns {Array<{ koop: object, row: object, item: object }>}
 */
export function collectCurrent(tree) {
  const out = [];
  for (const koop of tree?.kooperationen || []) {
    for (const row of koop.rows || []) {
      const folders = row.folders || [];
      const finals = (folders.find(f => f.id === FINAL_ID || f.kind === 'final')?.items || []);
      const loops = folders.filter(f => f.kind === 'schleife' && f.items.length);
      const used = new Set();
      const entries = [];
      for (const item of loops[loops.length - 1]?.items || []) {
        const finished = finals.filter(f => f.type === item.type
          && (f.asset?.source_asset_id === item.id || (item.variantKey && f.variantKey === item.variantKey)));
        if (!finished.length) {
          entries.push({ koop, row, item });
          continue;
        }
        for (const f of finished) {
          if (used.has(f.id)) continue;
          used.add(f.id);
          entries.push({ koop, row, item: f });
        }
      }
      for (const f of finals) if (!used.has(f.id)) entries.push({ koop, row, item: f });
      entries.sort((a, b) => (TYPE_RANK[a.item.type] ?? 9) - (TYPE_RANK[b.item.type] ?? 9));
      out.push(...entries);
    }
  }
  return out;
}

/**
 * Eine Datei je Variante im bevorzugten Seitenverhältnis. Hat die Variante es nicht,
 * gilt ihre erste vorhandene Datei, damit nichts aus dem Showcase verschwindet.
 * Finale ohne Variante (direkt hochgeladen) zählen einzeln.
 */
export function pickFormat(entries, fmt) {
  const groups = new Map();
  for (const entry of entries) {
    const { item, row } = entry;
    const key = `${row.id}|${item.type}|${item.variantKey || item.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  // Reihenfolge der Varianten (A, B, ...) bleibt: jede Gruppe steht dort, wo ihre erste Datei stand
  return [...groups.values()].map(list => list.find(e => e.item.ratio === fmt) || list[0]);
}

/** Typ- und Tag-Filter, UND-verknüpft. */
export function filterShowcase(entries, { typ = null, tag = null } = {}) {
  return entries.filter(({ item }) =>
    (!typ || item.type === typ) && (!tag || (item.tagIds || []).includes(tag)));
}

/**
 * Chips der Filterzeile: Typen, Trenner, Tags der Datenmenge (alphabetisch).
 * Ids: "typ:video" und "tag:<id>", damit beide Kategorien in einer Chip-Liste stehen.
 * @returns {Array<{ id?: string, label?: string, kind: 'typ'|'sep'|'tag' }>}
 */
export function showcaseChips(entries, catalog) {
  const types = SHOWCASE_TYPES
    .filter(t => entries.some(e => e.item.type === t.id))
    .map(t => ({ id: `${TYP_PREFIX}${t.id}`, label: t.label, kind: 'typ' }));
  const byId = new Map((catalog || []).map(t => [t.id, t]));
  const seen = new Set();
  for (const { item } of entries) for (const id of item.tagIds || []) if (byId.has(id)) seen.add(id);
  const tags = [...seen]
    .map(id => ({ id: `${TAG_PREFIX}${id}`, label: byId.get(id).label, kind: 'tag' }))
    .sort(byLabel);
  if (!types.length && !tags.length) return [];
  return [...types, ...(types.length && tags.length ? [{ kind: 'sep' }] : []), ...tags];
}

/** Aktive Chip-Ids aus dem Zustand. */
export function activeChipIds({ typ, tag } = {}) {
  return [typ ? `${TYP_PREFIX}${typ}` : null, tag ? `${TAG_PREFIX}${tag}` : null].filter(Boolean);
}

/** Chip anklicken: Einfachauswahl je Kategorie als Toggle (gleicher Chip hebt auf, anderer wechselt). */
export function toggleChip(state, chipId) {
  const next = { ...state };
  if (chipId.startsWith(TYP_PREFIX)) {
    const value = chipId.slice(TYP_PREFIX.length);
    next.typ = state.typ === value ? null : value;
  } else if (chipId.startsWith(TAG_PREFIX)) {
    const value = chipId.slice(TAG_PREFIX.length);
    next.tag = state.tag === value ? null : value;
  }
  return next;
}

/** Ein Filterwert, den es in der Datenmenge nicht (mehr) gibt, wird zurückgesetzt. */
export function reconcileState(state, entries, catalog) {
  const ids = new Set(showcaseChips(entries, catalog).map(c => c.id));
  const next = { ...state };
  if (next.typ && !ids.has(`${TYP_PREFIX}${next.typ}`)) next.typ = null;
  if (next.tag && !ids.has(`${TAG_PREFIX}${next.tag}`)) next.tag = null;
  return next;
}

/** Persona = erstes Tag der Gruppe "Persona", über Gruppe und Tag-Id, nicht über das Label. */
export function personaOf(item, catalog) {
  const byId = new Map((catalog || []).map(t => [t.id, t]));
  for (const id of item.tagIds || []) {
    const tag = byId.get(id);
    if (tag && tag.gruppe === PERSONA_GROUP) return tag;
  }
  return null;
}

/**
 * Abschnitte je Modus. `keine` liefert einen Abschnitt ohne Kopf. Leere Abschnitte entfallen.
 * @returns {Array<{ id: string, label: string, koop: object|null, persona: object|null, head: boolean, entries: Array }>}
 */
export function groupShowcase(entries, mode, catalog) {
  if (!entries.length) return [];
  if (mode === 'keine') {
    return [{ id: 'alle', label: '', koop: null, persona: null, head: false, entries }];
  }
  const groups = new Map();
  const add = (id, make, entry) => {
    if (!groups.has(id)) groups.set(id, { id, head: true, koop: null, persona: null, entries: [], ...make });
    groups.get(id).entries.push(entry);
  };
  for (const entry of entries) {
    if (mode === 'persona') {
      const persona = personaOf(entry.item, catalog);
      add(persona ? persona.id : 'ohne-persona', { label: persona ? persona.label : NO_PERSONA_LABEL, persona }, entry);
    } else {
      add(entry.koop.id, { label: entry.koop.name, koop: entry.koop }, entry);
    }
  }
  const list = [...groups.values()];
  if (mode === 'persona') {
    list.sort((a, b) => (a.id === 'ohne-persona') - (b.id === 'ohne-persona') || byLabel(a, b));
  }
  return list;
}

/** Flache Liste in Anzeigereihenfolge (Navigation der Vollansicht). */
export const displayList = (groups) => groups.flatMap(g => g.entries);

/** Gesamte Pipeline: Datenmenge, gefilterte Menge, Abschnitte, Anzeigeliste. */
export function buildShowcase(tree, state, catalog) {
  const collect = state.inhalt === 'aktuell' ? collectCurrent : collectFinals;
  const base = pickFormat(collect(tree), state.fmt);
  const filters = reconcileState(state, base, catalog);
  const filtered = filterShowcase(base, filters);
  const groups = groupShowcase(filtered, filters.group, catalog);
  return {
    state: filters,
    total: base.length,
    chips: showcaseChips(base, catalog),
    groups,
    list: displayList(groups)
  };
}

/** "{n} Inhalte von {m} Creators" für die gefilterte Menge. */
export function showcaseSummary(list) {
  const creators = new Set(list.map(e => e.koop.id)).size;
  return `${plural(list.length, 'Inhalt', 'Inhalte')} von ${plural(creators, 'Creator', 'Creators')}`;
}

export const sizePx = (size) => (SHOWCASE_SIZES.find(s => s.value === size) || SHOWCASE_SIZES[1]).px;
