// SkriptFilterConfig.js
// Status-Filter für die Skripte-Item-Ebene (Ordner ersetzen Unternehmen/Marke).

import { createFilterConfig } from '../../../core/filters/BaseFilterConfig.js';
import { STATUS_LABELS } from '../SkripteUtils.js';

export const SKRIPT_FILTERS = [
  createFilterConfig('select', {
    id: 'status',
    label: 'Status',
    options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
    priority: 1
  })
];

export const SKRIPT_FILTER_GROUPS = [
  {
    id: 'basic',
    label: 'Grundlagen',
    filters: ['status'],
    expanded: true
  }
];

export default {
  filters: SKRIPT_FILTERS,
  groups: SKRIPT_FILTER_GROUPS,
  presets: [],
  entityType: 'skripte'
};
