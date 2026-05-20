// FilterDropdownFormatApply.js
// Wert-Formatierung, Filter-Anwendung und State-Management.

// ---------------------------------------------------------------------------
// Counts & Lookup
// ---------------------------------------------------------------------------

export function getActiveFilterCount(ctx, entityType) {
  const instance = ctx.instances.get(entityType);
  return instance ? instance.activeFilters.size : 0;
}

export function getEntityTypeForFilter(ctx, filterId) {
  for (const [entityType, instance] of ctx.instances.entries()) {
    if (instance.config.filters.some(f => f.id === filterId)) {
      return entityType;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Formatierung
// ---------------------------------------------------------------------------

export function formatFilterValueSync(ctx, filterConfig, value) {
  if (filterConfig.type === 'boolean') {
    return value === true ? 'Ja' : value === false ? 'Nein' : '';
  }

  if (value === null || value === undefined || value === '') return '';

  if (filterConfig.type === 'select') {
    const option = filterConfig.options?.find(opt => (opt.value || opt.id) === value);
    if (option) return option.label || option.name || value;
  }

  if (filterConfig.table && typeof value === 'string' && value.length > 10) {
    ctx.loadFilterLabelAsync(filterConfig, value);
    return value;
  }

  return String(value);
}

export async function formatFilterValue(filterConfig, value) {
  if (filterConfig.type === 'boolean') {
    return value === true ? 'Ja' : value === false ? 'Nein' : '';
  }

  if (value === null || value === undefined || value === '') return '';

  switch (filterConfig.type) {
    case 'select': {
      const option = filterConfig.options?.find(opt => (opt.value || opt.id) === value);
      if (option) return option.label || option.name || value;

      if (filterConfig.table && filterConfig.displayField && filterConfig.valueField) {
        try {
          const { data, error } = await window.supabase
            .from(filterConfig.table)
            .select(`${filterConfig.valueField}, ${filterConfig.displayField}`)
            .eq(filterConfig.valueField, value)
            .single();
          if (!error && data) return data[filterConfig.displayField] || value;
        } catch (err) {
          console.error('Fehler beim Laden des Labels:', err);
        }
      }
      return value;
    }

    case 'multiSelect':
      if (Array.isArray(value)) {
        const labels = await Promise.all(value.map(async (v) => {
          const opt = filterConfig.options?.find(o => (o.value || o.id) === v);
          if (opt) return opt.label || opt.name || v;

          if (filterConfig.table && filterConfig.displayField && filterConfig.valueField) {
            try {
              const { data, error } = await window.supabase
                .from(filterConfig.table)
                .select(`${filterConfig.valueField}, ${filterConfig.displayField}`)
                .eq(filterConfig.valueField, v)
                .single();
              if (!error && data) return data[filterConfig.displayField] || v;
            } catch (err) {
              console.error('Fehler beim Laden des Labels:', err);
            }
          }
          return v;
        }));
        return labels.join(', ');
      }
      return value;

    case 'date':
    case 'dateRange':
      if (typeof value === 'object') {
        const parts = [];
        if (value.from) parts.push(`ab ${value.from}`);
        if (value.to) parts.push(`bis ${value.to}`);
        return parts.join(' ');
      }
      return value;

    case 'number':
    case 'numberRange':
      if (typeof value === 'object') {
        const parts = [];
        if (value.min !== undefined) parts.push(`min ${value.min}`);
        if (value.max !== undefined) parts.push(`max ${value.max}`);
        return parts.join(' - ');
      }
      return value;

    case 'boolean':
      return value ? 'Ja' : 'Nein';

    default:
      return String(value);
  }
}

export async function loadFilterLabelAsync(ctx, filterConfig, value) {
  if (!filterConfig.table || !filterConfig.displayField || !filterConfig.valueField) return;

  try {
    const { data, error } = await window.supabase
      .from(filterConfig.table)
      .select(`${filterConfig.valueField}, ${filterConfig.displayField}`)
      .eq(filterConfig.valueField, value)
      .single();

    if (!error && data && data[filterConfig.displayField]) {
      const label = data[filterConfig.displayField];
      const entityType = ctx.getEntityTypeForFilter(filterConfig.id);
      const instance = ctx.instances.get(entityType);
      if (instance) {
        if (!instance.labelCache) instance.labelCache = new Map();
        instance.labelCache.set(`${filterConfig.id}:${value}`, label);
        await ctx.updateUI(entityType);
      }
    }
  } catch (err) {
    console.error('Fehler beim Nachladen des Labels:', err);
  }
}

// ---------------------------------------------------------------------------
// Filter anwenden / entfernen / zurücksetzen
// ---------------------------------------------------------------------------

export async function applyFilterFromSubmenu(ctx, entityType, filterId, submenu) {
  const instance = ctx.instances.get(entityType);
  const filterConfig = instance?.config.filters.find(f => f.id === filterId);
  if (!filterConfig) return;

  let filterValue;

  switch (filterConfig.type) {
    case 'text':
    case 'date':
    case 'number': {
      const input = submenu.querySelector(`[data-filter-id="${filterId}"]`);
      filterValue = input?.value?.trim();
      break;
    }

    case 'select':
    case 'boolean': {
      const select = submenu.querySelector(`[data-filter-id="${filterId}"]`);
      filterValue = select?.value;
      if (filterConfig.type === 'boolean') {
        filterValue = filterValue === 'true' ? true : filterValue === 'false' ? false : null;
      }
      break;
    }

    case 'multiSelect': {
      const checkboxes = submenu.querySelectorAll(
        `input[type="checkbox"][data-filter-id="${filterId}"]:checked`
      );
      filterValue = Array.from(checkboxes).map(cb => cb.value);
      break;
    }

    case 'dateRange':
    case 'numberRange': {
      const fromInput = submenu.querySelector(
        `[data-filter-id="${filterId}"][data-range="from"], [data-filter-id="${filterId}"][data-range="min"]`
      );
      const toInput = submenu.querySelector(
        `[data-filter-id="${filterId}"][data-range="to"], [data-filter-id="${filterId}"][data-range="max"]`
      );
      const fromValue = fromInput?.value;
      const toValue = toInput?.value;

      if (fromValue || toValue) {
        filterValue = {};
        if (fromValue) filterValue[filterConfig.type === 'dateRange' ? 'from' : 'min'] = fromValue;
        if (toValue) filterValue[filterConfig.type === 'dateRange' ? 'to' : 'max'] = toValue;
      }
      break;
    }
  }

  const hasValidValue = filterValue !== null && filterValue !== undefined && filterValue !== '' &&
    (typeof filterValue === 'boolean' ||
     (typeof filterValue !== 'object' || Object.keys(filterValue).length > 0) &&
     (!Array.isArray(filterValue) || filterValue.length > 0));

  if (hasValidValue) {
    instance.activeFilters.set(filterId, filterValue);

    if (filterConfig.type === 'select' && filterConfig.table &&
        filterConfig.displayField && filterConfig.valueField) {
      if (typeof filterValue === 'string' && filterValue.length > 10) {
        ctx.loadFilterLabelAsync(filterConfig, filterValue);
      }
    }
  } else {
    instance.activeFilters.delete(filterId);
  }

  await ctx.updateUI(entityType);
  await ctx.executeFilterCallback(entityType);
  ctx.closeAllDropdowns();
}

export async function removeFilter(ctx, entityType, filterId) {
  const instance = ctx.instances.get(entityType);
  if (!instance) return;

  instance.activeFilters.delete(filterId);
  await ctx.updateUI(entityType);
  await ctx.executeFilterCallback(entityType);
}

export async function resetAllFilters(ctx, entityType) {
  const instance = ctx.instances.get(entityType);
  if (!instance) return;

  instance.activeFilters.clear();
  await ctx.updateUI(entityType);

  const callbacks = ctx.callbacks.get(entityType);
  if (callbacks?.onFilterReset) {
    await callbacks.onFilterReset();
  }
}

// ---------------------------------------------------------------------------
// UI-Update & Callbacks
// ---------------------------------------------------------------------------

export async function updateUI(ctx, entityType) {
  const instance = ctx.instances.get(entityType);
  if (!instance) return;

  const activeFiltersContainer = document.getElementById(`active-filters-${entityType}`);
  if (activeFiltersContainer) {
    activeFiltersContainer.innerHTML = await ctx.renderActiveFiltersAsync(entityType);
  }

  const container = instance.containerElement.querySelector('.filter-dropdown-container');
  const toggle = container?.querySelector('.filter-dropdown-toggle');
  if (toggle) {
    const existingBadge = toggle.querySelector('.filter-count-badge');
    const count = ctx.getActiveFilterCount(entityType);

    if (count > 0) {
      if (existingBadge) {
        existingBadge.textContent = count;
      } else {
        toggle.insertAdjacentHTML('beforeend', `<span class="filter-count-badge">${count}</span>`);
      }
    } else if (existingBadge) {
      existingBadge.remove();
    }
  }
}

export async function executeFilterCallback(ctx, entityType) {
  const callbacks = ctx.callbacks.get(entityType);
  const instance = ctx.instances.get(entityType);
  if (!callbacks?.onFilterApply || !instance) return;

  const filtersObject = {};
  instance.activeFilters.forEach((value, key) => {
    filtersObject[key] = value;
  });

  try {
    await callbacks.onFilterApply(filtersObject);
  } catch (error) {
    console.error(`Fehler beim Anwenden der Filter:`, error);
  }
}

// ---------------------------------------------------------------------------
// Getter / Setter
// ---------------------------------------------------------------------------

export function getActiveFilters(ctx, entityType) {
  const instance = ctx.instances.get(entityType);
  if (!instance) return {};

  const filtersObject = {};
  instance.activeFilters.forEach((value, key) => {
    filtersObject[key] = value;
  });
  return filtersObject;
}

export async function setFilters(ctx, entityType, filters) {
  const instance = ctx.instances.get(entityType);
  if (!instance) return;

  instance.activeFilters.clear();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      instance.activeFilters.set(key, value);
    }
  });

  await ctx.updateUI(entityType);
}
