// ProduktPersonaService.js
// Datenzugriff fuer die Persona- und Use-Case-Vorschlaege eines Produkts.
//
// Persistenz-Modell (Worksheet-Logik wie Varianten/Bilder): das Panel haelt
// den kompletten Stand im Speicher, erst der Save des Produkts schreibt ihn
// (flushOnSave). Dadurch gilt ein Code-Pfad fuer Create- und Edit-Modus und
// Annehmen/Verwerfen vor dem Save braucht keine compensating writes.
//
// Karten-Schluessel: Use Cases und Karten referenzieren sich ueber
// client-seitige keys (persistierte Zeilen: ihre id, neue: temp-Key). Beim
// Flush werden Use-Case-Keys auf echte IDs gemappt.
//
// Accept-Materialisierung:
//   match -> persona_id liegt vor, fehlende persona_marke-Links der
//            Produkt-Marken werden ergaenzt (die hinzugefuegten werden in
//            payload._attached_marke_ids protokolliert, damit ein
//            Zuruecknehmen genau sie wieder loesen kann)
//   neu   -> Persona aus payload anlegen (unternehmen_id des Produkts,
//            marke_ids wie das Produkt), dann persona_id auf den Vorschlag
//
// Verwerfen/Zuruecknehmen einer akzeptierten neuen Persona: die Persona wird
// hart geloescht, wenn sie unbenutzt ist (keine anderen akzeptierten Links,
// keine Skript-/DNA-Referenz) - sonst bleibt sie stehen.

import { PersonaService } from '../persona/PersonaService.js';

const ENDPOINT = '/.netlify/functions/produkt-persona-background';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 4 * 60 * 1000;

const VORSCHLAG_SELECT = '*, persona:persona_id(*)';

function warte(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emitProgress(detail) {
  document.dispatchEvent(new CustomEvent('produktPersonaProgress', { detail }));
}

function emitFinished(detail) {
  document.dispatchEvent(new CustomEvent('produktPersonaFinished', { detail }));
}

export class ProduktPersonaService {
  // --- Lesen ---

  static async loadUseCases(produktId) {
    const { data, error } = await window.supabase
      .from('produkt_use_case')
      .select('*')
      .eq('produkt_id', produktId)
      .order('position')
      .order('created_at');
    if (error) throw error;
    return data || [];
  }

  /** Offene und akzeptierte Karten, Match-Karten mit eingebetteter Persona. */
  static async loadVorschlaege(produktId) {
    const { data, error } = await window.supabase
      .from('produkt_persona_vorschlag')
      .select(VORSCHLAG_SELECT)
      .eq('produkt_id', produktId)
      .neq('status', 'deleted')
      .order('position')
      .order('created_at');
    if (error) throw error;
    return data || [];
  }

  /** Verworfene Match-IDs: duerfen bei einer Neu-Generierung nicht recycelt werden. */
  static async loadVerworfeneMatchIds(produktId) {
    const { data, error } = await window.supabase
      .from('produkt_persona_vorschlag')
      .select('persona_id')
      .eq('produkt_id', produktId)
      .eq('status', 'deleted')
      .eq('typ', 'match');
    if (error) throw error;
    return (data || []).map(r => r.persona_id).filter(Boolean);
  }

  // --- Generierungs-Job ---

  /**
   * Legt die Job-Zeile an, stoesst die Background Function an und pollt bis
   * done/error. Fortschritt laeuft als produktPersonaProgress-Events (das
   * Extract-Panel rendert sie als Liky-Steps mit).
   *
   * @param {Object} opts
   * @param {string|null} opts.produktId
   * @param {string|null} opts.unternehmenId
   * @param {Object} opts.input - Snapshot: felder, marke_ids, modus, ...
   * @returns {Promise<Object>} result-Payload des Jobs
   */
  static async starteJob({ produktId = null, unternehmenId = null, input }) {
    const db = window.supabase;
    const session = await this.getSession();
    if (!db || !session) throw new Error('Keine aktive Sitzung');

    emitProgress({ step: 'start', label: 'Persona-Vorschläge sind unterwegs…' });

    const { data: job, error: insertError } = await db.from('produkt_persona_jobs')
      .insert({
        produkt_id: produktId,
        unternehmen_id: unternehmenId,
        input,
        created_by: session.user.id
      })
      .select('id').single();
    if (insertError) throw new Error(`Job konnte nicht angelegt werden: ${insertError.message}`);

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ jobId: job.id })
    });
    if (response.status !== 202 && !response.ok) {
      const err = new Error(`Generierung konnte nicht gestartet werden (HTTP ${response.status})`);
      emitFinished({ ok: false });
      throw err;
    }

    try {
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      let letzterStep = null;

      while (Date.now() < deadline) {
        await warte(POLL_INTERVAL_MS);

        const { data: row, error: pollError } = await db.from('produkt_persona_jobs')
          .select('status, progress_step, progress_steps, result, error_message')
          .eq('id', job.id).maybeSingle();
        if (pollError || !row) continue;

        if (row.status === 'done') {
          const payload = row.result || {};
          if (!payload.success) throw new Error(payload.error || 'Generierung ohne Ergebnis beendet');
          emitFinished({ ok: true, anzahl: payload.vorschlaege?.length || 0 });
          return payload;
        }

        if (row.status === 'error') {
          throw new Error(row.error_message || 'Generierung fehlgeschlagen');
        }

        if (row.progress_step && row.progress_step !== letzterStep) {
          letzterStep = row.progress_step;
          const steps = Array.isArray(row.progress_steps) ? row.progress_steps : [];
          const last = steps[steps.length - 1];
          emitProgress({
            step: last?.step || row.progress_step,
            label: last?.label || 'Ich arbeite',
            steps
          });
        }
      }

      throw new Error('Zeitlimit erreicht – die Generierung läuft ungewöhnlich lange. Bitte später erneut versuchen.');
    } catch (err) {
      emitFinished({ ok: false });
      throw err;
    }
  }

  static async getSession() {
    let { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
      await new Promise(r => setTimeout(r, 500));
      ({ data: { session } } = await window.supabase.auth.getSession());
    }
    return session;
  }

  // --- Flush beim Produkt-Save ---

  /**
   * Schreibt den Panel-Stand. Reihenfolge: erst Use Cases (Karten brauchen
   * die echten IDs), dann Karten, dabei Accept-Materialisierung und
   * compensating writes fuer zurueckgenommene/verworfene Karten.
   *
   * @returns {Promise<{useCases: Array, karten: Array}>} Stand mit echten IDs
   */
  static async flushOnSave(produktId, { useCases = [], karten = [], verworfeneMatchIds = [] }, { unternehmenId = null, markeIds = [] } = {}) {
    const keyToId = await this.syncUseCases(produktId, useCases);

    const ergebnisKarten = [];
    for (const [index, karte] of karten.entries()) {
      const geflusht = await this.flushKarte(produktId, karte, {
        position: index,
        keyToId,
        unternehmenId,
        markeIds
      });
      if (geflusht) ergebnisKarten.push(geflusht);
    }

    await this.flushVerworfeneMatches(produktId, verworfeneMatchIds, karten);

    const ergebnisUseCases = useCases
      .filter(uc => !uc.deleted)
      .map((uc, i) => ({ ...uc, id: keyToId.get(uc.key) || uc.id || null, position: i, deleted: false }));

    return { useCases: ergebnisUseCases, karten: ergebnisKarten };
  }

  /**
   * Verworfene Match-IDs ohne eigene Karten-Zeile als deleted-Rows
   * festhalten, damit eine spaetere Generierung sie nicht recycelt
   * (loadVerworfeneMatchIds liest genau diese Zeilen).
   */
  static async flushVerworfeneMatches(produktId, verworfeneMatchIds = [], karten = []) {
    const ids = [...new Set((verworfeneMatchIds || []).filter(Boolean))];
    if (!ids.length) return;

    // Karten mit eigener Zeile setzen ihren deleted-Status ueber flushKarte
    const gedeckt = new Set(karten.filter(k => k.id && k.persona_id).map(k => k.persona_id));
    const bereitsDeleted = new Set(await this.loadVerworfeneMatchIds(produktId));

    const fehlende = ids.filter(id => !gedeckt.has(id) && !bereitsDeleted.has(id));
    if (!fehlende.length) return;

    const { error } = await window.supabase
      .from('produkt_persona_vorschlag')
      .insert(fehlende.map(persona_id => ({
        produkt_id: produktId,
        typ: 'match',
        status: 'deleted',
        persona_id
      })));
    if (error) throw error;
  }

  /** Sync wie saveVarianten: fehlende loeschen, vorhandene updaten, neue einfuegen. */
  static async syncUseCases(produktId, useCases) {
    const bestehende = await this.loadUseCases(produktId);
    const aktive = useCases.filter(uc => !uc.deleted && String(uc.name || '').trim());

    const keyToId = new Map();
    const finalIds = [];
    for (const [index, uc] of aktive.entries()) {
      const payload = {
        produkt_id: produktId,
        name: String(uc.name).trim(),
        beschreibung: uc.beschreibung?.trim() || null,
        position: index
      };

      let id = uc.id || null;

      // Retry-Schutz: nach einem Teilerfolg (z.B. Abbruch mitten im Flush)
      // eine gleichnamige Zeile adoptieren statt sie doppelt einzufuegen
      if (!id) {
        const adoptiert = bestehende.find(b => b.name === payload.name && !finalIds.includes(b.id));
        if (adoptiert) id = adoptiert.id;
      }

      if (id) {
        const { error } = await window.supabase
          .from('produkt_use_case')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await window.supabase
          .from('produkt_use_case')
          .insert([payload])
          .select('id').single();
        if (error) throw error;
        id = data.id;
      }

      keyToId.set(uc.key, id);
      finalIds.push(id);
    }

    // Erst nach dem Schreiben loeschen: adoptierte Zeilen duerfen nicht
    // im Loeschender landen
    const zuLoeschen = bestehende.filter(uc => !finalIds.includes(uc.id)).map(uc => uc.id);
    if (zuLoeschen.length) {
      const { error } = await window.supabase
        .from('produkt_use_case')
        .delete()
        .in('id', zuLoeschen);
      if (error) throw error;
    }

    // Geloeschte Use Cases duerfen nicht mehr referenziert werden - das
    // filtern der use_case_ids passiert in flushKarte ueber keyToId.
    return keyToId;
  }

  /**
   * Eine Karte schreiben. Gibt den Karten-Stand nach dem Flush zurueck
   * (oder null, wenn eine unpersistierte Karte verworfen wurde).
   */
  static async flushKarte(produktId, karte, { position, keyToId, unternehmenId, markeIds }) {
    const useCaseIds = (karte.useCaseKeys || [])
      .map(key => keyToId.get(key) || (this.isUuid(key) ? key : null))
      .filter(Boolean);

    const warAkzeptiert = karte.persisted?.status === 'accepted';

    // --- Verworfen ---
    if (karte.status === 'deleted') {
      if (!karte.id) return null;
      if (warAkzeptiert) await this.dematerialize(karte);
      const { error } = await window.supabase
        .from('produkt_persona_vorschlag')
        .update({ status: 'deleted' })
        .eq('id', karte.id);
      if (error) throw error;
      return null;
    }

    // --- Akzeptiert ---
    if (karte.status === 'accepted') {
      let personaId = karte.persona_id;
      let payload = karte.payload || null;

      if (!warAkzeptiert) {
        const materialisiert = await this.materialize(karte, { unternehmenId, markeIds });
        personaId = materialisiert.personaId;
        payload = materialisiert.payload;
      }

      const row = {
        produkt_id: produktId,
        typ: karte.typ,
        status: 'accepted',
        persona_id: personaId,
        payload,
        fit_grund: karte.fit_grund || null,
        use_case_ids: useCaseIds,
        position
      };
      const id = await this.upsertVorschlag(karte.id, row);
      return { ...karte, id, persona_id: personaId, payload, persisted: { status: 'accepted', persona_id: personaId } };
    }

    // --- Pending ---
    // Zurueckgenommene Karte: Akzeptanz rueckgaengig machen
    let personaId = karte.persona_id;
    let payload = karte.payload || null;
    if (warAkzeptiert) {
      const demat = await this.dematerialize(karte);
      personaId = demat.personaId;
      payload = demat.payload;
    }

    const row = {
      produkt_id: produktId,
      typ: karte.typ,
      status: 'pending',
      persona_id: personaId,
      payload,
      fit_grund: karte.fit_grund || null,
      use_case_ids: useCaseIds,
      position
    };
    const id = await this.upsertVorschlag(karte.id, row);
    return { ...karte, id, persona_id: personaId, payload, persisted: { status: 'pending', persona_id: personaId } };
  }

  static async upsertVorschlag(id, row) {
    if (id) {
      const { error } = await window.supabase
        .from('produkt_persona_vorschlag')
        .update(row)
        .eq('id', id);
      if (error) throw error;
      return id;
    }

    // Retry-Schutz wie bei den Use Cases: nach einem Teilerfolg des Flushs
    // die bestehende Zeile desselben Ursprungs adoptieren
    let dedupe = window.supabase
      .from('produkt_persona_vorschlag')
      .select('id')
      .eq('produkt_id', row.produkt_id)
      .eq('typ', row.typ)
      .neq('status', 'deleted');
    if (row.typ === 'match' && row.persona_id) {
      dedupe = dedupe.eq('persona_id', row.persona_id);
    } else {
      dedupe = dedupe.eq('payload->>name', row.payload?.name || '');
    }
    const { data: vorhandene } = await dedupe.limit(1);
    if (vorhandene?.length) {
      const { error } = await window.supabase
        .from('produkt_persona_vorschlag')
        .update(row)
        .eq('id', vorhandene[0].id);
      if (error) throw error;
      return vorhandene[0].id;
    }

    const { data, error } = await window.supabase
      .from('produkt_persona_vorschlag')
      .insert([row])
      .select('id').single();
    if (error) throw error;
    return data.id;
  }

  /**
   * Accept materialisieren: Match = fehlende Marken-Links, Neu = Persona
   * anlegen (oder wiederverwenden, wenn die Karte schon einmal akzeptiert war).
   */
  static async materialize(karte, { unternehmenId, markeIds }) {
    if (karte.typ === 'match') {
      const attached = await this.attachPersonaMarken(karte.persona_id, markeIds);
      const payload = { ...(karte.payload || {}), _attached_marke_ids: attached };
      return { personaId: karte.persona_id, payload };
    }

    // neu
    if (karte.persona_id) {
      // Re-Accept nach Zuruecknehmen: die Persona existiert noch
      const attached = await this.attachPersonaMarken(karte.persona_id, markeIds);
      const payload = { ...(karte.payload || {}), _attached_marke_ids: attached };
      return { personaId: karte.persona_id, payload };
    }

    // Interne Meta-Keys (_luecken_begruendung, _attached_marke_ids) gehoeren
    // nicht in die personas-Tabelle
    const personaPayload = Object.fromEntries(
      Object.entries(karte.payload || {}).filter(([key]) => !key.startsWith('_'))
    );
    const result = await PersonaService.create(personaPayload, { unternehmenId });
    if (!result?.id) throw new Error('Persona konnte nicht angelegt werden');

    await PersonaService.saveMarken(result.id, markeIds);
    const payload = { ...(karte.payload || {}), _attached_marke_ids: [...markeIds] };
    return { personaId: result.id, payload };
  }

  /**
   * Akzeptanz rueckgaengig: Match verliert die durch den Accept hinzugefuegten
   * Marken-Links, Neu verliert die Persona, wenn sie unbenutzt ist.
   * Gibt { personaId, payload } fuer den weiteren Verbleib der Karte zurueck.
   */
  static async dematerialize(karte) {
    const payload = { ...(karte.payload || {}) };
    const attached = Array.isArray(payload._attached_marke_ids) ? payload._attached_marke_ids : [];

    if (attached.length && karte.persona_id) {
      await window.supabase
        .from('persona_marke')
        .delete()
        .eq('persona_id', karte.persona_id)
        .in('marke_id', attached);
    }
    delete payload._attached_marke_ids;

    if (karte.typ === 'neu' && karte.persona_id) {
      const unbenutzt = await this.personaUnbenutzt(karte.persona_id, karte.id);
      if (unbenutzt) {
        // Erst die Karte von der Persona loesen - sonst rafft die CASCADE
        // die Vorschlags-Zeile mit weg
        if (karte.id) {
          const { error } = await window.supabase
            .from('produkt_persona_vorschlag')
            .update({ persona_id: null })
            .eq('id', karte.id);
          if (error) throw error;
        }
        await PersonaService.remove(karte.persona_id);
        return { personaId: null, payload };
      }
    }

    return { personaId: karte.persona_id, payload };
  }

  /**
   * Fehlende persona_marke-Links ergaenzen.
   * @returns {Promise<string[]>} die tatsaechlich NEU angelegten marke_ids
   */
  static async attachPersonaMarken(personaId, markeIds = []) {
    const eindeutige = [...new Set((markeIds || []).filter(Boolean))];
    if (!personaId || !eindeutige.length) return [];

    const { data: vorhandene, error } = await window.supabase
      .from('persona_marke')
      .select('marke_id')
      .eq('persona_id', personaId)
      .in('marke_id', eindeutige);
    if (error) throw error;

    const vorhandenSet = new Set((vorhandene || []).map(r => r.marke_id));
    const fehlende = eindeutige.filter(id => !vorhandenSet.has(id));
    if (!fehlende.length) return [];

    const { error: insertError } = await window.supabase
      .from('persona_marke')
      .insert(fehlende.map(marke_id => ({ persona_id: personaId, marke_id })));
    if (insertError) throw insertError;
    return fehlende;
  }

  /** Unbenutzt = kein anderer akzeptierter Link, kein Skript, keine DNA. */
  static async personaUnbenutzt(personaId, eigeneVorschlagId = null) {
    let linkQuery = window.supabase
      .from('produkt_persona_vorschlag')
      .select('id', { count: 'exact', head: true })
      .eq('persona_id', personaId)
      .eq('status', 'accepted');
    if (eigeneVorschlagId) linkQuery = linkQuery.neq('id', eigeneVorschlagId);

    const [links, skripte, dna] = await Promise.all([
      linkQuery,
      window.supabase.from('skripte').select('id', { count: 'exact', head: true }).eq('persona_id', personaId),
      window.supabase.from('skript_dna').select('id', { count: 'exact', head: true }).eq('persona_id', personaId)
    ]);

    return !(links.count > 0 || skripte.count > 0 || dna.count > 0);
  }

  static isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
  }
}
