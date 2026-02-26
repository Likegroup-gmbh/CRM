export class AuftragsdetailsRepository {
  get supabase() {
    return window.supabase;
  }

  async loadExistingDetails(detailsId) {
    if (!this.supabase || !detailsId) return null;
    const { data, error } = await this.supabase
      .from('auftrag_details')
      .select(`
        *,
        auftrag:auftrag_id (
          id,
          auftragsname,
          kampagnenanzahl,
          unternehmen_id,
          unternehmen:unternehmen_id (
            id,
            firmenname
          ),
          marke:marke_id (
            id,
            markenname
          )
        )
      `)
      .eq('id', detailsId)
      .single();

    if (error) throw error;
    return data;
  }

  async loadAuftragIdsWithDetails() {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('auftrag_details')
      .select('auftrag_id');
    if (error) throw error;
    return (data || []).map(d => d.auftrag_id).filter(Boolean);
  }

  async loadAllKampagnenartTypen() {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('kampagne_art_typen')
      .select('id, name')
      .order('sort_order, name');
    if (error) throw error;
    return data || [];
  }

  async loadAllAuftraegeBasic() {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('auftrag')
      .select('id, unternehmen_id');
    if (error) throw error;
    return data || [];
  }

  async loadAuftraegeForUnternehmen(unternehmenId) {
    if (!this.supabase || !unternehmenId) return [];
    const { data, error } = await this.supabase
      .from('auftrag')
      .select('id, auftragsname, kampagnenanzahl, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname)')
      .eq('unternehmen_id', unternehmenId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async loadUnternehmenByIds(ids) {
    if (!this.supabase || !ids || ids.length === 0) return [];
    const { data, error } = await this.supabase
      .from('unternehmen')
      .select('id, firmenname')
      .in('id', ids)
      .order('firmenname', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async loadKampagnenartenForAuftrag(auftragId) {
    if (!this.supabase || !auftragId) return [];
    const artenSet = new Set();

    const { data: auftragArten, error: auftragError } = await this.supabase
      .from('auftrag_kampagne_art')
      .select(`
        kampagne_art_typen:kampagne_art_id(id, name)
      `)
      .eq('auftrag_id', auftragId);

    if (!auftragError) {
      (auftragArten || []).forEach(item => {
        if (item.kampagne_art_typen?.name) artenSet.add(item.kampagne_art_typen.name);
      });
    }

    if (artenSet.size > 0) return Array.from(artenSet);

    const { data: kampagnen, error: kampError } = await this.supabase
      .from('kampagne')
      .select(`
        id,
        kampagne_art_typen:art_der_kampagne(id, name)
      `)
      .eq('auftrag_id', auftragId);

    if (kampError) throw kampError;

    (kampagnen || []).forEach(kampagne => {
      const arten = kampagne.kampagne_art_typen;
      if (Array.isArray(arten)) {
        arten.forEach(art => {
          if (art?.name) artenSet.add(art.name);
        });
      } else if (arten?.name) {
        artenSet.add(arten.name);
      }
    });

    return Array.from(artenSet);
  }

  async replaceKampagnenartenForAuftrag(auftragId, kampagneArtIds) {
    if (!this.supabase || !auftragId) return;

    const { error: deleteError } = await this.supabase
      .from('auftrag_kampagne_art')
      .delete()
      .eq('auftrag_id', auftragId);
    if (deleteError) throw deleteError;

    if (!kampagneArtIds || kampagneArtIds.length === 0) return;

    const insertData = kampagneArtIds.map(kampagneArtId => ({
      auftrag_id: auftragId,
      kampagne_art_id: kampagneArtId
    }));

    const { error: insertError } = await this.supabase
      .from('auftrag_kampagne_art')
      .insert(insertData);
    if (insertError) throw insertError;
  }

  async loadExistingValuesForAuftrag(auftragId) {
    if (!this.supabase || !auftragId) return {};
    const { data, error } = await this.supabase
      .from('auftrag_details')
      .select('*')
      .eq('auftrag_id', auftragId)
      .maybeSingle();
    if (error) throw error;
    return data || {};
  }

  async upsertAuftragsdetails(data) {
    if (!this.supabase) throw new Error('Supabase nicht verfügbar');
    const { data: saved, error } = await this.supabase
      .from('auftrag_details')
      .upsert([data], { onConflict: 'auftrag_id' })
      .select()
      .single();
    if (error) throw error;
    return saved;
  }
}

export const auftragsdetailsRepository = new AuftragsdetailsRepository();
