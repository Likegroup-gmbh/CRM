// SkriptKommentarService.js
// Datenzugriff fuer das Feedback-Panel im Skript-Editor (Tabelle skript_kommentare).
// Getrennt von SkripteService, weil Kunden hier - anders als beim AI-Chat -
// lesen UND schreiben duerfen.

const AUTOR_SELECT = 'created_by:benutzer!skript_kommentare_created_by_fkey(id, name, vorname, nachname, profile_image_url, rolle)';

const TEAM_ROLLEN = new Set(['admin', 'mitarbeiter']);

/**
 * Reine Auswahl: Team-Beitraege (Kommentar und Aenderung) mit Skript-Titel und,
 * bei Antworten, dem Anker des Threads. Kunden- und Gast-Beitraege fallen weg.
 */
export function waehleTeamKommentare(rows, skripte = []) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const titel = new Map(skripte.map((s) => [s.id, s.titel || '']));
  const nummer = new Map(skripte.map((s, i) => [s.id, i + 1]));

  const wurzel = (row) => {
    let cur = row;
    for (let i = 0; cur?.parent_id && i < 20; i += 1) cur = byId.get(cur.parent_id);
    return cur || null;
  };

  return rows
    .filter((r) => TEAM_ROLLEN.has(r.created_by?.rolle) && String(r.inhalt || r.nachher_text || '').trim())
    .map((r) => {
      const anker = r.parent_id ? wurzel(r) : null;
      return {
        id: r.id,
        typ: r.typ || 'kommentar',
        skript_id: r.skript_id,
        skript_titel: titel.get(r.skript_id) || '',
        skript_nr: skripte.length > 1 ? nummer.get(r.skript_id) : null,
        sektion: r.parent_id ? (anker?.sektion || null) : (r.sektion || null),
        ist_antwort: !!r.parent_id,
        zitat: (r.parent_id ? anker?.selektion_text : r.selektion_text) || null,
        inhalt: r.inhalt || '',
        vorher_text: r.vorher_text || null,
        nachher_text: r.nachher_text || null,
        autor: r.created_by?.name
          || `${r.created_by?.vorname || ''} ${r.created_by?.nachname || ''}`.trim()
          || r.author_name
          || 'Team',
        created_at: r.created_at
      };
    });
}

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

  /**
   * Kommentare des Teams (admin/mitarbeiter) zu allen Skripten einer Videoidee,
   * aelteste zuerst. Antworten tragen den Anker ihres Threads (`thread`), damit sie
   * ohne den Kommentar des Kunden verstaendlich bleiben.
   * Leer, wenn es kein Skript gibt oder RLS (Gast ohne Skript-Zugriff) nichts liefert.
   */
  async loadTeamKommentareFuerItem(itemId) {
    if (!itemId) return [];
    const { data: skripte, error: skriptError } = await this.db.from('skripte')
      .select('id, titel')
      .eq('strategie_item_id', itemId)
      .order('created_at', { ascending: true });
    if (skriptError) throw new Error(skriptError.message);
    if (!skripte?.length) return [];

    const { data, error } = await this.db.from('skript_kommentare')
      .select(`*, ${AUTOR_SELECT}`)
      .in('skript_id', skripte.map((s) => s.id))
      .order('created_at');
    if (error) throw new Error(error.message);
    return waehleTeamKommentare(data || [], skripte);
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

    // Share-Gaeste haben keine benutzer-Row: created_by bleibt NULL, der
    // Insert-Trigger setzt guest_participant_id + author_name aus dem JWT.
    const benutzerId = window.currentUser?.id ?? null;
    if (!benutzerId && !window.permissionSystem?.isGast) {
      throw new Error('Kein angemeldeter Benutzer');
    }

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
