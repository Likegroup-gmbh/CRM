// CreatorFilterLogic.js (ES6-Modul)
// Creator-spezifische Filter-Verarbeitungslogik

import { BASE_VALIDATORS } from '../../../core/filters/BaseFilterConfig.js';

/**
 * Creator-spezifische Filter-Verarbeitung
 */
export class CreatorFilterLogic {
  
  /**
   * Verarbeite Creator-spezifische Filter
   */
  static processFilters(filters, rawData = null) {
    const processedFilters = {};

    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue;

      switch (key) {
        case 'name':
          // Spezielle Behandlung für Name-Suche (vorname UND nachname)
          processedFilters[key] = {
            type: 'name_search',
            value: value,
            searchFields: ['vorname', 'nachname']
          };
          break;

        case 'instagram_follower':
        case 'tiktok_follower':
          // Follower-Range Filter
          if (typeof value === 'object') {
            processedFilters[key] = {
              type: 'number_range',
              min: value.min || 0,
              max: value.max || null
            };
          } else {
            processedFilters[key] = {
              type: 'number_min',
              value: parseInt(value)
            };
          }
          break;

        case 'has_email':
          // Virtual Filter: Email vorhanden
          processedFilters['mail'] = {
            type: 'not_null',
            value: value
          };
          break;

        case 'has_phone':
          // Virtual Filter: Telefon vorhanden
          processedFilters['telefonnummer'] = {
            type: 'not_null',
            value: value
          };
          break;

        case 'has_portfolio':
          // Virtual Filter: Portfolio vorhanden
          processedFilters['portfolio_link'] = {
            type: 'not_null',
            value: value
          };
          break;

        case 'created_at':
        case 'updated_at':
          // Datum-Range Filter
          if (typeof value === 'object') {
            processedFilters[key] = {
              type: 'date_range',
              from: value.from || null,
              to: value.to || null
            };
          }
          break;

        case 'lieferadresse_stadt':
          // Stadt-Filter mit Like-Suche
          processedFilters[key] = {
            type: 'text_search',
            value: value
          };
          break;

        default:
          // Standard-Filter (Select, etc.)
          processedFilters[key] = {
            type: 'equals',
            value: value
          };
          break;
      }
    }

    return processedFilters;
  }

  /**
   * Validiere Creator-spezifische Filter
   */
  static validateFilters(filters) {
    const errors = [];

    // Instagram Follower Validierung
    if (filters.instagram_follower) {
      const follower = filters.instagram_follower;
      if (typeof follower === 'object') {
        if (follower.min && follower.max && follower.min > follower.max) {
          errors.push('Instagram Follower: Minimum darf nicht größer als Maximum sein');
        }
        if (follower.min && follower.min < 0) {
          errors.push('Instagram Follower: Minimum darf nicht negativ sein');
        }
      }
    }

    // TikTok Follower Validierung
    if (filters.tiktok_follower) {
      const follower = filters.tiktok_follower;
      if (typeof follower === 'object') {
        if (follower.min && follower.max && follower.min > follower.max) {
          errors.push('TikTok Follower: Minimum darf nicht größer als Maximum sein');
        }
        if (follower.min && follower.min < 0) {
          errors.push('TikTok Follower: Minimum darf nicht negativ sein');
        }
      }
    }

    // Datum-Range Validierung
    if (filters.created_at && typeof filters.created_at === 'object') {
      if (!BASE_VALIDATORS.dateRange(filters.created_at)) {
        errors.push('Erstellungsdatum: Von-Datum darf nicht nach Bis-Datum liegen');
      }
    }

    if (filters.updated_at && typeof filters.updated_at === 'object') {
      if (!BASE_VALIDATORS.dateRange(filters.updated_at)) {
        errors.push('Aktualisierungsdatum: Von-Datum darf nicht nach Bis-Datum liegen');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generiere SQL-Query für Creator-Filter (Supabase)
   */
  static buildSupabaseQuery(query, filters) {
    const processedFilters = this.processFilters(filters);

    for (const [field, filter] of Object.entries(processedFilters)) {
      switch (filter.type) {
        case 'name_search':
          // Suche in vorname UND nachname
          query = query.or(`vorname.ilike.%${filter.value}%,nachname.ilike.%${filter.value}%`);
          break;

        case 'number_range':
          if (filter.min !== null) {
            query = query.gte(field, filter.min);
          }
          if (filter.max !== null) {
            query = query.lte(field, filter.max);
          }
          break;

        case 'number_min':
          query = query.gte(field, filter.value);
          break;

        case 'not_null':
          if (filter.value) {
            query = query.not(field, 'is', null);
          } else {
            query = query.is(field, null);
          }
          break;

        case 'date_range':
          if (filter.from) {
            query = query.gte(field, filter.from);
          }
          if (filter.to) {
            query = query.lte(field, filter.to);
          }
          break;

        case 'text_search':
          query = query.ilike(field, `%${filter.value}%`);
          break;

        case 'equals':
          query = query.eq(field, filter.value);
          break;
      }
    }

    return query;
  }

  /**
   * Filtere lokale Daten (für Mock/Offline-Modus)
   */
  static filterLocalData(data, filters) {
    const processedFilters = this.processFilters(filters);

    return data.filter(item => {
      for (const [field, filter] of Object.entries(processedFilters)) {
        if (!this.matchesFilter(item, field, filter)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Prüfe ob ein Item einem Filter entspricht
   */
  static matchesFilter(item, field, filter) {
    const value = item[field];

    switch (filter.type) {
      case 'name_search':
        const searchValue = filter.value.toLowerCase();
        const vorname = (item.vorname || '').toLowerCase();
        const nachname = (item.nachname || '').toLowerCase();
        return vorname.includes(searchValue) || nachname.includes(searchValue);

      case 'number_range':
        if (filter.min !== null && (value === null || value < filter.min)) return false;
        if (filter.max !== null && (value === null || value > filter.max)) return false;
        return true;

      case 'number_min':
        return value !== null && value >= filter.value;

      case 'not_null':
        return filter.value ? (value !== null && value !== '') : (value === null || value === '');

      case 'date_range':
        if (!value) return false;
        const itemDate = new Date(value);
        if (filter.from && itemDate < new Date(filter.from)) return false;
        if (filter.to && itemDate > new Date(filter.to)) return false;
        return true;

      case 'text_search':
        return value && value.toLowerCase().includes(filter.value.toLowerCase());

      case 'equals':
        return value === filter.value;

      default:
        return true;
    }
  }

  /**
   * Erstelle Filter-Zusammenfassung für UI
   */
  static createFilterSummary(filters) {
    const summary = [];
    const processedFilters = this.processFilters(filters);

    for (const [field, filter] of Object.entries(processedFilters)) {
      let label = '';
      
      switch (filter.type) {
        case 'name_search':
          label = `Name: "${filter.value}"`;
          break;
        case 'number_range':
          if (filter.min && filter.max) {
            label = `${field}: ${filter.min} - ${filter.max}`;
          } else if (filter.min) {
            label = `${field}: ab ${filter.min}`;
          } else if (filter.max) {
            label = `${field}: bis ${filter.max}`;
          }
          break;
        case 'equals':
          label = `${field}: ${filter.value}`;
          break;
      }

      if (label) {
        summary.push({
          field,
          label,
          removable: true
        });
      }
    }

    return summary;
  }
}

export default CreatorFilterLogic;