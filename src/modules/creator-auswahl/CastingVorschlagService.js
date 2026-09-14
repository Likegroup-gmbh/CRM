// CastingVorschlagService.js
// Client-Orchestrierung der KI-Creator-Vorschlaege eines Castings (ADR 0013).
//
// Anders als das Persona-Worksheet gibt es hier kein ungespeichertes
// Dokument: das Casting existiert, der Job schreibt pending-Zeilen sofort.
// Aktivieren legt den Casting-Eintrag mit creator_id an und setzt den
// Vorschlag auf accepted; Verwerfen gilt nur fuer dieses Casting.

import { creatorAuswahlService } from './CreatorAuswahlService.js';

const ENDPOINT = '/.netlify/functions/casting-vorschlag-background';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 4 * 60 * 1000;

const VORSCHLAG_SELECT = '*, creator:creator_id(id, vorname, nachname, instagram, tiktok, instagram_follower, tiktok_follower, profilbild_thumb_url)';

function warte(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emitProgress(detail) {
  document.dispatchEvent(new CustomEvent('castingVorschlagProgress', { detail }));
}

function emitFinished(detail) {
  document.dispatchEvent(new CustomEvent('castingVorschlagFinished', { detail }));
}

export const SLOT_LABELS = {
  proven: 'Bewährt',
  tight: 'Passgenau',
  adjacent: 'Nachbar',
  explore: 'Neu'
};

export class CastingVorschlagService {
  // --- Lesen ---

  static async loadVorschlaege(castingId) {
    const { data, error } = await window.supabase
      .from('casting_vorschlag')
      .select(VORSCHLAG_SELECT)
      .eq('casting_id', castingId)
      .eq('status', 'pending')
      .order('position')
      .order('created_at');
    if (error) throw error;
    return data || [];
  }

  // --- Generierungs-Job ---

  /**
   * Legt die Job-Zeile an, stoesst die Background Function an und pollt bis
   * done/error. Ersetzt nur pending-Zeilen; aktivierte bleiben Covered-Set.
   */
  static async starteJob({ castingId, input = {} }) {
    const db = window.supabase;
    const session = await this.getSession();
    if (!db || !session) throw new Error('Keine aktive Sitzung');

    emitProgress({ step: 'start', label: 'Creator-Vorschläge sind unterwegs…' });

    const { data: job, error: insertError } = await db.from('casting_vorschlag_jobs')
      .insert({
        casting_id: castingId,
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

        const { data: row, error: pollError } = await db.from('casting_vorschlag_jobs')
          .select('status, progress_step, progress_steps, result, error_message')
          .eq('id', job.id).maybeSingle();
        if (pollError || !row) continue;

        if (row.status === 'done') {
          const payload = row.result || {};
          if (!payload.success) throw new Error(payload.error || 'Generierung ohne Ergebnis beendet');
          emitFinished({ ok: true, anzahl: payload.anzahl || 0 });
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

  // --- Aktivieren / Verwerfen ---

  /**
   * Macht aus dem Vorschlag einen Casting-Eintrag mit creator_id (Kategorie:
   * kategorie_hint, wenn sie noch existiert, sonst Ohne Kategorie) und setzt
   * den Vorschlag auf accepted. Gibt das angelegte Item zurueck.
   */
  static async aktivieren(vorschlag, { listeId, listeTyp, kategorien = [] } = {}) {
    if (!vorschlag?.creator_id) throw new Error('Vorschlag ohne Creator');

    const { data: creator, error } = await window.supabase
      .from('creator')
      .select(`*, creator_creator_type(creator_type_id(id,name))`)
      .eq('id', vorschlag.creator_id)
      .single();
    if (error || !creator) throw new Error('Creator nicht gefunden');

    const typen = (creator.creator_creator_type || [])
      .map(j => j?.creator_type_id?.name).filter(Boolean);
    const erlaubterTyp = typen.find(t => ['UGC Paid', 'UGC Organic', 'Influencer', 'Vor-Ort-Produktion', 'Videograf', 'Model'].includes(t));
    const fallbackTyp = String(listeTyp || '').toLowerCase() === 'influencer' ? 'Influencer' : 'UGC Paid';

    const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim() || null;
    const kategorie = vorschlag.kategorie_hint && kategorien.includes(vorschlag.kategorie_hint)
      ? vorschlag.kategorie_hint
      : null;

    const itemData = {
      creator_auswahl_id: listeId,
      typ: erlaubterTyp || fallbackTyp,
      name,
      link_instagram: creator.instagram || null,
      follower_instagram: Number(creator.instagram_follower) || null,
      link_tiktok: creator.tiktok || null,
      follower_tiktok: Number(creator.tiktok_follower) || null,
      kategorie,
      wohnort: creator.lieferadresse_stadt || null,
      email: creator.mail || null,
      telefon: creator.telefonnummer || null,
      notiz: creator.notiz || null,
      creator_id: creator.id
    };

    const item = await creatorAuswahlService.createItem(itemData);

    const { error: updateError } = await window.supabase
      .from('casting_vorschlag')
      .update({ status: 'accepted' })
      .eq('id', vorschlag.id);
    if (updateError) throw updateError;

    return item;
  }

  /** Verwerfen gilt nur fuer dieses Casting, nicht als Marken-Abgelehnt. */
  static async verwerfen(vorschlagId) {
    const { error } = await window.supabase
      .from('casting_vorschlag')
      .update({ status: 'deleted' })
      .eq('id', vorschlagId);
    if (error) throw error;
  }
}
