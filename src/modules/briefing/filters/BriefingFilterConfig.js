// BriefingFilterConfig.js (ES6-Modul)
// Filter-Konfiguration fuer Campaign Briefings (campaign_briefings)

import {
  createFilterConfig,
  BASE_FORMATTERS
} from '../../../core/filters/BaseFilterConfig.js';

export const BRIEFING_FILTERS = [
  createFilterConfig('text', {
    id: 'aktivierung_name',
    label: 'Aktivierung',
    placeholder: 'Nach Aktivierung suchen...',
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
    id: 'bereich',
    label: 'Bereich',
    options: [
      { value: 'influencer_marketing', label: 'Influencer Marketing' },
      { value: 'paid_creator_ads', label: 'Paid Creator Ads' },
      { value: 'owned_social', label: 'Owned Social' }
    ],
    priority: 4
  }),

  createFilterConfig('select', {
    id: 'is_draft',
    label: 'Status',
    options: [
      { value: 'true', label: 'Entwurf' },
      { value: 'false', label: 'Final' }
    ],
    priority: 5
  }),

  createFilterConfig('select', {
    id: 'assignee_id',
    label: 'Zugewiesen an',
    table: 'benutzer',
    displayField: 'name',
    valueField: 'id',
    dynamic: true,
    priority: 6
  }),

  createFilterConfig('dateRange', {
    id: 'content_deadline',
    label: 'Content Deadline',
    priority: 7
  })
];

export const BRIEFING_FILTER_GROUPS = [
  {
    id: 'basic',
    label: 'Grundlagen',
    filters: ['aktivierung_name', 'unternehmen_id', 'marke_id', 'bereich', 'is_draft'],
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
    filters: ['content_deadline'],
    expanded: false
  }
];

export const BRIEFING_FILTER_PRESETS = [];

export const BRIEFING_SORT_OPTIONS = [
  { value: 'content_deadline', label: 'Deadline (nah zuerst)', direction: 'asc' },
  { value: 'content_deadline', label: 'Deadline (fern zuerst)', direction: 'desc' },
  { value: 'created_at', label: 'Erstellt (neu zuerst)', direction: 'desc' }
];

export default {
  filters: BRIEFING_FILTERS,
  groups: BRIEFING_FILTER_GROUPS,
  presets: BRIEFING_FILTER_PRESETS,
  sortOptions: BRIEFING_SORT_OPTIONS,
  entityType: 'briefing'
};
