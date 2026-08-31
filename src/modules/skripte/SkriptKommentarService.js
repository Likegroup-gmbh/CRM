// SkriptKommentarService.js
// Datenzugriff fuer das Feedback-Panel im Skript-Editor (Tabelle skript_kommentare).
// Getrennt von SkripteService, weil Kunden hier - anders als beim AI-Chat -
// lesen UND schreiben duerfen.

const AUTOR_SELECT = 'created_by:benutzer!skript_kommentare_created_by_fkey(id, name, vorname, nachname, profile_image_url, rolle)';

export class SkriptKommentarService {
  get db() {
    return window.supabase;
  }

  /**
   * Alle Kommentare eines Skripts, flach und chronologisch. Die Gruppierung
   * zu Threads passiert im Renderer.
   */
  async loadKommentare(skriptId) {
    if (!skriptId) return [];
    const { data, error } = await this.db.from('skript_kommentare')
      .select(`*, ${AUTOR_SELECT}`)
      .eq('skript_id', skriptId)
      .order('created_at');
    if (error) throw new Error(error.message);
    return this.ergaenzeAnsprechpartnerBilder(data || []);
  }

  /** Nachladen einer einzelnen Zeile inkl. Autor (Realtime liefert nur die rohen Spalten). */
  async loadKommentar(id) {
    if (!id) return null;
    const { data, error } = await this.db.from('skript_kommentare')
      .select(`*, ${AUTOR_SELECT}`)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const [angereichert] = await this.ergaenzeAnsprechpartnerBilder([data]);
    return angereichert;
  }

  /**
   * Kunden-Benutzer haben oft kein eigenes Profilbild, wohl aber der
   * Ansprechpartner, ueber den sie verknuepft sind. Nur ein Zusatz-Query
   * und nur fuer die Autoren, denen tatsaechlich ein Bild fehlt.
   */
  async ergaenzeAnsprechpartnerBilder(rows) {
    const offen = [...new Set(
      rows
        .map((r) => r.created_by)
        .filter((a) => a && !a.profile_image_url && a.rolle !== 'admin' && a.rolle !== 'mitarbeiter')
        .map((a) => a.id)
    )];
    if (!offen.length) return rows;

    const { data } = await this.db.from('kunde_ansprechpartner')
      .select('kunde_id, ansprechpartner:ansprechpartner_id(profile_image_url)')
      .in('kunde_id', offen);

    const bilder = new Map();
    for (const eintrag of data || []) {
      const url = eintrag.ansprechpartner?.profile_image_url;
      if (url && !bilder.has(eintrag.kunde_id)) bilder.set(eintrag.kunde_id, url);
    }
    if (!bilder.size) return rows;

    for (const row of rows) {
      const url = row.created_by?.id ? bilder.get(row.created_by.id) : null;
      if (url) row.created_by.profile_image_url = url;
    }
    return rows;
  }

  async createKommentar({
    skriptId, parentId = null, sektion = null, istVisuell = false,
    selektionText = null, inhalt
  }) {
    const text = String(inhalt || '').trim();
    if (!text) throw new Error('Kommentar ist leer');

    const benutzerId = window.currentUser?.id;
    if (!benutzerId) throw new Error('Kein angemeldeter Benutzer');

    const { data, error } = await this.db.from('skript_kommentare')
      .insert({
        skript_id: skriptId,
        parent_id: parentId,
        // Antworten haengen am Thread, der Anker steht nur an der Wurzel
        sektion: parentId ? null : sektion,
        ist_visuell: parentId ? false : Boolean(istVisuell),
        selektion_text: parentId ? null : selektionText,
        inhalt: text,
        created_by: benutzerId
      })
      .select(`*, ${AUTOR_SELECT}`)
      .single();
    if (error) throw new Error(error.message);
    const [angereichert] = await this.ergaenzeAnsprechpartnerBilder([data]);
    return angereichert;
  }

  async updateInhalt(id, inhalt) {
    const text = String(inhalt || '').trim();
    if (!text) throw new Error('Kommentar ist leer');
    const { data, error } = await this.db.from('skript_kommentare')
      .update({ inhalt: text })
      .eq('id', id)
      .select(`*, ${AUTOR_SELECT}`)
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async remove(id) {
    const { error } = await this.db.from('skript_kommentare').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  /** Erledigt-Toggle laeuft ueber RPC: "nur intern" gilt serverseitig. */
  async setErledigt(id, erledigt) {
    const { data, error } = await this.db.rpc('set_skript_kommentar_erledigt', {
      p_id: id,
      p_erledigt: Boolean(erledigt)
    });
    if (error) throw new Error(error.message);
    return data;
  }

  subscribeToKommentare(skriptId, onChange) {
    return this.db
      .channel(`skript-kommentare-${skriptId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'skript_kommentare',
        filter: `skript_id=eq.${skriptId}`
      }, (payload) => onChange(payload.new || payload.old, payload.eventType))
      .subscribe();
  }
}

export const skriptKommentarService = new SkriptKommentarService();
