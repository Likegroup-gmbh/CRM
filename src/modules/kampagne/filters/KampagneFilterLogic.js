// KampagneFilterLogic.js (ES6-Modul)
// Kampagne-spezifische Filter-Verarbeitungslogik

import { BASE_VALIDATORS } from '../../../core/filters/BaseFilterConfig.js';

/**
 * Kampagne-spezifische Filter-Verarbeitung
 */
export class KampagneFilterLogic {
  
  /**
   * Verarbeite Kampagne-spezifische Filter
   */
  static processFilters(filters, rawData = null) {
    const processedFilters = {};

    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue;

      switch (key) {
        case 'kampagnenname':
          // Text-Suche im Kampagnennamen (eigener_name UND kampagnenname)
          processedFilters[key] = {
            type: 'text_search_dual',
            value: value,
            fields: ['kampagnenname', 'eigener_name']
          };
          break;

        case 'art_der_kampagne':
          // Multi-Select für Kampagnen-Arten
          if (Array.isArray(value)) {
            processedFilters[key] = {
              type: 'array_contains',
              value: value
            };
          } else {
            processedFilters[key] = {
              type: 'equals',
              value: value
            };
          }
          break;

        case 'budget':
          // Budget-Range Filter
          if (typeof value === 'object') {
            processedFilters[key] = {
              type: 'number_range',
              min: value.min || 0,
              max: value.max || null
            };
          } else {
            processedFilters[key] = {
              type: 'number_min',
              value: parseFloat(value)
            };
          }
          break;

        case 'start':
        case 'deadline_post_produktion':
          // Datum-Range Filter
          if (typeof value === 'object') {
            processedFilters[key] = {
              type: 'date_range',
              from: value.from || null,
              to: value.to || null
            };
          }
          break;

        case 'creator_count':
          // Virtual Filter: Anzahl Creator pro Kampagne
          processedFilters[key] = {
            type: 'virtual_creator_count',
            min: typeof value === 'object' ? value.min : value,
            max: typeof value === 'object' ? value.max : null
          };
          break;

        case 'duration_days':
          // Virtual Filter: Kampagnen-Dauer in Tagen
          processedFilters[key] = {
            type: 'virtual_duration',
            min: typeof value === 'object' ? value.min : value,
            max: typeof value === 'object' ? value.max : null
          };
          break;

        case 'has_briefing':
          // Virtual Filter: Briefing vorhanden
          processedFilters['briefing'] = {
            type: 'not_null',
            value: value
          };
          break;

        case 'is_completed':
          // Virtual Filter: Kampagne abgeschlossen
          processedFilters[key] = {
            type: 'virtual_completed',
            value: value
          };
          break;

        case 'is_overdue':
          // Virtual Filter: Kampagne überfällig
          processedFilters[key] = {
            type: 'virtual_overdue',
            value: value
          };
          break;

        case 'created_at':
          // Erstellungsdatum Range
          if (typeof value === 'object') {
            processedFilters[key] = {
              type: 'date_range',
              from: value.from || null,
              to: value.to || null
            };
          }
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
   * Validiere Kampagne-spezifische Filter
   */
  static validateFilters(filters) {
    const errors = [];

    // Budget Validierung
    if (filters.budget) {
      const budget = filters.budget;
      if (typeof budget === 'object') {
        if (budget.min && budget.max && budget.min > budget.max) {
          errors.push('Budget: Minimum darf nicht größer als Maximum sein');
        }
        if (budget.min && budget.min < 0) {
          errors.push('Budget: Minimum darf nicht negativ sein');
        }
      }
    }

    // Creator-Anzahl Validierung
    if (filters.creator_count) {
      const count = filters.creator_count;
      if (typeof count === 'object') {
        if (count.min && count.max && count.min > count.max) {
          errors.push('Creator-Anzahl: Minimum darf nicht größer als Maximum sein');
        }
        if (count.min && count.min < 0) {
          errors.push('Creator-Anzahl: Minimum darf nicht negativ sein');
        }
      }
    }

    // Dauer Validierung
    if (filters.duration_days) {
      const duration = filters.duration_days;
      if (typeof duration === 'object') {
        if (duration.min && duration.max && duration.min > duration.max) {
          errors.push('Dauer: Minimum darf nicht größer als Maximum sein');
        }
        if (duration.min && duration.min < 1) {
          errors.push('Dauer: Minimum muss mindestens 1 Tag sein');
        }
      }
    }

    // Datum-Range Validierung
    if (filters.start && typeof filters.start === 'object') {
      if (!BASE_VALIDATORS.dateRange(filters.start)) {
        errors.push('Startdatum: Von-Datum darf nicht nach Bis-Datum liegen');
      }
    }

    if (filters.deadline_post_produktion && typeof filters.deadline_post_produktion === 'object') {
      if (!BASE_VALIDATORS.dateRange(filters.deadline_post_produktion)) {
        errors.push('Deadline Post Produktion: Von-Datum darf nicht nach Bis-Datum liegen');
      }
    }

    // Logik-Validierung: Start vor Deadline Post Produktion
    if (filters.start && filters.deadline_post_produktion) {
      const startDate = typeof filters.start === 'object' ? filters.start.from : filters.start;
      const deadlineDate = typeof filters.deadline_post_produktion === 'object' ? filters.deadline_post_produktion.to : filters.deadline_post_produktion;
      
      if (startDate && deadlineDate && new Date(startDate) > new Date(deadlineDate)) {
        errors.push('Startdatum darf nicht nach der Deadline Post Produktion liegen');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generiere SQL-Query für Kampagne-Filter (Supabase)
   */
  static buildSupabaseQuery(query, filters) {
    const processedFilters = this.processFilters(filters);

    for (const [field, filter] of Object.entries(processedFilters)) {
      switch (filter.type) {
        case 'text_search':
          query = query.ilike(field, `%${filter.value}%`);
          break;

        case 'text_search_dual':
          // Suche in mehreren Feldern (OR-Verknüpfung)
          const orConditions = filter.fields.map(f => `${f}.ilike.%${filter.value}%`).join(',');
          query = query.or(orConditions);
          break;

        case 'array_contains':
          // Für Kampagnen-Art (kann mehrere Werte haben)
          if (Array.isArray(filter.value) && filter.value.length > 0) {
            query = query.overlaps(field, filter.value);
          }
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

        case 'date_range':
          if (filter.from) {
            query = query.gte(field, filter.from);
          }
          if (filter.to) {
            query = query.lte(field, filter.to);
          }
          break;

        case 'not_null':
          if (filter.value) {
            query = query.not(field, 'is', null);
          } else {
            query = query.is(field, null);
          }
          break;

        case 'virtual_overdue':
          if (filter.value) {
            // Kampagnen mit Deadline Post Produktion in der Vergangenheit
            query = query.lt('deadline_post_produktion', new Date().toISOString().split('T')[0]);
          }
          break;

        case 'equals':
          query = query.eq(field, filter.value);
          break;

        // Virtual Filter werden in Post-Processing behandelt
        case 'virtual_creator_count':
        case 'virtual_duration':
        case 'virtual_completed':
          // Diese werden nach dem Query-Ausführung gefiltert
          break;
      }
    }

    return query;
  }

  /**
   * Post-Processing für Virtual Filter
   */
  static applyVirtualFilters(kampagnen, filters) {
    const processedFilters = this.processFilters(filters);
    
    return kampagnen.filter(kampagne => {
      for (const [field, filter] of Object.entries(processedFilters)) {
        if (!this.matchesVirtualFilter(kampagne, field, filter)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Prüfe Virtual Filter
   */
  static matchesVirtualFilter(kampagne, field, filter) {
    switch (filter.type) {
      case 'virtual_creator_count':
        const creatorCount = kampagne.kooperationen?.length || 0;
        if (filter.min !== null && creatorCount < filter.min) return false;
        if (filter.max !== null && creatorCount > filter.max) return false;
        return true;

      case 'virtual_duration':
        if (!kampagne.start || !kampagne.deadline_post_produktion) return false;
        const start = new Date(kampagne.start);
        const end = new Date(kampagne.deadline_post_produktion);
        const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (filter.min !== null && durationDays < filter.min) return false;
        if (filter.max !== null && durationDays > filter.max) return false;
        return true;

      case 'virtual_completed':
        const isCompleted = this.isKampagneCompleted(kampagne);
        return filter.value ? isCompleted : !isCompleted;

      case 'virtual_overdue':
        const isOverdue = this.isKampagneOverdue(kampagne);
        return filter.value ? isOverdue : !isOverdue;

      default:
        return true;
    }
  }

  /**
   * Prüfe ob Kampagne abgeschlossen ist
   */
  static isKampagneCompleted(kampagne) {
    // Kampagne ist abgeschlossen wenn:
    // 1. Status ist "abgeschlossen" ODER
    // 2. Deadline Post Produktion ist in der Vergangenheit UND alle Kooperationen sind abgeschlossen
    
    if (kampagne.status?.name === 'Abgeschlossen') {
      return true;
    }

    if (!kampagne.deadline_post_produktion) return false;
    
    const now = new Date();
    const deadline = new Date(kampagne.deadline_post_produktion);
    
    if (deadline > now) return false;

    return true;
  }

  /**
   * Prüfe ob Kampagne überfällig ist
   */
  static isKampagneOverdue(kampagne) {
    if (!kampagne.deadline_post_produktion) return false;
    
    const now = new Date();
    const deadline = new Date(kampagne.deadline_post_produktion);
    
    // Überfällig wenn Deadline Post Produktion in der Vergangenheit und nicht abgeschlossen
    return deadline < now && !this.isKampagneCompleted(kampagne);
  }

  /**
   * Filtere lokale Daten (für Mock/Offline-Modus)
   */
  static filterLocalData(data, filters) {
    let filteredData = data;
    const processedFilters = this.processFilters(filters);

    // Erst normale Filter anwenden
    filteredData = filteredData.filter(item => {
      for (const [field, filter] of Object.entries(processedFilters)) {
        if (filter.type.startsWith('virtual_')) continue; // Virtual Filter später
        if (!this.matchesFilter(item, field, filter)) {
          return false;
        }
      }
      return true;
    });

    // Dann Virtual Filter anwenden
    filteredData = this.applyVirtualFilters(filteredData, filters);

    return filteredData;
  }

  /**
   * Prüfe ob ein Item einem Filter entspricht
   */
  static matchesFilter(item, field, filter) {
    const value = item[field];

    switch (filter.type) {
      case 'text_search':
        return value && value.toLowerCase().includes(filter.value.toLowerCase());

      case 'text_search_dual':
        // Suche in mehreren Feldern
        const searchValue = filter.value.toLowerCase();
        return filter.fields.some(f => {
          const fieldValue = item[f];
          return fieldValue && fieldValue.toLowerCase().includes(searchValue);
        });

      case 'array_contains':
        if (!value) return false;
        if (Array.isArray(value)) {
          return filter.value.some(filterVal => value.includes(filterVal));
        }
        return filter.value.includes(value);

      case 'number_range':
        if (filter.min !== null && (value === null || value < filter.min)) return false;
        if (filter.max !== null && (value === null || value > filter.max)) return false;
        return true;

      case 'number_min':
        return value !== null && value >= filter.value;

      case 'date_range':
        if (!value) return false;
        const itemDate = new Date(value);
        if (filter.from && itemDate < new Date(filter.from)) return false;
        if (filter.to && itemDate > new Date(filter.to)) return false;
        return true;

      case 'not_null':
        return filter.value ? (value !== null && value !== '') : (value === null || value === '');

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
        case 'text_search':
          label = `${field}: "${filter.value}"`;
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
        case 'array_contains':
          label = `${field}: ${filter.value.join(', ')}`;
          break;
        case 'equals':
          label = `${field}: ${filter.value}`;
          break;
        case 'virtual_overdue':
          if (filter.value) label = 'Überfällige Kampagnen';
          break;
        case 'virtual_completed':
          if (filter.value) label = 'Abgeschlossene Kampagnen';
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

export default KampagneFilterLogic;