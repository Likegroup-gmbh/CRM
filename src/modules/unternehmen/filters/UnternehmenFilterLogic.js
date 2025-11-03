// UnternehmenFilterLogic.js (ES6-Modul)
// Unternehmen-spezifische Filter-Verarbeitungslogik

import { BASE_VALIDATORS } from '../../../core/filters/BaseFilterConfig.js';

/**
 * Unternehmen-spezifische Filter-Verarbeitung
 */
export class UnternehmenFilterLogic {
  
  /**
   * Verarbeite Unternehmen-spezifische Filter
   */
  static processFilters(filters, rawData = null) {
    const processedFilters = {};

    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue;

      switch (key) {
        case 'firmenname':
          // Exakte Übereinstimmung für Firmenname (aus Dropdown)
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

        case 'status':
          // Exakte Übereinstimmung für Status
          processedFilters[key] = {
            type: 'equals',
            value: value
          };
          break;

        case 'rechnungsadresse_stadt':
        case 'rechnungsadresse_land':
          // Text-Suche in Adressfeldern
          processedFilters[key] = {
            type: 'text_search',
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
   * Validiere Unternehmen-Filter
   */
  static validateFilters(filters) {
    const errors = [];

    // Firmenname validieren (wird aus Dropdown ausgewählt, keine Längen-Validierung nötig)
    
    // Status validieren
    if (filters.status) {
      const validStatuses = ['Aktiv', 'Inaktiv', 'Potentiell'];
      if (!validStatuses.includes(filters.status)) {
        errors.push({
          field: 'status',
          message: 'Ungültiger Status'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generiere SQL-Query für Unternehmen-Filter (Supabase)
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
          // Wir müssen Unternehmen finden, die diese Branche haben
          // Ansatz: Nutze inner join über unternehmen_branchen
          // Da Supabase das nicht direkt unterstützt, nutzen wir einen Workaround:
          // Wir laden erst die unternehmen_ids aus der Junction Table
          // ODER: Nutzen das branchen-Array falls vorhanden (PostGIS array)
          
          // WICHTIG: Dieser Filter erfordert eine spezielle Behandlung!
          // Wir markieren ihn zur späteren Verarbeitung
          console.log('⚠️ Branche-Filter erfordert spezielle Behandlung:', filter.value);
          // Wird in DataService speziell behandelt oder als Post-Filter angewendet
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
   * Spezial-Handling für Branche-Filter
   * Da Branchen über eine Junction Table verknüpft sind, müssen wir
   * eine separate Query machen und die Unternehmen-IDs filtern
   */
  static async applyBrancheFilter(brancheId) {
    if (!window.supabase || !brancheId) {
      return null;
    }

    try {
      // Lade alle Unternehmen-IDs, die diese Branche haben
      const { data, error } = await window.supabase
        .from('unternehmen_branchen')
        .select('unternehmen_id')
        .eq('branche_id', brancheId);

      if (error) {
        console.error('❌ Fehler beim Laden der Unternehmen für Branche:', error);
        return null;
      }

      // Extrahiere IDs
      const unternehmenIds = data.map(row => row.unternehmen_id);
      return unternehmenIds;

    } catch (error) {
      console.error('❌ Fehler beim Branche-Filter:', error);
      return null;
    }
  }

  /**
   * Filtere lokale Daten (für Mock/Offline-Modus)
   */
  static filterLocalData(data, filters) {
    const processedFilters = this.processFilters(filters);

    return data.filter(unternehmen => {
      for (const [field, filter] of Object.entries(processedFilters)) {
        const value = unternehmen[field];

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
            if (Array.isArray(unternehmen.branchen)) {
              const hasBranche = unternehmen.branchen.some(b => 
                (typeof b === 'object' ? b.id : b) === filter.value
              );
              if (!hasBranche) {
                return false;
              }
            } else if (unternehmen.branche_id !== filter.value) {
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

export default UnternehmenFilterLogic;

