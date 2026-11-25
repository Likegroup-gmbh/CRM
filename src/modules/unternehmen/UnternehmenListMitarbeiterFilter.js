// UnternehmenListMitarbeiterFilter.js
// Quickfilter „Mitarbeiter“ in der Unternehmen-Liste (HTML, Open/Close, Apply).

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { icon } from '../../core/icons/IconSystem.js';

export function getSelectedMitarbeiterFilterIds() {
  const currentFilters = filterSystem.getFilters('unternehmen');
  const ids = currentFilters?.mitarbeiter_ids;
  if (!Array.isArray(ids)) return [];
  return ids.map(id => String(id).trim()).filter(Boolean);
}

async function loadMitarbeiterQuickFilterOptions() {
  try {
    let data = [];

    const { data: activeUsers, error: activeUsersError } = await window.supabase
      .from('benutzer')
      .select('id, name, rolle, freigeschaltet')
      .in('rolle', ['admin', 'mitarbeiter'])
      .eq('freigeschaltet', true);

    if (activeUsersError) {
      const { data: fallbackUsers, error: fallbackError } = await window.supabase
        .from('benutzer')
        .select('id, name, rolle')
        .in('rolle', ['admin', 'mitarbeiter']);

      if (fallbackError) {
        console.warn('⚠️ UNTERNEHMENLISTE: Mitarbeiterfilter konnte nicht geladen werden:', fallbackError);
        return [];
      }

      data = fallbackUsers || [];
    } else {
      data = activeUsers || [];
    }

    return (data || [])
      .filter(user => user?.id && user?.name)
      .filter(user => {
        const name = String(user.name || '').toLowerCase();
        if (name.includes('oliver') && (name.includes('mageldanz') || name.includes('mackeldanz'))) {
          return false;
        }
        if (name.includes('alpha foods test')) {
          return false;
        }
        return true;
      })
      .map(user => ({ id: user.id, name: user.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
  } catch (error) {
    console.warn('⚠️ UNTERNEHMENLISTE: Fehler bei Mitarbeiterfilter-Optionen:', error);
    return [];
  }
}

function renderMitarbeiterQuickFilterHtml(list) {
  const selectedIds = getSelectedMitarbeiterFilterIds();
  const selectedSet = new Set(selectedIds);
  const selectedCount = selectedIds.length;
  const hasOptions = list._mitarbeiterQuickFilterOptions.length > 0;
  const optionsHtml = hasOptions
    ? list._mitarbeiterQuickFilterOptions.map((m, index) => {
        const inputId = `unternehmen-mitarbeiter-filter-${index}`;
        const checked = selectedSet.has(m.id) ? 'checked' : '';
        const safeLabel = list.sanitize(m.name);

        return `
          <label class="filter-checkbox-option" for="${inputId}">
            <span class="toggle-text">${safeLabel}</span>
            <span class="toggle-switch">
              <input type="checkbox"
                     id="${inputId}"
                     class="mitarbeiter-quick-filter-toggle-input"
                     value="${m.id}"
                     aria-label="${safeLabel}"
                     ${checked}>
              <span class="toggle-slider"></span>
            </span>
          </label>
        `;
      }).join('')
    : '<div class="filter-dropdown-empty">Keine Mitarbeiter gefunden</div>';

  return `
    <div class="filter-dropdown-container">
      <button id="mitarbeiter-quick-filter-toggle"
              class="filter-dropdown-toggle"
              aria-expanded="false"
              aria-label="Mitarbeiter filtern">
        ${icon('user-plus')}
        <span>Mitarbeiter</span>
        ${selectedCount > 0 ? `<span class="filter-count-badge">${selectedCount}</span>` : ''}
      </button>

      <div id="mitarbeiter-quick-filter-dropdown" class="filter-dropdown">
        <div class="filter-dropdown-header">
          <span class="filter-dropdown-title">Mitarbeiter filtern</span>
          <button id="mitarbeiter-quick-filter-reset" class="mdc-btn mdc-btn--secondary" ${selectedCount === 0 ? 'disabled' : ''}>
            Zurücksetzen
          </button>
        </div>
        <div class="filter-submenu-body mitarbeiter-quick-filter-body">
          <div class="filter-submenu-checkboxes mitarbeiter-quick-filter-list">
            ${optionsHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function initializeMitarbeiterQuickFilter(list) {
  const container = document.getElementById('unternehmen-mitarbeiter-filter-container');
  if (!container) return;

  list._mitarbeiterQuickFilterOptions = await loadMitarbeiterQuickFilterOptions();
  container.innerHTML = renderMitarbeiterQuickFilterHtml(list);
}

export function syncMitarbeiterQuickFilterUI(list) {
  const container = document.getElementById('unternehmen-mitarbeiter-filter-container');
  if (!container) return;
  container.innerHTML = renderMitarbeiterQuickFilterHtml(list);
}

function updateMitarbeiterQuickFilterMeta(selectedCount) {
  const toggleButton = document.getElementById('mitarbeiter-quick-filter-toggle');
  const resetButton = document.getElementById('mitarbeiter-quick-filter-reset');
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

function applyMitarbeiterQuickFilter(list, selectedIds) {
  const normalizedIds = Array.isArray(selectedIds)
    ? selectedIds.map(id => String(id).trim()).filter(Boolean)
    : [];

  const currentFilters = filterSystem.getFilters('unternehmen') || {};
  const nextFilters = { ...currentFilters };

  if (normalizedIds.length > 0) {
    nextFilters.mitarbeiter_ids = normalizedIds;
  } else {
    delete nextFilters.mitarbeiter_ids;
  }

  filterSystem.applyFilters('unternehmen', nextFilters);
  list.pagination.currentPage = 1;
  list.loadDataDebounced(100);
  updateMitarbeiterQuickFilterMeta(normalizedIds.length);
}

export function bindMitarbeiterQuickFilterEvents(list, signal) {
  document.addEventListener('click', (e) => {
    const container = document.getElementById('unternehmen-mitarbeiter-filter-container');
    const dropdown = document.getElementById('mitarbeiter-quick-filter-dropdown');
    const toggleButton = document.getElementById('mitarbeiter-quick-filter-toggle');
    if (!container || !dropdown || !toggleButton) return;

    const clickedToggleButton = e.target.closest('#mitarbeiter-quick-filter-toggle');
    if (clickedToggleButton) {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !dropdown.classList.contains('show');
      dropdown.classList.toggle('show', willOpen);
      toggleButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      return;
    }

    const clickedReset = e.target.closest('#mitarbeiter-quick-filter-reset');
    if (clickedReset) {
      e.preventDefault();
      applyMitarbeiterQuickFilter(list, []);
      return;
    }

    if (!e.target.closest('#unternehmen-mitarbeiter-filter-container')) {
      dropdown.classList.remove('show');
      toggleButton.setAttribute('aria-expanded', 'false');
    }
  }, { signal });

  document.addEventListener('change', (e) => {
    if (!e.target.classList.contains('mitarbeiter-quick-filter-toggle-input')) return;

    const selectedIds = Array.from(
      document.querySelectorAll('.mitarbeiter-quick-filter-toggle-input:checked')
    ).map(input => input.value).filter(Boolean);

    applyMitarbeiterQuickFilter(list, selectedIds);
  }, { signal });
}
