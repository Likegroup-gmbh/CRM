// RechnungSortQuickFilter.js
// Sortier-Dropdown (Gestellt am / Zahlungsziel) für die Rechnung-Liste.
// State liegt auf RechnungList (Singleton) – kein ModularFilterSystem,
// damit "Filter zurücksetzen" die Sortierung nicht anfasst.

import { icon } from '../../core/icons/IconSystem.js';

export const SORT_OPTIONS = [
  { id: 'gestellt_am', label: 'Gestellt am' },
  { id: 'zahlungsziel', label: 'Zahlungsziel' }
];

export const DEFAULT_SORT = 'gestellt_am';

export function getSortLabel(sortBy) {
  return SORT_OPTIONS.find(o => o.id === sortBy)?.label || SORT_OPTIONS[0].label;
}

export function renderHtml(currentSort = DEFAULT_SORT) {
  const optionsHtml = SORT_OPTIONS.map(option => {
    const isActive = option.id === currentSort;
    return `
      <div class="filter-option rechnung-sort-option${isActive ? ' active' : ''}"
           data-sort-by="${option.id}"
           role="button"
           aria-pressed="${isActive ? 'true' : 'false'}">
        <span class="filter-option-label">${option.label}</span>
        ${isActive ? icon('check') : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="filter-dropdown-container">
      <button id="rechnung-sort-filter-toggle"
              class="filter-dropdown-toggle"
              aria-expanded="false"
              aria-label="Sortierung wählen">
        ${icon('arrows-up-down')}
        <span>${getSortLabel(currentSort)}</span>
      </button>

      <div id="rechnung-sort-filter-dropdown" class="filter-dropdown">
        <div class="filter-dropdown-header">
          <span class="filter-dropdown-title">Sortieren nach</span>
        </div>
        <div class="filter-dropdown-body">
          ${optionsHtml}
        </div>
      </div>
    </div>
  `;
}

export function initializeSortFilter(container, currentSort) {
  if (!container) return;
  container.innerHTML = renderHtml(currentSort);
}

export function syncUI(currentSort) {
  const container = document.getElementById('rechnung-sort-filter-container');
  if (!container) return;
  container.innerHTML = renderHtml(currentSort);
}
