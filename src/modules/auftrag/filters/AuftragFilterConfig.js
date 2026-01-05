// AuftragFilterConfig.js (ES6-Modul)
// Auftrag-spezifische Filter-Konfiguration

import { 
  createFilterConfig, 
  COMMON_FILTER_OPTIONS,
  BASE_FORMATTERS 
} from '../../../core/filters/BaseFilterConfig.js';

/**
 * Auftrag-spezifische Filter-Konfiguration
 */
export const AUFTRAG_FILTERS = [
  // Auftragsname Filter (Dropdown)
  createFilterConfig('select', {
    id: 'auftragsname',
    label: 'Auftragsname',
    placeholder: 'Auftrag auswählen...',
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

  // Marke Filter
  createFilterConfig('select', {
    id: 'marke_id',
    label: 'Marke',
    table: 'marke',
    displayField: 'markenname',
    valueField: 'id',
    dynamic: true,
    priority: 3
  }),

  // Status Filter
  createFilterConfig('select', {
    id: 'status',
    label: 'Status',
    options: [
      { value: 'Beauftragt', label: 'Beauftragt' },
      { value: 'in Produktion', label: 'In Produktion' },
      { value: 'Abgeschlossen', label: 'Abgeschlossen' },
      { value: 'Storniert', label: 'Storniert' }
    ],
    priority: 4
  }),

  // Rechnung gestellt
  createFilterConfig('boolean', {
    id: 'rechnung_gestellt',
    label: 'Rechnung gestellt',
    priority: 5
  }),

  // Überwiesen
  createFilterConfig('boolean', {
    id: 'ueberwiesen',
    label: 'Überwiesen',
    priority: 6
  })
];

export default {
  filters: AUFTRAG_FILTERS,
  entityType: 'auftrag'
};