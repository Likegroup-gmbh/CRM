// SkripteService.js
// Datenzugriff fuer den Skript-Generator (Layer 1).
// Alle Queries laufen ueber window.supabase (RLS: intern voll, Kunden nur eigener Scope).

import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { FUNNEL_STUFEN, VIDEO_LAENGEN, DNA_LAYER, SKRIPT_BEREICHE, MASTER_BEREICHE } from './skripteKonstanten.js';
import { planeVersionsRows } from './versionsNummerierung.js';

export { FUNNEL_STUFEN, VIDEO_LAENGEN, DNA_LAYER, SKRIPT_BEREICHE, MASTER_BEREICHE };

// Gateway-/Last-Fehler beim Function-Invoke, bei denen ein Retry sinnvoll ist
const TRANSIENT_TRIGGER_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export class SkripteService {
  get db() {
    return window.supabase;
  }

  // ------------------------------------------------------------------
  // Stammdaten fuer Pick-and-pull
  // ------------------------------------------------------------------
  async loadUnternehmen() {
    const allowedIds = await window.getAllowedUnternehmenIds();
    if (allowedIds !== null && allowedIds.length === 0) return [];

    let q = this.db.from('unternehmen')
      .select('id, firmenname, branche_id').order('firmenname');
    if (allowedIds !== null) q = q.in('id', allowedIds);
    const { data } = await q;
    return data || [];
  }

  async loadMarken(unternehmenId) {
    const allowedIds = await window.getAllowedMarkenIds();
    if (allowedIds !== null && allowedIds.length === 0) return [];

    let q = this.db.from('marke')
      .select('id, markenname, branche_id, unternehmen_id').order('markenname');
    if (unternehmenId) q = q.eq('unternehmen_id', unternehmenId);
    if (allowedIds !== null) q = q.in('id', allowedIds);
    const { data } = await q;
    return data || [];
  }

  /**
   * Kampagnen zum Kontext: mit Marke nach marke_id gefiltert, ohne Marke
   * (Unternehmen ohne Marken bzw. "Keine" gewaehlt) nach unternehmen_id.
   */
  async loadKampagnen({ markeId = null, unternehmenId = null } = {}) {
    const allowedIds = await KampagneUtils.loadAllowedKampagneIds();
    if (allowedIds !== null && allowedIds.length === 0) return [];

    let q = this.db.from('kampagne')
      .select('id, kampagnenname, eigener_name, marke_id, unternehmen_id')
      .order('created_at', { ascending: false });
    if (markeId) q = q.eq('marke_id', markeId);
    else if (unternehmenId) q = q.eq('unternehmen_id', unternehmenId);
    if (allowedIds !== null) q = q.in('id', allowedIds);
    const { data } = await q;
    return data || [];
  }

  /**
   * Produkte zum Kontext. Die Marken-Zuordnung liegt in produkt_marke, deshalb
   * filtert der Marken-Fall ueber einen Inner-Join statt ueber eine Spalte.
   */
  async loadProdukte({ markeId = null, unternehmenId = null } = {}) {
    let q = markeId
      ? this.db.from('produkt')
          .select('id, name, unternehmen_id, treffer:produkt_marke!inner(marke_id)')
          .eq('treffer.marke_id', markeId)
      : this.db.from('produkt').select('id, name, unternehmen_id');

    if (!markeId && unternehmenId) q = q.eq('unternehmen_id', unternehmenId);

    const { data } = await q.order('name');
    return data || [];
  }

  /** Picker-Loader (DNA-Scope etc.): nur Label-Felder, kein select('*'). */
  async loadPersonas() {
    const { data } = await this.db.from('personas').select('id, name, oberbegriff')
      .order('oberbegriff', { nullsFirst: false }).order('name');
    return data || [];
  }

  /**
   * Strategie-Items der Kampagne fuer den Vorlagen-Picker (ein Roundtrip
   * via Inner-Join). Bewusst OHNE transkript/caption: das sind die dicken
   * Felder, die der Picker nicht anzeigt. transkript_quelle reicht als
   * "hat Transkript"-Flag. Das volle Item kommt erst beim Select ueber
   * loadStrategieItem.
   * nicht_umsetzen bleibt draussen - die sollen keine Vorlage werden.
   */
  async loadStrategieItems(kampagneId) {
    if (!kampagneId) return [];

    const { data, error } = await this.db.from('strategie_items')
      .select('id, strategie_id, video_link, plattform, beschreibung, transkript_quelle, creator_name, screenshot_url, nicht_umsetzen, strategie:strategie_id!inner(id, name, kampagne_id)')
      .eq('strategie.kampagne_id', kampagneId)
      .order('sortierung');

    if (error) throw new Error(error.message);
    return (data || []).filter((item) => !item.nicht_umsetzen);
  }

  /** Einzelnes Strategie-Item voll (mit Transkript) - erst beim Select. */
  async loadStrategieItem(id) {
    if (!id) return null;
    const { data, error } = await this.db.from('strategie_items')
      .select('id, strategie_id, video_link, plattform, beschreibung, transkript, caption, creator_name, screenshot_url')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  }

  /**
   * Campaign-Briefings zum Kontext: immer am Unternehmen, bei Markenwahl
   * zusaetzlich markenspezifische ODER unternehmensweite (marke_id IS NULL).
   * Drafts (inkl. migrierter Huellen) bleiben draussen.
   */
  async loadBriefings(unternehmenId, markeId = null) {
    if (!unternehmenId) return [];

    let q = this.db.from('campaign_briefings')
      .select('id, aktivierung_name, bereich, is_draft, im_funnel_stufen, pa_funnel_stufen, pa_videolaengen, im_formatvorgaben, os_formatvorgaben')
      .eq('unternehmen_id', unternehmenId)
      .eq('is_draft', false);

    if (markeId) q = q.or(`marke_id.eq.${markeId},marke_id.is.null`);

    const { data, error } = await q.order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }

  /** Anzeige-Label einer Persona: "Oberbegriff (Name)", Fallback nur Name. */
  personaLabel(p) {
    if (!p) return '';
    return p.oberbegriff ? `${p.oberbegriff} (${p.name})` : p.name;
  }

  async loadBranchen() {
    const { data } = await this.db.from('branchen').select('id, name').order('name');
    return data || [];
  }

  async createPersona(payload) {
    const { data, error } = await this.db.from('personas').insert(payload).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updatePersona(id, patch) {
    const { error } = await this.db.from('personas').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deletePersona(id) {
    const { error } = await this.db.from('personas').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ------------------------------------------------------------------
  // Skripte
  // ------------------------------------------------------------------
  async loadSkripte() {
    // Listen-Loader: hauptteil/cta bleiben draussen (nie angezeigt),
    // hook nur als Titel-Fallback (Renderer schneidet auf 50/80 Zeichen)
    const { data, error } = await this.db.from('skripte')
      .select('id, titel, unternehmen_id, marke_id, kampagne_id, branche_id, hook, herkunft, status, mit_dna, model, funnel_stufe, created_at, unternehmen(id, firmenname, internes_kuerzel, logo_url), marke(id, markenname, logo_url), kampagne(id, kampagnenname, eigener_name), branchen(name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    return data || [];
  }

  async loadSkript(id) {
    const { data, error } = await this.db.from('skripte')
      .select('*, unternehmen(firmenname), marke(markenname), kampagne(kampagnenname, eigener_name), produkt(name), personas(name, oberbegriff), branchen(name), briefing:campaign_briefings(aktivierung_name, bereich)')
      .eq('id', id).maybeSingle();

    if (error) throw new Error(error.message);
    return data || null;
  }

  async updateSkript(id, patch) {
    const { error } = await this.db.from('skripte').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async importSkript(payload) {
    const { data: { user } } = await this.db.auth.getUser();
    const { data, error } = await this.db.from('skripte')
      .insert({ ...payload, herkunft: 'historisch', status: 'final', created_by: user?.id })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async deleteSkript(id) {
    const { error } = await this.db.from('skripte').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  /**
   * Stub fuer die Rueckfragen-Phase: Skript-Row mit allen Generator-Vorgaben,
   * aber ohne Inhalt (status 'fragen'). Der volle Generator-Payload wird in
   * prompt_kontext gemerkt, damit Rueckfragen + finale Generierung ihn auch
   * nach einem Reload noch haben.
   */
  async createSkriptStub(payload) {
    const { data: { user } } = await this.db.auth.getUser();
    const { data, error } = await this.db.from('skripte').insert({
      titel: payload.video_idee ? payload.video_idee.slice(0, 60) : null,
      unternehmen_id: payload.unternehmen_id || null,
      marke_id: payload.marke_id || null,
      kampagne_id: payload.kampagne_id || null,
      produkt_id: payload.produkt_id || null,
      persona_id: payload.persona_id || null,
      branche_id: payload.branche_id || null,
      briefing_id: payload.briefing_id || null,
      bereich: payload.bereich || null,
      strategie_item_id: payload.strategie_item_id || null,
      video_idee: payload.video_idee || null,
      location: payload.location || null,
      regieanweisung: payload.regieanweisung || null,
      video_laenge: payload.video_laenge || null,
      funnel_stufe: payload.funnel_stufe || null,
      tonalitaet: payload.tonalitaet || null,
      herkunft: 'generiert',
      status: 'fragen',
      mit_dna: payload.mit_dna !== false,
      prompt_kontext: { generator_payload: payload },
      created_by: user?.id
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Stub mit frischem Generator-Payload aktualisieren (Retry/erneuter Start
   * mit geaenderten Vorgaben). prompt_kontext wird gemergt, damit z.B. ein
   * bestehender prompt_kontext (z.B. Job-Caches) erhalten bleibt.
   */
  async updateSkriptStub(id, payload) {
    const { data: existing } = await this.db.from('skripte')
      .select('prompt_kontext').eq('id', id).single();
    const { data, error } = await this.db.from('skripte').update({
      titel: payload.video_idee ? payload.video_idee.slice(0, 60) : null,
      unternehmen_id: payload.unternehmen_id || null,
      marke_id: payload.marke_id || null,
      kampagne_id: payload.kampagne_id || null,
      produkt_id: payload.produkt_id || null,
      persona_id: payload.persona_id || null,
      branche_id: payload.branche_id || null,
      briefing_id: payload.briefing_id || null,
      bereich: payload.bereich || null,
      strategie_item_id: payload.strategie_item_id || null,
      video_idee: payload.video_idee || null,
      location: payload.location || null,
      regieanweisung: payload.regieanweisung || null,
      video_laenge: payload.video_laenge || null,
      funnel_stufe: payload.funnel_stufe || null,
      tonalitaet: payload.tonalitaet || null,
      mit_dna: payload.mit_dna !== false,
      prompt_kontext: { ...(existing?.prompt_kontext || {}), generator_payload: payload }
    }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ------------------------------------------------------------------
  // Editor: Chat-Messages (Assistant-Message = Job, Status via Realtime)
  // ------------------------------------------------------------------
  async getChatMessages(skriptId) {
    const { data, error } = await this.db.from('skript_chat_messages')
      .select('*').eq('skript_id', skriptId).order('created_at');
    if (error) throw new Error(error.message);
    return data || [];
  }

  async createChatMessage(payload) {
    const { data: { user } } = await this.db.auth.getUser();
    const { data, error } = await this.db.from('skript_chat_messages')
      .insert({ ...payload, created_by: user?.id }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * nurWennStatus: Update nur ausfuehren, wenn die Message noch in diesem
   * Status ist (Race-Schutz gegen die Function, die gleichzeitig claimt).
   * Rueckgabe: true, wenn eine Zeile aktualisiert wurde.
   */
  async updateChatMessage(id, patch, { nurWennStatus } = {}) {
    let q = this.db.from('skript_chat_messages').update(patch).eq('id', id);
    if (nurWennStatus) q = q.eq('status', nurWennStatus);
    const { data, error } = await q.select('id');
    if (error) throw new Error(error.message);
    return (data || []).length > 0;
  }

  async pollChatMessage(id) {
    const { data } = await this.db.from('skript_chat_messages')
      .select('*').eq('id', id).single();
    return data;
  }

  subscribeToChat(skriptId, onChange) {
    return this.db
      .channel(`skript-chat-${skriptId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'skript_chat_messages',
        filter: `skript_id=eq.${skriptId}`
      }, (payload) => onChange(payload.new, payload.eventType))
      .subscribe();
  }

  // ------------------------------------------------------------------
  // Editor: Versions-Snapshots
  // ------------------------------------------------------------------
  async getVersionen(skriptId) {
    const { data, error } = await this.db.from('skript_versionen')
      .select('id, version_nr, sub_nr, titel, hook, hauptteil, cta, hook_visuell, hauptteil_visuell, cta_visuell, inhalt_md, aenderung_beschreibung, created_at')
      .eq('skript_id', skriptId).order('version_nr').order('sub_nr');
    if (error) throw new Error(error.message);
    return data || [];
  }

  /** Anzeige-Label einer Version: "v2" (Hauptversion) bzw. "v2.1" (Unterversion). */
  versionLabel(v) {
    if (!v) return '';
    const nr = v.version_nr ?? v;
    const sub = v.sub_nr ?? 0;
    return `v${nr}${sub ? `.${sub}` : ''}`;
  }

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
  }

  /**
   * Versionswechsel im Editor: Snapshot in die Arbeitskopie (skripte-Row)
   * zurueckschreiben und als aktive Version merken. Es geht nichts verloren,
   * da jede angenommene Aenderung als Snapshot vorliegt.
   */
  async wechsleVersion(skriptId, version) {
    await this.updateSkript(skriptId, {
      titel: version.titel,
      hook: version.hook,
      hauptteil: version.hauptteil,
      cta: version.cta,
      hook_visuell: version.hook_visuell ?? null,
      hauptteil_visuell: version.hauptteil_visuell ?? null,
      cta_visuell: version.cta_visuell ?? null,
      inhalt_md: version.inhalt_md ?? null,
      aktive_version_nr: version.version_nr,
      aktive_sub_nr: version.sub_nr || 0
    });
  }

  // ------------------------------------------------------------------
  // DNA
  // ------------------------------------------------------------------
  /** Aktive DNA-Dokumente fuer die Auswahl im Generator. */
  async loadAktiveDna() {
    const { data } = await this.db.from('skript_dna')
      .select('id, name, layer_typ, version, branchen(name), personas(name, oberbegriff), marke(markenname)')
      .eq('status', 'aktiv')
      .order('layer_typ').order('version', { ascending: false });
    return data || [];
  }

  async loadDnaDokumente() {
    const { data } = await this.db.from('skript_dna')
      .select('*, branchen(name), personas(name, oberbegriff), marke(markenname)')
      .order('layer_typ').order('version', { ascending: false });
    return data || [];
  }

  async loadDna(id) {
    const { data, error } = await this.db.from('skript_dna')
      .select('*, branchen(name), personas(name, oberbegriff), marke(markenname)')
      .eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async createDna({ name, inhalt, layer_typ, branche_id = null, persona_id = null, marke_id = null }) {
    let maxQ = this.db.from('skript_dna').select('version')
      .eq('layer_typ', layer_typ)
      .order('version', { ascending: false }).limit(1);
    if (branche_id) maxQ = maxQ.eq('branche_id', branche_id);
    if (persona_id) maxQ = maxQ.eq('persona_id', persona_id);
    if (marke_id) maxQ = maxQ.eq('marke_id', marke_id);
    const { data: maxRows } = await maxQ;
    const { data, error } = await this.db.from('skript_dna').insert({
      name: (name || '').trim() || null,
      inhalt: inhalt ?? '',
      layer_typ,
      branche_id: branche_id || null,
      persona_id: persona_id || null,
      marke_id: marke_id || null,
      version: (maxRows?.[0]?.version || 0) + 1,
      status: 'entwurf'
    }).select('*, branchen(name), personas(name, oberbegriff), marke(markenname)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateDna(id, patch) {
    const { error } = await this.db.from('skript_dna').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  }

  /** Aktiviert eine DNA-Version und archiviert die bisher aktive desselben Scopes. */
  async aktiviereDna(doc) {
    const { data: { user } } = await this.db.auth.getUser();
    let q = this.db.from('skript_dna').update({ status: 'archiviert' })
      .eq('layer_typ', doc.layer_typ).eq('status', 'aktiv').neq('id', doc.id);
    if (doc.branche_id) q = q.eq('branche_id', doc.branche_id);
    if (doc.persona_id) q = q.eq('persona_id', doc.persona_id);
    if (doc.marke_id) q = q.eq('marke_id', doc.marke_id);
    await q;
    await this.updateDna(doc.id, {
      status: 'aktiv',
      freigegeben_von: user?.id || null,
      freigegeben_am: new Date().toISOString()
    });
  }

  // ------------------------------------------------------------------
  // Master-Regelwerk
  // ------------------------------------------------------------------
  async loadMasterDokumente() {
    const { data, error } = await this.db.from('skript_master')
      .select('*')
      .order('bereich').order('version', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }

  async loadMaster(id) {
    const { data, error } = await this.db.from('skript_master')
      .select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

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
  }

  async updateMaster(id, patch) {
    const { error } = await this.db.from('skript_master').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  }

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
  }

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
  }

  // ------------------------------------------------------------------
  // Jobs (Background Functions)
  // ------------------------------------------------------------------
  async createJob({ skriptId = null } = {}) {
    const { data: { user } } = await this.db.auth.getUser();
    const { data, error } = await this.db.from('skript_generation_jobs')
      .insert({ created_by: user?.id, ...(skriptId ? { skript_id: skriptId } : {}) })
      .select().single();
    if (error) throw new Error(`Job-Insert fehlgeschlagen: ${error.message}`);
    return data;
  }

  /**
   * Background Function anstossen. Erfolg = 202/2xx oder 409 (laeuft bereits,
   * z.B. Netlify-Auto-Retry nach Gateway-Fehler). Transiente Gateway-Fehler
   * (408/429/5xx) und Netzwerkabbrueche werden kurz retried: Netlify queued
   * den Job oft trotz 502/503 schon, der atomare Claim serverseitig macht
   * den doppelten Invoke idempotent. Schlagen alle Versuche fehl, wird mit
   * err.transient = true geworfen - der Aufrufer toasted das nicht, weil
   * Poll/Realtime das Ergebnis trotzdem liefern koennen.
   */
  async triggerFunction(name, body, { signal } = {}) {
    const session = await this.db.auth.getSession();
    const token = session?.data?.session?.access_token || '';
    const MAX_VERSUCHE = 3;
    let letzterFehler = null;

    for (let versuch = 1; versuch <= MAX_VERSUCHE; versuch++) {
      if (versuch > 1) await new Promise((r) => setTimeout(r, 400 * 2 ** (versuch - 2)));
      let response;
      try {
        response = await fetch(`/.netlify/functions/${name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
          ...(signal ? { signal } : {})
        });
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        letzterFehler = err;
        continue;
      }
      if (response.ok || response.status === 409) return;
      if (!TRANSIENT_TRIGGER_STATUS.has(response.status)) {
        throw new Error(`Function-Trigger fehlgeschlagen: HTTP ${response.status}`);
      }
      letzterFehler = new Error(`Function-Trigger fehlgeschlagen: HTTP ${response.status}`);
    }

    const err = letzterFehler || new Error('Function-Trigger fehlgeschlagen');
    err.transient = true;
    throw err;
  }

  subscribeToJob(jobId, onUpdate) {
    return this.db
      .channel(`skript-job-${jobId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'skript_generation_jobs',
        filter: `id=eq.${jobId}`
      }, (payload) => onUpdate(payload.new))
      .subscribe();
  }

  async pollJob(jobId) {
    const { data } = await this.db.from('skript_generation_jobs')
      .select('*').eq('id', jobId).single();
    return data;
  }

  /** Client-seitiges Job-Update (z.B. Abbruch). RLS: nur eigene Jobs. */
  async updateJob(jobId, patch) {
    const { error } = await this.db.from('skript_generation_jobs')
      .update(patch).eq('id', jobId);
    if (error) throw new Error(error.message);
  }
}

export const skripteService = new SkripteService();
