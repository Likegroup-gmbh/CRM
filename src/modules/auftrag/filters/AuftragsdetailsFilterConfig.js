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
  // Auftragsname Filter (lädt aus auftrag-Tabelle)
  createFilterConfig('select', {
    id: 'auftragsname',
    label: 'Auftragsname',
    placeholder: 'Auftrag auswählen...',
    dynamic: true,
    priority: 1
  }),
  
  // Auftrag Filter (via ID)
  createFilterConfig('select', {
    id: 'auftrag_id',
    label: 'Auftrag',
    table: 'auftrag',
    displayField: 'auftragsname',
    valueField: 'id',
    dynamic: true,
    priority: 2
  })
];

/**
 * Auftragsdetails-spezifische Filter-Gruppen
 */
export const AUFTRAGSDETAILS_FILTER_GROUPS = [
  {
    id: 'basic',
    label: 'Grunddaten',
    filters: ['auftragsname', 'auftrag_id'],
    expanded: true
  }
];

export default {
  filters: AUFTRAGSDETAILS_FILTERS,
  groups: AUFTRAGSDETAILS_FILTER_GROUPS
};

