// BriefingFilterConfig.js (ES6-Modul)
// Briefing-spezifische Filter-Konfiguration

import { 
  createFilterConfig,
  BASE_FORMATTERS
} from '../../../core/filters/BaseFilterConfig.js';

export const BRIEFING_FILTERS = [
  // Volltext auf Produkt/Angebot
  createFilterConfig('text', {
    id: 'product_service_offer',
    label: 'Produkt/Angebot',
    placeholder: 'Nach Produkt/Angebot suchen...',
    priority: 1
  }),

  createFilterConfig('select', {
    id: 'unternehmen_id',
    label: 'Unternehmen',
    table: 'unternehmen',
    displayField: 'firmenname',
    valueField: 'id',
    dynamic: true,
    priority: 2
  }),

  createFilterConfig('select', {
    id: 'marke_id',
    label: 'Marke',
    table: 'marke',
    displayField: 'markenname',
    valueField: 'id',
    dynamic: true,
    priority: 3
  }),

  createFilterConfig('select', {
    id: 'assignee_id',
    label: 'Zugewiesen an',
    table: 'benutzer',
    displayField: 'name',
    valueField: 'id',
    dynamic: true,
    priority: 4
  }),

  createFilterConfig('select', {
    id: 'status',
    label: 'Status',
    options: [
      { value: 'active', label: 'Aktiv' },
      { value: 'inactive', label: 'Inaktiv' },
      { value: 'completed', label: 'Abgeschlossen' },
      { value: 'cancelled', label: 'Abgebrochen' }
    ],
    priority: 5
  }),

  createFilterConfig('dateRange', {
    id: 'deadline',
    label: 'Deadline',
    priority: 6
  }),

  createFilterConfig('dateRange', {
    id: 'created_at',
    label: 'Erstellt am',
    priority: 7
  })
];

export const BRIEFING_FILTER_GROUPS = [
  {
    id: 'basic',
    label: 'Grundlagen',
    filters: ['product_service_offer', 'unternehmen_id', 'marke_id', 'status'],
    expanded: true
  },
  {
    id: 'assignments',
    label: 'Zuweisungen',
    filters: ['assignee_id'],
    expanded: false
  },
  {
    id: 'timing',
    label: 'Zeit',
    filters: ['deadline', 'created_at'],
    expanded: false
  }
];

export const BRIEFING_FILTER_PRESETS = [];

export const BRIEFING_SORT_OPTIONS = [
  { value: 'created_at', label: 'Erstellt (neu zuerst)', direction: 'desc' },
  { value: 'created_at', label: 'Erstellt (alt zuerst)', direction: 'asc' },
  { value: 'deadline', label: 'Deadline (nah zuerst)', direction: 'asc' },
  { value: 'deadline', label: 'Deadline (fern zuerst)', direction: 'desc' }
];

export default {
  filters: BRIEFING_FILTERS,
  groups: BRIEFING_FILTER_GROUPS,
  presets: BRIEFING_FILTER_PRESETS,
  sortOptions: BRIEFING_SORT_OPTIONS,
  entityType: 'briefing'
};



