// AuftragFilterLogic.js (ES6-Modul)
// Auftrag-spezifische Filter-Verarbeitungslogik

import { BASE_VALIDATORS } from '../../../core/filters/BaseFilterConfig.js';

/**
 * Auftrag-spezifische Filter-Verarbeitung
 */
export class AuftragFilterLogic {
  
  /**
   * Verarbeite Auftrag-spezifische Filter
   */
  static processFilters(filters, rawData = null) {
    const processedFilters = {};

    for (const [key, value] of Object.entries(filters)) {
      // Für Boolean-Filter: false ist ein gültiger Wert, also nicht überspringen
      if (value === null || value === undefined || value === '') continue;

      switch (key) {
        case 'auftragsname':
          // Exakte Übereinstimmung für Auftragsnamen (aus Dropdown)
          processedFilters[key] = {
            type: 'equals',
            value: value
          };
          break;

        case 'unternehmen_id':
        case 'marke_id':
          // Exakte Übereinstimmung für UUIDs
          processedFilters[key] = {
            type: 'equals',
            value: value
          };
          break;

        case 'status':
          // Exakte Übereinstimmung für Select-Felder
          processedFilters[key] = {
            type: 'equals',
            value: value
          };
          break;

        case 'rechnung_gestellt':
        case 'ueberwiesen':
          // Boolean Filter
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
   * Validiere Auftrag-Filter
   */
  static validateFilters(filters) {
    const errors = [];

    // Auftragsname validieren
    if (filters.auftragsname && filters.auftragsname.length < 2) {
      errors.push({
        field: 'auftragsname',
        message: 'Auftragsname muss mindestens 2 Zeichen lang sein'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generiere SQL-Query für Auftrag-Filter (Supabase)
   */
  static buildSupabaseQuery(query, filters) {
    const processedFilters = this.processFilters(filters);

    for (const [field, filter] of Object.entries(processedFilters)) {
      switch (filter.type) {
        case 'text_search':
          // Text-Suche mit ilike (case-insensitive)
          query = query.ilike(field, `%${filter.value}%`);
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

    return data.filter(auftrag => {
      for (const [field, filter] of Object.entries(processedFilters)) {
        const value = auftrag[field];

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

export default AuftragFilterLogic;

