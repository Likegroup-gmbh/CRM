export default {
  buildSelectClause(context) {
    return `*,
auftrag:auftrag_id(id, auftragsname, unternehmen_id, marke_id)`;
  },

  async applyJunctionFilters(query, filters, supabase, context = 'list') {
    if (context !== 'list') return { query, filters, shortCircuit: false };
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
