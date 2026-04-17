export default {
  config: {
    table: 'auftrag_details',
    displayField: 'id',
    fields: {
      auftrag_id: 'uuid',
      kampagnenanzahl: 'number',
      ugc_pro_paid_video_anzahl: 'number',
      ugc_pro_paid_creator_anzahl: 'number',
      ugc_pro_paid_bilder_anzahl: 'number',
      ugc_pro_paid_budget_info: 'text',
      ugc_pro_paid_einkaufspreis_netto_von: 'number',
      ugc_pro_paid_einkaufspreis_netto_bis: 'number',
      ugc_pro_paid_verkaufspreis_netto_von: 'number',
      ugc_pro_paid_verkaufspreis_netto_bis: 'number',
      ugc_pro_organic_video_anzahl: 'number',
      ugc_pro_organic_creator_anzahl: 'number',
      ugc_pro_organic_bilder_anzahl: 'number',
      ugc_pro_organic_budget_info: 'text',
      ugc_pro_organic_einkaufspreis_netto_von: 'number',
      ugc_pro_organic_einkaufspreis_netto_bis: 'number',
      ugc_pro_organic_verkaufspreis_netto_von: 'number',
      ugc_pro_organic_verkaufspreis_netto_bis: 'number',
      ugc_video_paid_video_anzahl: 'number',
      ugc_video_paid_creator_anzahl: 'number',
      ugc_video_paid_bilder_anzahl: 'number',
      ugc_video_paid_budget_info: 'text',
      ugc_video_paid_einkaufspreis_netto_von: 'number',
      ugc_video_paid_einkaufspreis_netto_bis: 'number',
      ugc_video_paid_verkaufspreis_netto_von: 'number',
      ugc_video_paid_verkaufspreis_netto_bis: 'number',
      ugc_video_organic_video_anzahl: 'number',
      ugc_video_organic_creator_anzahl: 'number',
      ugc_video_organic_bilder_anzahl: 'number',
      ugc_video_organic_budget_info: 'text',
      ugc_video_organic_einkaufspreis_netto_von: 'number',
      ugc_video_organic_einkaufspreis_netto_bis: 'number',
      ugc_video_organic_verkaufspreis_netto_von: 'number',
      ugc_video_organic_verkaufspreis_netto_bis: 'number',
      influencer_video_anzahl: 'number',
      influencer_creator_anzahl: 'number',
      influencer_bilder_anzahl: 'number',
      influencer_budget_info: 'text',
      influencer_einkaufspreis_netto_von: 'number',
      influencer_einkaufspreis_netto_bis: 'number',
      influencer_verkaufspreis_netto_von: 'number',
      influencer_verkaufspreis_netto_bis: 'number',
      vor_ort_video_anzahl: 'number',
      vor_ort_creator_anzahl: 'number',
      vor_ort_bilder_anzahl: 'number',
      vor_ort_videographen_anzahl: 'number',
      vor_ort_budget_info: 'text',
      vor_ort_einkaufspreis_netto_von: 'number',
      vor_ort_einkaufspreis_netto_bis: 'number',
      vor_ort_verkaufspreis_netto_von: 'number',
      vor_ort_verkaufspreis_netto_bis: 'number',
      vor_ort_mitarbeiter_video_anzahl: 'number',
      vor_ort_mitarbeiter_bilder_anzahl: 'number',
      vor_ort_mitarbeiter_videographen_anzahl: 'number',
      vor_ort_mitarbeiter_budget_info: 'text',
      vor_ort_mitarbeiter_einkaufspreis_netto_von: 'number',
      vor_ort_mitarbeiter_einkaufspreis_netto_bis: 'number',
      vor_ort_mitarbeiter_verkaufspreis_netto_von: 'number',
      vor_ort_mitarbeiter_verkaufspreis_netto_bis: 'number',
      gesamt_videos: 'number',
      gesamt_creator: 'number',
      created_by_id: 'uuid'
    },
    relations: {
      auftrag: { table: 'auftrag', foreignKey: 'auftrag_id', displayField: 'auftragsname' },
      created_by: { table: 'benutzer', foreignKey: 'created_by_id', displayField: 'name' }
    },
    filters: ['auftrag_id', 'kampagnenanzahl', 'gesamt_videos', 'gesamt_creator', 'created_at'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },

  buildSelectClause(context) {
    return `*,
auftrag:auftrag_id(id, auftragsname, unternehmen_id, marke_id)`;
  },

  async applyJunctionFilters(query, filters, supabase) {
    try {
      if (filters && filters.auftragsname) {
        const auftragsname = filters.auftragsname;
        console.log('🔍 Filtere Auftragsdetails nach Auftragsname:', auftragsname);

        const { data: auftraege, error: aerr } = await supabase
          .from('auftrag')
          .select('id')
          .eq('auftragsname', auftragsname);

        if (aerr) {
          console.error('❌ Fehler beim Laden der Aufträge:', aerr);
        } else {
          const auftragIds = (auftraege || []).map(r => r.id).filter(Boolean);
          console.log(`✅ ${auftragIds.length} Aufträge mit Name "${auftragsname}" gefunden`);

          if (auftragIds.length === 0) {
            return { query, filters, shortCircuit: true };
          }

          query = query.in('auftrag_id', auftragIds);
        }

        delete filters.auftragsname;
      }

      if (filters && filters.auftrag_id) {
        const auftragId = filters.auftrag_id;
        console.log('🔍 Filtere Auftragsdetails nach Auftrag-ID:', auftragId);

        query = query.eq('auftrag_id', auftragId);

        delete filters.auftrag_id;
      }
    } catch (e) {
      console.warn('⚠️ Konnte Auftragsdetails-Filter nicht anwenden:', e);
    }
    return { query, filters, shortCircuit: false };
  }
};
