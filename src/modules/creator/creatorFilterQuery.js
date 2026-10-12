// Auswahl der Creator-Übersicht als Query-String.
// Spaltenfilter, Suche, Größe und Generation überleben Reload und geteilte Links.

import { normalizeSort } from './creatorBuchung.js';
import { settleRezensionFilters } from './rezension.js';

const BAR_KEYS = new Set(['q', 'groesse', 'generation', 'video', 'sort']);

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

function splitList(raw) {
  return String(raw || '').split(',').map((entry) => entry.trim()).filter(Boolean);
}

function asParams(search) {
  if (search instanceof URLSearchParams) return search;
  const raw = String(search || '');
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : raw;
  return new URLSearchParams(query);
}

/**
 * @param {string|URLSearchParams} search
 * @param {{ filters?: Array, groessen?: string[], generationen?: string[] }} [options]
 */
export function queryToSelection(search, { filters = [], groessen = [], generationen = [] } = {}) {
  const params = asParams(search);
  const byId = new Map(filters.map((filter) => [filter.id, filter]));

  let groesse = splitList(params.get('groesse'));
  if (groessen.length) groesse = groesse.filter((label) => groessen.includes(label));

  let generation = splitList(params.get('generation'));
  if (generationen.length) generation = generation.filter((label) => generationen.includes(label));

  const videoRaw = params.get('video');
  const legacySort = videoRaw === '30' ? 'video30' : videoRaw === '90' ? 'video90' : '';
  const sort = normalizeSort(params.get('sort') || legacySort);

  const column = {};
  for (const [key, raw] of params.entries()) {
    if (BAR_KEYS.has(key)) continue;
    const filter = byId.get(key);
    if (!filter) continue;
    const value = decodeFilterValue(filter, raw);
    if (value !== undefined) column[key] = value;
  }

  return {
    search: (params.get('q') || '').trim(),
    groesse,
    generation,
    sort,
    filters: settleRezensionFilters(column)
  };
}

/**
 * @param {{ search?: string, groesse?: string[], generation?: string|string[], filters?: object, filterIds?: Set<string> }} selection
 * @returns {URLSearchParams}
 */
export function selectionToQuery({ search = '', groesse = [], generation = [], sort = 'name', filters = {}, filterIds = null } = {}) {
  const params = new URLSearchParams();
  const term = String(search || '').trim();
  if (term) params.set('q', term);
  if (groesse?.length) params.set('groesse', groesse.join(','));
  const generationen = [].concat(generation || []);
  if (generationen.length) params.set('generation', generationen.join(','));
  const sortId = normalizeSort(sort);
  if (sortId !== 'name') params.set('sort', sortId);

  const settled = settleRezensionFilters(filters || {});
  for (const [id, value] of Object.entries(settled)) {
    if (id.startsWith('_')) continue;
    if (filterIds && !filterIds.has(id)) continue;
    const encoded = encodeFilterValue(value);
    if (encoded != null && encoded !== '') params.set(id, encoded);
  }
  return params;
}

export function formatCreatorSumme(total) {
  if (total == null || total === '') return '';
  const n = Number(total);
  if (!Number.isFinite(n) || n < 0) return '';
  return `${new Intl.NumberFormat('de-DE').format(n)} Creator`;
}
