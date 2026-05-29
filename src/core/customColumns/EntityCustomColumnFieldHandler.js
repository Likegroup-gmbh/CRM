// EntityCustomColumnFieldHandler.js
// Inline-Editing fuer generische Custom Column Werte (Sourcing/Strategie).
// UPSERT ueber EntityCustomColumnDataLoader, dynamische Dropdown-Optionen.

export class EntityCustomColumnFieldHandler {
  /**
   * Prueft ob ein DOM-Feld ein Custom-Column-Feld ist.
   */
  static isCustomColumnField(field) {
    if (field.getAttribute('data-custom-column-id')) return true;
    if (field.getAttribute('data-entity') === 'custom') return true;
    return false;
  }

  /**
   * @param {HTMLElement} field
   * @param {object} ctx
   * @param {import('./EntityCustomColumnDataLoader.js').EntityCustomColumnDataLoader} ctx.dataLoader
   * @param {Array} ctx.columns  Spalten-Definitionen (mit _dropdownOptions)
   * @param {(entityId:string, columnId:string, value:string)=>void} [ctx.onValueChange]
   * @returns {Promise<boolean>}
   */
  static async handleUpdate(field, { dataLoader, columns, onValueChange }) {
    let columnId = field.getAttribute('data-custom-column-id');
    let entityId = field.getAttribute('data-entity-id');

    // CustomDatePicker-Inputs nutzen data-entity="custom" + data-field/data-id
    if (!columnId && field.getAttribute('data-entity') === 'custom') {
      columnId = field.getAttribute('data-field');
      entityId = field.getAttribute('data-id');
    }

    if (!columnId || !entityId) return false;

    let value;
    if (field.type === 'checkbox') {
      value = field.checked ? 'true' : 'false';
    } else if (field.classList.contains('custom-date-picker__input')) {
      value = field.dataset.isoValue || field.value || '';
    } else {
      value = field.value;
    }

    await dataLoader.upsertValue(columnId, entityId, value);
    onValueChange?.(entityId, columnId, value);

    if (field.classList.contains('custom-col-select') && value) {
      await this._ensureDropdownOption(columnId, value, columns, dataLoader);
    }
    return true;
  }

  static async _ensureDropdownOption(columnId, value, columns, dataLoader) {
    const col = (columns || []).find(c => c.id === columnId);
    if (!col || col.field_type !== 'dropdown') return;
    const options = col._dropdownOptions || [];
    if (options.some(opt => opt.label === value)) return;
    try {
      const newOpt = await dataLoader.addDropdownOption(columnId, value);
      (col._dropdownOptions ||= []).push(newOpt);
    } catch (error) {
      console.warn('⚠️ Dropdown-Option konnte nicht hinzugefügt werden:', error);
    }
  }
}
