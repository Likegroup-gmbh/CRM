// FilterDropdownEvents.js
// Event-Handling und DOM-Interaktion für das FilterDropdown.

export function bindGlobalEvents(ctx) {
  if (ctx._eventsBound) return;
  ctx._eventsBound = true;

  ctx._clickHandler = (e) => {
    // --- Submenu Apply ---
    const applyBtn = e.target.closest('.filter-submenu-apply');
    if (applyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const submenu = applyBtn.closest('.filter-submenu');
      if (!submenu) return;
      const { filterId, entityType } = submenu.dataset;
      if (filterId && entityType) {
        ctx.applyFilterFromSubmenu(entityType, filterId, submenu);
      }
      return;
    }

    // --- Toggle Button ---
    const toggle = e.target.closest('.filter-dropdown-toggle');
    if (toggle) {
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleDropdown(ctx, toggle);
      return;
    }

    // --- Close Button ---
    if (e.target.closest('.filter-dropdown-close')) {
      e.preventDefault();
      closeAllDropdowns();
      return;
    }

    // --- Filter-Option → Submenu öffnen ---
    const filterOption = e.target.closest('.filter-option');
    if (filterOption) {
      e.preventDefault();
      e.stopPropagation();
      showFilterSubmenu(ctx, filterOption);
      return;
    }

    // --- Chip entfernen ---
    const chipRemove = e.target.closest('.filter-chip-remove');
    if (chipRemove) {
      e.preventDefault();
      const filterId = chipRemove.dataset.filterId;
      const container = chipRemove.closest('.filter-dropdown-container');
      const entityType = container?.dataset.entityType;
      if (entityType && filterId) ctx.removeFilter(entityType, filterId);
      return;
    }

    // --- Alle Filter zurücksetzen ---
    const resetAll = e.target.closest('.filter-reset-all');
    if (resetAll) {
      e.preventDefault();
      const entityType = resetAll.dataset.entityType;
      if (entityType) ctx.resetAllFilters(entityType);
      return;
    }

    // --- Klick außerhalb → schließen ---
    if (!e.target.closest('.filter-dropdown-container') && !e.target.closest('.filter-submenu')) {
      closeAllDropdowns();
    }
  };

  document.addEventListener('click', ctx._clickHandler);
}

// ---------------------------------------------------------------------------
// Dropdown öffnen / schließen
// ---------------------------------------------------------------------------

export function toggleDropdown(ctx, toggleButton) {
  const container = toggleButton.closest('.filter-dropdown-container');
  const dropdown = container?.querySelector('.filter-dropdown');
  const isOpen = dropdown?.classList.contains('show');

  closeAllDropdowns();

  if (!isOpen && dropdown) {
    dropdown.classList.add('show');
    toggleButton.setAttribute('aria-expanded', 'true');
    positionDropdown(dropdown, toggleButton);
  }
}

export function positionDropdown(dropdown, toggle) {
  const toggleRect = toggle.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const dropdownHeight = dropdown.offsetHeight;
  const spaceBelow = viewportHeight - toggleRect.bottom;

  if (spaceBelow < dropdownHeight && toggleRect.top > dropdownHeight) {
    dropdown.style.bottom = '100%';
    dropdown.style.top = 'auto';
    dropdown.style.marginBottom = '8px';
  } else {
    dropdown.style.top = '100%';
    dropdown.style.bottom = 'auto';
    dropdown.style.marginTop = '8px';
  }
}

export function closeAllDropdowns() {
  document.querySelectorAll('.filter-dropdown.show').forEach(d => d.classList.remove('show'));
  document.querySelectorAll('.filter-dropdown-toggle').forEach(t => t.setAttribute('aria-expanded', 'false'));
  document.querySelectorAll('.filter-submenu').forEach(s => s.remove());
}

// ---------------------------------------------------------------------------
// Submenu anzeigen / positionieren
// ---------------------------------------------------------------------------

export async function showFilterSubmenu(ctx, filterOption) {
  const container = filterOption.closest('.filter-dropdown-container');
  const entityType = container?.dataset.entityType;
  const filterId = filterOption.dataset.filterId;
  if (!entityType || !filterId) return;

  document.querySelectorAll('.filter-submenu').forEach(s => s.remove());

  const instance = ctx.instances.get(entityType);
  const filterConfig = instance?.config.filters.find(f => f.id === filterId);
  if (!filterConfig) return;

  const submenu = document.createElement('div');
  submenu.className = 'filter-submenu';
  submenu.dataset.filterId = filterId;
  submenu.dataset.entityType = entityType;
  submenu.innerHTML = await ctx.renderFilterSubmenu(filterConfig, entityType);

  document.body.appendChild(submenu);
  positionSubmenu(submenu, filterOption);

  const firstInput = submenu.querySelector('input, select');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

export function positionSubmenu(submenu, filterOption) {
  const optionRect = filterOption.getBoundingClientRect();
  const submenuWidth = submenu.offsetWidth;
  const submenuHeight = submenu.offsetHeight;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = optionRect.right + 8;
  let top = optionRect.top;

  if (left + submenuWidth > viewportWidth - 20) {
    left = optionRect.left - submenuWidth - 8;
  }
  if (top + submenuHeight > viewportHeight - 20) {
    top = Math.max(20, viewportHeight - submenuHeight - 20);
  }

  submenu.style.left = `${left}px`;
  submenu.style.top = `${top}px`;
}
