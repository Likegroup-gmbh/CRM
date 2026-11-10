// videoBrowserFilter.js
// Tag-Filter der Inhalte-Spalte. Der Zustand (`vb.filter = { folderId, value }`) gilt für einen Ordner,
// "Final" und jedes Tag sind Chips mit Toggle. Es wird nur die Spalte neu gebaut, das Detail bleibt stehen.

import { toggleFilter } from './videoBrowserLogic.js';

function apply(vb, nextFilter, focusValue) {
  vb.filter = nextFilter;
  vb._renderNav();
  const rows = vb.colsEl.querySelectorAll('.vb-col--3 .vb-row:not(.vb-row--upload)');
  if (rows.length) vb.motion?.filterRowsIn([...rows]);
  if (focusValue) {
    const chips = [...vb.colsEl.querySelectorAll('[data-vb-filter]')];
    chips.find(c => c.dataset.vbFilter === focusValue)?.focus({ preventScroll: true });
  }
}

/** Chip an- bzw. ausschalten (gleicher Chip hebt auf, ein anderer wechselt). */
export function toggleFolderFilter(vb, value) {
  const folderId = vb.sel.folderId;
  if (!folderId) return;
  apply(vb, toggleFilter(vb.filter, folderId, value), value);
}

export function clearFolderFilter(vb) {
  apply(vb, null, null);
}
