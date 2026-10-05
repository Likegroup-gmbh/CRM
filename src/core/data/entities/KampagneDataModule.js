export default {
  skipFieldForSupabase(field, value) {
    if (
      field === 'ansprechpartner_ids' || field === 'ansprechpartner_ids[]' ||
      field === 'mitarbeiter_ids' || field === 'mitarbeiter_ids[]' ||
      field === 'pm_ids' || field === 'pm_ids[]' ||
      field === 'scripter_ids' || field === 'scripter_ids[]' ||
      field === 'cutter_ids' || field === 'cutter_ids[]' ||
      field === 'copywriter_ids' || field === 'copywriter_ids[]' ||
      field === 'strategie_ids' || field === 'strategie_ids[]' ||
      field === 'creator_sourcing_ids' || field === 'creator_sourcing_ids[]' ||
      field === 'organic_ziele_ids' || field === 'organic_ziele_ids[]' ||
      field === 'plattform_ids' || field === 'plattform_ids[]' ||
      field === 'format_ids' || field === 'format_ids[]'
    ) {
      console.log(`🏷️ Verarbeite ${field} für Kampagne:`, value);
      return true;
    }
    return false;
  },

  async loadFilterDataOverride(supabase) {
    const CACHE_KEY = 'kampagne_filter_options';
    const CACHE_TTL = 5 * 60 * 1000;

    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) return data;
      }
    } catch { /* corrupt cache – ignore */ }

    const { data, error } = await supabase.rpc('get_kampagne_filter_options');
    if (error) {
      console.error('❌ Fehler bei get_kampagne_filter_options RPC:', error);
      return {};
    }
    const result = {
      status: data?.status || [],
      art_typen: data?.art_typen || []
    };

    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: result }));
    } catch { /* storage full – ignore */ }

    return result;
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

    return filterOptions;
  }
};
