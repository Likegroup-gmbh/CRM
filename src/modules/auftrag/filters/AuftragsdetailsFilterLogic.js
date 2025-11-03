// AuftragsdetailsFilterLogic.js (ES6-Modul)
// Auftragsdetails-spezifische Filter-Verarbeitungslogik

/**
 * Auftragsdetails-spezifische Filter-Verarbeitung
 */
export class AuftragsdetailsFilterLogic {
  
  /**
   * Verarbeite Auftragsdetails-spezifische Filter
   */
  static processFilters(filters, rawData = null) {
    const processedFilters = {};

    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue;

      switch (key) {
        case 'auftragsname':
          // Auftragsname muss über die auftrag-Relation gefiltert werden
          processedFilters[key] = {
            type: 'auftrag_relation',
            value: value
          };
          break;

        case 'auftrag_id':
          // Direkte Filterung nach Auftrag-ID
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
   * Validiere Auftragsdetails-Filter
   */
  static validateFilters(filters) {
    const errors = [];

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generiere SQL-Query für Auftragsdetails-Filter (Supabase)
   */
  static buildSupabaseQuery(query, filters) {
    const processedFilters = this.processFilters(filters);

    for (const [field, filter] of Object.entries(processedFilters)) {
      switch (filter.type) {
        case 'auftrag_relation':
          // Filter über die auftrag-Relation (auftragsname)
          // Dies muss speziell behandelt werden - wird im DataService gemacht
          console.log('🔍 Auftragsdetails: Filter über Auftrag-Relation:', filter.value);
          break;

        case 'equals':
          // Exakte Übereinstimmung
          query = query.eq(field, filter.value);
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

    return data.filter(detail => {
      for (const [field, filter] of Object.entries(processedFilters)) {
        const value = detail[field];

        switch (filter.type) {
          case 'auftrag_relation':
            // Prüfe ob der verknüpfte Auftrag den Namen hat
            if (detail.auftrag && detail.auftrag.auftragsname !== filter.value) {
              return false;
            }
            break;

          case 'equals':
            if (value !== filter.value) {
              return false;
            }
            break;
        }
      }

      return true;
    });
  }
}

export default AuftragsdetailsFilterLogic;

