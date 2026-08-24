// SkriptEditorRealtime.js
// Realtime-Subscription auf skript_chat_messages + Poll-Fallback, solange
// Messages offen (pending/running) sind.

import { skripteService } from '../SkripteService.js';

// pending heisst: die Function hat den Job noch nicht geclaimt. Bleibt eine
// Message laenger pending, ging der Invoke verloren (z.B. 502/503 ohne
// Netlify-Auto-Retry) -> als Fehler mit Retry zeigen statt ewig "Ich arbeite…"
const PENDING_TIMEOUT_MS = 45000;

export class SkriptEditorRealtime {
  constructor(view) {
    this.view = view;
  }

  subscribe() {
    const v = this.view;
    v.channel = skripteService.subscribeToChat(v.skript.id, (row, eventType) => {
      this.applyMessageUpdate(row, eventType);
    });
  }

  ensurePolling() {
    const v = this.view;
    if (v.pollInterval) return;
    v.pollInterval = setInterval(async () => {
      const offen = v.messages.filter((m) => m.status === 'pending' || m.status === 'running');
      if (!offen.length) {
        clearInterval(v.pollInterval);
        v.pollInterval = null;
        return;
      }
      for (const m of offen) {
        try {
          const fresh = await skripteService.pollChatMessage(m.id);
          if (fresh) this.applyMessageUpdate(fresh, 'UPDATE');
        } catch (_) { /* Poll-Fehler ignorieren, naechster Umlauf kommt */ }
        await this.checkPendingTimeout(m.id);
      }
    }, 5000);
  }

  /**
   * Watchdog fuer verlorene Invokes: Message aelter als PENDING_TIMEOUT_MS
   * und immer noch pending -> auf error setzen. Das Update ist konditional
   * (nurWennStatus), damit eine gleichzeitig claimende Function gewinnt.
   */
  async checkPendingTimeout(messageId) {
    const v = this.view;
    const m = v.messages.find((x) => x.id === messageId);
    if (!m || m.status !== 'pending') return;
    const alter = Date.now() - new Date(m.created_at || 0).getTime();
    if (!Number.isFinite(alter) || alter < PENDING_TIMEOUT_MS) return;
    const patch = {
      status: 'error',
      error_message: 'Start fehlgeschlagen – bitte nochmal versuchen.'
    };
    let uebernommen = false;
    try {
      uebernommen = await skripteService.updateChatMessage(messageId, patch, { nurWennStatus: 'pending' });
    } catch (_) { return; }
    if (!uebernommen) return;
    this.applyMessageUpdate({ ...m, ...patch }, 'UPDATE');
  }

  applyMessageUpdate(row, eventType) {
    const v = this.view;
    if (!row || row.skript_id !== v.skript?.id) return;
    const idx = v.messages.findIndex((m) => m.id === row.id);
    let animateText = false;
    if (idx === -1) {
      if (eventType !== 'INSERT' && eventType !== 'UPDATE') return;
      v.messages.push(row);
    } else {
      // Lokal bereits final gesetzte Status (angenommen/abgelehnt/cancelled)
      // nicht durch verspaetete Realtime-Events zuruecksetzen
      const lokal = v.messages[idx];
      if (['angenommen', 'abgelehnt', 'cancelled'].includes(lokal.status)
        && ['vorschlag', 'running', 'pending'].includes(row.status)) return;
      // Kein Re-Render, wenn sich nichts Sichtbares geaendert hat
      // (Poll-Fallback liefert alle 5s auch unveraenderte Rows)
      const unveraendert = lokal.status === row.status
        && lokal.inhalt === row.inhalt
        && lokal.vorschlag_text === row.vorschlag_text
        && lokal.error_message === row.error_message;
      const warOffen = ['pending', 'running'].includes(lokal.status);
      const jetztFinal = ['fertig', 'vorschlag'].includes(row.status);
      animateText = warOffen && jetztFinal;
      v.messages[idx] = row;
      if (unveraendert) return;
    }
    v.upsertMessageRow(row, { animateText });
    v.renderCost();

    // Visual-Vorschlag direkt in die Zelle uebernehmen (kein Annehmen/Ablehnen)
    if (row.aktion === 'visuell' && row.status === 'vorschlag' && row.vorschlag_text) {
      v.applyVisuellVorschlag(row);
    }
  }
}
