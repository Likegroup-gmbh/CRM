// VideoideeVorschlagService.js
// Client-Orchestrierung der KI-Videoideen eines Konzepts (ADR 0015).
// Das Konzept existiert; der Job inseriert flagged strategie_items.
// Uebernehmen nimmt das Flag, Verwerfen loescht die Zeile. Weitere addiert.

import { deleteStrategieItem } from './service/strategieItems.js';

const ENDPOINT = '/.netlify/functions/strategie-idee-background';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 4 * 60 * 1000;
/** Function hat den Job nicht angefasst (Auth-504, Worker-Crash, Env). */
export const JOB_START_WATCHDOG_MS = 25 * 1000;

function warte(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emitProgress(detail) {
  document.dispatchEvent(new CustomEvent('videoideeVorschlagProgress', { detail }));
}

function emitFinished(detail) {
  document.dispatchEvent(new CustomEvent('videoideeVorschlagFinished', { detail }));
}

export class VideoideeVorschlagService {
  /**
   * Legt die Job-Zeile an, stoesst die Background Function an und pollt bis
   * done/error. Additiv: bestehende Vorschlaege bleiben.
   */
  static async starteJob({ strategieId, input = {} }) {
    const db = window.supabase;
    const session = await this.getSession();
    if (!db || !session) throw new Error('Keine aktive Sitzung');

    emitProgress({ step: 'start', label: 'Videoideen sind unterwegs…' });

    const { data: job, error: insertError } = await db.from('strategie_idee_jobs')
      .insert({
        strategie_id: strategieId,
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
      const startedAt = Date.now();
      const deadline = startedAt + POLL_TIMEOUT_MS;
      let letzterStep = null;

      while (Date.now() < deadline) {
        await warte(POLL_INTERVAL_MS);

        const { data: row, error: pollError } = await db.from('strategie_idee_jobs')
          .select('status, progress_step, progress_steps, result, error_message')
          .eq('id', job.id).maybeSingle();
        if (pollError || !row) continue;

        if (row.status === 'pending' && !row.progress_step
          && Date.now() - startedAt >= JOB_START_WATCHDOG_MS) {
          throw new Error('Die Generierung ist nicht angelaufen. Bitte nochmal versuchen.');
        }

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

  /**
   * Videoidee-Vorschlag zur normalen Videoidee machen (ADR 0015).
   * Flag weg, landet in Ohne Kategorie.
   */
  static async uebernehmen(itemId) {
    const { data, error } = await window.supabase
      .from('strategie_items')
      .update({ ist_vorschlag: false, teilbereich: null })
      .eq('id', itemId)
      .eq('ist_vorschlag', true)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('Kein Videoidee-Vorschlag');
    return data;
  }

  static async uebernehmenAlle(strategieId) {
    const { data, error } = await window.supabase
      .from('strategie_items')
      .update({ ist_vorschlag: false, teilbereich: null })
      .eq('strategie_id', strategieId)
      .eq('ist_vorschlag', true)
      .select('id');
    if (error) throw error;
    return data || [];
  }

  static async verwerfen(itemId) {
    const { data, error } = await window.supabase
      .from('strategie_items')
      .select('id, ist_vorschlag')
      .eq('id', itemId)
      .single();
    if (error || !data) throw new Error('Videoidee nicht gefunden');
    if (!data.ist_vorschlag) throw new Error('Nur Videoidee-Vorschläge können so verworfen werden.');
    await deleteStrategieItem(itemId);
  }

  static async verwerfenAlle(strategieId) {
    const { data, error } = await window.supabase
      .from('strategie_items')
      .select('id')
      .eq('strategie_id', strategieId)
      .eq('ist_vorschlag', true);
    if (error) throw error;
    for (const row of data || []) {
      await deleteStrategieItem(row.id);
    }
    return data || [];
  }
}
