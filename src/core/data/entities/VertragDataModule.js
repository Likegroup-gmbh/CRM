export default {
  config: {
    table: 'vertraege',
    displayField: 'name',
    fields: {
      name: 'string',
      typ: 'string',
      kunde_unternehmen_id: 'uuid',
      kampagne_id: 'uuid',
      creator_id: 'uuid',
      kooperation_id: 'uuid',
      is_draft: 'boolean',
      created_at: 'date'
    },
    relations: {
      kunde: { table: 'unternehmen', foreignKey: 'kunde_unternehmen_id', displayField: 'firmenname' },
      kampagne: { table: 'kampagne', foreignKey: 'kampagne_id', displayField: 'kampagnenname' },
      creator: { table: 'creator', foreignKey: 'creator_id', displayField: 'vorname' }
    },
    filters: ['typ', 'kunde_unternehmen_id', 'kampagne_id', 'creator_id'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },

  async loadFilterDataOverride(supabase) {
    const CACHE_KEY = 'vertrag_filter_options';
    const CACHE_TTL = 5 * 60 * 1000;

    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) return data;
      }
    } catch { /* corrupt cache – ignore */ }

    const { data, error } = await supabase.rpc('get_vertrag_filter_options');
    if (error) {
      console.error('❌ Fehler bei get_vertrag_filter_options RPC:', error);
      return {};
    }

    const result = {
      typ: data?.typ || [],
      kunde_unternehmen_id: data?.kunde_unternehmen_id || [],
      kampagne_id: data?.kampagne_id || [],
      creator_id: data?.creator_id || []
    };

    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: result }));
    } catch { /* storage full – ignore */ }

    return result;
  }
};
