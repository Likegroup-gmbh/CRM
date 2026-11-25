// skripteEditorDaten.js
// Editor: Chat-Messages, Versions-Snapshots, Master-Regelwerk und Regie-Modi
// (Prototype-Mixin von SkripteService)

import { MASTER_BEREICHE } from '../skripteKonstanten.js';
import { planeVersionsRows } from '../versionsNummerierung.js';

export const skripteEditorDatenMethoden = {
  // ------------------------------------------------------------------
  // Editor: Chat-Messages (Assistant-Message = Job, Status via Realtime)
  // ------------------------------------------------------------------
  async getChatMessages(skriptId) {
    const { data, error } = await this.db.from('skript_chat_messages')
      .select('*').eq('skript_id', skriptId).order('created_at');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createChatMessage(payload) {
    const { data: { user } } = await this.db.auth.getUser();
    const { data, error } = await this.db.from('skript_chat_messages')
      .insert({ ...payload, created_by: user?.id }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * nurWennStatus: Update nur ausfuehren, wenn die Message noch in diesem
   * Status ist (Race-Schutz gegen die Function, die gleichzeitig claimt).
   * Rueckgabe: true, wenn eine Zeile aktualisiert wurde.
   */
  async updateChatMessage(id, patch, { nurWennStatus } = {}) {
    let q = this.db.from('skript_chat_messages').update(patch).eq('id', id);
    if (Array.isArray(nurWennStatus)) q = q.in('status', nurWennStatus);
    else if (nurWennStatus) q = q.eq('status', nurWennStatus);
    const { data, error } = await q.select('id');
    if (error) throw new Error(error.message);
    return (data || []).length > 0;
  },

  async pollChatMessage(id) {
    const { data } = await this.db.from('skript_chat_messages')
      .select('*').eq('id', id).single();
    return data;
  },

  /** onStatus: Channel-Status (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED) fuer Resync nach Luecken. */
  subscribeToChat(skriptId, onChange, onStatus) {
    return this.db
      .channel(`skript-chat-${skriptId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'skript_chat_messages',
        filter: `skript_id=eq.${skriptId}`
      }, (payload) => onChange(payload.new, payload.eventType))
      .subscribe(onStatus ? (status) => onStatus(status) : undefined);
  },

  // ------------------------------------------------------------------
  // Editor: Versions-Snapshots
  // ------------------------------------------------------------------
  async getVersionen(skriptId) {
    const { data, error } = await this.db.from('skript_versionen')
      .select('id, version_nr, sub_nr, titel, hook, hauptteil, cta, hook_visuell, hauptteil_visuell, cta_visuell, hook_variante_1, hook_variante_2, hook_variante_3, rezept, text_hook, caption, inhalt_md, aenderung_beschreibung, created_at')
      .eq('skript_id', skriptId).order('version_nr').order('sub_nr');
    if (error) throw new Error(error.message);
    return data || [];
  },

  /** Anzeige-Label einer Version: "v2" (Hauptversion) bzw. "v2.1" (Unterversion). */
  versionLabel(v) {
    if (!v) return '';
    const nr = v.version_nr ?? v;
    const sub = v.sub_nr ?? 0;
    return `v${nr}${sub ? `.${sub}` : ''}`;
  },

  /**
   * Snapshot des uebergebenen Skript-Stands als naechste Version.
   * - Aktive Version = neueste Hauptversion -> neue Hauptversion (v4).
   * - Aktive Version = aeltere Version (v2 oder v2.1) -> Unterversion v2.x,
   *   damit die spaeteren Hauptversionen nicht ueberschrieben werden.
   * Legt fuer Bestandsskripte ohne Versionen lazy v1 an (Stand VOR der Aenderung).
   * Rueckgabe: { version_nr, sub_nr } der neuen Version.
   *
   * @param {object|null} aktiveVersion - { version_nr, sub_nr } der Version, an der gearbeitet wurde
   */
  async createVersion(skript, beschreibung, vorherigerStand = null, aktiveVersion = null) {
    const { data: { user } } = await this.db.auth.getUser();
    const { data: vorhandene } = await this.db.from('skript_versionen')
      .select('version_nr, sub_nr').eq('skript_id', skript.id)
      .order('version_nr').order('sub_nr');

    const { rows, neu } = planeVersionsRows({
      versionen: vorhandene || [],
      skript,
      beschreibung,
      vorherigerStand,
      aktiveVersion,
      userId: user?.id
    });

    const { error } = await this.db.from('skript_versionen').insert(rows);
    if (error) throw new Error(error.message);

    // Neue Version ist ab jetzt die aktive (Reload-sicher am Skript gemerkt)
    await this.updateSkript(skript.id, {
      aktive_version_nr: neu.version_nr,
      aktive_sub_nr: neu.sub_nr
    });

    return neu;
  },

  /**
   * Versionswechsel im Editor: Snapshot in die Arbeitskopie (skripte-Row)
   * zurueckschreiben und als aktive Version merken. Es geht nichts verloren,
   * da jede angenommene Aenderung als Snapshot vorliegt.
   * Gaeste schreiben ueber den RPC, weil sie skripte nicht direkt aktualisieren duerfen.
   */
  async wechsleVersion(skriptId, version) {
    if (window.permissionSystem?.isGast) {
      const { error } = await this.db.rpc('wechsle_skript_version_gast', {
        p_skript_id: skriptId,
        p_version_nr: version.version_nr,
        p_sub_nr: version.sub_nr || 0
      });
      if (error) throw new Error(error.message);
      return;
    }
    await this.updateSkript(skriptId, {
      titel: version.titel,
      hook: version.hook,
      hauptteil: version.hauptteil,
      cta: version.cta,
      hook_visuell: version.hook_visuell ?? null,
      hauptteil_visuell: version.hauptteil_visuell ?? null,
      cta_visuell: version.cta_visuell ?? null,
      hook_variante_1: version.hook_variante_1 ?? null,
      hook_variante_2: version.hook_variante_2 ?? null,
      hook_variante_3: version.hook_variante_3 ?? null,
      rezept: version.rezept ?? null,
      text_hook: version.text_hook ?? null,
      caption: version.caption ?? null,
      inhalt_md: version.inhalt_md ?? null,
      aktive_version_nr: version.version_nr,
      aktive_sub_nr: version.sub_nr || 0
    });
  },

  // ------------------------------------------------------------------
  // Master-Regelwerk
  // ------------------------------------------------------------------
  async loadMasterDokumente() {
    const { data, error } = await this.db.from('skript_master')
      .select('*')
      .order('bereich').order('version', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async loadMaster(id) {
    const { data, error } = await this.db.from('skript_master')
      .select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async createMaster({ name, inhalt, bereich }) {
    const { data: maxRows } = await this.db.from('skript_master')
      .select('version').eq('bereich', bereich)
      .order('version', { ascending: false }).limit(1);
    const { data, error } = await this.db.from('skript_master').insert({
      name: (name || '').trim() || MASTER_BEREICHE[bereich] || bereich,
      inhalt: inhalt ?? '',
      bereich,
      version: (maxRows?.[0]?.version || 0) + 1,
      status: 'entwurf'
    }).select('*').single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateMaster(id, patch) {
    const { error } = await this.db.from('skript_master').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  },

  /** Aktiviert eine Master-Version und archiviert die bisher aktive desselben Bereichs. */
  async aktiviereMaster(doc) {
    const { data: { user } } = await this.db.auth.getUser();
    await this.db.from('skript_master').update({ status: 'archiviert' })
      .eq('bereich', doc.bereich).eq('status', 'aktiv').neq('id', doc.id);
    await this.updateMaster(doc.id, {
      status: 'aktiv',
      freigegeben_von: user?.id || null,
      freigegeben_am: new Date().toISOString()
    });
  },

  // ------------------------------------------------------------------
  // Modi (visuelle Regie: klassisch / dynamisch)
  // ------------------------------------------------------------------
  /** Aktive Regie-Modi fuer das Visual-Menue im Editor. */
  async loadAktiveModi() {
    const { data, error } = await this.db.from('skript_modi')
      .select('id, slug, name, beschreibung, icon, item_layout')
      .eq('status', 'aktiv')
      .order('sort_order');
    if (error) throw new Error(error.message);
    return data || [];
  },
};
