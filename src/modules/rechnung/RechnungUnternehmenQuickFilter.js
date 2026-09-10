// RechnungUnternehmenQuickFilter.js
// Unternehmen-Quickfilter dropdown for the Rechnung list.

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { icon } from '../../core/icons/IconSystem.js';

let _options = [];

export async function initializeQuickFilter(container) {
  if (!container) return;
  _options = await loadOptions();
  container.innerHTML = renderHtml();
}

async function loadOptions() {
  try {
    const { data, error } = await window.supabase
      .from('unternehmen')
      .select('id, firmenname')
      .order('firmenname');
    if (error) {
      console.warn('⚠️ RECHNUNGLIST: Unternehmen-Quickfilter konnte nicht geladen werden:', error);
      return [];
    }
    return (data || [])
      .filter(u => u?.id && u?.firmenname)
      .map(u => ({ id: u.id, name: u.firmenname }));
  } catch (error) {
    console.warn('⚠️ RECHNUNGLIST: Fehler bei Unternehmen-Quickfilter-Optionen:', error);
    return [];
  }
}

export function getSelectedIds() {
  const currentFilters = filterSystem.getFilters('rechnung');
  const ids = currentFilters?.unternehmen_ids;
  if (!Array.isArray(ids)) return [];
  return ids.map(id => String(id).trim()).filter(Boolean);
}

export function applyQuickFilter(selectedIds, reloadCallback) {
  const normalizedIds = Array.isArray(selectedIds)
    ? selectedIds.map(id => String(id).trim()).filter(Boolean)
    : [];

  const currentFilters = filterSystem.getFilters('rechnung') || {};
  const nextFilters = { ...currentFilters };
  if (normalizedIds.length > 0) {
    nextFilters.unternehmen_ids = normalizedIds;
  } else {
    delete nextFilters.unternehmen_ids;
  }

  filterSystem.applyFilters('rechnung', nextFilters);
  reloadCallback();
  updateMeta(normalizedIds.length);
}

export function syncUI() {
  const container = document.getElementById('rechnung-unternehmen-filter-container');
  if (!container) return;
  container.innerHTML = renderHtml();
}

function updateMeta(selectedCount) {
  const toggleButton = document.getElementById('rechnung-unternehmen-filter-toggle');
  const resetButton = document.getElementById('rechnung-unternehmen-filter-reset');
  if (!toggleButton) return;

  let badge = toggleButton.querySelector('.filter-count-badge');
  if (selectedCount > 0) {
    if (!badge) {
      toggleButton.insertAdjacentHTML('beforeend', `<span class="filter-count-badge">${selectedCount}</span>`);
    } else {
      badge.textContent = String(selectedCount);
    }
  } else if (badge) {
    badge.remove();
  }

  if (resetButton) {
    resetButton.disabled = selectedCount === 0;
  }
}

function renderHtml() {
  const selectedIds = getSelectedIds();
  const selectedSet = new Set(selectedIds);
  const selectedCount = selectedIds.length;
  const hasOptions = _options.length > 0;

  const optionsHtml = hasOptions
    ? _options.map((u, index) => {
        const inputId = `rechnung-unternehmen-filter-${index}`;
        const checked = selectedSet.has(u.id) ? 'checked' : '';
        const safeLabel = u.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
          <label class="filter-checkbox-option" for="${inputId}">
            <span class="toggle-text">${safeLabel}</span>
            <span class="toggle-switch">
              <input type="checkbox"
                     id="${inputId}"
                     class="rechnung-unternehmen-filter-toggle-input"
                     value="${u.id}"
                     aria-label="${safeLabel}"
                     ${checked}>
              <span class="toggle-slider"></span>
            </span>
          </label>
        `;
      }).join('')
    : '<div class="filter-dropdown-empty">Keine Unternehmen gefunden</div>';

  return `
    <div class="filter-dropdown-container">
      <button id="rechnung-unternehmen-filter-toggle"
              class="filter-dropdown-toggle"
              aria-expanded="false"
              aria-label="Unternehmen filtern">
        ${icon('building')}
        <span>Unternehmen</span>
        ${selectedCount > 0 ? `<span class="filter-count-badge">${selectedCount}</span>` : ''}
      </button>

      <div id="rechnung-unternehmen-filter-dropdown" class="filter-dropdown">
        <div class="filter-dropdown-header">
          <span class="filter-dropdown-title">Unternehmen filtern</span>
          <button id="rechnung-unternehmen-filter-reset" class="mdc-btn mdc-btn--secondary" ${selectedCount === 0 ? 'disabled' : ''}>
            Zurücksetzen
          </button>
        </div>
        <div class="filter-submenu-body">
          <div class="filter-submenu-checkboxes">
            ${optionsHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}
