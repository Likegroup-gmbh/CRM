// ProduktFilterLogic.js
// Supabase-Filter für die Produkte-Liste. marke_id läuft über produkt_marke
// und wird in ProduktList.loadPageData aufgelöst.

export class ProduktFilterLogic {
  static processFilters(filters) {
    const processedFilters = {};

    for (const [key, value] of Object.entries(filters)) {
      if (key.startsWith('_')) continue;
      if (!value) continue;

      switch (key) {
        case 'name':
        case 'marke_id':
          break;
        case 'unternehmen_id':
          processedFilters[key] = { type: 'equals', value };
          break;
        default:
          processedFilters[key] = { type: 'equals', value };
          break;
      }
    }

    return processedFilters;
  }

  static buildSupabaseQuery(query, filters) {
    const processedFilters = this.processFilters(filters);

    for (const [field, filter] of Object.entries(processedFilters)) {
      if (filter.type === 'equals') {
        query = query.eq(field, filter.value);
      }
    }

    return query;
  }
}

export default ProduktFilterLogic;
