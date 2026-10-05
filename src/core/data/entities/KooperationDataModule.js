export default {
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
