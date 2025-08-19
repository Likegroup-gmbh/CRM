// AnsprechpartnerFilterConfig.js (ES6-Modul)
// Ansprechpartner-spezifische Filter-Konfiguration

import { 
  createFilterConfig, 
  COMMON_FILTER_OPTIONS 
} from '../../../core/filters/BaseFilterConfig.js';

/**
 * Ansprechpartner-spezifische Filter-Konfiguration
 */
export const ANSPRECHPARTNER_FILTERS = [
  // Vorname Filter
  createFilterConfig('text', {
    id: 'vorname',
    label: 'Vorname',
    placeholder: 'Nach Vorname suchen...',
    priority: 1
  }),

  // Nachname Filter
  createFilterConfig('text', {
    id: 'nachname',
    label: 'Nachname',
    placeholder: 'Nach Nachname suchen...',
    priority: 2
  }),

  // Position Filter
  createFilterConfig('select', {
    id: 'position_id',
    label: 'Position',
    table: 'positionen',
    displayField: 'name',
    valueField: 'id',
    dynamic: true,
    priority: 3
  }),

  // Unternehmen Filter
  createFilterConfig('select', {
    id: 'unternehmen_id',
    label: 'Unternehmen',
    table: 'unternehmen',
    displayField: 'firmenname',
    valueField: 'id',
    dynamic: true,
    priority: 4
  }),

  // Stadt Filter
  createFilterConfig('text', {
    id: 'stadt',
    label: 'Stadt',
    placeholder: 'Nach Stadt suchen...',
    priority: 5
  }),

  // Sprache Filter
  createFilterConfig('select', {
    id: 'sprache_id',
    label: 'Sprache',
    table: 'sprachen',
    displayField: 'name',
    valueField: 'id',
    dynamic: true,
    priority: 6
  }),

  // Email vorhanden
  createFilterConfig('boolean', {
    id: 'has_email',
    label: 'Email vorhanden',
    virtual: true,
    priority: 7
  }),

  // Telefon vorhanden
  createFilterConfig('boolean', {
    id: 'has_phone',
    label: 'Telefon vorhanden',
    virtual: true,
    priority: 8
  }),

  // Erstellt am
  createFilterConfig('dateRange', {
    id: 'created_at',
    label: 'Erstellt am',
    priority: 9
  })
];

/**
 * Ansprechpartner-spezifische Filter-Gruppen
 */
export const ANSPRECHPARTNER_FILTER_GROUPS = [
  {
    id: 'basic',
    label: 'Grundlagen',
    filters: ['vorname', 'nachname', 'position_id', 'unternehmen_id'],
    expanded: true
  },
  {
    id: 'location',
    label: 'Standort',
    filters: ['stadt', 'sprache_id'],
    expanded: false
  },
  {
    id: 'contact',
    label: 'Kontakt',
    filters: ['has_email', 'has_phone'],
    expanded: false
  },
  {
    id: 'meta',
    label: 'Metadaten',
    filters: ['created_at'],
    expanded: false
  }
];

export default {
  filters: ANSPRECHPARTNER_FILTERS,
  groups: ANSPRECHPARTNER_FILTER_GROUPS,
  entityType: 'ansprechpartner'
};