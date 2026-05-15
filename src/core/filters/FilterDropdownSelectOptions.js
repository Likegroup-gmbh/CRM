// FilterDropdownSelectOptions.js
// Einheitliche Pipeline zum Laden von Select-/MultiSelect-Optionen.

import { getSelectOptionsLoader } from './FilterSelectOptionsRegistry.js';
import { extractOptionsFromCurrentData } from './FilterDropdownHelper.js';

/**
 * Lädt Optionen für einen Select-/MultiSelect-Filter.
 *
 * Priorität:
 *  1. filterConfig.options (statisch in der Config definiert)
 *  2. Options-Cache (ctx.optionsCache)
 *  3. Registry-Loader (FilterSelectOptionsRegistry)
 *  4. DOM-Extraktion (extractOptionsFromCurrentData)
 *  5. Generischer Tabellen-Fallback (.from(table).select)
 */
export async function loadSelectOptions(ctx, entityType, filterConfig) {
  if (filterConfig.options?.length > 0) {
    return filterConfig.options;
  }

  const cached = ctx.getCachedOptions(entityType, filterConfig.id);
  if (cached) return cached;

  if (!filterConfig.dynamic && !filterConfig.table) return [];

  let options = [];

  try {
    const registeredLoader = getSelectOptionsLoader(entityType, filterConfig.id);
    if (registeredLoader && window.supabase) {
      options = await registeredLoader({ supabase: window.supabase, filterConfig, entityType });
    }

    if (options.length === 0) {
      options = extractOptionsFromCurrentData(entityType, filterConfig);
    }

    if (options.length === 0 && window.supabase && filterConfig.table) {
      const displayField = filterConfig.displayField || 'name';
      const valueField = filterConfig.valueField || 'id';

      const { data, error } = await window.supabase
        .from(filterConfig.table)
        .select(`${valueField}, ${displayField}`)
        .order(displayField);

      if (!error && data) {
        options = data.map(item => ({
          value: item[valueField],
          label: item[displayField]
        }));
      }
    }
  } catch (error) {
    console.error(`Fehler beim Laden der Optionen für ${filterConfig.id}:`, error);
  }

  if (options.length > 0) {
    ctx.setCachedOptions(entityType, filterConfig.id, options);
  }

  return options;
}
