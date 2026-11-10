// skripteSkriptDaten.js
// Skripte laden/aktualisieren, Skript-Dokument (Bloecke, Bilder), Video-Verknuepfungen,
// Kunden-/Gast-Aenderungen und Freigabe (Prototype-Mixin von SkripteService)

import { dropAnschreibenWarm } from '../../../core/anschreiben/openAnschreiben.js';
import { berechneSkriptNummern, mitSkriptNummern } from '../skriptNummern.js';
import { SKRIPT_BILDER_BUCKET, skriptBildPublicUrl } from '../editor/dokument/skriptBild.js';

export const skripteSkriptDatenMethoden = {
  // ------------------------------------------------------------------
  // Skripte
  // ------------------------------------------------------------------
  /**
   * Listen-Loader. Optionaler Scope: { kampagneId } filtert die Sidebar im
   * Editor auf eine Kampagne; null = explizit „ohne Kampagne“. Ohne Argument
   * bleibt das bisherige Verhalten (alles, Limit 200) fuer SkriptList.
   */
  async loadSkripte({ kampagneId, produktionId = null, briefingId = null } = {}) {
    // hauptteil/cta bleiben draussen (nie angezeigt),
    // hook nur als Titel-Fallback (Renderer schneidet auf 50/80 Zeichen)
    let query = this.db.from('skripte')
      .select(`id, titel, unternehmen_id, marke_id, kampagne_id, briefing_id, produktion_id, branche_id, hook, herkunft, status, model, funnel_stufe, created_at, unternehmen(id, firmenname, internes_kuerzel, logo_url), marke(id, markenname, logo_url), kampagne(id, kampagnenname, eigener_name, start, deadline, auftrag:auftrag_id(start, ende)), branchen(name),
        briefing:briefing_id(id, aktivierung_name), produkt(id, name), personas(id, name),
        strategie_item:strategie_item_id(
          id, strategie_id, creator_name, creator_auswahl_item_id,
          strategie:strategie_id(id, name),
          casting_eintrag:creator_auswahl_item_id(
            id, name, creator_id,
            creator:creator_id(id, vorname, nachname, mail, profilbild_url, profilbild_thumb_url)
          )
        ),
        kooperation_videos(
          id, position,
          kooperation:kooperation_id(
            videoanzahl,
            creator:creator_id(id, vorname, nachname, mail, profilbild_url, profilbild_thumb_url)
          )
        )`)
      .order('created_at', { ascending: false })
      .limit(200);

    if (kampagneId) query = query.eq('kampagne_id', kampagneId);
    else if (kampagneId === null) query = query.is('kampagne_id', null);
    if (produktionId) query = query.eq('produktion_id', produktionId);
    if (briefingId) query = query.eq('briefing_id', briefingId);

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    const mitNr = await this.attachSkriptNummern(data || []);
    return this.attachListeCreators(mitNr);
  },

  /**
   * Laufende Skript-Nummer je Konzept (siehe skriptNummern.js). Die Ranglisten
   * kommen aus allen Ideen der betroffenen Konzepte, nicht aus der gefilterten
   * Liste. Fehler hier lassen die Anzeige nie kippen (dann ohne Nummer).
   */
  async attachSkriptNummern(skripte) {
    const itemIds = [...new Set((skripte || []).map((s) => s.strategie_item?.id || s.strategie_item_id).filter(Boolean))];
    const strategieIds = [...new Set((skripte || []).map((s) => s.strategie_item?.strategie_id).filter(Boolean))];
    if (!itemIds.length) return mitSkriptNummern(skripte, new Map());

    let strategieIdsAlle = strategieIds;
    if (!strategieIdsAlle.length) {
      const { data } = await this.db.from('strategie_items').select('id, strategie_id').in('id', itemIds);
      strategieIdsAlle = [...new Set((data || []).map((i) => i.strategie_id).filter(Boolean))];
    }
    if (!strategieIdsAlle.length) return mitSkriptNummern(skripte, new Map());

    const { data, error } = await this.db.from('strategie_items')
      .select('id, strategie_id, sortierung, skript_freigabe, nicht_umsetzen, ist_vorschlag')
      .in('strategie_id', strategieIdsAlle);
    if (error) {
      console.warn('Skript-Nummern konnten nicht geladen werden:', error.message);
      return mitSkriptNummern(skripte, new Map());
    }
    return mitSkriptNummern(skripte, berechneSkriptNummern(data || [], itemIds));
  },

  /**
   * Share-Gaeste sehen Creator-Joins nicht (RLS haengt an Kampagne/Strategie).
   * Die Anzeige kommt deshalb aus skript_creator_anzeige, nur fuer Skripte
   * des aktuellen Zugangs.
   */
  async attachListeCreators(skripte) {
    if (!window.permissionSystem?.isGast || !skripte?.length) return skripte;
    const ids = skripte.map((s) => s.id).filter(Boolean);
    if (!ids.length) return skripte;
    const { data, error } = await this.db.rpc('skript_creator_anzeige', { p_ids: ids });
    if (error) {
      console.warn('Creator-Anzeige fuer Gaeste fehlgeschlagen:', error.message);
      return skripte;
    }
    const byId = new Map();
    for (const row of data || []) {
      const list = byId.get(row.skript_id) || [];
      list.push(row);
      byId.set(row.skript_id, list);
    }
    return skripte.map((s) => ({ ...s, liste_creators: byId.get(s.id) || [] }));
  },

  async loadSkript(id) {
    const { data, error } = await this.db.from('skripte')
      .select(`*, unternehmen(firmenname, logo_url), marke(markenname, logo_url), kampagne(kampagnenname, eigener_name), produktion:produktion_id(name), produkt(name, verbotene_claims), personas(name, oberbegriff), branchen(name), briefing:campaign_briefings(aktivierung_name, bereich, persona_ids, hook_vorgaben),
        strategie_item:strategie_item_id(
          id, strategie_id, sortierung, video_link, plattform, creator_name, creator_auswahl_item_id, funnel_stufe,
          casting_eintrag:creator_auswahl_item_id(
            id, name, creator_id,
            creator:creator_id(id, vorname, nachname, mail, profilbild_url, profilbild_thumb_url)
          )
        )`)
      .eq('id', id).maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    const [mitNr] = await this.attachSkriptNummern([data]);
    return this.attachPersonaOptionen(await this.attachHookSperre(mitNr));
  },

  /**
   * Hook-Sperre der Videoidee (ADR 0054) fuer die Statusanzeige im Editor.
   * Eigene Abfrage, damit ein Fehler hier das Laden des Skripts nie kippt.
   */
  async attachHookSperre(skript) {
    const itemId = skript?.strategie_item_id;
    if (!itemId) return skript;
    const { data } = await this.db.from('strategie_items')
      .select('hook_gesperrt').eq('id', itemId).maybeSingle();
    if (!data?.hook_gesperrt) return skript;
    return { ...skript, strategie_item: { ...(skript.strategie_item || { id: itemId }), hook_gesperrt: true } };
  },

  async updateSkript(id, patch) {
    const { error } = await this.db.from('skripte').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
    dropAnschreibenWarm('skript', id);
  },

  // ------------------------------------------------------------------
  // Skript-Dokument: Freie Bloecke (ADR 0062), nicht Teil der Versionen
  // ------------------------------------------------------------------

  /**
   * Speichert nur, wenn niemand seit `erwartetRev` gespeichert hat.
   * @returns {Promise<{ konflikt: boolean, rev?: number }>}
   */
  async saveDokumentBloecke(id, bloecke, erwartetRev) {
    const rev = Number(erwartetRev) || 0;
    const { data, error } = await this.db.from('skripte')
      .update({ dokument_bloecke: bloecke, dokument_bloecke_rev: rev + 1 })
      .eq('id', id)
      .eq('dokument_bloecke_rev', rev)
      .select('dokument_bloecke_rev');
    if (error) throw new Error(error.message);
    if (!data?.length) return { konflikt: true };
    dropAnschreibenWarm('skript', id);
    return { konflikt: false, rev: data[0].dokument_bloecke_rev };
  },

  async loadDokumentBloecke(id) {
    const { data, error } = await this.db.from('skripte')
      .select('dokument_bloecke, dokument_bloecke_rev')
      .eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return { bloecke: data?.dokument_bloecke ?? null, rev: data?.dokument_bloecke_rev ?? 0 };
  },

  skriptBildUrl(pfad) {
    return skriptBildPublicUrl(this.db, pfad);
  },

  /** Bereits verkleinertes Bild hochladen; Pfad je Skript, Dateiname zufaellig. */
  async uploadSkriptBild(skriptId, blob) {
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
    const pfad = `${skriptId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await this.db.storage.from(SKRIPT_BILDER_BUCKET)
      .upload(pfad, blob, { contentType: blob.type || 'image/webp', upsert: false });
    if (error) throw new Error(error.message || 'Bild konnte nicht hochgeladen werden');
    return pfad;
  },

  /**
   * Videos (Creator in Kooperation), an denen dieses Skript haengt.
   */
  async loadSkriptVerknuepfungen(skriptId) {
    if (!skriptId) return [];
    const { data, error } = await this.db
      .from('kooperation_videos')
      .select('id, position, video_name, thema, kooperation_id, kooperation:kooperation_id(id, name, kampagne_id, videoanzahl, creator:creator_id(id, vorname, nachname, mail, profilbild_url, profilbild_thumb_url))')
      .eq('skript_id', skriptId)
      .order('position', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  /** Kooperationen + Videos einer Kampagne fuer den Zuweisungs-Picker. */
  async loadKooperationenMitVideos(kampagneId) {
    if (!kampagneId) return { kooperationen: [], videos: [] };

    const { data: kooperationen, error: koopError } = await this.db
      .from('kooperationen')
      .select('id, name, videoanzahl, kampagne_id, creator:creator_id(id, vorname, nachname)')
      .eq('kampagne_id', kampagneId)
      .order('created_at', { ascending: false });
    if (koopError) throw new Error(koopError.message);

    const koops = kooperationen || [];
    if (koops.length === 0) return { kooperationen: [], videos: [] };

    const { data: videos, error: videoError } = await this.db
      .from('kooperation_videos')
      .select('id, video_name, thema, content_art, kampagnenart, kooperation_id, position, skript_id')
      .in('kooperation_id', koops.map((k) => k.id))
      .order('position', { ascending: true });
    if (videoError) throw new Error(videoError.message);

    return { kooperationen: koops, videos: videos || [] };
  },

  async verknuepfeMitVideo(videoId, skriptId) {
    const { error } = await this.db
      .from('kooperation_videos')
      .update({ skript_id: skriptId })
      .eq('id', videoId);
    if (error) throw new Error(error.message);
  },

  async loeseVerknuepfung(videoId) {
    const { error } = await this.db
      .from('kooperation_videos')
      .update({ skript_id: null })
      .eq('id', videoId);
    if (error) throw new Error(error.message);
  },

  /**
   * Kunden-Speicherweg fuer Dokument-Edits: der RPC schreibt genau ein
   * Content-Feld (Whitelist serverseitig) und legt atomar die Info-Zeile
   * (typ='aenderung') in skript_kommentare an. Gibt die Kommentar-ID
   * zurueck; kein Versionen-Snapshot (das bleibt der interne Changelog).
   */
  async saveKundeAenderung(skriptId, feld, wert) {
    const { data, error } = await this.db.rpc('save_skript_kunde_aenderung', {
      p_skript_id: skriptId,
      p_feld: feld,
      p_wert: wert
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Gleicher Speicherweg fuer Share-Gaeste mit Feedback-Recht: gleiche
   * Feld-Whitelist und Vorher/Nachher-Info-Zeile, Zugriff laeuft ueber
   * den Share-Claim statt ueber den Kunden-Scope.
   */
  async saveGastAenderung(skriptId, feld, wert) {
    const { data, error } = await this.db.rpc('save_skript_gast_aenderung', {
      p_skript_id: skriptId,
      p_feld: feld,
      p_wert: wert
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Gast mit Bearbeiten-Recht gibt ein finales Skript frei. Der RPC setzt
   * den Status und hakt die Checkbox an allen verknüpften Videos.
   */
  async freigebenSkriptGast(skriptId) {
    const { error } = await this.db.rpc('freigeben_skript_gast', {
      p_skript_id: skriptId
    });
    if (error) throw new Error(error.message);
  },

  /** Intern: Checkbox „Skript freigegeben“ an allen Videos dieses Skripts. */
  async markiereVideosSkriptFreigegeben(skriptId) {
    return this.setVideosSkriptFreigegeben(skriptId, true);
  },

  /** Checkbox an allen Videos dieses Skripts setzen oder zurücknehmen. */
  async setVideosSkriptFreigegeben(skriptId, freigegeben) {
    const { error } = await this.db
      .from('kooperation_videos')
      .update({ skript_freigegeben: Boolean(freigegeben) })
      .eq('skript_id', skriptId);
    if (error) throw new Error(error.message);
  },
};
