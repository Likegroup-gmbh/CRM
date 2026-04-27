export default {
  config: {
    table: 'kampagne',
    displayField: 'kampagnenname',
    fields: {
      eigener_name: 'string',
      kampagnenname: 'string',
      unternehmen_id: 'uuid',
      marke_id: 'uuid',
      auftrag_id: 'uuid',
      art_der_kampagne: 'array',
      kampagne_typ: 'string',
      start: 'date',
      deadline_briefing: 'date',
      deadline_strategie: 'date',
      deadline_skripte: 'date',
      deadline_creator_sourcing: 'date',
      deadline_video_produktion: 'date',
      deadline_post_produktion: 'date',
      kampagnen_nummer: 'number',
      drehort_typ_id: 'uuid',
      drehort_beschreibung: 'string',
      creatoranzahl: 'number',
      videoanzahl: 'number',
      budget_info: 'string',
      ugc_paid_video_anzahl: 'number',
      ugc_paid_creator_anzahl: 'number',
      ugc_organic_video_anzahl: 'number',
      ugc_organic_creator_anzahl: 'number',
      ugc_pro_paid_video_anzahl: 'number',
      ugc_pro_paid_creator_anzahl: 'number',
      ugc_pro_paid_bilder_anzahl: 'number',
      ugc_pro_organic_video_anzahl: 'number',
      ugc_pro_organic_creator_anzahl: 'number',
      ugc_pro_organic_bilder_anzahl: 'number',
      ugc_video_paid_video_anzahl: 'number',
      ugc_video_paid_creator_anzahl: 'number',
      ugc_video_paid_bilder_anzahl: 'number',
      ugc_video_organic_video_anzahl: 'number',
      ugc_video_organic_creator_anzahl: 'number',
      ugc_video_organic_bilder_anzahl: 'number',
      influencer_video_anzahl: 'number',
      influencer_creator_anzahl: 'number',
      influencer_bilder_anzahl: 'number',
      story_video_anzahl: 'number',
      story_creator_anzahl: 'number',
      vor_ort_video_anzahl: 'number',
      vor_ort_creator_anzahl: 'number',
      vor_ort_bilder_anzahl: 'number',
      vor_ort_videographen_anzahl: 'number'
    },
    relations: {
      unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
      marke: { table: 'marke', foreignKey: 'marke_id', displayField: 'markenname' },
      auftrag: { table: 'auftrag', foreignKey: 'auftrag_id', displayField: 'auftragsname' },
      drehort_typ: { table: 'drehort_typen', foreignKey: 'drehort_typ_id', displayField: 'name' }
    },
    manyToMany: {
      ansprechpartner: {
        table: 'ansprechpartner',
        junctionTable: 'ansprechpartner_kampagne',
        localKey: 'kampagne_id',
        foreignKey: 'ansprechpartner_id',
        displayField: 'id,vorname,nachname,email,profile_image_url'
      },
      mitarbeiter: {
        table: 'benutzer',
        junctionTable: 'kampagne_mitarbeiter',
        localKey: 'kampagne_id',
        foreignKey: 'mitarbeiter_id',
        displayField: 'name,profile_image_url'
      }
    },
    filters: ['kampagnenname', 'unternehmen_id', 'marke_id', 'art_der_kampagne', 'start', 'deadline_post_produktion'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },

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
