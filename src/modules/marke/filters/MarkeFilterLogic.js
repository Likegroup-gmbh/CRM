// MarkeFilterLogic.js (ES6-Modul)
// Marke-spezifische Filter-Verarbeitungslogik

import { BASE_VALIDATORS } from '../../../core/filters/BaseFilterConfig.js';

/**
 * Marke-spezifische Filter-Verarbeitung
 */
export class MarkeFilterLogic {
  
  /**
   * Verarbeite Marke-spezifische Filter
   */
  static processFilters(filters, rawData = null) {
    const processedFilters = {};

    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue;

      switch (key) {
        case 'markenname':
          // Exakte Übereinstimmung für Markennamen (aus Dropdown)
          processedFilters[key] = {
            type: 'equals',
            value: value
          };
          break;

        case 'unternehmen_id':
          // Exakte Übereinstimmung für Unternehmen
          processedFilters[key] = {
            type: 'equals',
            value: value
          };
          break;

        case 'branche_id':
          // Branche-Filter (Many-to-Many über Junction Table)
          processedFilters[key] = {
            type: 'branche_filter',
            value: value
          };
          break;

        default:
          // Unbekannte Filter als equals behandeln
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
   * Validiere Marke-Filter
   */
  static validateFilters(filters) {
    const errors = [];

    // Markenname validieren
    if (filters.markenname && filters.markenname.length < 2) {
      errors.push({
        field: 'markenname',
        message: 'Markenname muss mindestens 2 Zeichen lang sein'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generiere SQL-Query für Marke-Filter (Supabase)
   */
  static buildSupabaseQuery(query, filters) {
    const processedFilters = this.processFilters(filters);

    for (const [field, filter] of Object.entries(processedFilters)) {
      switch (filter.type) {
        case 'text_search':
          // Text-Suche mit ilike (case-insensitive)
          query = query.ilike(field, `%${filter.value}%`);
          break;

        case 'branche_filter':
          // Branche-Filter über Many-to-Many Junction Table
          // Wird in DataService speziell behandelt
          console.log('⚠️ Branche-Filter für Marken erfordert spezielle Behandlung:', filter.value);
          break;

        case 'equals':
          // Exakte Übereinstimmung
          query = query.eq(field, filter.value);
          break;

        case 'not_null':
          if (filter.value) {
            query = query.not(field, 'is', null);
          } else {
            query = query.is(field, null);
          }
          break;

        default:
          console.warn(`⚠️ Unbekannter Filter-Typ: ${filter.type} für ${field}`);
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

    return data.filter(marke => {
      for (const [field, filter] of Object.entries(processedFilters)) {
        const value = marke[field];

        switch (filter.type) {
          case 'text_search':
            if (!value || !String(value).toLowerCase().includes(String(filter.value).toLowerCase())) {
              return false;
            }
            break;

          case 'equals':
            if (value !== filter.value) {
              return false;
            }
            break;

          case 'branche_filter':
            // Prüfe ob Branche in branchen-Array ist
            if (Array.isArray(marke.branchen)) {
              const hasBranche = marke.branchen.some(b => 
                (typeof b === 'object' ? b.id : b) === filter.value
              );
              if (!hasBranche) {
                return false;
              }
            } else if (marke.branche_id !== filter.value) {
              return false;
            }
            break;

          case 'not_null':
            if (filter.value && !value) {
              return false;
            }
            if (!filter.value && value) {
              return false;
            }
            break;
        }
      }

      return true;
    });
  }
}

export default MarkeFilterLogic;

