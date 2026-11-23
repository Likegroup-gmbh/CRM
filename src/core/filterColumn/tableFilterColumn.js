// Filterspalte für Tabellen, die ihre Zeilen komplett im Speicher halten
// (Casting, Konzept, Kooperationen in der Produktion). Startet eingeklappt,
// filtert und sortiert im Browser und merkt sich die Auswahl in der URL.
//
// Ablauf: createTableFilter(...) einmal je Tabelle; renderToggle() in die
// Werkzeugzeile, renderLayout(tabelleHtml) um die Tabelle, nach jedem Rendern
// mount({ root, onChange }). apply(rows) liefert gefilterte, sortierte Zeilen.

import {
  bindFilterColumn,
  columnStartsCollapsed,
  groupColumnFilters,
  renderColumnBody,
  renderFilterColumnAside,
  renderFilterToggle
} from './filterColumnView.js';
import { isActive } from './filterColumnValues.js';
import { filterRows, isManualSort, sortRows } from './filterRows.js';
import { readPrefixedSelection, writePrefixedSelection } from './filterQueryCodec.js';

function currentSearch() {
  return typeof window !== 'undefined' ? window.location?.search || '' : '';
}

function writeUrl(state) {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  writePrefixedSelection(url.searchParams, state);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * @param {object} o
 * @param {string} o.key                 Präfix für URL, DOM-IDs und localStorage
 * @param {Array}  o.filters             Filterdefinitionen mit get(row) oder match(row, value)
 * @param {Array}  [o.groups]            Gruppen { id, label, expanded, filters: [ids] }
 * @param {Array}  [o.sorts]             Sortierungen { id, label, get?, type?, direction? }
 * @param {string} [o.defaultSort]
 * @param {boolean} [o.persistUrl]
 */
export function createTableFilter({ key, filters = [], groups = [], sorts = [], defaultSort = '', persistUrl = true }) {
  const storageKey = `${key}-filter-column-collapsed`;
  const sortName = `${key}-sort`;
  const initial = readPrefixedSelection(currentSearch(), { prefix: key, filters, sorts, defaultSort: defaultSort || sorts[0]?.id || '' });

  const state = {
    filters,
    groups,
    sorts,
    defaultSort: defaultSort || sorts[0]?.id || '',
    values: initial.values,
    sort: initial.sort,
    abort: null,
    wired: null
  };

  const persist = () => {
    if (!persistUrl) return;
    writeUrl({ prefix: key, values: state.values, sort: state.sort, defaultSort: state.defaultSort });
  };

  const sortDef = () => state.sorts.find((entry) => entry.id === state.sort) || null;

  const api = {
    key,
    getValues: () => ({ ...state.values }),
    getSort: () => state.sort,
    getSortDef: sortDef,
    isManualSort: () => isManualSort(sortDef()),
    hasActiveFilters: () => Object.values(state.values).some(isActive),

    /** Neue Filter (z. B. Optionen aus frisch geladenen Zeilen); unbekannte Werte fallen weg. */
    setFilters(nextFilters, nextGroups = state.groups) {
      state.filters = nextFilters || [];
      state.groups = nextGroups || [];
      const ids = new Set(state.filters.map((filter) => filter.id));
      state.values = Object.fromEntries(Object.entries(state.values).filter(([id]) => ids.has(id)));
    },

    setValues(values) {
      state.values = { ...(values || {}) };
      persist();
    },

    setSort(sort) {
      state.sort = state.sorts.some((entry) => entry.id === sort) ? sort : state.defaultSort;
      persist();
    },

    filter: (rows) => filterRows(rows, state.filters, state.values),
    sort: (rows) => sortRows(rows, sortDef()),
    apply: (rows) => sortRows(filterRows(rows, state.filters, state.values), sortDef()),

    renderToggle({ label = 'Filter' } = {}) {
      return renderFilterToggle({ key, collapsed: columnStartsCollapsed(storageKey, { defaultCollapsed: true }), label });
    },

    renderLayout(mainHtml) {
      const collapsed = columnStartsCollapsed(storageKey, { defaultCollapsed: true });
      return `
        <div class="filter-column-layout filter-column-layout--table${collapsed ? ' is-column-collapsed' : ''}" data-filter-layout="${key}">
          ${renderFilterColumnAside({ key })}
          <div class="filter-column-layout__main">
            <div class="filter-column-chips" data-filter-chips="${key}"></div>
            ${mainHtml}
          </div>
        </div>
      `;
    },

    /**
     * Füllt und verdrahtet die gerenderte Spalte. Erneut aufrufen nach jedem
     * Neuzeichnen des Layouts; die vorherige Verdrahtung wird gelöst.
     * @param {{ root: Element, toggleRoot?: Element, onChange: Function }} o
     */
    mount({ root, toggleRoot = null, onChange }) {
      state.abort?.abort();
      state.abort = null;
      state.wired = null;
      const layout = root?.querySelector(`[data-filter-layout="${key}"]`);
      const column = layout?.querySelector('.filter-column');
      const body = layout?.querySelector('.filter-column__body');
      if (!layout || !column || !body) return;

      body.innerHTML = renderColumnBody(state.filters, state.groups, state.values, {
        sorts: state.sorts.map(({ id, label }) => ({ id, label })),
        sort: state.sort,
        sortName
      });

      const controller = new AbortController();
      state.abort = controller;
      const toggle = (toggleRoot || root).querySelector(`#${key}-filter-toggle`)
        || document.getElementById(`${key}-filter-toggle`);
      layout.classList.toggle('is-column-collapsed', columnStartsCollapsed(storageKey, { defaultCollapsed: true }));
      toggle?.setAttribute('aria-expanded', String(!layout.classList.contains('is-column-collapsed')));

      state.wired = bindFilterColumn({
        layout,
        column,
        toggle,
        chipsHost: () => layout.querySelector(`[data-filter-chips="${key}"]`),
        filters: state.filters,
        sections: groupColumnFilters(state.filters, state.groups),
        sortName,
        storageKey,
        defaultCollapsed: true,
        getValues: () => state.values,
        onApply: (values) => {
          api.setValues(values);
          onChange?.({ values: api.getValues(), sort: state.sort });
        },
        onSort: (sort) => {
          api.setSort(sort);
          onChange?.({ values: api.getValues(), sort: state.sort });
        },
        signal: controller.signal
      });
      state.wired.renderChips();
    },

    refreshChips() {
      state.wired?.renderChips();
    },

    destroy() {
      state.abort?.abort();
      state.abort = null;
      state.wired = null;
    }
  };

  return api;
}
