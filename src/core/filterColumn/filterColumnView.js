// Filterspalte: Sortierung oben, Filter in aufklappbaren Gruppen, Chips über der Liste.
// Genutzt von der Creator-Datenbank und den Tabellen in der Produktion.
// Ein Aufrufer liefert Filter, Gruppen, Sortierungen und reagiert auf onApply/onSort.

import { renderFilterControl } from '../filters/FilterDropdownRender.js';
import { formatFilterValue } from '../filters/FilterDropdownFormatApply.js';
import { bindFilterSelects, renderFilterSelect } from '../filters/FilterSelect.js';
import { icon } from '../icons/IconSystem.js';
import { isActive, paintFilterValues, readFiltersFromColumn } from './filterColumnValues.js';

export const NARROW_QUERY = '(max-width: 768px)';
const APPLY_DELAY_MS = 250;
const SELECT_TYPES = new Set(['select', 'multiSelect', 'boolean']);

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isNarrow() {
  try {
    return window.matchMedia(NARROW_QUERY).matches;
  } catch {
    return false;
  }
}

export function columnStartsCollapsed(storageKey, { defaultCollapsed = false } = {}) {
  if (isNarrow()) return true;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch { /* privat */ }
  return defaultCollapsed;
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

export function countActiveByGroup(sections, values) {
  const counts = {};
  for (const section of sections) {
    counts[section.id] = section.items.filter((filter) => isActive(values?.[filter.id])).length;
  }
  return counts;
}

export function renderSortBlock(sorts, current, { name = 'filter-column-sort' } = {}) {
  if (!sorts?.length) return '';
  return `
    <div class="filter-column-sort">
      <div class="filter-column-field">
        <span class="filter-column-field__label">Sortieren nach</span>
        ${renderFilterSelect(
          { label: 'Sortieren nach', type: 'select', noEmpty: true },
          current,
          sorts.map((entry) => ({ value: entry.id, label: entry.label })),
          { name }
        )}
      </div>
    </div>
  `;
}

function renderField(values) {
  return (filter) => {
    const label = `<span class="filter-column-field__label">${esc(filter.label)}</span>`;
    if (SELECT_TYPES.has(filter.type)) {
      return `
        <div class="filter-column-field" data-field="${esc(filter.id)}">
          ${label}
          ${renderFilterSelect(filter, values[filter.id], filter.options || [])}
        </div>`;
    }
    return `
      <label class="filter-column-field" data-field="${esc(filter.id)}">
        ${label}
        ${renderFilterControl(filter, values[filter.id], filter.options || [])}
      </label>`;
  };
}

export function renderColumnBody(filters, groups, values = {}, { sorts = [], sort = '', sortName } = {}) {
  const sections = groupColumnFilters(filters, groups);
  const counts = countActiveByGroup(sections, values);
  const groupsHtml = sections.map((section) => `
    <details class="filter-column-group" data-group="${esc(section.id)}"${section.expanded ? ' open' : ''}>
      <summary>
        <span class="filter-column-group__title">${esc(section.label)}</span>
        <span class="filter-count-badge" data-group-count${counts[section.id] ? '' : ' hidden'}>${counts[section.id] || 0}</span>
        <span class="filter-column-group__chevron" aria-hidden="true">${icon('chevron-down')}</span>
      </summary>
      <div class="filter-column-group__body">
        ${section.items.map(renderField(values)).join('')}
      </div>
    </details>
  `).join('');

  return `
    ${renderSortBlock(sorts, sort, { name: sortName })}
    ${groupsHtml}
    <div class="filter-column__foot">
      <button type="button" class="mdc-btn mdc-btn--secondary filter-column-reset">Zurücksetzen</button>
    </div>
  `;
}

export async function renderChipsHtml(filters, values) {
  const chips = [];
  for (const [id, value] of Object.entries(values || {})) {
    const filter = filters.find((entry) => entry.id === id);
    if (!filter || !isActive(value)) continue;
    const display = await formatFilterValue(filter, value);
    chips.push(`
      <span class="filter-chip" data-filter-id="${esc(id)}">
        <span class="filter-chip-label">${esc(filter.label)}: ${esc(display)}</span>
        <button type="button" class="filter-chip-remove filter-column-chip-remove" data-filter-id="${esc(id)}" aria-label="Filter entfernen">×</button>
      </span>
    `);
  }
  if (chips.length) {
    chips.push('<button type="button" class="mdc-btn mdc-btn--secondary filter-column-reset">Zurücksetzen</button>');
  }
  return chips.join('');
}

export function renderFilterToggle({ key, collapsed, label = 'Filter' }) {
  return `
    <button type="button" class="mdc-btn mdc-btn--secondary filter-column-toggle" id="${esc(key)}-filter-toggle" aria-expanded="${collapsed ? 'false' : 'true'}" aria-controls="${esc(key)}-filter-column">
      ${icon('filter-alt')}
      <span>${esc(label)}</span>
      <span class="filter-count-badge" data-filter-total hidden></span>
    </button>
  `;
}

export function renderFilterColumnAside({ key, title = 'Sortieren und Filtern' }) {
  return `
    <div class="filter-column-backdrop" data-action="close-filter-column"></div>
    <aside class="filter-column" id="${esc(key)}-filter-column" aria-label="${esc(title)}">
      <div class="filter-column__head">
        <span class="filter-column__title">${esc(title)}</span>
        <button type="button" class="filter-column__close" data-action="close-filter-column" aria-label="${esc(title)} schließen">${icon('x-mark')}</button>
      </div>
      <div class="filter-column__body" id="${esc(key)}-filter-column-body"></div>
    </aside>
  `;
}

export function paintCounts(root, sections, values, toggleBadge) {
  const counts = countActiveByGroup(sections, values);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  root?.querySelectorAll('.filter-column-group[data-group]').forEach((group) => {
    const badge = group.querySelector('[data-group-count]');
    const n = counts[group.dataset.group] || 0;
    if (badge) {
      badge.textContent = String(n);
      badge.hidden = n === 0;
    }
  });
  if (toggleBadge) {
    toggleBadge.textContent = String(total);
    toggleBadge.hidden = total === 0;
  }
  return total;
}

/**
 * Verdrahtet eine gerenderte Spalte. Liefert renderChips() und setCollapsed().
 * @param {object} o
 * @param {Element} o.layout          Container mit Klasse is-column-collapsed
 * @param {Element} o.column          die <aside>
 * @param {Element} [o.toggle]        Button zum Auf- und Zuklappen
 * @param {Element|Function} [o.chipsHost]  Ziel der Chips (oder Getter)
 * @param {Function} o.getValues      aktuelle Werte
 * @param {Function} o.onApply        (values) => void
 * @param {Function} [o.onSort]       (sortId) => void
 * @param {Function} [o.onReset]      () => void, Standard: alles leeren
 */
export function bindFilterColumn({
  layout, column, toggle = null, chipsHost = null, filters, sections,
  sortName = 'filter-column-sort', storageKey = '', defaultCollapsed = false, settle = null,
  getValues, onApply, onSort = null, onReset = null,
  isDestroyed = () => false, debounceMs = APPLY_DELAY_MS, signal
}) {
  let timer = null;
  let chipReq = 0;
  const toggleBadge = () => toggle?.querySelector('[data-filter-total]') || null;
  const chipsEl = () => (typeof chipsHost === 'function' ? chipsHost() : chipsHost);

  const renderChips = async () => {
    const values = { ...getValues() };
    paintCounts(column, sections, values, toggleBadge());
    const host = chipsEl();
    if (!host) return;
    const req = ++chipReq;
    const html = await renderChipsHtml(filters, values);
    if (req !== chipReq) return;
    host.innerHTML = html;
  };

  const setCollapsed = (collapsed, { persist = true } = {}) => {
    layout.classList.toggle('is-column-collapsed', collapsed);
    toggle?.setAttribute('aria-expanded', String(!collapsed));
    if (persist && storageKey && !isNarrow()) {
      try { localStorage.setItem(storageKey, String(collapsed)); } catch { /* privat */ }
    }
  };

  const apply = (values) => {
    onApply(values);
    renderChips();
  };

  const applyNow = () => apply(readFiltersFromColumn(column, filters, { settle }));

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (isDestroyed()) return;
      applyNow();
    }, debounceMs);
  };

  const reset = () => {
    if (onReset) {
      onReset();
      renderChips();
      return;
    }
    paintFilterValues(column, filters, {});
    apply({});
  };

  bindFilterSelects(column, { signal });

  column.addEventListener('input', (event) => {
    if (event.target.closest('[data-select-search]')) return;
    schedule();
  }, { signal });

  column.addEventListener('change', (event) => {
    if (event.target.name === sortName) {
      onSort?.(event.target.value);
      return;
    }
    if (event.target.closest('[data-select-search]')) return;
    schedule();
  }, { signal });

  toggle?.addEventListener('click', (event) => {
    event.preventDefault();
    setCollapsed(!layout.classList.contains('is-column-collapsed'), { persist: !isNarrow() });
  }, { signal });

  const onClick = (event) => {
    if (event.target.closest('[data-action="close-filter-column"]')) {
      event.preventDefault();
      setCollapsed(true, { persist: !isNarrow() });
      return;
    }
    if (event.target.closest('.filter-column-reset')) {
      event.preventDefault();
      reset();
      return;
    }
    const remove = event.target.closest('.filter-column-chip-remove');
    if (remove) {
      event.preventDefault();
      const current = { ...getValues() };
      delete current[remove.dataset.filterId];
      const next = settle ? settle(current) : current;
      paintFilterValues(column, filters, next);
      apply(next);
    }
  };
  layout.addEventListener('click', onClick, { signal });
  const host = chipsEl();
  if (host && !layout.contains(host)) host.addEventListener('click', onClick, { signal });

  try {
    const media = window.matchMedia(NARROW_QUERY);
    const onMedia = () => {
      if (media.matches) setCollapsed(true, { persist: false });
      else setCollapsed(columnStartsCollapsed(storageKey, { defaultCollapsed }), { persist: false });
    };
    media.addEventListener?.('change', onMedia);
    signal?.addEventListener('abort', () => media.removeEventListener?.('change', onMedia));
  } catch { /* ohne matchMedia */ }
  signal?.addEventListener('abort', () => clearTimeout(timer));

  return { renderChips, setCollapsed, applyNow };
}
