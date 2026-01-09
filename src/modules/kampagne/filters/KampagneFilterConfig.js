// KampagneFilterConfig.js (ES6-Modul)
// Kampagne-spezifische Filter-Konfiguration

import { 
  createFilterConfig, 
  COMMON_FILTER_OPTIONS,
  BASE_FORMATTERS 
} from '../../../core/filters/BaseFilterConfig.js';

/**
 * Kampagne-spezifische Filter-Konfiguration
 */
export const KAMPAGNE_FILTERS = [
  // Kampagnenname Filter
  createFilterConfig('text', {
    id: 'kampagnenname',
    label: 'Kampagnenname',
    placeholder: 'Nach Kampagnenname suchen...',
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
    id: 'status_id',
    label: 'Status',
    table: 'kampagne_status',
    displayField: 'name',
    valueField: 'id',
    dynamic: true,
    priority: 4
  }),

  // Art der Kampagne Filter
  createFilterConfig('multiSelect', {
    id: 'art_der_kampagne',
    label: 'Art der Kampagne',
    options: COMMON_FILTER_OPTIONS.campaignTypes,
    priority: 5
  }),

  // Budget Range Filter
  createFilterConfig('numberRange', {
    id: 'budget',
    label: 'Budget',
    min: 0,
    max: 1000000,
    step: 100,
    formatter: BASE_FORMATTERS.currency,
    priority: 6
  }),

  // Startdatum Filter
  createFilterConfig('dateRange', {
    id: 'start',
    label: 'Startdatum',
    priority: 7
  }),

  // Deadline Post Produktion Filter
  createFilterConfig('dateRange', {
    id: 'deadline_post_produktion',
    label: 'Deadline Post Produktion',
    priority: 8
  }),

  // Creator-Anzahl Range
  createFilterConfig('numberRange', {
    id: 'creator_count',
    label: 'Anzahl Creator',
    min: 0,
    max: 100,
    step: 1,
    virtual: true, // Wird aus Kooperationen berechnet
    priority: 9
  }),

  // Kampagnen-Dauer (Tage)
  createFilterConfig('numberRange', {
    id: 'duration_days',
    label: 'Dauer (Tage)',
    min: 1,
    max: 365,
    step: 1,
    virtual: true, // Wird aus Start/End berechnet
    priority: 10
  }),

  // Hat Briefing
  createFilterConfig('boolean', {
    id: 'has_briefing',
    label: 'Briefing vorhanden',
    virtual: true,
    priority: 11
  }),

  // Ist abgeschlossen
  createFilterConfig('boolean', {
    id: 'is_completed',
    label: 'Abgeschlossen',
    virtual: true,
    priority: 12
  }),

  // Ist überfällig
  createFilterConfig('boolean', {
    id: 'is_overdue',
    label: 'Überfällig',
    virtual: true,
    priority: 13
  })
];

/**
 * Kampagne-spezifische Filter-Gruppen
 */
export const KAMPAGNE_FILTER_GROUPS = [
  {
    id: 'basic',
    label: 'Grundlagen',
    filters: ['kampagnenname', 'unternehmen_id', 'marke_id', 'status_id'],
    expanded: true
  },
  {
    id: 'campaign_details',
    label: 'Kampagnen-Details',
    filters: ['art_der_kampagne', 'budget', 'creator_count'],
    expanded: false
  },
  {
    id: 'timing',
    label: 'Zeitplanung',
    filters: ['start', 'deadline_post_produktion', 'duration_days'],
    expanded: false
  },
  {
    id: 'status_flags',
    label: 'Status & Flags',
    filters: ['has_briefing', 'is_completed', 'is_overdue'],
    expanded: false
  },
];

/**
 * Kampagne-spezifische Filter-Presets
 */
export const KAMPAGNE_FILTER_PRESETS = [
  {
    id: 'active_campaigns',
    label: 'Aktive Kampagnen',
    description: 'Laufende Kampagnen mit aktivem Status',
    filters: {
      status_id: 'active',
      start: { to: new Date().toISOString().split('T')[0] },
      deadline_post_produktion: { from: new Date().toISOString().split('T')[0] }
    }
  },
  {
    id: 'upcoming_campaigns',
    label: 'Bevorstehende Kampagnen',
    description: 'Kampagnen die in den nächsten 30 Tagen starten',
    filters: {
      start: {
        from: new Date().toISOString().split('T')[0],
        to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    }
  },
  {
    id: 'overdue_campaigns',
    label: 'Überfällige Kampagnen',
    description: 'Kampagnen mit überschrittener Deadline',
    filters: {
      is_overdue: true
    }
  },
  {
    id: 'high_budget_campaigns',
    label: 'High-Budget Kampagnen',
    description: 'Kampagnen mit Budget über 50.000€',
    filters: {
      budget: { min: 50000 }
    }
  },
  {
    id: 'ugc_campaigns',
    label: 'UGC Kampagnen',
    description: 'User Generated Content Kampagnen',
    filters: {
      art_der_kampagne: ['UGC Kampagne']
    }
  },
  {
    id: 'completed_this_month',
    label: 'Diesen Monat abgeschlossen',
    description: 'In diesem Monat abgeschlossene Kampagnen',
    filters: {
      is_completed: true,
      deadline_post_produktion: {
        from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
      }
    }
  }
];

/**
 * Kampagne-spezifische Sortier-Optionen
 */
export const KAMPAGNE_SORT_OPTIONS = [
  { value: 'kampagnenname', label: 'Name (A-Z)', direction: 'asc' },
  { value: 'kampagnenname', label: 'Name (Z-A)', direction: 'desc' },
  { value: 'start', label: 'Startdatum (neu zuerst)', direction: 'desc' },
  { value: 'start', label: 'Startdatum (alt zuerst)', direction: 'asc' },
  { value: 'deadline_post_produktion', label: 'Deadline Post Produktion (nah zuerst)', direction: 'asc' },
  { value: 'deadline_post_produktion', label: 'Deadline Post Produktion (fern zuerst)', direction: 'desc' },
  { value: 'budget', label: 'Budget (hoch zuerst)', direction: 'desc' },
  { value: 'budget', label: 'Budget (niedrig zuerst)', direction: 'asc' }
];

/**
 * Exportiere die Konfiguration
 */
export default {
  filters: KAMPAGNE_FILTERS,
  groups: KAMPAGNE_FILTER_GROUPS,
  presets: KAMPAGNE_FILTER_PRESETS,
  sortOptions: KAMPAGNE_SORT_OPTIONS,
  entityType: 'kampagne'
};