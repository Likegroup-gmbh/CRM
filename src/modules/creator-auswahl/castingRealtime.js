// castingRealtime.js
// Live-Updates der Casting-Tabelle: Was die andere Seite (Kunde oder Team) speichert,
// erscheint ohne Neuladen. Ein Feld mit Fokus oder ungespeichertem Text behält
// den lokalen Stand, dessen Save schreibt danach ohnehin.

import { hasUnsavedTextEdit, rememberTextBaseline } from '../../core/table/textFieldBaseline.js';

const IGNORED_KEYS = new Set(['updated_at']);
const NUMBER_DISPLAY_KEYS = new Set(['follower_instagram', 'follower_tiktok']);
// Felder, deren Zelle mehr zeigt als den Input-Wert (Chip, Status-Punkt).
const ROW_RENDER_KEYS = new Set(['link_instagram']);

function sameValue(a, b) {
  if ((a ?? null) === (b ?? null)) return true;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function changedKeys(item, row) {
  return Object.keys(row || {}).filter(k => !IGNORED_KEYS.has(k) && !sameValue(item?.[k], row[k]));
}

function isEditing(el) {
  return el === document.activeElement || hasUnsavedTextEdit(el);
}

function isTypingIn(root) {
  const active = document.activeElement;
  return !!(root && active && root.contains(active) && active.matches?.('input, textarea, select, [contenteditable="true"]'));
}

function flash(el) {
  el.classList.add('field-updated');
  setTimeout(() => el.classList.remove('field-updated'), 2000);
}

function patchField(detail, el, value) {
  if (el.type === 'checkbox') {
    const checked = !!value;
    if (el.checked === checked) return;
    el.checked = checked;
  } else if (NUMBER_DISPLAY_KEYS.has(el.dataset.field)) {
    detail.refreshNumberCell(el, value);
    rememberTextBaseline(el);
  } else {
    const text = value == null ? '' : String(value);
    if (el.value === text) return;
    el.value = text;
    rememberTextBaseline(el);
  }
  flash(el);
}

/**
 * Übernimmt eine geänderte Zeile in Item und DOM.
 * @returns {'missing'|'unchanged'|'applied'|'deferred'}
 */
export function applyCastingRowUpdate(detail, row) {
  const item = detail.items.find(i => i.id === row?.id);
  if (!item) return 'missing';
  const keys = changedKeys(item, row);
  if (!keys.length) return 'unchanged';

  const rowEl = detail._q(`.item-row[data-item-id="${row.id}"]`);
  let needsRow = false;
  for (const key of keys) {
    // Tabelle und offener Detail-Drawer zeigen dieselben Felder.
    const fields = [...document.querySelectorAll(`[data-item-id="${row.id}"][data-field="${key}"]`)];
    if (fields.some(isEditing)) continue;
    item[key] = row[key];
    const inputs = fields.filter(f => f.matches('input, textarea, select'));
    if (!inputs.length || ROW_RENDER_KEYS.has(key)) needsRow = true;
    inputs.forEach(el => patchField(detail, el, row[key]));
  }

  if (!needsRow || !rowEl) return 'applied';
  if (isTypingIn(rowEl)) return 'deferred';
  detail.refreshItemRow(row.id);
  return 'applied';
}

/** Neue oder gelöschte Zeilen ändern Reihenfolge und Zähler: ganze Tabelle neu. */
export function rerenderUnlessTyping(detail) {
  const table = detail._q('.table-container');
  if (isTypingIn(table)) return false;
  detail.rerenderTable();
  return true;
}

export async function handleCastingRealtime(detail, payload, { loadItems } = {}) {
  const type = payload?.eventType;
  if (type === 'UPDATE') {
    if (applyCastingRowUpdate(detail, payload.new) !== 'missing') return;
  }

  if (type === 'DELETE') {
    const id = payload.old?.id;
    if (!id || !detail.items.some(i => i.id === id)) return;
    detail.items = detail.items.filter(i => i.id !== id);
    detail.selectedItems?.delete?.(id);
    rerenderUnlessTyping(detail);
    return;
  }

  // INSERT oder UPDATE einer Zeile, die lokal fehlt: mit Joins nachladen.
  const id = payload?.new?.id;
  if (!id || detail.items.some(i => i.id === id) || !loadItems) return;
  const fresh = await loadItems();
  const known = new Set(detail.items.map(i => i.id));
  const added = (fresh || []).filter(i => !known.has(i.id));
  if (!added.length) return;
  detail.items = [...detail.items, ...added];
  rerenderUnlessTyping(detail);
}
