// VideoFilterLogic.js (ES6-Modul)
// Video-spezifische Filter-Verarbeitung

/**
 * Video-spezifische Filter-Verarbeitung
 */
export class VideoFilterLogic {
  
  /**
   * Verarbeite Video-spezifische Filter
   */
  static processFilters(filters) {
    const processedFilters = {};
    
    // Status Filter (produktion, abgeschlossen)
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
    
    // Freigabe Filter (boolean)
    if (filters.freigabe !== undefined && filters.freigabe !== null && filters.freigabe !== '') {
      processedFilters.freigabe = {
        type: 'equals',
        value: filters.freigabe === 'true' || filters.freigabe === true
      };
    }
    
    // Content Art Filter
    if (filters.content_art && Array.isArray(filters.content_art) && filters.content_art.length > 0) {
      processedFilters.content_art = {
        type: 'in',
        value: filters.content_art
      };
    } else if (filters.content_art && typeof filters.content_art === 'string') {
      processedFilters.content_art = {
        type: 'equals',
        value: filters.content_art
      };
    }
    
    // Posting Datum Range Filter
    if (filters.posting_datum) {
      const from = filters.posting_datum.from || filters.posting_datum.min || null;
      const to = filters.posting_datum.to || filters.posting_datum.max || null;
      
      if (from || to) {
        processedFilters.posting_datum = {
          type: 'date_range',
          from,
          to
        };
      }
    }
    
    // Erstellt Datum Range Filter
    if (filters.created_at) {
      const from = filters.created_at.from || filters.created_at.min || null;
      const to = filters.created_at.to || filters.created_at.max || null;
      
      if (from || to) {
        processedFilters.created_at = {
          type: 'date_range',
          from,
          to
        };
      }
    }
    
    // Kooperation ID Filter (für verknüpfte Filterung)
    if (filters.kooperation_id) {
      processedFilters.kooperation_id = {
        type: 'equals',
        value: filters.kooperation_id
      };
    }
    
    return processedFilters;
  }
  
  /**
   * Validiere Video-Filter
   */
  static validateFilters(filters) {
    const errors = [];
    
    // Status-Validierung
    if (filters.status) {
      const validStatuses = ['produktion', 'abgeschlossen'];
      const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
      
      for (const status of statusArray) {
        if (!validStatuses.includes(status)) {
          errors.push({ field: 'status', message: `Ungültiger Status: ${status}` });
        }
      }
    }
    
    // Content Art Validierung
    if (filters.content_art) {
      const validContentArts = ['Paid', 'Organisch', 'Influencer', 'Videograph', 'Whitelisting', 'Spark-Ad'];
      const contentArtArray = Array.isArray(filters.content_art) ? filters.content_art : [filters.content_art];
      
      for (const art of contentArtArray) {
        if (!validContentArts.includes(art)) {
          errors.push({ field: 'content_art', message: `Ungültige Content Art: ${art}` });
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Generiere SQL-Query für Video-Filter (Supabase)
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
        
        case 'date_range':
          if (filter.from) {
            query = query.gte(field, filter.from);
          }
          if (filter.to) {
            query = query.lte(field, filter.to);
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
    let filtered = [...data];
    
    for (const [field, filter] of Object.entries(processedFilters)) {
      switch (filter.type) {
        case 'equals':
          filtered = filtered.filter(item => item[field] === filter.value);
          break;
        
        case 'in':
          filtered = filtered.filter(item => filter.value.includes(item[field]));
          break;
        
        case 'date_range':
          filtered = filtered.filter(item => {
            const value = item[field];
            if (!value) return false;
            if (filter.from && value < filter.from) return false;
            if (filter.to && value > filter.to) return false;
            return true;
          });
          break;
      }
    }
    
    return filtered;
  }
}

export default VideoFilterLogic;
