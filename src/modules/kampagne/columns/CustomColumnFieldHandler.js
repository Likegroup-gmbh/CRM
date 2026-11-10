// CustomColumnFieldHandler.js
// Inline-Editing fuer Custom Column Werte.
// UPSERT in custom_column_values, dynamische Dropdown-Optionen.

import { CustomColumnDataLoader } from './CustomColumnDataLoader.js';

export class CustomColumnFieldHandler {

  /**
   * Prueft ob ein DOM-Feld ein Custom Column Feld ist.
   * Erkennt sowohl direkte data-custom-column-id Attribute als auch
   * CustomDatePicker Inputs mit data-entity="custom".
   */
  static isCustomColumnField(field) {
    if (field.getAttribute('data-custom-column-id')) return true;
    if (field.getAttribute('data-entity') === 'custom') return true;
    return false;
  }

  /**
   * Behandelt ein Custom Column Field-Update.
   * Gibt true zurueck wenn erfolgreich, wirft bei Fehler.
   */
  static readUpdate(field) {
    let columnId = field.getAttribute('data-custom-column-id');
    let entityId = field.getAttribute('data-entity-id');

    if (!columnId && field.getAttribute('data-entity') === 'custom') {
      columnId = field.getAttribute('data-field');
      entityId = field.getAttribute('data-id');
    }

    if (!columnId || !entityId) return null;

    let value;
    if (field.type === 'checkbox') {
      value = field.checked ? 'true' : 'false';
    } else if (field.classList.contains('custom-date-picker__input')) {
      value = field.dataset.isoValue || field.value || '';
    } else {
      value = field.value;
    }

    return { columnId, entityId, value };
  }

  static async handleUpdate(field, store) {
    const read = this.readUpdate(field);
    if (!read) {
      console.warn('⚠️ Custom Column Update: columnId oder entityId fehlt');
      return false;
    }
    const { columnId, entityId, value } = read;

    console.log(`💾 Custom Column Update:`, { columnId, entityId, value });

    const previous = store?.getCustomColumnValue(entityId, columnId);
    store?.updateCustomColumnValue(entityId, columnId, value);

    try {
      await CustomColumnDataLoader.upsertValue(columnId, entityId, value);
    } catch (error) {
      store?.updateCustomColumnValue(entityId, columnId, previous);
      throw error;
    }

    // Dropdown: Neuen Wert dynamisch als Option hinzufuegen
    if (field.classList.contains('custom-col-select') && value) {
      await this._ensureDropdownOption(columnId, value, store);
    }

    return true;
  }

  /**
   * Stellt sicher, dass ein Dropdown-Wert als Option existiert.
   * Fuegt ihn dynamisch hinzu falls nicht vorhanden.
   */
  static async _ensureDropdownOption(columnId, value, store) {
    if (!store) return;

    const col = store.customColumns.find(c => c.id === columnId);
    if (!col || col.field_type !== 'dropdown') return;

    const options = col._dropdownOptions || [];
    const exists = options.some(opt => opt.label === value);
    if (exists) return;

    try {
      const newOpt = await CustomColumnDataLoader.addDropdownOption(columnId, value);
      if (!col._dropdownOptions) col._dropdownOptions = [];
      col._dropdownOptions.push(newOpt);
    } catch (error) {
      console.warn('⚠️ Dropdown-Option konnte nicht hinzugefügt werden:', error);
    }
  }
}
