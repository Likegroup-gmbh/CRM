// SkripteService.js
// Datenzugriff fuer den Skript-Generator (Layer 1).
// Alle Queries laufen ueber window.supabase (RLS: intern only).

export const SEKTIONEN = ['hook', 'hauptteil', 'cta', 'gesamt'];

export const PERFORMANCE_LABELS = {
  unbewertet: 'Unbewertet',
  erfolgreich: 'Erfolgreich',
  nicht_erfolgreich: 'Nicht erfolgreich',
  viral: 'Viral'
};

export const FUNNEL_STUFEN = {
  top: 'Top (Awareness)',
  mid: 'Mid (Consideration)',
  bottom: 'Bottom (Conversion)'
};

// Video-Gesamtlaenge in 15-Sekunden-Spannen (Wert = Sekunden "von-bis")
export const VIDEO_LAENGEN = {
  '0-15': '0–15 Sek.',
  '15-30': '15–30 Sek.',
  '30-45': '30–45 Sek.',
  '45-60': '45–60 Sek.',
  '60-75': '1:00–1:15 Min.',
  '75-90': '1:15–1:30 Min.',
  '90-105': '1:30–1:45 Min.',
  '105-120': '1:45–2:00 Min.',
  '120-135': '2:00–2:15 Min.',
  '135-150': '2:15–2:30 Min.',
  '150-165': '2:30–2:45 Min.',
  '165-180': '2:45–3:00 Min.'
};

export const DNA_LAYER = {
  global: 'Global',
  branche: 'Branche',
  zielgruppe: 'Zielgruppe',
  marke: 'Marke'
};

export class SkripteService {
  get db() {
    return window.supabase;
  }

  // ------------------------------------------------------------------
  // Stammdaten fuer Pick-and-pull
  // ------------------------------------------------------------------
  async loadUnternehmen() {
    const { data } = await this.db.from('unternehmen')
      .select('id, firmenname, branche_id').order('firmenname');
    return data || [];
  }

  async loadMarken(unternehmenId) {
    let q = this.db.from('marke')
      .select('id, markenname, branche_id, unternehmen_id').order('markenname');
    if (unternehmenId) q = q.eq('unternehmen_id', unternehmenId);
    const { data } = await q;
    return data || [];
  }

  /**
   * Kampagnen zum Kontext: mit Marke nach marke_id gefiltert, ohne Marke
   * (Unternehmen ohne Marken bzw. "Keine" gewaehlt) nach unternehmen_id.
   */
  async loadKampagnen({ markeId = null, unternehmenId = null } = {}) {
    let q = this.db.from('kampagne')
      .select('id, kampagnenname, eigener_name, marke_id, unternehmen_id')
      .order('created_at', { ascending: false });
    if (markeId) q = q.eq('marke_id', markeId);
    else if (unternehmenId) q = q.eq('unternehmen_id', unternehmenId);
    const { data } = await q;
    return data || [];
  }

  async loadProdukte({ markeId = null, unternehmenId = null } = {}) {
    let q = this.db.from('produkt').select('id, name, marke_id, unternehmen_id').order('name');
    if (markeId) q = q.eq('marke_id', markeId);
    else if (unternehmenId) q = q.eq('unternehmen_id', unternehmenId);
    const { data } = await q;
    return data || [];
  }

  async loadPersonas() {
    const { data } = await this.db.from('personas').select('*')
      .order('oberbegriff', { nullsFirst: false }).order('name');
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
    const { data } = await this.db.from('skripte')
      .select('id, titel, unternehmen_id, marke_id, kampagne_id, branche_id, hook, hauptteil, cta, herkunft, performance_label, status, mit_dna, model, funnel_stufe, created_at, unternehmen(firmenname), marke(markenname), branchen(name)')
      .order('created_at', { ascending: false })
      .limit(200);
    return data || [];
  }

  async loadSkript(id) {
    const { data } = await this.db.from('skripte')
      .select('*, unternehmen(firmenname), marke(markenname), kampagne(kampagnenname, eigener_name), produkt(name), personas(name, oberbegriff), branchen(name)')
      .eq('id', id).single();
    return data;
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

  // ------------------------------------------------------------------
  // Editor: Chat-Messages (Assistant-Message = Job, Status via Realtime)
  // ------------------------------------------------------------------
  async getChatMessages(skriptId) {
    const { data } = await this.db.from('skript_chat_messages')
      .select('*').eq('skript_id', skriptId).order('created_at');
    return data || [];
  }

  async createChatMessage(payload) {
    const { data: { user } } = await this.db.auth.getUser();
    const { data, error } = await this.db.from('skript_chat_messages')
      .insert({ ...payload, created_by: user?.id }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateChatMessage(id, patch) {
    const { error } = await this.db.from('skript_chat_messages').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
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
    const { data } = await this.db.from('skript_versionen')
      .select('id, version_nr, sub_nr, titel, hook, hauptteil, cta, aenderung_beschreibung, created_at')
      .eq('skript_id', skriptId).order('version_nr').order('sub_nr');
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
    const versionen = vorhandene || [];

    const rows = [];
    const maxHaupt = versionen.length ? Math.max(...versionen.map((v) => v.version_nr)) : 0;

    if (maxHaupt === 0 && vorherigerStand) {
      rows.push({
        skript_id: skript.id,
        version_nr: 1,
        sub_nr: 0,
        titel: vorherigerStand.titel || null,
        hook: vorherigerStand.hook || null,
        hauptteil: vorherigerStand.hauptteil || null,
        cta: vorherigerStand.cta || null,
        aenderung_beschreibung: 'Ausgangsversion',
        created_by: user?.id
      });
    }

    // Neue Nummer bestimmen: Hauptversion, wenn an der neuesten Hauptversion
    // gearbeitet wurde (oder keine Angabe) - sonst Unterversion der aktiven Version
    let neu;
    const basisHaupt = rows.length ? 1 : maxHaupt;
    const aufNeuesterHaupt = !aktiveVersion
      || (aktiveVersion.version_nr === basisHaupt && !(aktiveVersion.sub_nr > 0));
    if (basisHaupt === 0 || aufNeuesterHaupt) {
      neu = { version_nr: basisHaupt + 1, sub_nr: 0 };
    } else {
      const maxSub = Math.max(0, ...versionen
        .filter((v) => v.version_nr === aktiveVersion.version_nr)
        .map((v) => v.sub_nr || 0));
      neu = { version_nr: aktiveVersion.version_nr, sub_nr: maxSub + 1 };
    }

    rows.push({
      skript_id: skript.id,
      version_nr: neu.version_nr,
      sub_nr: neu.sub_nr,
      titel: skript.titel || null,
      hook: skript.hook || null,
      hauptteil: skript.hauptteil || null,
      cta: skript.cta || null,
      aenderung_beschreibung: beschreibung || null,
      created_by: user?.id
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
      aktive_version_nr: version.version_nr,
      aktive_sub_nr: version.sub_nr || 0
    });
  }

  // ------------------------------------------------------------------
  // Feedback
  // ------------------------------------------------------------------
  async loadFeedback(skriptId) {
    const { data } = await this.db.from('skript_feedback')
      .select('*').eq('skript_id', skriptId).order('created_at');
    return data || [];
  }

  async saveFeedback(skriptId, eintraege) {
    const { data: { user } } = await this.db.auth.getUser();
    const rows = eintraege
      .filter((e) => e.score != null || (e.begruendung || '').trim() || (e.korrigierte_version || '').trim())
      .map((e) => ({
        skript_id: skriptId,
        sektion: e.sektion,
        score: e.score ?? null,
        begruendung: (e.begruendung || '').trim() || null,
        korrigierte_version: (e.korrigierte_version || '').trim() || null,
        selektion_text: (e.selektion_text || '').trim() || null,
        version_nr: e.version_nr ?? null,
        chat_message_id: e.chat_message_id || null,
        created_by: user?.id
      }));
    if (!rows.length) return [];
    const { data, error } = await this.db.from('skript_feedback').insert(rows).select();
    if (error) throw new Error(error.message);
    await this.updateSkript(skriptId, { status: 'feedback_gegeben' });
    return data || [];
  }

  /** Nachtraeglicher Patch an einem Feedback-Eintrag (z.B. chat_message_id). */
  async updateFeedback(id, patch) {
    const { error } = await this.db.from('skript_feedback').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
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
  // Jobs (Background Functions)
  // ------------------------------------------------------------------
  async createJob() {
    const { data: { user } } = await this.db.auth.getUser();
    const { data, error } = await this.db.from('skript_generation_jobs')
      .insert({ created_by: user?.id }).select().single();
    if (error) throw new Error(`Job-Insert fehlgeschlagen: ${error.message}`);
    return data;
  }

  async triggerFunction(name, body) {
    const session = await this.db.auth.getSession();
    const token = session?.data?.session?.access_token || '';
    const response = await fetch(`/.netlify/functions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    if (response.status !== 202 && !response.ok) {
      throw new Error(`Function-Trigger fehlgeschlagen: HTTP ${response.status}`);
    }
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

  // ------------------------------------------------------------------
  // Auswertung: Score-Trend + Blindvergleich
  // ------------------------------------------------------------------
  async loadAuswertung() {
    const { data: feedback } = await this.db.from('skript_feedback')
      .select('sektion, score, created_at, skript_id').not('score', 'is', null);
    const { data: skripte } = await this.db.from('skripte')
      .select('id, mit_dna, herkunft');
    return { feedback: feedback || [], skripte: skripte || [] };
  }
}

export const skripteService = new SkripteService();
