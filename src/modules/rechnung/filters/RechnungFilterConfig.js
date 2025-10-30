// RechnungFilterConfig.js (ES6-Modul)
import { createFilterConfig } from '../../../core/filters/BaseFilterConfig.js';

export const RECHNUNG_FILTERS = [
  createFilterConfig('text', {
    id: 'rechnung_nr',
    label: 'Rechnungs-Nr.',
    placeholder: 'z.B. RE-2025-001'
  }),
  createFilterConfig('select', {
    id: 'unternehmen_id',
    label: 'Unternehmen',
    table: 'unternehmen',
    displayField: 'firmenname',
    valueField: 'id',
    dynamic: true
  }),
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
      { value: 'Entwurf', label: 'Entwurf' },
      { value: 'Offen', label: 'Offen' },
      { value: 'Überfällig', label: 'Überfällig' },
      { value: 'Teilweise bezahlt', label: 'Teilweise bezahlt' },
      { value: 'Bezahlt', label: 'Bezahlt' },
      { value: 'Storniert', label: 'Storniert' }
    ]
  }),
  {
    id: 'nettobetrag',
    label: 'Betrag (Netto)',
    type: 'range',
    min: 0,
    max: 200000,
    step: 100
  }
];

export default {
  filters: RECHNUNG_FILTERS,
  entityType: 'rechnung'
};


