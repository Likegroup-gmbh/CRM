// CreatorFilterConfig.js (ES6-Modul)
// Creator-spezifische Filter-Konfiguration

import { 
  createFilterConfig, 
  COMMON_FILTER_OPTIONS,
  BASE_FORMATTERS 
} from '../../../core/filters/BaseFilterConfig.js';

/**
 * Creator-spezifische Filter-Konfiguration
 */
export const CREATOR_FILTERS = [
  // Name-Filter (sucht in vorname UND nachname)
  createFilterConfig('text', {
    id: 'name',
    label: 'Creator Name',
    placeholder: 'Nach Creator-Namen suchen...',
    searchFields: ['vorname', 'nachname'], // Creator-spezifisch
    priority: 1
  }),

  // Creator-Typ Filter (M:N)
  createFilterConfig('select', {
    id: 'creator_type_id',
    label: 'Creator Typ',
    table: 'creator_type',
    displayField: 'name',
    valueField: 'id',
    dynamic: true,
    placeholder: 'Creator Typ auswählen...',
    priority: 2
  }),

  // Sprache Filter (M:N)
  createFilterConfig('select', {
    id: 'sprache_id',
    label: 'Sprache',
    table: 'sprachen',
    displayField: 'name',
    valueField: 'id',
    dynamic: true,
    placeholder: 'Sprache auswählen...',
    priority: 3
  }),

  // Branche Filter (M:N)
  createFilterConfig('select', {
    id: 'branche_id',
    label: 'Branche',
    table: 'branchen_creator',
    displayField: 'name',
    valueField: 'id',
    dynamic: true,
    placeholder: 'Branche auswählen...',
    priority: 4
  }),

  // Instagram Follower Range
  createFilterConfig('numberRange', {
    id: 'instagram_follower',
    label: 'Instagram Follower',
    min: 0,
    max: 10000000,
    step: 1000,
    formatter: BASE_FORMATTERS.followerCount,
    priority: 5
  }),

  // TikTok Follower Range
  createFilterConfig('numberRange', {
    id: 'tiktok_follower',
    label: 'TikTok Follower',
    min: 0,
    max: 10000000,
    step: 1000,
    formatter: BASE_FORMATTERS.followerCount,
    priority: 6
  }),

  // Stadt Filter
  createFilterConfig('text', {
    id: 'lieferadresse_stadt',
    label: 'Stadt',
    placeholder: 'Nach Stadt suchen...',
    priority: 7
  }),

  // Land Filter
  createFilterConfig('select', {
    id: 'lieferadresse_land',
    label: 'Land',
    options: [
      { value: 'Deutschland', label: 'Deutschland' },
      { value: 'Österreich', label: 'Österreich' },
      { value: 'Schweiz', label: 'Schweiz' },
      { value: 'Frankreich', label: 'Frankreich' },
      { value: 'Italien', label: 'Italien' },
      { value: 'Spanien', label: 'Spanien' },
      { value: 'Niederlande', label: 'Niederlande' },
      { value: 'Belgien', label: 'Belgien' },
      { value: 'Luxemburg', label: 'Luxemburg' },
      { value: 'Dänemark', label: 'Dänemark' },
      { value: 'Schweden', label: 'Schweden' },
      { value: 'Norwegen', label: 'Norwegen' },
      { value: 'Finnland', label: 'Finnland' },
      { value: 'Polen', label: 'Polen' },
      { value: 'Tschechien', label: 'Tschechien' },
      { value: 'Ungarn', label: 'Ungarn' },
      { value: 'Slowakei', label: 'Slowakei' },
      { value: 'Slowenien', label: 'Slowenien' },
      { value: 'Kroatien', label: 'Kroatien' },
      { value: 'Bulgarien', label: 'Bulgarien' },
      { value: 'Rumänien', label: 'Rumänien' },
      { value: 'Griechenland', label: 'Griechenland' },
      { value: 'Portugal', label: 'Portugal' },
      { value: 'Irland', label: 'Irland' },
      { value: 'Großbritannien', label: 'Großbritannien' },
      { value: 'Vereinigte Staaten', label: 'Vereinigte Staaten' },
      { value: 'Kanada', label: 'Kanada' },
      { value: 'Australien', label: 'Australien' },
      { value: 'Neuseeland', label: 'Neuseeland' }
    ],
    placeholder: 'Land auswählen...',
    priority: 8
  }),

  // Email vorhanden Filter
  createFilterConfig('boolean', {
    id: 'has_email',
    label: 'Email vorhanden',
    virtual: true, // Wird in der Logik verarbeitet
    priority: 9
  }),

  // Telefon vorhanden Filter
  createFilterConfig('boolean', {
    id: 'has_phone',
    label: 'Telefon vorhanden',
    virtual: true, // Wird in der Logik verarbeitet
    priority: 10
  }),

  // Portfolio Link vorhanden Filter
  createFilterConfig('boolean', {
    id: 'has_portfolio',
    label: 'Portfolio vorhanden',
    virtual: true, // Wird in der Logik verarbeitet
    priority: 11
  }),

  // Erstellt am Datum Range
  createFilterConfig('dateRange', {
    id: 'created_at',
    label: 'Erstellt am',
    priority: 12
  }),

  // Zuletzt aktualisiert Datum Range
  createFilterConfig('dateRange', {
    id: 'updated_at',
    label: 'Zuletzt aktualisiert',
    priority: 13
  })
];

/**
 * Creator-spezifische Filter-Gruppen für bessere UX
 */
export const CREATOR_FILTER_GROUPS = [
  {
    id: 'basic',
    label: 'Grundlagen',
    filters: ['name', 'creator_type_id', 'sprache_id', 'branche_id'],
    expanded: true
  },
  {
    id: 'social',
    label: 'Social Media',
    filters: ['instagram_follower', 'tiktok_follower'],
    expanded: false
  },
  {
    id: 'location',
    label: 'Standort',
    filters: ['lieferadresse_stadt', 'lieferadresse_land'],
    expanded: false
  },
  {
    id: 'contact',
    label: 'Kontakt',
    filters: ['has_email', 'has_phone', 'has_portfolio'],
    expanded: false
  },
  {
    id: 'meta',
    label: 'Metadaten',
    filters: ['created_at', 'updated_at'],
    expanded: false
  }
];

/**
 * Creator-spezifische Filter-Presets
 */
export const CREATOR_FILTER_PRESETS = [
  {
    id: 'active_influencers',
    label: 'Aktive Influencer',
    description: 'Creator mit >10K Instagram Followern und Email',
    filters: {
      creator_type_id: 'influencer',
      instagram_follower: { min: 10000 },
      has_email: true
    }
  },
  {
    id: 'ugc_creators',
    label: 'UGC Creator',
    description: 'Creator spezialisiert auf User Generated Content',
    filters: {
      creator_type_id: 'ugc-creator'
    }
  },
  {
    id: 'german_creators',
    label: 'Deutsche Creator',
    description: 'Creator aus Deutschland mit deutscher Sprache',
    filters: {
      sprache_id: 'deutsch',
      lieferadresse_land: 'Deutschland'
    }
  },
  {
    id: 'new_creators',
    label: 'Neue Creator',
    description: 'In den letzten 30 Tagen hinzugefügte Creator',
    filters: {
      created_at: {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    }
  }
];

/**
 * Exportiere die Konfiguration
 */
export default {
  filters: CREATOR_FILTERS,
  groups: CREATOR_FILTER_GROUPS,
  presets: CREATOR_FILTER_PRESETS,
  entityType: 'creator'
};