// BaseFilterConfig.js (ES6-Modul)
// Basis-Filter-Typen und gemeinsame Konfiguration für alle Entitäten

/**
 * Basis Filter-Typen die von allen Entitäten verwendet werden können
 */
export const BASE_FILTER_TYPES = {
  // Text-basierte Filter
  text: {
    type: 'text',
    component: 'TextFilter',
    defaultProps: {
      placeholder: 'Suchen...',
      autoComplete: 'off'
    }
  },

  // Einfache Select-Filter
  select: {
    type: 'select',
    component: 'SelectFilter',
    options: [], // Standard: leere Optionen-Liste
    defaultProps: {
      placeholder: 'Auswählen...',
      clearable: true
    }
  },

  // Multi-Select Filter
  multiSelect: {
    type: 'multi-select',
    component: 'MultiSelectFilter',
    options: [], // Standard: leere Optionen-Liste
    defaultProps: {
      placeholder: 'Mehrere auswählen...',
      searchable: true,
      clearable: true
    }
  },

  // Datum-Filter
  date: {
    type: 'date',
    component: 'DateFilter',
    defaultProps: {
      format: 'YYYY-MM-DD'
    }
  },

  // Datums-Bereich Filter
  dateRange: {
    type: 'date-range',
    component: 'DateRangeFilter',
    defaultProps: {
      format: 'YYYY-MM-DD',
      separator: ' bis '
    }
  },

  // Nummer-Filter
  number: {
    type: 'number',
    component: 'NumberFilter',
    defaultProps: {
      min: 0,
      step: 1
    }
  },

  // Nummern-Bereich Filter
  numberRange: {
    type: 'numberRange',
    component: 'NumberRangeFilter',
    defaultProps: {
      min: 0,
      max: 1000000,
      step: 1,
      separator: ' bis '
    }
  },

  // Boolean/Checkbox Filter
  boolean: {
    type: 'boolean',
    component: 'BooleanFilter',
    defaultProps: {
      trueLabel: 'Ja',
      falseLabel: 'Nein'
    }
  },

  // Tag-Input Filter
  tags: {
    type: 'tags',
    component: 'TagsFilter',
    defaultProps: {
      placeholder: 'Tags eingeben...',
      separator: ','
    }
  }
};

/**
 * Gemeinsame Filter-Optionen für häufig verwendete Felder
 */
export const COMMON_FILTER_OPTIONS = {
  // Standard Status-Optionen
  status: [
    { value: 'aktiv', label: 'Aktiv' },
    { value: 'inaktiv', label: 'Inaktiv' },
    { value: 'pending', label: 'Ausstehend' },
    { value: 'abgeschlossen', label: 'Abgeschlossen' },
    { value: 'storniert', label: 'Storniert' }
  ],

  // Ja/Nein Optionen
  yesNo: [
    { value: true, label: 'Ja' },
    { value: false, label: 'Nein' }
  ],

  // Prioritäten
  priority: [
    { value: 'niedrig', label: 'Niedrig' },
    { value: 'mittel', label: 'Mittel' },
    { value: 'hoch', label: 'Hoch' },
    { value: 'kritisch', label: 'Kritisch' }
  ],

  // Kampagnen-Arten
  campaignTypes: [
    { value: 'UGC Kampagne', label: 'UGC Kampagne' },
    { value: 'Influencer Kampagne', label: 'Influencer Kampagne' },
    { value: 'Hybrid Kampagne', label: 'Hybrid Kampagne' },
    { value: 'Produktions Kampagne', label: 'Produktions Kampagne' }
  ]
};

/**
 * Basis-Validatoren für Filter-Werte
 */
export const BASE_VALIDATORS = {
  required: (value) => {
    return value !== null && value !== undefined && value !== '';
  },

  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return !value || emailRegex.test(value);
  },

  url: (value) => {
    try {
      return !value || Boolean(new URL(value));
    } catch {
      return false;
    }
  },

  phone: (value) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return !value || phoneRegex.test(value.replace(/\s+/g, ''));
  },

  positiveNumber: (value) => {
    return !value || (Number(value) >= 0);
  },

  dateRange: (value) => {
    if (!value || !value.from || !value.to) return true;
    return new Date(value.from) <= new Date(value.to);
  }
};

/**
 * Basis-Formatter für Filter-Werte
 */
export const BASE_FORMATTERS = {
  currency: (value) => {
    if (!value || isNaN(value)) return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  },

  followerCount: (value) => {
    if (!value || isNaN(value)) return '-';
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  },

  percentage: (value) => {
    if (!value || isNaN(value)) return '-';
    return `${value}%`;
  },

  date: (value) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('de-DE').format(new Date(value));
  },

  dateTime: (value) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }
};

/**
 * Hilfsfunktion zum Erstellen von Filter-Konfigurationen
 */
export function createFilterConfig(baseType, overrides = {}) {
  if (!BASE_FILTER_TYPES[baseType]) {
    throw new Error(`Unknown base filter type: ${baseType}`);
  }

  return {
    ...BASE_FILTER_TYPES[baseType],
    ...overrides,
    defaultProps: {
      ...BASE_FILTER_TYPES[baseType].defaultProps,
      ...overrides.defaultProps
    }
  };
}

/**
 * Hilfsfunktion zum Validieren einer Filter-Konfiguration
 */
export function validateFilterConfig(config) {
  const errors = [];

  if (!config.id) {
    errors.push('Filter ID ist erforderlich');
  }

  if (!config.label) {
    errors.push('Filter Label ist erforderlich');
  }

  if (!config.type) {
    errors.push('Filter Type ist erforderlich');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}