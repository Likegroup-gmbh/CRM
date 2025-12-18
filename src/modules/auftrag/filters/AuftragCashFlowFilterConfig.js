// AuftragCashFlowFilterConfig.js (ES6-Modul)
// Cash Flow Kalender-spezifische Filter-Konfiguration

import { createFilterConfig } from '../../../core/filters/BaseFilterConfig.js';

/**
 * Cash Flow Kalender Filter-Konfiguration
 * Nur Unternehmen und Marke für übersichtliche Filterung
 */
export const AUFTRAG_CASHFLOW_FILTERS = [
  // Unternehmen Filter
  createFilterConfig('select', {
    id: 'unternehmen_id',
    label: 'Unternehmen',
    table: 'unternehmen',
    displayField: 'firmenname',
    valueField: 'id',
    dynamic: true,
    priority: 1
  }),

  // Marke Filter
  createFilterConfig('select', {
    id: 'marke_id',
    label: 'Marke',
    table: 'marke',
    displayField: 'markenname',
    valueField: 'id',
    dynamic: true,
    priority: 2
  })
];

export default {
  filters: AUFTRAG_CASHFLOW_FILTERS,
  entityType: 'auftrag_cashflow'
};



























