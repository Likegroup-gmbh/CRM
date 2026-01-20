// ProduktFilterConfig.js (ES6-Modul)
// Produkt-spezifische Filter-Konfiguration

import { 
  createFilterConfig, 
  COMMON_FILTER_OPTIONS 
} from '../../../core/filters/BaseFilterConfig.js';

/**
 * Produkt-spezifische Filter-Konfiguration
 */
export const PRODUKT_FILTERS = [
  // Produktname Filter (Suche)
  createFilterConfig('text', {
    id: 'name',
    label: 'Produktname',
    placeholder: 'Produkt suchen...',
    priority: 1
  }),

  // Marke Filter
  createFilterConfig('select', {
    id: 'marke_id',
    label: 'Marke',
    table: 'marke',
    displayField: 'markenname',
    valueField: 'id',
    dynamic: true,
    priority: 2
  }),

  // Unternehmen Filter
  createFilterConfig('select', {
    id: 'unternehmen_id',
    label: 'Unternehmen',
    table: 'unternehmen',
    displayField: 'firmenname',
    valueField: 'id',
    dynamic: true,
    priority: 3
  })
];

export default {
  filters: PRODUKT_FILTERS,
  entityType: 'produkt'
};
