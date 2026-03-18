const VERTRAG_SELECT = `
  id, name, typ, is_draft,
  datei_url, datei_path,
  unterschriebener_vertrag_url, unterschriebener_vertrag_path,
  dropbox_file_url, dropbox_file_path,
  kooperation_id, kampagne_id, creator_id, kunde_unternehmen_id,
  created_at
`;

export class VertragRepository {
  constructor(supabase) {
    this._supabase = supabase || window.supabase;
  }

  async loadByKooperation(kooperationId) {
    const { data, error } = await this._supabase
      .from('vertraege')
      .select(VERTRAG_SELECT)
      .eq('kooperation_id', kooperationId);

    return { data: data || [], error };
  }

  async loadByKampagne(kampagneId) {
    const { data, error } = await this._supabase
      .from('vertraege')
      .select(VERTRAG_SELECT)
      .eq('kampagne_id', kampagneId);

    return { data: data || [], error };
  }
}
