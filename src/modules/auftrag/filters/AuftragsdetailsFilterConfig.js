// AuftragsdetailsFilterConfig.js (ES6-Modul)
// Auftragsdetails-spezifische Filter-Konfiguration

import { 
  createFilterConfig, 
  COMMON_FILTER_OPTIONS 
} from '../../../core/filters/BaseFilterConfig.js';

/**
 * Auftragsdetails-spezifische Filter-Konfiguration
 */
export const AUFTRAGSDETAILS_FILTERS = [
  // Auftrag Filter
  createFilterConfig('select', {
    id: 'auftrag_id',
    label: 'Auftrag',
    table: 'auftrag',
    displayField: 'auftragsname',
    valueField: 'id',
    dynamic: true,
    priority: 1
  }),

  // Kampagnenanzahl Filter
  createFilterConfig('numberRange', {
    id: 'kampagnenanzahl',
    label: 'Kampagnenanzahl',
    priority: 2
  }),

  // Gesamt Videos Filter
  createFilterConfig('numberRange', {
    id: 'gesamt_videos',
    label: 'Geplante Videos',
    priority: 3
  }),

  // Gesamt Creator Filter
  createFilterConfig('numberRange', {
    id: 'gesamt_creator',
    label: 'Geplante Creator',
    priority: 4
  }),

  // Erstellt am
  createFilterConfig('dateRange', {
    id: 'created_at',
    label: 'Erstellt am',
    priority: 5
  })
];

/**
 * Auftragsdetails-spezifische Filter-Gruppen
 */
export const AUFTRAGSDETAILS_FILTER_GROUPS = [
  {
    id: 'basic',
    label: 'Grunddaten',
    filters: ['auftrag_id', 'kampagnenanzahl'],
    expanded: true
  },
  {
    id: 'planning',
    label: 'Planung',
    filters: ['gesamt_videos', 'gesamt_creator'],
    expanded: false
  },
  {
    id: 'meta',
    label: 'Zeitraum',
    filters: ['created_at'],
    expanded: false
  }
];

export default {
  filters: AUFTRAGSDETAILS_FILTERS,
  groups: AUFTRAGSDETAILS_FILTER_GROUPS
};

