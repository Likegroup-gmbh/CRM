// videoBrowserSelection.js
// Auswahl im Spaltenbrowser (Kooperation → Video → Ordner → Datei) und ihre Abbildung auf die URL.

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
