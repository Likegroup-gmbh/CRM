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

  // Deadline-Filter entfernt: skript_deadline/content_deadline liegen jetzt auf Video-Ebene (kooperation_videos)

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