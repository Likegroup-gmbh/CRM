// videoBrowserTagLogic.js
// Reine Logik der Tags im Videos-Tab: Tags gehören zur Variante (Video A, Story 2, Bild 3),
// nicht zur einzelnen Version. Sie gelten damit in jeder Feedbackschleife und in der Finalen
// Version (Verweis über source_asset_id). Kein DOM, kein Supabase.

import { FORMATE } from './videoBrowserFormat.js';

/** Gruppen im Katalog, in Anzeigereihenfolge. Neu angelegte Tags landen in "Eigene". */
export const TAG_GROUPS = ['Persona', 'Ansatz', 'Plattform', 'Sonstiges', 'Eigene'];
export const NEW_TAG_GROUP = 'Eigene';
export const TAG_LABEL_MAX = 40;

/** Schlüssel der Variante ohne Rücksicht auf die Version, `null` wenn die Datei keine hat. */
function ownKey(item) {
  const asset = item.asset || {};
  const variant = String(asset.variant_name || '').trim();
  if (item.type === 'video') return variant ? `video${variant}` : null;
  if (item.type === 'story') {
    if (!asset.story_id) return null;
    return `story${asset.story_id}${variant && !FORMATE.includes(variant) ? variant : ''}`;
  }
  if (item.type === 'still') return variant && !item.isFinal ? `still${variant}` : null;
  return null;
}

/**
 * Variante einer Datei, z. B. "videoA". Finale Dateien erben sie von ihrer Quelle in der
 * Feedbackschleife. Direkt hochgeladene Finale ohne Quelle und Rohmaterial haben keine.
 * @returns {string|null}
 */
export function variantKeyOf(item, row) {
  if (!item || item.type === 'roh') return null;
  if (!item.isFinal) return ownKey(item);
  const sourceId = item.asset?.source_asset_id;
  if (!sourceId) return null;
  for (const folder of row?.folders || []) {
    if (folder.kind !== 'schleife') continue;
    const source = folder.items.find(i => i.id === sourceId && i.type === item.type);
    if (source) return ownKey(source);
  }
  return null;
}

/** Satz für den Hinweis unter den Tags. */
export function tagHint(item) {
  const variant = String(item?.asset?.variant_name || '').trim();
  if (item?.type === 'video' && variant && !FORMATE.includes(variant)) return `Gilt für alle Versionen von Video ${variant}`;
  if (item?.type === 'story') return 'Gilt für alle Versionen dieser Story';
  if (item?.type === 'still') return 'Gilt für alle Versionen dieses Bildes';
  return 'Gilt für alle Versionen dieser Variante';
}

/** Zeichenfolge zum Vergleichen: ohne Beachtung von Groß- und Kleinschreibung und Randleerzeichen. */
export const normalizeTagLabel = (label) => String(label || '').trim().replace(/\s+/g, ' ').toLowerCase();

export const cleanTagLabel = (label) => String(label || '').trim().replace(/\s+/g, ' ').slice(0, TAG_LABEL_MAX);

/** Katalogeintrag mit diesem Label (ohne Beachtung von Groß- und Kleinschreibung). */
export function findTagByLabel(catalog, label) {
  const wanted = normalizeTagLabel(label);
  if (!wanted) return null;
  return (catalog || []).find(t => normalizeTagLabel(t.label) === wanted) || null;
}

/**
 * Baut `tagIds` (nach Vergabe sortiert) und `variantKey` an jede Datei und `finalMarked`
 * an jede Datei einer Feedbackschleife, die als Finale Version freigegeben wurde.
 * Ändert die Dateien des Baums direkt.
 * @param {Array} kooperationen
 * @param {{ tagTypen?: Array, varianteTags?: Array }} raw
 */
export function attachTags(kooperationen, { tagTypen = [], varianteTags = [] } = {}) {
  const known = new Set(tagTypen.map(t => t.id));
  const assigned = new Map();
  const sorted = [...varianteTags].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  for (const entry of sorted) {
    if (!known.has(entry.tag_typ_id)) continue;
    const key = `${entry.video_id}|${entry.variant_key}`;
    if (!assigned.has(key)) assigned.set(key, []);
    assigned.get(key).push(entry.tag_typ_id);
  }

  for (const koop of kooperationen) {
    for (const row of koop.rows) {
      const finals = row.folders.find(f => f.kind === 'final')?.items || [];
      const markedSources = new Set(finals.map(f => `${f.type}:${f.asset?.source_asset_id}`).filter(k => !k.endsWith(':undefined') && !k.endsWith(':null')));
      for (const folder of row.folders) {
        for (const item of folder.items) {
          const key = variantKeyOf(item, row);
          item.variantKey = key;
          item.tagIds = key ? [...(assigned.get(`${row.id}|${key}`) || [])] : [];
          item.finalMarked = !item.isFinal && markedSources.has(`${item.type}:${item.id}`);
        }
      }
    }
  }
}

/** Katalog als Liste nach Gruppen: [{ group, tags }], leere Gruppen fehlen. */
export function groupTags(tags) {
  const order = new Map(TAG_GROUPS.map((g, i) => [g, i]));
  const groups = new Map();
  for (const tag of tags) {
    const group = tag.gruppe || NEW_TAG_GROUP;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(tag);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (order.get(a) ?? 99) - (order.get(b) ?? 99) || a.localeCompare(b, 'de'))
    .map(([group, list]) => ({ group, tags: [...list].sort((x, y) => x.label.localeCompare(y.label, 'de')) }));
}

/**
 * Optionen der Tag-Auswahl für eine Eingabe: noch nicht vergebene Tags, gefiltert nach Teilstring,
 * gruppiert, plus "Neu anlegen", wenn es keinen exakten Treffer gibt.
 * @returns {{ groups: Array<{ group: string, tags: Array }>, create: string|null, empty: boolean }}
 */
export function tagOptions(catalog, takenIds, query) {
  const taken = new Set(takenIds || []);
  const free = (catalog || []).filter(t => !taken.has(t.id));
  const needle = normalizeTagLabel(query);
  const hits = needle ? free.filter(t => normalizeTagLabel(t.label).includes(needle)) : free;
  const clean = cleanTagLabel(query);
  // Ein exakter Treffer, auch unter den schon vergebenen, verhindert "Neu anlegen"
  const exists = !!clean && !!findTagByLabel(catalog, clean);
  return {
    groups: groupTags(hits),
    create: clean && !exists ? clean : null,
    empty: !free.length && !clean
  };
}

/**
 * Filter-Chips einer Ordner-Spalte: "Final" (nur wenn ein Inhalt markiert ist, nicht im Final-Ordner)
 * und jedes Tag, das im Ordner vorkommt, in Reihenfolge des ersten Auftretens.
 * Es gibt nur Chips, wenn der Ordner mehr als einen Inhalt hat.
 * @returns {Array<{ id: string, label: string, kind: 'final'|'tag' }>}
 */
export function folderFilters(folder, catalog) {
  if (!folder || folder.items.length < 2) return [];
  const byId = new Map((catalog || []).map(t => [t.id, t]));
  const out = [];
  if (folder.kind !== 'final' && folder.items.some(i => i.finalMarked)) {
    out.push({ id: 'final', label: 'Final', kind: 'final' });
  }
  const seen = new Set();
  for (const item of folder.items) {
    for (const id of item.tagIds || []) {
      if (seen.has(id) || !byId.has(id)) continue;
      seen.add(id);
      out.push({ id, label: byId.get(id).label, kind: 'tag' });
    }
  }
  return out;
}

/**
 * Filter gilt pro Ordner: `{ folderId, value }`, `value` ist "final" oder eine Tag-ID.
 * @returns {string|null} aktiver Wert für diesen Ordner
 */
export function activeFilterValue(filter, folderId) {
  return filter && filter.folderId === folderId ? filter.value : null;
}

/** Zeigt die Datei zu diesem Filterwert? Ohne Filter immer. */
export function matchesFilter(item, value) {
  if (!value) return true;
  if (value === 'final') return !!item.finalMarked;
  return (item.tagIds || []).includes(value);
}

/** Einfachauswahl als Toggle: gleicher Chip hebt auf, anderer Chip wechselt. */
export function toggleFilter(filter, folderId, value) {
  if (filter && filter.folderId === folderId && filter.value === value) return null;
  return { folderId, value };
}
