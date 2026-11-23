// Filterspalte der Masterliste, derselbe Kern wie Casting und Konzept.
// Standard ist die gezogene Reihenfolge; jede andere Sortierung ordnet nur die Ansicht.

import { createTableFilter } from '../../core/filterColumn/tableFilterColumn.js';
import { optionsFromRows } from '../../core/filterColumn/filterRows.js';
import { customColumnFilterDefs, customColumnFilterGroup } from '../../core/filterColumn/customColumnFilters.js';
import { CREATOR_TYP_OPTIONS } from '../creator-auswahl/creatorTypeOptions.js';
import { canManageMasterliste, filterMembers } from './masterliste.js';

export const MASTERLISTE_FILTER_KEY = 'ml';

function zahl(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const str = String(value).trim().replace(/\s/g, '');
  if (!str) return null;
  if (str.endsWith('+')) {
    const n = Number(str.slice(0, -1).replace(/\./g, ''));
    return Number.isFinite(n) ? n : null;
  }
  const teile = str.split('-');
  if (teile.length === 2) {
    const min = Number(teile[0].replace(/\./g, ''));
    const max = Number(teile[1].replace(/\./g, ''));
    if (Number.isFinite(min) && Number.isFinite(max)) return Math.round((min + max) / 2);
  }
  const n = Number(str.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function typOptionen(members) {
  const ausZeilen = optionsFromRows(members, (member) => member.creator?.creatorTypes || []);
  if (ausZeilen.length) return ausZeilen;
  return CREATOR_TYP_OPTIONS.map((typ) => ({ value: typ, label: typ }));
}

export function masterlisteFilterDefs({ members = [], hidden = [], customColumns = null } = {}) {
  const defs = [
    {
      id: 'typ', label: 'Creator Art', type: 'multiSelect',
      options: typOptionen(members),
      get: (member) => member.creator?.creatorTypes || []
    },
    {
      id: 'branchen', label: 'Branchen', type: 'multiSelect',
      options: optionsFromRows(members, (member) => member.creator?.branchen || []),
      get: (member) => member.creator?.branchen || []
    },
    {
      id: 'sprachen', label: 'Sprachen', type: 'multiSelect',
      options: optionsFromRows(members, (member) => member.creator?.sprachen || []),
      get: (member) => member.creator?.sprachen || []
    },
    {
      id: 'ort', label: 'Ort', type: 'multiSelect',
      options: optionsFromRows(members, (member) => member.creator?.lieferadresse_stadt || ''),
      get: (member) => member.creator?.lieferadresse_stadt || ''
    },
    {
      id: 'datensatz', label: 'Creator-Datensatz vorhanden', type: 'boolean',
      get: (member) => !!member.hatDatensatz
    },
    {
      id: 'follower_ig', label: 'Follower Instagram', type: 'numberRange',
      get: (member) => zahl(member.creator?.instagram_follower)
    },
    {
      id: 'follower_tt', label: 'Follower TikTok', type: 'numberRange',
      get: (member) => zahl(member.creator?.tiktok_follower)
    },
    {
      id: 'engagement', label: 'Engagement-Rate', type: 'numberRange',
      get: (member) => zahl(member.creator?.ig_engagement_rate)
    }
  ];
  const eigene = customColumnFilterDefs(
    customColumns?.getOrderedColumns?.() || [],
    (member, col) => customColumns.getValue(member.memberId, col.id),
    { hiddenColumns: hidden }
  );
  return [...defs, ...eigene];
}

export function masterlisteFilterGroups(defs) {
  return [
    { id: 'profil', label: 'Profil', expanded: true, filters: ['typ', 'branchen', 'sprachen', 'ort', 'datensatz'] },
    { id: 'reichweite', label: 'Reichweite', expanded: true, filters: ['follower_ig', 'follower_tt', 'engagement'] },
    ...customColumnFilterGroup(defs)
  ];
}

export function masterlisteSorts() {
  return [
    { id: 'manuell', label: 'Manuell' },
    { id: 'name', label: 'Name, A–Z', get: (member) => member.creator?.name || '' },
    { id: 'follower_ig', label: 'Follower Instagram, meiste zuerst', type: 'number', direction: 'desc', get: (member) => zahl(member.creator?.instagram_follower) },
    { id: 'follower_tt', label: 'Follower TikTok, meiste zuerst', type: 'number', direction: 'desc', get: (member) => zahl(member.creator?.tiktok_follower) },
    { id: 'engagement', label: 'Engagement, höchstes zuerst', type: 'number', direction: 'desc', get: (member) => zahl(member.creator?.ig_engagement_rate) },
    { id: 'neu', label: 'Zuletzt hinzugefügt', type: 'date', direction: 'desc', get: (member) => member.addedAt }
  ];
}

export function createMasterlisteTableFilter(ctx = {}) {
  const filters = masterlisteFilterDefs(ctx);
  return createTableFilter({
    key: MASTERLISTE_FILTER_KEY,
    filters,
    groups: masterlisteFilterGroups(filters),
    sorts: masterlisteSorts(),
    defaultSort: 'manuell'
  });
}

/** Optionen an den aktuellen Bestand angleichen. Neue Filter bauen die Spalte neu auf. */
export function syncMasterlisteTableFilter(detail) {
  const filters = masterlisteFilterDefs(detail);
  const sig = filters.map((filter) => `${filter.id}:${filter.options?.length || 0}`).join('|');
  if (!detail.tableFilter) detail.tableFilter = createMasterlisteTableFilter(detail);
  else detail.tableFilter.setFilters(filters, masterlisteFilterGroups(filters));
  if (sig !== detail._filterSig) {
    detail._filterSig = sig;
    detail._filterMounted = false;
  }
}

export function sichtbareMember(detail) {
  const gesucht = filterMembers(detail.members, detail.searchQuery);
  return detail.tableFilter ? detail.tableFilter.apply(gesucht) : gesucht;
}

export function masterlisteHatFilter(detail) {
  return !!String(detail.searchQuery || '').trim() || !!detail.tableFilter?.hasActiveFilters();
}

export function mountMasterlisteFilter(detail) {
  if (detail._filterMounted || !detail.tableFilter) return;
  const root = document.getElementById('masterliste-page');
  if (!root) return;
  detail.tableFilter.mount({ root, onChange: () => detail.renderTable() });
  detail._filterMounted = true;
}

/** Ziehen nur in der manuellen Reihenfolge und ohne aktiven Filter oder Suche. */
export function masterlisteDarfZiehen(detail) {
  return canManageMasterliste()
    && !masterlisteHatFilter(detail)
    && (detail.tableFilter?.isManualSort() ?? true);
}
