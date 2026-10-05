export default {
  prepareForSupabase(data) {
    if (data && data.brutto_gesamt_budget && !data.bruttobetrag) {
      data.bruttobetrag = data.brutto_gesamt_budget;
    }
    return data;
  },

  skipFieldForSupabase(field, value) {
    if (field === 'art_der_kampagne' || field === 'art_der_kampagne[]') {
      console.log(`🏷️ Verarbeite ${field} für Auftrag:`, value);
      return true;
    }
    return false;
  }
};
