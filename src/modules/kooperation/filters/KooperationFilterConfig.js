// KooperationFilterConfig.js (ES6-Modul)
// Kooperation-spezifische Filter-Konfiguration

import { 
  createFilterConfig, 
  COMMON_FILTER_OPTIONS,
  BASE_FORMATTERS 
} from '../../../core/filters/BaseFilterConfig.js';

/**
 * Kooperation-spezifische Filter-Konfiguration
 */
export const KOOPERATION_FILTERS = [
  // Creator Filter
  createFilterConfig('select', {
    id: 'creator_id',
    label: 'Creator',
    table: 'creator',
    displayField: 'vorname',
    valueField: 'id',
    dynamic: true,
    priority: 1
  }),

  // Kampagne Filter
  createFilterConfig('select', {
    id: 'kampagne_id',
    label: 'Kampagne',
    table: 'kampagne',
    displayField: 'kampagnenname',
    valueField: 'id',
    dynamic: true,
    priority: 2
  }),

  // Status Filter
  createFilterConfig('select', {
    id: 'status',
    label: 'Status',
    options: [
      { value: 'Angefragt', label: 'Angefragt' },
      { value: 'Bestätigt', label: 'Bestätigt' },
      { value: 'In Bearbeitung', label: 'In Bearbeitung' },
      { value: 'Abgeschlossen', label: 'Abgeschlossen' },
      { value: 'Abgelehnt', label: 'Abgelehnt' }
    ],
    priority: 3
  }),

  // Budget Filter
  createFilterConfig('numberRange', {
    id: 'budget',
    label: 'Budget',
    min: 0,
    max: 50000,
    step: 100,
    formatter: BASE_FORMATTERS.currency,
    priority: 4
  }),

  // Start-Datum Filter
  createFilterConfig('dateRange', {
    id: 'start_datum',
    label: 'Script Deadline',
    priority: 5
  }),

  // End-Datum Filter
  createFilterConfig('dateRange', {
    id: 'end_datum',
    label: 'Content Deadline',
    priority: 6
  }),

  // Deliverables erstellt
  createFilterConfig('boolean', {
    id: 'has_deliverables',
    label: 'Deliverables vorhanden',
    virtual: true,
    priority: 7
  }),

  // Bezahlt
  createFilterConfig('boolean', {
    id: 'is_paid',
    label: 'Bezahlt',
    virtual: true,
    priority: 8
  })
];

export default {
  filters: KOOPERATION_FILTERS,
  entityType: 'kooperation'
};