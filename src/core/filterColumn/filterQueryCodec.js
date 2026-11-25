// Filterwerte als Query-String. Die Creator-Datenbank schreibt die Schlüssel direkt,
// Tabellen in der Produktion mit Präfix („casting.status=…“), damit sie sich
// nicht mit tab, linie oder untereinander in die Quere kommen.

function splitRange(raw) {
  const idx = String(raw).indexOf('..');
  if (idx === -1) return [String(raw), ''];
  return [String(raw).slice(0, idx), String(raw).slice(idx + 2)];
}

export function encodeFilterValue(value) {
  if (value === true) return '1';
  if (value === false) return '0';
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.map((entry) => String(entry)).join(',');
  }
  if (value && typeof value === 'object') {
    const left = value.min ?? value.from ?? '';
    const right = value.max ?? value.to ?? '';
    if (left === '' && right === '') return null;
    return `${left}..${right}`;
  }
  if (value == null || value === '') return null;
  return String(value);
}

export function decodeFilterValue(filter, raw) {
  if (raw == null || raw === '') return undefined;
  switch (filter.type) {
    case 'boolean':
      if (raw === '1' || raw === 'true') return true;
      if (raw === '0' || raw === 'false') return false;
      return undefined;
    case 'multiSelect': {
      const values = String(raw).split(',').map((entry) => entry.trim()).filter(Boolean);
      return values.length ? values : undefined;
    }
    case 'numberRange': {
      const [min, max] = splitRange(raw);
      const value = {};
      if (min !== '') value.min = min;
      if (max !== '') value.max = max;
      return Object.keys(value).length ? value : undefined;
    }
    case 'dateRange':
    case 'date-range': {
      const [from, to] = splitRange(raw);
      const value = {};
      if (from !== '') value.from = from;
      if (to !== '') value.to = to;
      return Object.keys(value).length ? value : undefined;
    }
    default:
      return String(raw);
  }
}

export function asParams(search) {
  if (search instanceof URLSearchParams) return search;
  const raw = String(search || '');
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : raw;
  return new URLSearchParams(query);
}

/**
 * @param {string|URLSearchParams} search
 * @param {{ prefix: string, filters?: Array, sorts?: Array<{id:string}>, defaultSort?: string }} options
 * @returns {{ values: object, sort: string }}
 */
export function readPrefixedSelection(search, { prefix, filters = [], sorts = [], defaultSort = '' }) {
  const params = asParams(search);
  const values = {};
  for (const filter of filters) {
    const value = decodeFilterValue(filter, params.get(`${prefix}.${filter.id}`));
    if (value !== undefined) values[filter.id] = value;
  }
  const rawSort = params.get(`${prefix}.sort`);
  const sort = sorts.some((entry) => entry.id === rawSort) ? rawSort : defaultSort;
  return { values, sort };
}

/** Schreibt die Auswahl einer Tabelle in params und entfernt veraltete Schlüssel mit demselben Präfix. */
export function writePrefixedSelection(params, { prefix, values = {}, sort = '', defaultSort = '' }) {
  for (const key of [...params.keys()]) {
    if (key.startsWith(`${prefix}.`)) params.delete(key);
  }
  for (const [id, value] of Object.entries(values)) {
    const encoded = encodeFilterValue(value);
    if (encoded != null && encoded !== '') params.set(`${prefix}.${id}`, encoded);
  }
  if (sort && sort !== defaultSort) params.set(`${prefix}.sort`, sort);
  return params;
}
