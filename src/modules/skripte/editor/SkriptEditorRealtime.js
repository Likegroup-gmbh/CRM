// SkriptEditorRealtime.js
// Realtime-Subscription auf skript_chat_messages + Poll-Fallback, solange
// Messages offen (pending/running) sind.

import { skripteService } from '../SkripteService.js';

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
        const fresh = await skripteService.pollChatMessage(m.id);
        if (fresh) this.applyMessageUpdate(fresh, 'UPDATE');
      }
    }, 5000);
  }

  applyMessageUpdate(row, eventType) {
    const v = this.view;
    if (!row || row.skript_id !== v.skript?.id) return;
    const idx = v.messages.findIndex((m) => m.id === row.id);
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
      v.messages[idx] = row;
      if (unveraendert) return;
    }
    v.upsertMessageRow(row);
    v.renderCost();

    // Visual-Vorschlag direkt in die Zelle uebernehmen (kein Annehmen/Ablehnen)
    if (row.aktion === 'visuell' && row.status === 'vorschlag' && row.vorschlag_text) {
      v.applyVisuellVorschlag(row);
    }
  }
}
