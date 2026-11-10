// videoBrowserSelection.js
// Auswahl im Spaltenbrowser (Kooperation → Video → Ordner → Datei) und ihre Abbildung auf die URL.

import { DEFAULT_SHOWCASE, SHOWCASE_GROUPS, SHOWCASE_INHALT, SHOWCASE_RATIOS, SHOWCASE_SIZES, SHOWCASE_TYPES } from './videoBrowserShowcaseLogic.js';
import { isKoopGroup } from './videoBrowserGroups.js';

export const SELECTION_KEYS = ['kooperationId', 'videoId', 'folderId', 'itemId'];
const SELECTION_PARAMS = ['k', 'v', 'f', 'i'];

export const EMPTY_SELECTION = Object.freeze({
  kooperationId: null, videoId: null, folderId: null, itemId: null
});

/** Tiefste gewählte Ebene (-1 = nichts). */
export function selectionDepth(sel) {
  let depth = -1;
  SELECTION_KEYS.forEach((key, i) => { if (sel?.[key]) depth = i; });
  return depth;
}

/** Zeile in Ebene `depth` wählen und alle tieferen Ebenen leeren. */
export function selectLevel(sel, depth, id) {
  const next = { ...EMPTY_SELECTION };
  for (let i = 0; i < depth; i++) next[SELECTION_KEYS[i]] = sel?.[SELECTION_KEYS[i]] || null;
  next[SELECTION_KEYS[depth]] = id || null;
  return next;
}

/** Alles ab Ebene `depth` leeren (Pfadleiste). */
export function clearFrom(sel, depth) {
  const next = { ...EMPTY_SELECTION };
  for (let i = 0; i < depth; i++) next[SELECTION_KEYS[i]] = sel?.[SELECTION_KEYS[i]] || null;
  return next;
}

export function findKoop(tree, id) {
  return (tree?.kooperationen || []).find(k => k.id === id) || null;
}
export function findRow(koop, id) {
  return (koop?.rows || []).find(r => r.id === id) || null;
}
export function findFolder(row, id) {
  return (row?.folders || []).find(f => f.id === id) || null;
}
export function findItem(folder, id) {
  return (folder?.items || []).find(i => i.id === id) || null;
}

/** Löst die Auswahl gegen den Baum auf. Fehlende Knoten bleiben null. */
export function resolveSelection(tree, sel) {
  const koop = findKoop(tree, sel?.kooperationId);
  const row = findRow(koop, sel?.videoId);
  const folder = findFolder(row, sel?.folderId);
  const item = findItem(folder, sel?.itemId);
  return { koop, row, folder, item };
}

/** Leert die Auswahl ab der ersten Ebene, deren Knoten nicht (mehr) existiert. */
export function validateSelection(sel, tree) {
  const { koop, row, folder, item } = resolveSelection(tree, sel);
  const nodes = [koop, row, folder, item];
  const out = { ...EMPTY_SELECTION };
  for (let i = 0; i < SELECTION_KEYS.length; i++) {
    if (!sel?.[SELECTION_KEYS[i]] || !nodes[i]) break;
    out[SELECTION_KEYS[i]] = sel[SELECTION_KEYS[i]];
  }
  return out;
}

/**
 * Wer einen Ordner mit genau einer Datei öffnet, landet direkt in der Datei
 * (ein Klick statt zwei). Rohmaterial bleibt außen vor: dort ist die Liste der Inhalt.
 */
export function withAutoItem(sel, tree) {
  if (!sel?.folderId || sel?.itemId) return sel;
  const { folder } = resolveSelection(tree, sel);
  if (!folder || folder.kind === 'raw' || folder.items.length !== 1) return sel;
  return { ...sel, itemId: folder.items[0].id };
}

export function selectionEquals(a, b) {
  return SELECTION_KEYS.every(k => (a?.[k] || null) === (b?.[k] || null));
}

/* URL: ?k=…&v=…&f=…&i=… neben ?tab= und ?linie= */

export function selectionFromSearch(search) {
  const params = new URLSearchParams(search || '');
  const sel = { ...EMPTY_SELECTION };
  SELECTION_KEYS.forEach((key, i) => { sel[key] = params.get(SELECTION_PARAMS[i]) || null; });
  return validateChain(sel);
}

function validateChain(sel) {
  const out = { ...EMPTY_SELECTION };
  for (const key of SELECTION_KEYS) {
    if (!sel[key]) break;
    out[key] = sel[key];
  }
  return out;
}

/** Neuer Query-String: Auswahl gesetzt, alle anderen Parameter bleiben. */
export function selectionToSearch(search, sel) {
  const params = new URLSearchParams(search || '');
  SELECTION_KEYS.forEach((key, i) => {
    if (sel?.[key]) params.set(SELECTION_PARAMS[i], sel[key]);
    else params.delete(SELECTION_PARAMS[i]);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/* Gruppierung der Spalte 0: ?koopgruppe=creator|linie (`gruppe` gehört dem Showcase und wird dort gelöscht) */

const KOOP_GROUP_PARAM = 'koopgruppe';

/** `null`, wenn die URL keine (gültige) Gruppierung nennt. */
export function koopGroupFromSearch(search) {
  const value = new URLSearchParams(search || '').get(KOOP_GROUP_PARAM);
  return isKoopGroup(value) ? value : null;
}

/** Neuer Query-String: mit `mode` steht die Gruppierung drin, ohne fehlt sie. Fremde Parameter bleiben. */
export function koopGroupToSearch(search, mode) {
  const params = new URLSearchParams(search || '');
  if (isKoopGroup(mode)) params.set(KOOP_GROUP_PARAM, mode);
  else params.delete(KOOP_GROUP_PARAM);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/* URL der Showcase-Ansicht: ?ansicht=showcase&inhalt=final|aktuell&gruppe=…&format=9x16&groesse=M&typ=…&tag=… */

const SHOWCASE_PARAMS = ['ansicht', 'inhalt', 'gruppe', 'format', 'groesse', 'typ', 'tag'];
const ratioToParam = (ratio) => ratio.replace(':', 'x');
const oneOf = (list, value, fallback) => (list.includes(value) ? value : fallback);

/** `null`, wenn die URL nicht den Showcase meint, sonst der Zustand (unbekannte Werte fallen auf den Standard). */
export function showcaseFromSearch(search) {
  const params = new URLSearchParams(search || '');
  if (params.get('ansicht') !== 'showcase') return null;
  const ratios = SHOWCASE_RATIOS.map(r => r.value);
  const fmt = (params.get('format') || '').replace('x', ':');
  const typ = params.get('typ');
  return {
    inhalt: oneOf(SHOWCASE_INHALT.map(i => i.value), params.get('inhalt'), DEFAULT_SHOWCASE.inhalt),
    group: oneOf(SHOWCASE_GROUPS.map(g => g.value), params.get('gruppe'), DEFAULT_SHOWCASE.group),
    fmt: oneOf(ratios, fmt, DEFAULT_SHOWCASE.fmt),
    size: oneOf(SHOWCASE_SIZES.map(s => s.value), params.get('groesse'), DEFAULT_SHOWCASE.size),
    typ: SHOWCASE_TYPES.some(t => t.id === typ) ? typ : null,
    tag: params.get('tag') || null
  };
}

/** Neuer Query-String: mit `state` (Showcase offen) stehen die Werte drin, mit `null` fehlen sie. Fremde Parameter bleiben. */
export function showcaseToSearch(search, state) {
  const params = new URLSearchParams(search || '');
  SHOWCASE_PARAMS.forEach(key => params.delete(key));
  if (state) {
    params.set('ansicht', 'showcase');
    params.set('inhalt', state.inhalt);
    params.set('gruppe', state.group);
    params.set('format', ratioToParam(state.fmt));
    params.set('groesse', state.size);
    if (state.typ) params.set('typ', state.typ);
    if (state.tag) params.set('tag', state.tag);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
