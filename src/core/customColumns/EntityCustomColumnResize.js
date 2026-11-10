// EntityCustomColumnResize.js
// Spalten-Resize fuer eigene Spalten in Casting/Konzept.
// Breite per data-custom-col-id, Persistenz in localStorage pro Liste.

const MIN_WIDTH_PX = 80;

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function storageKey(parentType, parentId) {
  return `entity-custom-col-widths_${parentType}_${parentId}`;
}

function pxToRem(px) {
  return `${(px / 16).toFixed(3)}rem`;
}

/** Legacy Pixel-Werte (>25) in rem umrechnen — analog VideoTableUIHelpers. */
export function normalizeStoredWidth(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value > 25 ? value / 16 : value;
}

function colSelector(colId) {
  return `[data-custom-col-id="${colId}"]`;
}

/**
 * Breite auf Header + Zellen mit gleichem data-custom-col-id setzen.
 * Nicht per nth-child — Kategorie-colspan-Zeilen haben andere Zellenzahl.
 * @param {ParentNode} root
 * @param {string} colId  z.B. "custom:{uuid}"
 * @param {number} widthPx
 */
export function setColumnWidth(root, colId, widthPx) {
  if (!root || !colId) return;
  const remStr = pxToRem(widthPx);
  root.querySelectorAll(colSelector(colId)).forEach(el => {
    el.style.width = remStr;
    el.style.minWidth = remStr;
    el.style.maxWidth = remStr;
  });
}

export function loadWidths(parentType, parentId) {
  if (!parentType || !parentId) return {};
  try {
    const saved = getStorage()?.getItem(storageKey(parentType, parentId));
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    const out = {};
    for (const [col, width] of Object.entries(parsed)) {
      const rem = normalizeStoredWidth(width);
      if (rem == null) continue;
      out[col] = rem;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveWidths(parentType, parentId, widths) {
  if (!parentType || !parentId) return;
  try {
    const store = getStorage();
    if (!store) return;
    const obj = widths instanceof Map ? Object.fromEntries(widths) : { ...widths };
    store.setItem(storageKey(parentType, parentId), JSON.stringify(obj));
  } catch { /* ignore */ }
}

export function applySavedWidths(root, parentType, parentId) {
  if (!root) return;
  const saved = loadWidths(parentType, parentId);
  for (const [col, rem] of Object.entries(saved)) {
    setColumnWidth(root, col, rem * 16);
  }
}

/**
 * Bindet mousedown/move/up am Tabellen-Root. Gibt Cleanup zurueck.
 * @param {HTMLElement} root  table (oder Container, der th+td enthaelt)
 * @param {{ parentType: string, parentId: string, minPx?: number }} opts
 * @returns {() => void}
 */
export function bindColumnResize(root, { parentType, parentId, minPx = MIN_WIDTH_PX } = {}) {
  if (!root) return () => {};

  const widths = new Map(Object.entries(loadWidths(parentType, parentId)));
  applySavedWidths(root, parentType, parentId);

  let isResizing = false;
  let resizeCol = null;
  let startX = 0;
  let startWidth = 0;

  const abort = new AbortController();
  const { signal } = abort;

  const startResize = (colId, pageX, handle) => {
    isResizing = true;
    resizeCol = colId;
    startX = pageX;
    const header = handle.closest('.entity-custom-col-header');
    startWidth = header ? header.offsetWidth : 160;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const onMove = (e) => {
    if (!isResizing || !resizeCol) return;
    const delta = e.pageX - startX;
    const newWidth = Math.max(minPx, startWidth + delta);
    widths.set(resizeCol, newWidth / 16);
    setColumnWidth(root, resizeCol, newWidth);
  };

  const endResize = () => {
    if (!isResizing) return;
    isResizing = false;
    resizeCol = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    saveWidths(parentType, parentId, widths);
  };

  root.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.resize-handle-col');
    if (!handle || !root.contains(handle)) return;
    const colId = handle.dataset.col;
    if (!colId) return;
    e.preventDefault();
    e.stopPropagation();
    startResize(colId, e.pageX, handle);
  }, { signal });

  document.addEventListener('mousemove', onMove, { signal });
  document.addEventListener('mouseup', endResize, { signal });

  return () => {
    if (isResizing) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      isResizing = false;
    }
    abort.abort();
  };
}
