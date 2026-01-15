// VertragFilterConfig.js (ES6-Modul)
import { createFilterConfig } from '../../../core/filters/BaseFilterConfig.js';

export const VERTRAG_FILTERS = [
  createFilterConfig('select', {
    id: 'typ',
    label: 'Vertragstyp',
    options: [
      { value: 'UGC', label: 'UGC-Produktionsvertrag' },
      { value: 'Influencer Kooperation', label: 'Influencer Kooperation' },
      { value: 'Videograph', label: 'Videograf/Fotograf' }
    ]
  }),
  createFilterConfig('select', {
    id: 'kunde_unternehmen_id',
    label: 'Unternehmen',
    table: 'unternehmen',
    displayField: 'firmenname',
    valueField: 'id',
    dynamic: true
  }),
  createFilterConfig('select', {
    id: 'kampagne_id',
    label: 'Kampagne',
    table: 'kampagne',
    displayField: 'kampagnenname',
    valueField: 'id',
    dynamic: true
  }),
  createFilterConfig('select', {
    id: 'creator_id',
    label: 'Creator',
    table: 'creator',
    displayField: 'vorname',
    valueField: 'id',
    dynamic: true
  })
];

export default {
  filters: VERTRAG_FILTERS,
  entityType: 'vertrag'
};
