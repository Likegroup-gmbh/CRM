// Liest Filterwerte aus den Steuerungen der Filterspalte und schreibt sie zurück.

import { settleRezensionFilters } from './rezension.js';

function cssId(value) {
  return String(value).replace(/["\\]/g, '\\$&');
}

export function isActive(value) {
  if (value == null || value === '') return false;
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

export function readFiltersFromColumn(root, filters) {
  const result = {};
  for (const filter of filters) {
    const value = readOne(root, filter);
    if (isActive(value)) result[filter.id] = value;
  }
  return settleRezensionFilters(result);
}

function readOne(root, filter) {
  const id = filter.id;
  switch (filter.type) {
    case 'text':
    case 'date':
    case 'number':
      return root.querySelector(`[data-filter-id="${cssId(id)}"]`)?.value?.trim() || '';
    case 'select':
    case 'boolean': {
      const raw = root.querySelector(`select[data-filter-id="${cssId(id)}"]`)?.value;
      if (filter.type === 'boolean') {
        if (raw === 'true') return true;
        if (raw === 'false') return false;
        return null;
      }
      return raw || '';
    }
    case 'multiSelect': {
      const boxes = root.querySelectorAll(`input[type="checkbox"][data-filter-id="${cssId(id)}"]:checked`);
      return Array.from(boxes).map((box) => box.value);
    }
    case 'dateRange':
    case 'date-range':
    case 'numberRange': {
      const fromInput = root.querySelector(`[data-filter-id="${cssId(id)}"][data-range="from"], [data-filter-id="${cssId(id)}"][data-range="min"]`);
      const toInput = root.querySelector(`[data-filter-id="${cssId(id)}"][data-range="to"], [data-filter-id="${cssId(id)}"][data-range="max"]`);
      const fromValue = fromInput?.value;
      const toValue = toInput?.value;
      if (!fromValue && !toValue) return null;
      const value = {};
      const isDate = filter.type === 'dateRange' || filter.type === 'date-range';
      if (fromValue) value[isDate ? 'from' : 'min'] = fromValue;
      if (toValue) value[isDate ? 'to' : 'max'] = toValue;
      return value;
    }
    default:
      return null;
  }
}

export function paintFilterValues(root, filters, values) {
  for (const filter of filters) {
    const value = values?.[filter.id];
    const id = cssId(filter.id);
    if (filter.type === 'multiSelect') {
      const selected = new Set(Array.isArray(value) ? value : []);
      root.querySelectorAll(`input[type="checkbox"][data-filter-id="${id}"]`).forEach((box) => {
        box.checked = selected.has(box.value);
      });
    } else if (filter.type === 'boolean') {
      const select = root.querySelector(`select[data-filter-id="${id}"]`);
      if (select) select.value = value === true ? 'true' : value === false ? 'false' : '';
    } else if (filter.type === 'select' || filter.type === 'text' || filter.type === 'date' || filter.type === 'number') {
      const input = root.querySelector(`[data-filter-id="${id}"]`);
      if (input) input.value = value ?? '';
    } else if (filter.type === 'numberRange') {
      const min = root.querySelector(`[data-filter-id="${id}"][data-range="min"]`);
      const max = root.querySelector(`[data-filter-id="${id}"][data-range="max"]`);
      if (min) min.value = value?.min ?? '';
      if (max) max.value = value?.max ?? '';
    } else if (filter.type === 'dateRange' || filter.type === 'date-range') {
      const from = root.querySelector(`[data-filter-id="${id}"][data-range="from"]`);
      const to = root.querySelector(`[data-filter-id="${id}"][data-range="to"]`);
      if (from) from.value = value?.from ?? '';
      if (to) to.value = value?.to ?? '';
    }
  }
}
