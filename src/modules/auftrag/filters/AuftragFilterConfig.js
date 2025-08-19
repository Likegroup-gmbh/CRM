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
  // Auftragsname Filter
  createFilterConfig('text', {
    id: 'auftragsname',
    label: 'Auftragsname',
    placeholder: 'Nach Auftragsname suchen...',
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

  // Auftragstyp Filter
  createFilterConfig('text', {
    id: 'auftragtype',
    label: 'Auftragstyp',
    placeholder: 'Nach Auftragstyp suchen...',
    priority: 5
  }),

  // Art der Kampagne Filter
  createFilterConfig('multiSelect', {
    id: 'art_der_kampagne',
    label: 'Art der Kampagne',
    options: COMMON_FILTER_OPTIONS.campaignTypes,
    priority: 6
  }),

  // Gesamtbudget Filter
  createFilterConfig('numberRange', {
    id: 'gesamt_budget',
    label: 'Gesamtbudget',
    min: 0,
    max: 1000000,
    step: 1000,
    formatter: BASE_FORMATTERS.currency,
    priority: 7
  }),

  // Creator Budget Filter
  createFilterConfig('numberRange', {
    id: 'creator_budget',
    label: 'Creator Budget',
    min: 0,
    max: 500000,
    step: 500,
    formatter: BASE_FORMATTERS.currency,
    priority: 8
  }),

  // Start-Datum Filter
  createFilterConfig('dateRange', {
    id: 'start',
    label: 'Startdatum',
    priority: 9
  }),

  // End-Datum Filter
  createFilterConfig('dateRange', {
    id: 'ende',
    label: 'Enddatum',
    priority: 10
  }),

  // Rechnung gestellt
  createFilterConfig('boolean', {
    id: 'rechnung_gestellt',
    label: 'Rechnung gestellt',
    priority: 11
  }),

  // Überwiesen
  createFilterConfig('boolean', {
    id: 'ueberwiesen',
    label: 'Überwiesen',
    priority: 12
  }),

  // Erstellt am
  createFilterConfig('dateRange', {
    id: 'created_at',
    label: 'Erstellt am',
    priority: 13
  })
];

export default {
  filters: AUFTRAG_FILTERS,
  entityType: 'auftrag'
};