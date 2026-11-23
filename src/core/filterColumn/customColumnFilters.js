// Eigene Spalten (Dropdown, Ja/Nein, Zahl, Datum) als Filter der Filterspalte.
// Text, Link und Upload bleiben der Suche überlassen. Angeboten wird nur, was
// die Rolle in der Tabelle auch sieht.

const FILTER_TYPE = Object.freeze({
  dropdown: 'multiSelect',
  boolean: 'boolean',
  number: 'numberRange',
  date: 'dateRange'
});

export const CUSTOM_FILTER_GROUP_ID = 'eigene';
const PREFIX = 'custom_';

const isTrue = (value) => value === true || value === 'true';
const asList = (raw) => (Array.isArray(raw) ? raw : [raw]).filter((v) => v != null && v !== '');

function dropdownOptions(col) {
  const options = col._dropdownOptions || col.dropdownOptions || [];
  return [...options]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((opt) => ({ value: opt.label, label: opt.label }));
}

/**
 * @param {Array} columns              Spalten { id, name, field_type, visible_for_kunden?, ... }
 * @param {(row, col) => any} getValue Wert der Zeile, bei Video-Spalten einer Kooperation eine Liste
 * @param {{ isKunde?: boolean, hiddenColumns?: string[], kundenSichtbar?: (col) => boolean }} [o]
 */
export function customColumnFilterDefs(columns, getValue, { isKunde = false, hiddenColumns = [], kundenSichtbar } = {}) {
  const sichtbarFuerKunden = kundenSichtbar || ((col) => !!col.visible_for_kunden);
  return (columns || [])
    .filter((col) => FILTER_TYPE[col.field_type])
    .filter((col) => !(isKunde && !sichtbarFuerKunden(col)))
    .filter((col) => !(hiddenColumns || []).includes(`custom:${col.id}`))
    .map((col) => {
      const def = { id: `${PREFIX}${col.id}`, label: col.name || 'Eigene Spalte', type: FILTER_TYPE[col.field_type] };
      if (col.field_type === 'dropdown') def.options = dropdownOptions(col);
      if (col.field_type === 'boolean') {
        // Leer zählt als Nein; bei Listen reicht ein passender Wert.
        def.match = (row, wanted) => {
          const values = asList(getValue(row, col));
          return values.length ? values.some((v) => isTrue(v) === wanted) : wanted === false;
        };
      } else {
        def.get = (row) => getValue(row, col);
      }
      return def;
    });
}

/** Gruppe „Eigene Spalten“ für die gegebenen Filter, eingeklappt. Ohne Filter keine Gruppe. */
export function customColumnFilterGroup(defs) {
  const ids = (defs || []).filter((def) => def.id.startsWith(PREFIX)).map((def) => def.id);
  return ids.length ? [{ id: CUSTOM_FILTER_GROUP_ID, label: 'Eigene Spalten', expanded: false, filters: ids }] : [];
}
