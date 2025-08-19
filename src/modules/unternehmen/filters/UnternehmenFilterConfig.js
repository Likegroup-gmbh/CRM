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
  // Firmenname Filter
  createFilterConfig('text', {
    id: 'firmenname',
    label: 'Firmenname',
    placeholder: 'Nach Firmenname suchen...',
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
  }),

  // Anzahl Ansprechpartner
  createFilterConfig('numberRange', {
    id: 'ansprechpartner_count',
    label: 'Anzahl Ansprechpartner',
    min: 0,
    max: 50,
    virtual: true,
    priority: 6
  }),

  // Anzahl Kampagnen
  createFilterConfig('numberRange', {
    id: 'kampagne_count',
    label: 'Anzahl Kampagnen',
    min: 0,
    max: 100,
    virtual: true,
    priority: 7
  }),

  // Erstellt am
  createFilterConfig('dateRange', {
    id: 'created_at',
    label: 'Erstellt am',
    priority: 8
  })
];

export default {
  filters: UNTERNEHMEN_FILTERS,
  entityType: 'unternehmen'
};