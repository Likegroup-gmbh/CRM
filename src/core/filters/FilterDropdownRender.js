// FilterDropdownRender.js
// HTML-Rendering für Dropdown-Shell, Filter-Chips und Submenu-Inhalte.

import { iconRegistry } from '../actions/IconRegistry.js';
import { loadSelectOptions } from './FilterDropdownSelectOptions.js';

// ---------------------------------------------------------------------------
// Dropdown-Shell
// ---------------------------------------------------------------------------

export function renderDropdown(ctx, entityType, config) {
  const activeFilterCount = ctx.getActiveFilterCount(entityType);
  const hasActiveFilters = activeFilterCount > 0;

  return `
    <div class="filter-dropdown-container" data-entity-type="${entityType}">
      <div class="filter-row">
        <button class="filter-dropdown-toggle" aria-expanded="false" aria-label="Filter hinzufügen">
          ${iconRegistry.get('filter')}
          <span>Filter hinzufügen</span>
          ${hasActiveFilters ? `<span class="filter-count-badge">${activeFilterCount}</span>` : ''}
        </button>

        <div class="active-filters" id="active-filters-${entityType}">
          ${renderActiveFilters(ctx, entityType)}
        </div>
      </div>

      <div class="filter-dropdown">
        <div class="filter-dropdown-header">
          <span class="filter-dropdown-title">Filter auswählen</span>
          <button class="filter-dropdown-close" aria-label="Schließen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="filter-dropdown-body">
          ${renderFilterOptions(config.filters)}
        </div>
      </div>
    </div>
  `;
}

export function renderFilterOptions(filters) {
  if (!filters || filters.length === 0) {
    return '<div class="filter-dropdown-empty">Keine Filter verfügbar</div>';
  }

  return filters.map(filter => `
    <div class="filter-option" data-filter-id="${filter.id}" data-filter-type="${filter.type}">
      <span class="filter-option-label">${filter.label}</span>
      <svg class="submenu-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </div>
  `).join('');
}

// ---------------------------------------------------------------------------
// Filter-Chips
// ---------------------------------------------------------------------------

function chipHtml(filterId, label, displayValue) {
  return `
    <span class="filter-chip" data-filter-id="${filterId}">
      <span class="filter-chip-label">${label}: ${displayValue}</span>
      <button class="filter-chip-remove" data-filter-id="${filterId}" aria-label="Filter entfernen">
        ×
      </button>
    </span>
  `;
}

function resetButtonHtml(entityType) {
  return `
    <button class="secondary-btn filter-reset-all" data-entity-type="${entityType}">
      Alle zurücksetzen
    </button>
  `;
}

export async function renderActiveFiltersAsync(ctx, entityType) {
  const instance = ctx.instances.get(entityType);
  if (!instance || instance.activeFilters.size === 0) return '';

  const chips = [];
  for (const [filterId, filterValue] of instance.activeFilters.entries()) {
    const filterConfig = instance.config.filters.find(f => f.id === filterId);
    if (!filterConfig) continue;

    const cacheKey = `${filterId}:${typeof filterValue === 'object' ? JSON.stringify(filterValue) : filterValue}`;
    let displayValue;

    if (instance.labelCache?.has(cacheKey)) {
      displayValue = instance.labelCache.get(cacheKey);
    } else {
      displayValue = await ctx.formatFilterValue(filterConfig, filterValue);
      if (!instance.labelCache) instance.labelCache = new Map();
      instance.labelCache.set(cacheKey, displayValue);
    }

    chips.push(chipHtml(filterId, filterConfig.label, displayValue));
  }

  if (chips.length > 0) chips.push(resetButtonHtml(entityType));
  return chips.join('');
}

export function renderActiveFilters(ctx, entityType) {
  const instance = ctx.instances.get(entityType);
  if (!instance || instance.activeFilters.size === 0) return '';

  const chips = [];
  instance.activeFilters.forEach((filterValue, filterId) => {
    const filterConfig = instance.config.filters.find(f => f.id === filterId);
    if (!filterConfig) return;

    const cacheKey = `${filterId}:${typeof filterValue === 'object' ? JSON.stringify(filterValue) : filterValue}`;
    const cachedLabel = instance.labelCache?.get(cacheKey);
    const displayValue = cachedLabel || ctx.formatFilterValueSync(filterConfig, filterValue);

    chips.push(chipHtml(filterId, filterConfig.label, displayValue));
  });

  if (chips.length > 0) chips.push(resetButtonHtml(entityType));
  return chips.join('');
}

// ---------------------------------------------------------------------------
// Submenu
// ---------------------------------------------------------------------------

function renderSubmenuInputHtml(filterConfig, currentValue, options) {
  switch (filterConfig.type) {
    case 'text':
      return `
        <input type="text" class="filter-submenu-input"
               data-filter-id="${filterConfig.id}"
               placeholder="${filterConfig.placeholder || 'Suchen...'}"
               value="${currentValue || ''}" autocomplete="off">
      `;

    case 'select': {
      const optionsHtml = options.map(opt => {
        const value = opt.value || opt.id || '';
        const label = opt.label || opt.name || opt.value || 'Unbekannt';
        const selected = currentValue === value ? 'selected' : '';
        return `<option value="${value}" ${selected}>${label}</option>`;
      }).join('');

      return `
        <select class="filter-submenu-select" data-filter-id="${filterConfig.id}">
          <option value="">Bitte wählen...</option>
          ${optionsHtml}
        </select>
      `;
    }

    case 'multiSelect': {
      const checkboxesHtml = options.map(opt => {
        const value = opt.value || opt.id;
        const label = opt.label || opt.name;
        const checked = Array.isArray(currentValue) && currentValue.includes(value) ? 'checked' : '';
        return `
          <label class="filter-checkbox-option">
            <input type="checkbox" value="${value}"
                   data-filter-id="${filterConfig.id}" ${checked}>
            <span>${label}</span>
          </label>
        `;
      }).join('');

      return `<div class="filter-submenu-checkboxes">${checkboxesHtml}</div>`;
    }

    case 'date':
      return `
        <input type="date" class="filter-submenu-input"
               data-filter-id="${filterConfig.id}"
               value="${currentValue || ''}">
      `;

    case 'dateRange': {
      const dateFrom = currentValue?.from || '';
      const dateTo = currentValue?.to || '';
      return `
        <div class="filter-range-inputs">
          <label class="filter-range-label">Von:</label>
          <input type="date" class="filter-submenu-input"
                 data-filter-id="${filterConfig.id}" data-range="from" value="${dateFrom}">
          <label class="filter-range-label">Bis:</label>
          <input type="date" class="filter-submenu-input"
                 data-filter-id="${filterConfig.id}" data-range="to" value="${dateTo}">
        </div>
      `;
    }

    case 'number':
      return `
        <input type="number" class="filter-submenu-input"
               data-filter-id="${filterConfig.id}"
               placeholder="${filterConfig.placeholder || 'Zahl eingeben...'}"
               min="${filterConfig.min || 0}"
               max="${filterConfig.max || ''}"
               step="${filterConfig.step || 1}"
               value="${currentValue || ''}">
      `;

    case 'numberRange': {
      const numMin = currentValue?.min ?? '';
      const numMax = currentValue?.max ?? '';
      return `
        <div class="filter-range-inputs">
          <label class="filter-range-label">Min:</label>
          <input type="number" class="filter-submenu-input"
                 data-filter-id="${filterConfig.id}" data-range="min"
                 min="${filterConfig.min || 0}" step="${filterConfig.step || 1}"
                 placeholder="${filterConfig.min || 0}" value="${numMin}">
          <label class="filter-range-label">Max:</label>
          <input type="number" class="filter-submenu-input"
                 data-filter-id="${filterConfig.id}" data-range="max"
                 max="${filterConfig.max || ''}" step="${filterConfig.step || 1}"
                 placeholder="${filterConfig.max || ''}" value="${numMax}">
        </div>
      `;
    }

    case 'boolean': {
      const boolValue = currentValue === true ? 'true' : currentValue === false ? 'false' : '';
      return `
        <select class="filter-submenu-select" data-filter-id="${filterConfig.id}">
          <option value="">Alle</option>
          <option value="true" ${boolValue === 'true' ? 'selected' : ''}>Ja</option>
          <option value="false" ${boolValue === 'false' ? 'selected' : ''}>Nein</option>
        </select>
      `;
    }

    default:
      return '<p class="text-muted">Unbekannter Filter-Typ</p>';
  }
}

export async function renderFilterSubmenu(ctx, filterConfig, entityType) {
  const currentValue = ctx.instances.get(entityType)?.activeFilters.get(filterConfig.id);

  let options = [];
  if (filterConfig.type === 'select' || filterConfig.type === 'multiSelect') {
    options = await loadSelectOptions(ctx, entityType, filterConfig);
  }

  const inputHtml = renderSubmenuInputHtml(filterConfig, currentValue, options);

  return `
    <div class="filter-submenu-header">
      <span class="filter-submenu-title">${filterConfig.label}</span>
    </div>
    <div class="filter-submenu-body">
      ${inputHtml}
    </div>
    <div class="filter-submenu-footer">
      <button class="filter-submenu-apply secondary-btn">Anwenden</button>
    </div>
  `;
}
