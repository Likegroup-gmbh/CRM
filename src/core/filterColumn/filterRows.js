// Filtern und Sortieren von Zeilen im Browser, für Tabellen, die ihre Zeilen
// komplett im Speicher halten. Jede Filterdefinition liest ihren Wert über
// get(row) (Einzelwert oder Liste) oder prüft selbst über match(row, value).
// Eine Sortierung ohne get ist „Manuell“ und lässt die Reihenfolge, wie sie ist.

import { isActive } from './filterColumnValues.js';

const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });

function toNumber(raw) {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function toDay(raw) {
  if (!raw) return '';
  const text = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function asList(raw) {
  if (Array.isArray(raw)) return raw.filter((entry) => entry != null && entry !== '').map(String);
  if (raw == null || raw === '') return [];
  return [String(raw)];
}

/** Spannen treffen, wenn einer der Werte passt (z. B. die Videos einer Kooperation). */
function asValues(raw) {
  return Array.isArray(raw) ? raw : [raw];
}

export function matchesFilter(filter, row, selected) {
  if (!isActive(selected)) return true;
  if (typeof filter.match === 'function') return filter.match(row, selected);
  const raw = filter.get ? filter.get(row) : row?.[filter.id];

  switch (filter.type) {
    case 'multiSelect': {
      const wanted = new Set(asList(selected));
      return asList(raw).some((entry) => wanted.has(entry));
    }
    case 'select':
      return asList(raw).includes(String(selected));
    case 'boolean':
      return Boolean(raw) === selected;
    case 'numberRange': {
      const min = toNumber(selected.min);
      const max = toNumber(selected.max);
      return asValues(raw).some((entry) => {
        const n = toNumber(entry);
        return n != null && (min == null || n >= min) && (max == null || n <= max);
      });
    }
    case 'dateRange':
    case 'date-range':
      return asValues(raw).some((entry) => {
        const day = toDay(entry);
        return !!day && (!selected.from || day >= selected.from) && (!selected.to || day <= selected.to);
      });
    case 'date':
      return toDay(raw) === String(selected);
    case 'number':
      return toNumber(raw) === toNumber(selected);
    case 'text':
    default:
      return asList(raw).some((entry) => entry.toLowerCase().includes(String(selected).trim().toLowerCase()));
  }
}

export function filterRows(rows, filters, values) {
  const active = (filters || []).filter((filter) => isActive(values?.[filter.id]));
  if (!active.length) return [...(rows || [])];
  return (rows || []).filter((row) => active.every((filter) => matchesFilter(filter, row, values[filter.id])));
}

export function isManualSort(sortDef) {
  return !sortDef || typeof sortDef.get !== 'function';
}

function compareValues(a, b, type) {
  if (type === 'number') return a - b;
  if (type === 'date') return a < b ? -1 : a > b ? 1 : 0;
  return collator.compare(a, b);
}

function normalize(raw, type) {
  if (type === 'number') return toNumber(raw);
  if (type === 'date') return toDay(raw) || null;
  if (raw == null) return null;
  const text = String(raw).trim();
  return text === '' ? null : text;
}

/**
 * Stabile Sortierung, leere Werte stehen immer am Ende.
 * @param {Array} rows
 * @param {{ get?: Function, type?: 'text'|'number'|'date', direction?: 'asc'|'desc' }} sortDef
 */
export function sortRows(rows, sortDef) {
  const list = [...(rows || [])];
  if (isManualSort(sortDef)) return list;
  const type = sortDef.type || 'text';
  const factor = sortDef.direction === 'desc' ? -1 : 1;
  return list
    .map((row, index) => ({ row, index, key: normalize(sortDef.get(row), type) }))
    .sort((a, b) => {
      if (a.key == null && b.key == null) return a.index - b.index;
      if (a.key == null) return 1;
      if (b.key == null) return -1;
      return compareValues(a.key, b.key, type) * factor || a.index - b.index;
    })
    .map((entry) => entry.row);
}

/** Optionen eines Auswahlfilters aus den vorhandenen Zeilen, alphabetisch. */
export function optionsFromRows(rows, get) {
  const seen = new Map();
  for (const row of rows || []) {
    for (const entry of [].concat(get(row) ?? [])) {
      if (entry == null || entry === '') continue;
      const option = typeof entry === 'object' ? entry : { value: String(entry), label: String(entry) };
      if (!seen.has(String(option.value))) seen.set(String(option.value), { value: String(option.value), label: String(option.label) });
    }
  }
  return [...seen.values()].sort((a, b) => collator.compare(a.label, b.label));
}
