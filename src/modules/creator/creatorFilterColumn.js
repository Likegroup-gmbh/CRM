// Filterspalte der Creator-Übersicht.
// Gruppen aus der Config, Steuerungen direkt in der offenen Gruppe.
// Andere Listen behalten das Menü „Filter hinzufügen“.

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { loadSelectOptions } from '../../core/filters/FilterDropdownSelectOptions.js';
import { renderFilterControl } from '../../core/filters/FilterDropdownRender.js';
import { formatFilterValue } from '../../core/filters/FilterDropdownFormatApply.js';
import { icon } from '../../core/icons/IconSystem.js';
import { CREATOR_SORTS, normalizeSort } from './creatorBuchung.js';
import { GENERATIONEN, GROESSEN } from './creatorProfil.js';
import { settleRezensionFilters } from './rezension.js';
import { isActive, paintFilterValues, readFiltersFromColumn } from './creatorFilterValues.js';

export { paintFilterValues, readFiltersFromColumn };
import { queryToSelection } from './creatorFilterQuery.js';
import { ladeFavoritPersonen } from './creatorFavorit.js';
import { bindFilterSelects, renderFilterSelect, syncFilterSelects } from '../../core/filters/FilterSelect.js';

const SIDEBAR_NARROW_QUERY = '(max-width: 768px)';
const STORAGE_KEY = 'creator-filter-column-collapsed';
const APPLY_DELAY_MS = 250;
// Auswahl-Filter mit genau einem Wert. Alle übrigen erlauben in der Spalte mehrere.
const SINGLE_SELECT = new Set(['rezension_min']);
const SELECT_TYPES = new Set(['select', 'multiSelect', 'boolean']);

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function columnStartsCollapsed() {
  try {
    if (window.matchMedia(SIDEBAR_NARROW_QUERY).matches) return true;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
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

export function groupColumnFilters(filters, groups) {
  const byId = new Map(filters.map((filter) => [filter.id, filter]));
  const used = new Set();
  const sections = (groups || []).map((group) => {
    const items = (group.filters || []).map((id) => byId.get(id)).filter(Boolean);
    items.forEach((filter) => used.add(filter.id));
    return { id: group.id, label: group.label, expanded: group.expanded !== false, items };
  }).filter((section) => section.items.length);

  const rest = filters.filter((filter) => !used.has(filter.id));
  if (rest.length) {
    const basic = sections.find((section) => section.id === 'basic');
    if (basic) basic.items.push(...rest);
    else sections.unshift({ id: 'basic', label: 'Grundlagen', expanded: true, items: rest });
  }
  return sections;
}

export function renderSortBlock(sort = 'name') {
  const current = normalizeSort(sort);
  return `
    <div class="creator-filter-sort">
      <div class="creator-filter-field">
        <span class="creator-filter-field__label">Sortieren nach</span>
        ${renderFilterSelect(
          { label: 'Sortieren nach', type: 'select', noEmpty: true },
          current,
          CREATOR_SORTS.map((entry) => ({ value: entry.id, label: entry.label })),
          { name: 'creator-sort' }
        )}
      </div>
    </div>
  `;
}

export function countActiveByGroup(sections, values) {
  const counts = {};
  for (const section of sections) {
    counts[section.id] = section.items.filter((filter) => isActive(values?.[filter.id])).length;
  }
  return counts;
}

function paintCounts(sections, values) {
  const counts = countActiveByGroup(sections, values);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  document.querySelectorAll('.creator-filter-group[data-group]').forEach((group) => {
    const badge = group.querySelector('[data-group-count]');
    const n = counts[group.dataset.group] || 0;
    if (badge) {
      badge.textContent = String(n);
      badge.hidden = n === 0;
    }
  });
  const toggleBadge = document.getElementById('creator-filter-count');
  if (toggleBadge) {
    toggleBadge.textContent = String(total);
    toggleBadge.hidden = total === 0;
  }
}

function renderField(values) {
  return (filter) => {
    const label = `<span class="creator-filter-field__label">${esc(filter.label)}</span>`;
    if (SELECT_TYPES.has(filter.type)) {
      return `
        <div class="creator-filter-field" data-field="${esc(filter.id)}">
          ${label}
          ${renderFilterSelect(filter, values[filter.id], filter.options || [])}
        </div>`;
    }
    return `
      <label class="creator-filter-field" data-field="${esc(filter.id)}">
        ${label}
        ${renderFilterControl(filter, values[filter.id], filter.options || [])}
      </label>`;
  };
}

export function renderColumnBody(filters, groups, values = {}, sort = 'name') {
  const sections = groupColumnFilters(filters, groups);
  const counts = countActiveByGroup(sections, values);
  const groupsHtml = sections.map((section) => `
    <details class="creator-filter-group" data-group="${esc(section.id)}"${section.expanded ? ' open' : ''}>
      <summary>
        <span class="creator-filter-group__title">${esc(section.label)}</span>
        <span class="filter-count-badge" data-group-count${counts[section.id] ? '' : ' hidden'}>${counts[section.id] || 0}</span>
        <span class="creator-filter-group__chevron" aria-hidden="true">${icon('chevron-down')}</span>
      </summary>
      <div class="creator-filter-group__body">
        ${section.items.map(renderField(values)).join('')}
      </div>
    </details>
  `).join('');

  return `
    ${renderSortBlock(sort)}
    ${groupsHtml}
    <div class="creator-filter-column__foot">
      <button type="button" class="mdc-btn mdc-btn--secondary creator-filter-reset">Zurücksetzen</button>
    </div>
  `;
}

async function chipHtml(filters, values) {
  const chips = [];
  for (const [id, value] of Object.entries(values || {})) {
    const filter = filters.find((entry) => entry.id === id);
    if (!filter) continue;
    const display = await formatFilterValue(filter, value);
    chips.push(`
      <span class="filter-chip" data-filter-id="${esc(id)}">
        <span class="filter-chip-label">${esc(filter.label)}: ${esc(display)}</span>
        <button type="button" class="filter-chip-remove creator-filter-chip-remove" data-filter-id="${esc(id)}" aria-label="Filter entfernen">×</button>
      </span>
    `);
  }
  if (chips.length) {
    chips.push('<button type="button" class="mdc-btn mdc-btn--secondary creator-filter-reset">Zurücksetzen</button>');
  }
  return chips.join('');
}

function isNarrow() {
  return window.matchMedia(SIDEBAR_NARROW_QUERY).matches;
}

export async function mountCreatorFilterColumn(list, { debounceMs = APPLY_DELAY_MS } = {}) {
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
  const groups = overviewColumnGroups(config.groups || []);
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
    timer: null,
    _chipReq: 0,
    async renderChips() {
      const values = { ...filterSystem.getFilters('creator') };
      paintCounts(sections, values);
      const host = document.getElementById('creator-column-chips');
      if (!host) return;
      const req = ++api._chipReq;
      const html = await chipHtml(filters, values);
      if (req !== api._chipReq) return;
      host.innerHTML = html;
    },
    bind(signal) {
      const root = document.querySelector('.creator-browser');
      const column = document.getElementById('creator-filter-column');
      const toggle = document.getElementById('creator-filter-toggle');
      if (!root || !column) return;

      const setCollapsed = (collapsed, { persist = true } = {}) => {
        root.classList.toggle('is-column-collapsed', collapsed);
        toggle?.setAttribute('aria-expanded', String(!collapsed));
        if (persist && !isNarrow()) {
          try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch { /* privat */ }
        }
      };

      const applyNow = () => {
        const read = readFiltersFromColumn(column, filters);
        const ohne = column.querySelector('[data-filter-id="rezension_ohne"]');
        if (ohne && !read.rezension_ohne && ohne.value === 'true') {
          ohne.value = '';
          syncFilterSelects(column);
        }
        filterSystem.applyFilters('creator', read);
        list.onFiltersApplied(read);
        api.renderChips();
      };

      const schedule = () => {
        clearTimeout(api.timer);
        api.timer = setTimeout(() => {
          if (list._destroyed) return;
          applyNow();
        }, debounceMs);
      };

      bindFilterSelects(column, { signal });

      column.addEventListener('input', (event) => {
        if (event.target.closest('[data-select-search]')) return;
        schedule();
      }, { signal });

      column.addEventListener('change', (event) => {
        if (event.target.name === 'creator-sort') {
          list.setSort?.(event.target.value);
          return;
        }
        if (event.target.closest('[data-select-search]')) return;
        schedule();
      }, { signal });

      root.addEventListener('click', (event) => {
        if (event.target.closest('#creator-filter-toggle')) {
          event.preventDefault();
          setCollapsed(!root.classList.contains('is-column-collapsed'), { persist: !isNarrow() });
          return;
        }
        if (event.target.closest('[data-action="close-creator-filters"]')) {
          event.preventDefault();
          setCollapsed(true, { persist: !isNarrow() });
          return;
        }
        if (event.target.closest('.creator-filter-reset')) {
          event.preventDefault();
          list.onFiltersReset();
          return;
        }
        const remove = event.target.closest('.creator-filter-chip-remove');
        if (remove) {
          event.preventDefault();
          const current = { ...filterSystem.getFilters('creator') };
          delete current[remove.dataset.filterId];
          const next = settleRezensionFilters(current);
          paintFilterValues(column, filters, next);
          filterSystem.applyFilters('creator', next);
          list.onFiltersApplied(next);
          api.renderChips();
        }
      }, { signal });

      const media = window.matchMedia(SIDEBAR_NARROW_QUERY);
      const onMedia = () => {
        if (media.matches) setCollapsed(true, { persist: false });
        else setCollapsed(localStorage.getItem(STORAGE_KEY) === 'true', { persist: false });
      };
      media.addEventListener('change', onMedia);
      signal.addEventListener('abort', () => {
        media.removeEventListener('change', onMedia);
        clearTimeout(api.timer);
      });

      api.renderChips();
    }
  };

  return api;
}
