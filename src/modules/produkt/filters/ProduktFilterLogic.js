// ProduktFilterLogic.js (ES6-Modul)
// Produkt-spezifische Filter-Verarbeitungslogik

import { BASE_VALIDATORS } from '../../../core/filters/BaseFilterConfig.js';

/**
 * Produkt-spezifische Filter-Verarbeitung
 */
export class ProduktFilterLogic {
  
  /**
   * Verarbeite Produkt-spezifische Filter
   */
  static processFilters(filters, rawData = null) {
    const processedFilters = {};

    for (const [key, value] of Object.entries(filters)) {
      if (key.startsWith('_')) continue;
      if (!value) continue;

      switch (key) {
        case 'name':
          processedFilters[key] = {
            type: 'multi_text_search',
            value: value,
            fields: ['name', 'url', 'kernbotschaft']
          };
          break;

        case 'marke_id':
          // Exakte Übereinstimmung für Marke
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
   * Validiere Produkt-Filter
   */
  static validateFilters(filters) {
    const errors = [];

    // Produktname validieren
    if (filters.name && filters.name.length < 2) {
      errors.push({
        field: 'name',
        message: 'Produktname muss mindestens 2 Zeichen lang sein'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generiere SQL-Query für Produkt-Filter (Supabase)
   */
  static buildSupabaseQuery(query, filters) {
    const processedFilters = this.processFilters(filters);

    for (const [field, filter] of Object.entries(processedFilters)) {
      switch (filter.type) {
        case 'text_search':
          query = query.ilike(field, `%${filter.value}%`);
          break;

        case 'multi_text_search':
          query = query.or(filter.fields.map(f => `${f}.ilike.%${filter.value}%`).join(','));
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

    return data.filter(produkt => {
      for (const [field, filter] of Object.entries(processedFilters)) {
        const value = produkt[field];

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

export default ProduktFilterLogic;
