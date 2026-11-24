// customColumnSelect.js
// Dropdown-Spalte als internes Dropdown (TableSelect) statt nativem <select>.
// Gespeichert wird über das table-select-change-Event, nicht über change.

import { renderTableSelect } from '../components/TableSelect.js';

export const CUSTOM_SELECT_PREFIX = 'custom-col:';

/** Zellen-HTML eines editierbaren Dropdowns. Der Wert ist das Label der Option. */
export function renderCustomTableSelect(col, entityId, value) {
  const options = (col._dropdownOptions || [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(opt => ({ value: opt.label, label: opt.label }));
  // Wert ohne passende Option (Altbestand) bleibt sichtbar
  if (value && !options.some(opt => opt.value === value)) options.push({ value, label: value });

  return renderTableSelect({
    field: `${CUSTOM_SELECT_PREFIX}${col.id}`,
    itemId: entityId,
    value: value ?? '',
    options: [{ value: '', label: '–' }, ...options],
    input: 'custom-col-value',
    placeholder: '–'
  });
}

/** Hängt das Speichern an table-select-change. Bei Fehler: Toast, dann onError (z. B. neu zeichnen). */
export function bindCustomSelectChange(manager, { signal, onError } = {}) {
  document.addEventListener('table-select-change', (event) => {
    handleCustomSelectChange(manager, event.detail).catch(() => {
      window.toastSystem?.show('Speichern fehlgeschlagen.', 'error');
      onError?.();
    });
  }, { signal });
}

/**
 * Speichert die Auswahl eines Custom-Dropdowns.
 * @param {import('./EntityCustomColumnsManager.js').EntityCustomColumnsManager} manager
 * @param {{ field: string, itemId: string, value: string }} detail  Detail von table-select-change
 * @returns {Promise<boolean>} false, wenn das Event nicht zu einer eigenen Spalte gehört
 */
export async function handleCustomSelectChange(manager, { field, itemId, value } = {}) {
  if (!field?.startsWith(CUSTOM_SELECT_PREFIX) || !itemId) return false;
  const columnId = field.slice(CUSTOM_SELECT_PREFIX.length);
  if (!manager.columns.some(col => col.id === columnId)) return false;

  const previous = manager.getValue(itemId, columnId);
  manager.setValue(itemId, columnId, value);
  try {
    await manager.dataLoader.upsertValue(columnId, itemId, value);
    return true;
  } catch (error) {
    manager.setValue(itemId, columnId, previous);
    throw error;
  }
}
