// MarkeFilterConfig.js (ES6-Modul)
// Marke-spezifische Filter-Konfiguration

import { 
  createFilterConfig, 
  COMMON_FILTER_OPTIONS 
} from '../../../core/filters/BaseFilterConfig.js';

/**
 * Marke-spezifische Filter-Konfiguration
 */
export const MARKE_FILTERS = [
  // Markenname Filter (Dropdown)
  createFilterConfig('select', {
    id: 'markenname',
    label: 'Markenname',
    placeholder: 'Marke auswählen...',
    dynamic: true,
    priority: 1
  }),

  // Unternehmen Filter
  createFilterConfig('select', {
    id: 'unternehmen_id',
    label: 'Unternehmen',
    table: 'unternehmen',
    displayField: 'firmenname',
    valueField: 'id',
    dynamic: true,
    priority: 2
  }),

  // Branche Filter (dynamisch aus Datenbank)
  createFilterConfig('select', {
    id: 'branche_id',
    label: 'Branche',
    table: 'branchen',
    displayField: 'name',
    valueField: 'id',
    dynamic: true,
    priority: 3
  })
];

export default {
  filters: MARKE_FILTERS,
  entityType: 'marke'
};