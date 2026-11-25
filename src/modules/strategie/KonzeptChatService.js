// KonzeptChatService.js
// Client-Orchestrierung des Liky-Chats am Konzept (ADR 0036). Die
// User-Message in konzept_chat_messages ist der Job: anlegen, Function
// anstossen, dieselbe Zeile pollen. Muster wie VideoideeVorschlagService.

const ENDPOINT = '/.netlify/functions/konzept-chat-background';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 4 * 60 * 1000;
/** Function hat die Message nicht angefasst (Auth-504, Worker-Crash, Env). */
export const CHAT_START_WATCHDOG_MS = 25 * 1000;

function warte(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emitProgress(detail) {
  document.dispatchEvent(new CustomEvent('konzeptChatProgress', { detail }));
}

export class KonzeptChatService {
  /** Eigener Faden: nur die eigenen Nachrichten dieses Konzepts. */
  static async ladeVerlauf(strategieId) {
    const db = window.supabase;
    if (!db) return [];
    const { data, error } = await db.from('konzept_chat_messages')
      .select('id, rolle, inhalt, status, error_message, progress_steps, bezug_ids, braucht_anzahl, created_at')
      .eq('strategie_id', strategieId)
      .order('created_at');
    if (error) {
      console.error('Konzept-Chat-Verlauf konnte nicht geladen werden:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Legt die User-Message an, stoesst die Background Function an und pollt
   * bis fertig/error. Gibt die fertige Zeile zurueck.
   */
  static async sendeNachricht({ strategieId, inhalt }) {
    const db = window.supabase;
    const session = await this.getSession();
    if (!db || !session) throw new Error('Keine aktive Sitzung');

    const { data: message, error: insertError } = await db.from('konzept_chat_messages')
      .insert({
        strategie_id: strategieId,
        rolle: 'user',
        inhalt,
        status: 'pending',
        created_by: session.user.id
      })
      .select('id').single();
    if (insertError) throw new Error(`Nachricht konnte nicht angelegt werden: ${insertError.message}`);

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ messageId: message.id })
    });
    if (response.status !== 202 && !response.ok) {
      throw new Error(`Antwort konnte nicht gestartet werden (HTTP ${response.status})`);
    }

    const startedAt = Date.now();
    const deadline = startedAt + POLL_TIMEOUT_MS;
    let letzteSteps = null;

    while (Date.now() < deadline) {
      await warte(POLL_INTERVAL_MS);

      const { data: row, error: pollError } = await db.from('konzept_chat_messages')
        .select('status, inhalt, error_message, progress_steps, bezug_ids, braucht_anzahl')
        .eq('id', message.id).maybeSingle();
      if (pollError || !row) continue;

      if (row.status === 'pending'
        && Date.now() - startedAt >= CHAT_START_WATCHDOG_MS) {
        throw new Error('Liky ist nicht angelaufen. Bitte nochmal versuchen.');
      }

      if (row.status === 'fertig') return row;
      if (row.status === 'error') throw new Error(row.error_message || 'Antwort fehlgeschlagen');

      const steps = Array.isArray(row.progress_steps) ? row.progress_steps : [];
      if (steps.length && steps !== letzteSteps) {
        letzteSteps = steps;
        emitProgress({ steps });
      }
    }

    throw new Error('Zeitlimit erreicht – Liky braucht ungewöhnlich lange. Bitte später erneut versuchen.');
  }

  static async getSession() {
    let { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
      await new Promise((r) => setTimeout(r, 500));
      ({ data: { session } } = await window.supabase.auth.getSession());
    }
    return session;
  }
}
