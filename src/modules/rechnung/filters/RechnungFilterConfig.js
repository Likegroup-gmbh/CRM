// RechnungFilterConfig.js (ES6-Modul)
import { createFilterConfig } from '../../../core/filters/BaseFilterConfig.js';

export const RECHNUNG_FILTERS = [
  createFilterConfig('select', {
    id: 'rechnungstyp',
    label: 'Rechnungstyp',
    options: [
      { value: 'kampagne', label: 'Kampagne' },
      { value: 'contracting', label: 'Contracting' }
    ]
  }),
  createFilterConfig('text', {
    id: 'rechnung_nr',
    label: 'Rechnungs-Nr.',
    placeholder: 'z.B. RE-2025-001'
  }),
  {
    id: 'gestellt_am',
    label: 'Zeitraum (Rechnungsdatum)',
    type: 'dateRange',
    field: 'gestellt_am'
  },
  createFilterConfig('select', {
    id: 'auftrag_id',
    label: 'Auftrag',
    table: 'auftrag',
    displayField: 'auftragsname',
    valueField: 'id',
    dynamic: true
  }),
  createFilterConfig('select', {
    id: 'status',
    label: 'Status',
    options: [
      { value: 'Offen', label: 'Offen' },
      { value: 'Rückfrage', label: 'Rückfrage' },
      { value: 'Bezahlt', label: 'Bezahlt' },
      { value: 'An Qonto gesendet', label: 'An Qonto gesendet' },
      { value: 'Marc an Qonto gesendet', label: 'Marc an Qonto gesendet' }
    ]
  }),
  createFilterConfig('text', {
    id: 'land',
    label: 'Land',
    placeholder: 'z.B. Deutschland'
  })
];

export default {
  filters: RECHNUNG_FILTERS,
  entityType: 'rechnung'
};


