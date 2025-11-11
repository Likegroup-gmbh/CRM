// KooperationFilterLogic.js (ES6-Modul)
// Kooperation-spezifische Filter-Verarbeitung

/**
 * Kooperation-spezifische Filter-Verarbeitung
 */
export class KooperationFilterLogic {
  
  /**
   * Verarbeite Kooperation-spezifische Filter
   */
  static processFilters(filters, rawData = null) {
    const processedFilters = {};
    
    // Creator Filter
    if (filters.creator_id) {
      processedFilters.creator_id = {
        type: 'equals',
        value: filters.creator_id
      };
    }
    
    // Kampagne Filter
    if (filters.kampagne_id) {
      processedFilters.kampagne_id = {
        type: 'equals',
        value: filters.kampagne_id
      };
    }
    
    // Status Filter
    if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
      processedFilters.status = {
        type: 'in',
        value: filters.status
      };
    } else if (filters.status && typeof filters.status === 'string') {
      processedFilters.status = {
        type: 'equals',
        value: filters.status
      };
    }
    
    // Budget Range Filter
    if (filters.budget) {
      const min = filters.budget.min ?? null;
      const max = filters.budget.max ?? null;
      
      if (min !== null || max !== null) {
        processedFilters.nettobetrag = {
          type: 'number_range',
          min,
          max
        };
      }
    }
    
    // Start-Datum Range Filter
    if (filters.start_datum) {
      const from = filters.start_datum.from || filters.start_datum.min || null;
      const to = filters.start_datum.to || filters.start_datum.max || null;
      
      if (from || to) {
        processedFilters.start_datum = {
          type: 'date_range',
          from,
          to
        };
      }
    }
    
    // End-Datum Range Filter
    if (filters.end_datum) {
      const from = filters.end_datum.from || filters.end_datum.min || null;
      const to = filters.end_datum.to || filters.end_datum.max || null;
      
      if (from || to) {
        processedFilters.end_datum = {
          type: 'date_range',
          from,
          to
        };
      }
    }
    
    // Virtual: has_deliverables (wird in Post-Processing behandelt)
    if (filters.has_deliverables !== undefined) {
      processedFilters.has_deliverables = {
        type: 'virtual_deliverables',
        value: filters.has_deliverables
      };
    }
    
    // Virtual: is_paid (wird in Post-Processing behandelt)
    if (filters.is_paid !== undefined) {
      processedFilters.is_paid = {
        type: 'virtual_paid',
        value: filters.is_paid
      };
    }
    
    return processedFilters;
  }
  
  /**
   * Validiere Kooperation-Filter
   */
  static validateFilters(filters) {
    const errors = [];
    
    // Budget-Validierung
    if (filters.budget) {
      if (filters.budget.min !== undefined && filters.budget.min < 0) {
        errors.push({ field: 'budget', message: 'Budget Minimum darf nicht negativ sein' });
      }
      if (filters.budget.max !== undefined && filters.budget.max < 0) {
        errors.push({ field: 'budget', message: 'Budget Maximum darf nicht negativ sein' });
      }
      if (filters.budget.min !== undefined && filters.budget.max !== undefined && filters.budget.min > filters.budget.max) {
        errors.push({ field: 'budget', message: 'Budget Minimum darf nicht größer als Maximum sein' });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Generiere SQL-Query für Kooperation-Filter (Supabase)
   * WICHTIG: Diese Methode MUSS das Query-Objekt zurückgeben, NICHT das ausgeführte Ergebnis!
   */
  static buildSupabaseQuery(query, filters) {
    const processedFilters = this.processFilters(filters);
    
    for (const [field, filter] of Object.entries(processedFilters)) {
      switch (filter.type) {
        case 'equals':
          query = query.eq(field, filter.value);
          break;
        
        case 'in':
          if (Array.isArray(filter.value) && filter.value.length > 0) {
            query = query.in(field, filter.value);
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
        
        case 'date_range':
          if (filter.from) {
            query = query.gte(field, filter.from);
          }
          if (filter.to) {
            query = query.lte(field, filter.to);
          }
          break;
        
        // Virtual Filter werden in Post-Processing behandelt
        case 'virtual_deliverables':
        case 'virtual_paid':
          // Diese werden nach dem Query-Ausführung gefiltert
          break;
        
        default:
          console.warn(`⚠️ Unbekannter Filter-Typ: ${filter.type} für ${field}`);
          break;
      }
    }
    
    return query;
  }
  
  /**
   * Post-Processing für Virtual Filter
   * Diese Filter können nicht direkt in SQL ausgedrückt werden
   */
  static applyVirtualFilters(kooperationen, filters) {
    const processedFilters = this.processFilters(filters);
    let filtered = [...kooperationen];
    
    // has_deliverables Filter
    if (processedFilters.has_deliverables) {
      filtered = filtered.filter(k => {
        const hasDeliverables = k.videoanzahl > 0;
        return processedFilters.has_deliverables.value ? hasDeliverables : !hasDeliverables;
      });
    }
    
    // is_paid Filter
    if (processedFilters.is_paid) {
      filtered = filtered.filter(k => {
        const isPaid = k.bezahlt === true || k.status === 'Abgeschlossen';
        return processedFilters.is_paid.value ? isPaid : !isPaid;
      });
    }
    
    return filtered;
  }
  
  /**
   * Filtere lokale Daten (für Mock/Offline-Modus)
   */
  static filterLocalData(data, filters) {
    const processedFilters = this.processFilters(filters);
    let filtered = [...data];
    
    for (const [field, filter] of Object.entries(processedFilters)) {
      switch (filter.type) {
        case 'equals':
          filtered = filtered.filter(item => item[field] === filter.value);
          break;
        
        case 'in':
          filtered = filtered.filter(item => filter.value.includes(item[field]));
          break;
        
        case 'number_range':
          filtered = filtered.filter(item => {
            const value = item[field];
            if (filter.min !== null && value < filter.min) return false;
            if (filter.max !== null && value > filter.max) return false;
            return true;
          });
          break;
        
        case 'date_range':
          filtered = filtered.filter(item => {
            const value = item[field];
            if (filter.from && value < filter.from) return false;
            if (filter.to && value > filter.to) return false;
            return true;
          });
          break;
      }
    }
    
    // Apply virtual filters
    filtered = this.applyVirtualFilters(filtered, filters);
    
    return filtered;
  }
}

export default KooperationFilterLogic;

