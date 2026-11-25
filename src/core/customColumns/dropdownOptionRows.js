// Dropdown-Optionen mit demselben Ziehgriff wie die Spalten im Drawer
// "Tabelle anpassen". Gespeicherte Optionen schreiben Positionen 0…n-1.

import { escapeHtml } from './entityColumnUtils.js';
import { icon } from '../icons/IconSystem.js';
import { bindGripReorder } from '../list/gripReorder.js';

function optionGrip(label) {
  const safe = escapeHtml(label);
  return `<span class="sourcing-spalten-griff" data-action="drag-option" role="button" tabindex="0" title="Reihenfolge ändern" aria-label="Reihenfolge von ${safe} ändern">${icon('bars-3', { className: 'icon-16' })}</span>`;
}

export function renderSavedOptionsHtml(col) {
  const opts = [...(col._dropdownOptions || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const rows = opts.map(opt => `
    <div class="dd-opt-row" data-option-id="${escapeHtml(opt.id)}" data-column-id="${escapeHtml(col.id)}" draggable="false">
      ${optionGrip(opt.label)}
      <input type="text" class="dd-opt-input dropdown-opt-label" data-option-id="${escapeHtml(opt.id)}" data-column-id="${escapeHtml(col.id)}" value="${escapeHtml(opt.label)}"/>
      <button type="button" class="dd-opt-del dropdown-opt-delete" data-option-id="${escapeHtml(opt.id)}" data-column-id="${escapeHtml(col.id)}" title="Entfernen">&times;</button>
    </div>`).join('');

  return `
    <div class="dd-opts-list" data-column-id="${escapeHtml(col.id)}">${rows || '<p class="dd-opts-empty">Keine Optionen vorhanden.</p>'}</div>
    <div class="dd-opts-add-row">
      <input type="text" class="dd-opt-input dropdown-opt-new-input" data-column-id="${escapeHtml(col.id)}" placeholder="Neue Option…"/>
      <button type="button" class="dd-opts-add-btn dropdown-opt-add-btn" data-column-id="${escapeHtml(col.id)}">+</button>
    </div>`;
}

export function renderDraftOptionsHtml(labels) {
  return (labels || []).map(label => `
    <div class="dd-opt-row cc-new-opt-row" data-draft-label="${escapeHtml(label)}" draggable="false">
      ${optionGrip(label)}
      <span class="dd-opt-text">${escapeHtml(label)}</span>
      <button type="button" class="dd-opt-del cc-new-opt-delete" data-draft-label="${escapeHtml(label)}" title="Entfernen">&times;</button>
    </div>`).join('');
}

export function bindOptionLists(root, { onSaved, onDraft }) {
  if (!root) return () => {};
  const unbinds = [];
  root.querySelectorAll('.dd-opts-list').forEach(list => {
    unbinds.push(bindGripReorder(list, {
      rowSelector: '.dd-opt-row',
      handleSelector: '[data-action="drag-option"]',
      onCommit: () => onSaved?.(list)
    }));
  });
  root.querySelectorAll('.cc-new-dd-list').forEach(list => {
    unbinds.push(bindGripReorder(list, {
      rowSelector: '.dd-opt-row',
      handleSelector: '[data-action="drag-option"]',
      onCommit: () => onDraft?.(list)
    }));
  });
  return () => unbinds.forEach(fn => fn());
}

export function draftLabelsFromList(list) {
  return [...list.querySelectorAll('.dd-opt-row')].map(row => row.dataset.draftLabel);
}

export function restoreOptionOrder(list, ids) {
  const rows = new Map(
    [...list.querySelectorAll('.dd-opt-row')].map(row => [row.dataset.optionId || row.dataset.draftLabel, row])
  );
  for (const id of ids) {
    const row = rows.get(id);
    if (row) list.appendChild(row);
  }
}

/** Schreibt die neue Reihenfolge als Positionen 0…n-1. Bei Fehler bleibt der Speicherstand. */
export async function saveOptionOrder(options, orderedIds, update) {
  const byId = new Map((options || []).map(opt => [opt.id, opt]));
  const ordered = orderedIds.map(id => byId.get(id)).filter(Boolean);
  if (ordered.length !== (options || []).length) return false;
  const changed = ordered.some((opt, index) => opt.position !== index);
  if (!changed) return true;
  await Promise.all(ordered.map((opt, index) => (
    opt.position === index ? Promise.resolve() : update(opt.id, index)
  )));
  ordered.forEach((opt, index) => { opt.position = index; });
  return true;
}

export async function commitSavedOptionOrder(list, { findColumn, update, onChange }) {
  const col = findColumn?.(list.dataset.columnId);
  if (!col) return;
  const previous = [...(col._dropdownOptions || [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(opt => opt.id);
  const next = [...list.querySelectorAll('.dd-opt-row')].map(row => row.dataset.optionId);
  if (next.join('|') === previous.join('|')) return;
  try {
    const ok = await saveOptionOrder(col._dropdownOptions, next, update);
    if (ok === false) throw new Error('Optionen-Reihenfolge unvollständig');
    onChange?.();
  } catch (error) {
    restoreOptionOrder(list, previous);
    console.error('Optionen-Reihenfolge speichern fehlgeschlagen:', error);
    window.toastSystem?.show('Reihenfolge konnte nicht gespeichert werden', 'error');
  }
}
