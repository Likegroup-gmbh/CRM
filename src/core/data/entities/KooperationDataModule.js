export default {
  config: {
    table: 'kooperationen',
    displayField: 'id',
    fields: {
      name: 'string',
      creator_id: 'uuid',
      kampagne_id: 'uuid',
      briefing_id: 'uuid',
      unternehmen_id: 'uuid',
      einkaufspreis_netto: 'number',
      einkaufspreis_zusatzkosten: 'number',
      einkaufspreis_ust: 'number',
      einkaufspreis_gesamt: 'number',
      verkaufspreis_netto: 'number',
      verkaufspreis_zusatzkosten: 'number',
      verkaufspreis_ust: 'number',
      verkaufspreis_gesamt: 'number',
      vertrag_unterschrieben: 'boolean',
      videoanzahl: 'number',
      content_link: 'string',
      bewertung: 'number',
      budget: 'number',
      start_datum: 'date',
      end_datum: 'date',
      notiz: 'string'
    },
    relations: {
      creator: { table: 'creator', foreignKey: 'creator_id', displayField: 'vorname' },
      kampagne: { table: 'kampagne', foreignKey: 'kampagne_id', displayField: 'name' },
      briefing: { table: 'briefings', foreignKey: 'briefing_id', displayField: 'product_service_offer' }
    },
    manyToMany: {
      tags: {
        table: 'kooperation_tag_typen',
        junctionTable: 'kooperation_tags',
        localKey: 'kooperation_id',
        foreignKey: 'tag_id',
        displayField: 'name'
      }
    },
    filters: ['creator_id', 'kampagne_id', 'budget', 'start_datum', 'end_datum'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },

  skipFieldForSupabase(field, value) {
    if (
      field === 'einkaufspreis_ust_prozent' ||
      field.startsWith('video_') ||
      field.startsWith('adressname_') || field.startsWith('strasse_') || field.startsWith('hausnummer_') ||
      field.startsWith('plz_') || field.startsWith('stadt_') || field.startsWith('land_') || field.startsWith('notiz_')
    ) {
      console.log(`🔧 Überspringe dynamisches Feld für kooperation: ${field}`);
      return true;
    }
    return false;
  },

  async extractFilterOptions(data, supabase) {
    const filterOptions = {};

    const allStatus = new Set();
    data.forEach(item => {
      if (item.status) {
        allStatus.add(item.status);
      }
    });
    filterOptions.status = Array.from(allStatus).sort();

    const budgetValues = data
      .map(item => item.budget)
      .filter(budget => budget && budget > 0)
      .sort((a, b) => a - b);

    if (budgetValues.length > 0) {
      filterOptions.budget_min = Math.min(...budgetValues);
      filterOptions.budget_max = Math.max(...budgetValues);
    }

    return filterOptions;
  }
};
