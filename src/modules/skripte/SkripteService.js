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

  async loadKampagnen(markeId) {
    let q = this.db.from('kampagne')
      .select('id, kampagnenname, eigener_name, marke_id')
      .order('created_at', { ascending: false });
    if (markeId) q = q.eq('marke_id', markeId);
    const { data } = await q;
    return data || [];
  }

  async loadProdukte(markeId) {
    let q = this.db.from('produkt').select('id, name, marke_id').order('name');
    if (markeId) q = q.eq('marke_id', markeId);
    const { data } = await q;
    return data || [];
  }

  async loadPersonas() {
    const { data } = await this.db.from('personas').select('*').order('name');
    return data || [];
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
      .select('*, unternehmen(firmenname), marke(markenname), kampagne(kampagnenname, eigener_name), produkt(name), personas(name), branchen(name)')
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
      .select('id, version_nr, titel, hook, hauptteil, cta, aenderung_beschreibung, created_at')
      .eq('skript_id', skriptId).order('version_nr');
    return data || [];
  }

  /**
   * Snapshot des uebergebenen Skript-Stands als naechste Version.
   * Legt fuer Bestandsskripte ohne Versionen lazy v1 an (Stand VOR der Aenderung).
   */
  async createVersion(skript, beschreibung, vorherigerStand = null) {
    const { data: { user } } = await this.db.auth.getUser();
    const { data: letzte } = await this.db.from('skript_versionen')
      .select('version_nr').eq('skript_id', skript.id)
      .order('version_nr', { ascending: false }).limit(1);

    const rows = [];
    let nr = letzte?.[0]?.version_nr || 0;

    if (nr === 0 && vorherigerStand) {
      rows.push({
        skript_id: skript.id,
        version_nr: ++nr,
        titel: vorherigerStand.titel || null,
        hook: vorherigerStand.hook || null,
        hauptteil: vorherigerStand.hauptteil || null,
        cta: vorherigerStand.cta || null,
        aenderung_beschreibung: 'Ausgangsversion',
        created_by: user?.id
      });
    }

    rows.push({
      skript_id: skript.id,
      version_nr: ++nr,
      titel: skript.titel || null,
      hook: skript.hook || null,
      hauptteil: skript.hauptteil || null,
      cta: skript.cta || null,
      aenderung_beschreibung: beschreibung || null,
      created_by: user?.id
    });

    const { error } = await this.db.from('skript_versionen').insert(rows);
    if (error) throw new Error(error.message);
    return nr;
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
      .filter((e) => e.score || (e.begruendung || '').trim() || (e.korrigierte_version || '').trim())
      .map((e) => ({
        skript_id: skriptId,
        sektion: e.sektion,
        score: e.score || null,
        begruendung: (e.begruendung || '').trim() || null,
        korrigierte_version: (e.korrigierte_version || '').trim() || null,
        created_by: user?.id
      }));
    if (!rows.length) return 0;
    const { error } = await this.db.from('skript_feedback').insert(rows);
    if (error) throw new Error(error.message);
    await this.updateSkript(skriptId, { status: 'feedback_gegeben' });
    return rows.length;
  }

  // ------------------------------------------------------------------
  // DNA
  // ------------------------------------------------------------------
  /** Aktive DNA-Dokumente fuer die Auswahl im Generator. */
  async loadAktiveDna() {
    const { data } = await this.db.from('skript_dna')
      .select('id, name, layer_typ, version, branchen(name), personas(name), marke(markenname)')
      .eq('status', 'aktiv')
      .order('layer_typ').order('version', { ascending: false });
    return data || [];
  }

  async loadDnaDokumente() {
    const { data } = await this.db.from('skript_dna')
      .select('*, branchen(name), personas(name), marke(markenname)')
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
