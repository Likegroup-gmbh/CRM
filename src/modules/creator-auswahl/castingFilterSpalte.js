// Filter und Sortierungen der Casting-Tabelle für die Filterspalte.
// Kunden bekommen nur Filter auf Spalten, die sie sehen; Preise und Matching nur das Team.

import { createTableFilter } from '../../core/filterColumn/tableFilterColumn.js';
import { customColumnFilterDefs, customColumnFilterGroup } from '../../core/filterColumn/customColumnFilters.js';
import {
  SOURCING_FEEDBACK_FILTER_TAGS,
  SOURCING_PROZESS_FILTER_TAGS,
  matchesStatusFilter
} from './sourcingStatusOptions.js';
import { CREATOR_TYP_OPTIONS } from './creatorTypeOptions.js';
import { isColumnVisibleForCustomer } from './sourcingSpaltenSichtbarkeit.js';
import {
  NICHT_UMSETZEN_KATEGORIE,
  NICHT_UMSETZEN_KEY,
  OHNE_KATEGORIE,
  OHNE_KATEGORIE_KEY,
  kategorieGroupKey,
  orderedKategorieGroups
} from './castingKategorien.js';

export const CASTING_FILTER_KEY = 'casting';

const toOptions = (labels) => labels.map((label) => ({ value: label, label }));

/** Preise sind Freitext („1.500 €“, „800“). Liest die erste Zahl, Tausenderpunkte inklusive. */
export function parsePreis(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const match = String(raw).match(/\d[\d.\s]*(?:,\d+)?/);
  if (!match) return null;
  const n = Number(match[0].replace(/[.\s]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function followerOf(item) {
  const values = [item?.follower_instagram, item?.follower_tiktok].map(Number).filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

function preisVideoOf(item) {
  return parsePreis(item?.preis_reels) ?? parsePreis(item?.preis_tiktok_video);
}

function kategorieOptions(items, teilbereiche) {
  return orderedKategorieGroups(items, teilbereiche).map((group) => ({
    value: group.key,
    label: group.key === OHNE_KATEGORIE_KEY ? OHNE_KATEGORIE
      : group.key === NICHT_UMSETZEN_KEY ? NICHT_UMSETZEN_KATEGORIE
        : group.label
  }));
}

/**
 * @param {{ items?: Array, teilbereiche?: string[], isKunde?: boolean, hiddenColumns?: string[],
 *   customManager?: object }} ctx
 */
export function castingFilterDefs({ items = [], teilbereiche = [], isKunde = false, hiddenColumns = [], customManager = null } = {}) {
  const sichtbar = (col) => !isKunde || isColumnVisibleForCustomer(col, true, hiddenColumns || []);
  const defs = [
    {
      id: 'status', label: 'Status', type: 'multiSelect', column: 'cp-col-status',
      options: toOptions(SOURCING_PROZESS_FILTER_TAGS),
      match: (item, value) => matchesStatusFilter(item, value)
    },
    {
      id: 'feedback', label: 'Kundenfeedback', type: 'multiSelect', column: 'cp-col-kunden-feedback',
      options: toOptions(SOURCING_FEEDBACK_FILTER_TAGS),
      match: (item, value) => matchesStatusFilter(item, value)
    },
    {
      id: 'kategorie', label: 'Kategorie', type: 'multiSelect',
      options: kategorieOptions(items, teilbereiche),
      get: (item) => kategorieGroupKey(item)
    },
    {
      id: 'typ', label: 'Creator Art', type: 'multiSelect', column: 'cp-col-typ',
      options: toOptions(CREATOR_TYP_OPTIONS),
      get: (item) => item.typ
    },
    {
      id: 'follower', label: 'Follower', type: 'numberRange', column: 'cp-col-follower',
      get: followerOf
    },
    {
      id: 'datensatz', label: 'Creator-Datensatz vorhanden', type: 'boolean', teamOnly: true,
      get: (item) => !!item.creator_id
    },
    {
      id: 'preis_video', label: 'Preis Video', type: 'numberRange', column: 'cp-col-preis-video', teamOnly: true,
      get: preisVideoOf
    }
  ];
  const eigene = customColumnFilterDefs(
    customManager?.getOrderedColumns?.() || [],
    (item, col) => customManager.getValue(item.id, col.id),
    { isKunde, hiddenColumns }
  );
  return [
    ...defs.filter((def) => !(isKunde && def.teamOnly) && (!def.column || sichtbar(def.column))),
    ...eigene
  ];
}

export const CASTING_FILTER_GROUPS = Object.freeze([
  { id: 'basic', label: 'Status und Kategorie', expanded: true, filters: ['status', 'feedback', 'kategorie'] },
  { id: 'profil', label: 'Profil', expanded: true, filters: ['typ', 'follower', 'datensatz'] },
  { id: 'preise', label: 'Preise', expanded: false, filters: ['preis_video'] }
]);

export function castingFilterGroups(defs) {
  return [...CASTING_FILTER_GROUPS, ...customColumnFilterGroup(defs)];
}

export function castingSorts({ isKunde = false } = {}) {
  const sorts = [
    { id: 'manuell', label: 'Manuell' },
    { id: 'name', label: 'Name, A–Z', get: (item) => item.name },
    { id: 'follower', label: 'Follower, meiste zuerst', type: 'number', direction: 'desc', get: followerOf },
    { id: 'neu', label: 'Zuletzt hinzugefügt', type: 'date', direction: 'desc', get: (item) => item.created_at },
    { id: 'matching', label: 'Matching, bestes zuerst', type: 'number', direction: 'desc', teamOnly: true, get: (item) => item.matching_score },
    { id: 'preis_video', label: 'Preis Video, günstigste zuerst', type: 'number', teamOnly: true, get: preisVideoOf }
  ];
  return sorts.filter((sort) => !(isKunde && sort.teamOnly));
}

export function createCastingTableFilter(ctx = {}) {
  const filters = castingFilterDefs(ctx);
  return createTableFilter({
    key: CASTING_FILTER_KEY,
    filters,
    groups: castingFilterGroups(filters),
    sorts: castingSorts(ctx),
    defaultSort: 'manuell'
  });
}
