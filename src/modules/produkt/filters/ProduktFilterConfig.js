// ProduktFilterConfig.js
// Filter für die globale Produkte-Liste: Unternehmen + Marke

import { createFilterConfig } from '../../../core/filters/BaseFilterConfig.js';

export const PRODUKT_FILTERS = [
  createFilterConfig('select', {
    id: 'unternehmen_id',
    label: 'Unternehmen',
    table: 'unternehmen',
    displayField: 'firmenname',
    valueField: 'id',
    dynamic: true,
    priority: 1
  }),
  createFilterConfig('select', {
    id: 'marke_id',
    label: 'Marke',
    table: 'marke',
    displayField: 'markenname',
    valueField: 'id',
    dynamic: true,
    priority: 2
  })
];

export default {
  filters: PRODUKT_FILTERS,
  entityType: 'produkt'
};
