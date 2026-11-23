// Filterspalte der Creator-Übersicht.
// Darstellung und Verdrahtung kommen aus core/filterColumn; hier liegen die
// Creator-Filter (Größe, Generation, Favoriten, Rezension) und die Sortierungen.

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { loadSelectOptions } from '../../core/filters/FilterDropdownSelectOptions.js';
import { syncFilterSelects } from '../../core/filters/FilterSelect.js';
import {
  bindFilterColumn,
  columnStartsCollapsed as startsCollapsed,
  countActiveByGroup,
  groupColumnFilters,
  renderColumnBody as renderBody,
  renderSortBlock as renderSorts
} from '../../core/filterColumn/filterColumnView.js';
import { CREATOR_SORTS, normalizeSort } from './creatorBuchung.js';
import { GENERATIONEN, GROESSEN } from './creatorProfil.js';
import { settleRezensionFilters } from './rezension.js';
import { paintFilterValues, readFiltersFromColumn } from './creatorFilterValues.js';
import { queryToSelection } from './creatorFilterQuery.js';
import { ladeFavoritPersonen } from './creatorFavorit.js';

export { paintFilterValues, readFiltersFromColumn, groupColumnFilters, countActiveByGroup };

const STORAGE_KEY = 'creator-filter-column-collapsed';
const SORT_NAME = 'creator-sort';
// Auswahl-Filter mit genau einem Wert. Alle übrigen erlauben in der Spalte mehrere.
const SINGLE_SELECT = new Set(['rezension_min']);
const SORT_OPTIONS = CREATOR_SORTS.map((entry) => ({ id: entry.id, label: entry.label }));

export function columnStartsCollapsed() {
  return startsCollapsed(STORAGE_KEY);
}

export function overviewColumnFilters(filters) {
  const extra = [
    {
      id: 'groesse',
      label: 'Größe',
      type: 'multiSelect',
      options: GROESSEN.map((label) => ({ value: label, label }))
    },
    {
      id: 'generation',
      label: 'Generation',
      type: 'multiSelect',
      options: GENERATIONEN.map((entry) => ({ value: entry.label, label: entry.label }))
    }
  ];
  const ids = new Set((filters || []).map((filter) => filter.id));
  const multi = (filters || []).map((filter) => (
    filter.type === 'select' && !SINGLE_SELECT.has(filter.id) ? { ...filter, type: 'multiSelect' } : filter
  ));
  return [...extra.filter((filter) => !ids.has(filter.id)), ...multi];
}

export function overviewColumnGroups(groups) {
  const lead = ['groesse', 'generation', 'favorit_von', 'creator_tag_id'];
  return (groups || []).map((group) => {
    if (group.id !== 'basic') return group;
    const rest = (group.filters || []).filter((id) => !lead.includes(id));
    return { ...group, filters: [...lead, ...rest] };
  });
}

export function renderSortBlock(sort = 'name') {
  return renderSorts(SORT_OPTIONS, normalizeSort(sort), { name: SORT_NAME });
}

export function renderColumnBody(filters, groups, values = {}, sort = 'name') {
  return renderBody(filters, groups, values, { sorts: SORT_OPTIONS, sort: normalizeSort(sort), sortName: SORT_NAME });
}

async function loadColumnFilters() {
  const config = await filterDropdown.loadFilterConfig('creator');
  const filters = overviewColumnFilters(await Promise.all((config.filters || []).map(async (filter) => {
    if (filter.id === 'favorit_von') {
      try {
        const options = await ladeFavoritPersonen(window.supabase);
        return { ...filter, options };
      } catch (error) {
        console.warn('Favoriten-Personen konnten nicht geladen werden', error);
        return { ...filter, options: [] };
      }
    }
    if (filter.type !== 'select' && filter.type !== 'multiSelect') return filter;
    if (!filter.table) return filter;
    try {
      const options = await loadSelectOptions(filterDropdown, 'creator', filter);
      return { ...filter, options };
    } catch (error) {
      console.warn(`Filter ${filter.id} konnte nicht geladen werden`, error);
      return { ...filter, options: [] };
    }
  })));
  return { filters, groups: overviewColumnGroups(config.groups || []) };
}

export async function mountCreatorFilterColumn(list) {
  const { filters, groups } = await loadColumnFilters();
  const selection = queryToSelection(window.location.search, {
    filters,
    groessen: GROESSEN,
    generationen: GENERATIONEN.map((entry) => entry.label)
  });
  const values = { ...selection.filters };
  if (selection.groesse?.length) values.groesse = selection.groesse;
  if (selection.generation?.length) values.generation = selection.generation;

  await filterSystem.applyFilters('creator', values);

  const body = document.getElementById('creator-filter-column-body');
  if (body) body.innerHTML = renderColumnBody(filters, groups, values, list.sort);

  const sections = groupColumnFilters(filters, groups);
  const api = {
    filters,
    async renderChips() {
      await api._wired?.renderChips();
    },
    bind(signal) {
      const layout = document.querySelector('.creator-browser');
      const column = document.getElementById('creator-filter-column');
      if (!layout || !column) return;

      api._wired = bindFilterColumn({
        layout,
        column,
        toggle: document.getElementById('creator-filter-toggle'),
        chipsHost: () => document.getElementById('creator-column-chips'),
        filters,
        sections,
        sortName: SORT_NAME,
        storageKey: STORAGE_KEY,
        settle: settleRezensionFilters,
        getValues: () => filterSystem.getFilters('creator'),
        onApply: (read) => {
          const ohne = column.querySelector('[data-filter-id="rezension_ohne"]');
          if (ohne && !read.rezension_ohne && ohne.value === 'true') {
            ohne.value = '';
            syncFilterSelects(column);
          }
          filterSystem.applyFilters('creator', read);
          list.onFiltersApplied(read);
        },
        onSort: (sort) => list.setSort?.(sort),
        onReset: () => list.onFiltersReset(),
        isDestroyed: () => !!list._destroyed,
        signal
      });
      api._wired.renderChips();
    }
  };

  return api;
}
