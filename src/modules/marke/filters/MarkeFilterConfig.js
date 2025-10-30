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
  // Markenname Filter
  createFilterConfig('text', {
    id: 'markenname',
    label: 'Markenname',
    placeholder: 'Nach Markenname suchen...',
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
  }),

  // Anzahl Kampagnen
  createFilterConfig('numberRange', {
    id: 'kampagne_count',
    label: 'Anzahl Kampagnen',
    min: 0,
    max: 100,
    virtual: true,
    priority: 4
  })
];

export default {
  filters: MARKE_FILTERS,
  entityType: 'marke'
};