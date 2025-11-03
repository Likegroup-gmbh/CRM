// UnternehmenFilterConfig.js (ES6-Modul)
// Unternehmen-spezifische Filter-Konfiguration

import { 
  createFilterConfig, 
  COMMON_FILTER_OPTIONS 
} from '../../../core/filters/BaseFilterConfig.js';

/**
 * Unternehmen-spezifische Filter-Konfiguration
 */
export const UNTERNEHMEN_FILTERS = [
  // Firmenname Filter (Dropdown mit verfügbaren Firmennamen)
  createFilterConfig('select', {
    id: 'firmenname',
    label: 'Firmenname',
    placeholder: 'Firmenname auswählen...',
    dynamic: true,
    priority: 1
  }),

  // Branche Filter (dynamisch aus Datenbank)
  createFilterConfig('select', {
    id: 'branche_id',
    label: 'Branche',
    table: 'branchen',
    displayField: 'name',
    valueField: 'id',
    dynamic: true,
    priority: 2
  }),

  // Status Filter
  createFilterConfig('select', {
    id: 'status',
    label: 'Status',
    options: [
      { value: 'Aktiv', label: 'Aktiv' },
      { value: 'Inaktiv', label: 'Inaktiv' },
      { value: 'Potentiell', label: 'Potentiell' }
    ],
    priority: 3
  }),

  // Stadt Filter
  createFilterConfig('text', {
    id: 'rechnungsadresse_stadt',
    label: 'Stadt',
    placeholder: 'Nach Stadt suchen...',
    priority: 4
  }),

  // Land Filter
  createFilterConfig('text', {
    id: 'rechnungsadresse_land',
    label: 'Land',
    placeholder: 'Nach Land suchen...',
    priority: 5
  })
];

export default {
  filters: UNTERNEHMEN_FILTERS,
  entityType: 'unternehmen'
};