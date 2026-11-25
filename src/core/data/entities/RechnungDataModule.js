export default {
  async loadFilterDataOverride(_supabase) {
    return {};
  },

  skipFieldForSupabase(field, value) {
    // ust_aktiv ist ein UI-only Toggle und keine DB-Spalte
    if (field === 'ust_aktiv') {
      return true;
    }
    return false;
  },

  buildSelectClause(context) {
    return `*,
unternehmen:unternehmen_id(id, firmenname),
auftrag:auftrag_id(id, auftragsname, auftrag_details(id)),
creator:creator_id(id, vorname, nachname),
created_by:created_by_id(id, name, profile_image_url),
vertrag:vertrag_id(id, name, unterschriebener_vertrag_url, dropbox_file_url, datei_url),
kampagne:kampagne_id(id, kampagnenname, eigener_name),
rechnung_pdfs(id, rechnung_id, file_name, file_path, file_url)`;
  },

  customOrder(query) {
    return query
      .order('gestellt_am', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
  },

  transformResult(data) {
    if (!data) return data;
    data.sort((a, b) => {
      const aDate = a.gestellt_am ? new Date(a.gestellt_am).getTime() : 0;
      const bDate = b.gestellt_am ? new Date(b.gestellt_am).getTime() : 0;
      if (aDate !== bDate) return bDate - aDate;

      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bCreated - aCreated;
    });
    return data;
  }
};
