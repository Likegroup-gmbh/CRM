// skripteGeneratorDaten.js
// Import, Generator-Stub mit Briefing-Vorgaben und Background-Jobs
// (Prototype-Mixin von SkripteService)

import { briefingVorgaben } from '../briefingVorgaben.js';
import { funnelAusSkript } from '../../strategie/strategieFunnelOptions.js';

// Gateway-/Last-Fehler beim Function-Invoke, bei denen ein Retry sinnvoll ist
const TRANSIENT_TRIGGER_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export const skripteGeneratorDatenMethoden = {
  async importSkript(payload) {
    const { data: { user } } = await this.db.auth.getUser();
    const { data, error } = await this.db.from('skripte')
      .insert({ ...payload, herkunft: 'historisch', status: 'final', created_by: user?.id })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Stub fuer die Rueckfragen-Phase: Skript-Row mit allen Generator-Vorgaben,
   * aber ohne Inhalt (status 'fragen'). Der volle Generator-Payload wird in
   * prompt_kontext gemerkt, damit Rueckfragen + finale Generierung ihn auch
   * nach einem Reload noch haben.
   */
  async createSkriptStub(payload) {
    const { data: { user } } = await this.db.auth.getUser();
    const enriched = await this._enrichPayloadFromBriefing(payload);
    const { data, error } = await this.db.from('skripte').insert({
      titel: enriched.video_idee ? enriched.video_idee.slice(0, 60) : null,
      unternehmen_id: enriched.unternehmen_id || null,
      marke_id: enriched.marke_id || null,
      kampagne_id: enriched.kampagne_id || null,
      produktion_id: enriched.produktion_id || null,
      produkt_id: enriched.produkt_id || null,
      persona_id: enriched.persona_id || null,
      branche_id: enriched.branche_id || null,
      briefing_id: enriched.briefing_id || null,
      bereich: enriched.bereich || null,
      strategie_item_id: enriched.strategie_item_id || null,
      video_idee: enriched.video_idee || null,
      location: null,
      regieanweisung: null,
      video_laenge: enriched.video_laenge || null,
      funnel_stufe: enriched.funnel_stufe || null,
      tonalitaet: enriched.tonalitaet || null,
      herkunft: 'generiert',
      status: 'fragen',
      prompt_kontext: { generator_payload: enriched },
      created_by: user?.id
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Laenge/Bereich aus dem Briefing ziehen, wenn der Caller sie nicht schon
   * gesetzt hat (Create-Drawer uebergibt nur die Idee). Die Funnel-Stufe kommt
   * aus der Videoidee im Konzept (resolveSkriptCreatePayload), nie aus dem Briefing.
   */
  async _enrichPayloadFromBriefing(payload) {
    const next = { ...payload };
    const briefing = payload.briefing
      || (payload.briefing_id ? await this._loadBriefingVorgaben(payload.briefing_id) : null);
    if (!briefing) return next;

    // payload.funnel_stufe ist der Skript-Schlüssel (top/mid/bottom), das Briefing
    // kennt upper/mid/lower.
    const vorgaben = briefingVorgaben(briefing, funnelAusSkript(next.funnel_stufe));
    if (!next.bereich) next.bereich = briefing.bereich || null;
    if (!next.video_laenge) next.video_laenge = vorgaben.video_laenge;
    delete next.briefing;
    return next;
  },

  async _loadBriefingVorgaben(briefingId) {
    const { data, error } = await this.db.from('campaign_briefings')
      .select('id, aktivierung_name, bereich, im_funnel_stufen, pa_funnel_stufen, pa_videolaengen, videolaengen, videolaenge_text, videolaenge_von, videolaenge_bis, videolaenge_funnel, im_formatvorgaben, os_formatvorgaben')
      .eq('id', briefingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

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
      prompt_kontext: { ...(existing?.prompt_kontext || {}), generator_payload: payload }
    }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Aufbau-Flags (mit_rezept / mit_text_hook) in den generator_payload
   * mergen - gleicher Merge-Ansatz wie updateSkriptStub, aber ohne die
   * uebrigen Stub-Felder anzufassen.
   */
  async updateGeneratorFlags(id, flags) {
    const { data: existing } = await this.db.from('skripte')
      .select('prompt_kontext').eq('id', id).single();
    const pk = existing?.prompt_kontext || {};
    const { error } = await this.db.from('skripte').update({
      prompt_kontext: { ...pk, generator_payload: { ...(pk.generator_payload || {}), ...flags } }
    }).eq('id', id);
    if (error) throw new Error(error.message);
  },

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
  },

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
  },

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
  },

  async pollJob(jobId) {
    const { data } = await this.db.from('skript_generation_jobs')
      .select('*').eq('id', jobId).single();
    return data;
  },

  /** Client-seitiges Job-Update (z.B. Abbruch). RLS: nur eigene Jobs. */
  async updateJob(jobId, patch) {
    const { error } = await this.db.from('skript_generation_jobs')
      .update(patch).eq('id', jobId);
    if (error) throw new Error(error.message);
  },
};
