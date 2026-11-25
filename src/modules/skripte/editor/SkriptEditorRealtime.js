// SkriptEditorRealtime.js
// Realtime-Subscription auf skript_chat_messages + Resync-Fallback, solange
// Messages offen (pending/running) sind.
//
// Prinzip: die DB ist die Wahrheit. Realtime liefert den schnellen Pfad,
// der Resync (komplette Liste aus der DB) heilt alles, was Realtime
// verpasst oder doppelt geliefert hat (Geister-Rows, Channel-Abriss,
// schlafender Tab). Watchdogs setzen verlorene Auftraege auf error.

import { skripteService } from '../SkripteService.js';
import {
  istOffen, istAbgelaufen, istLangsam, ablaufFehlertext, alterMs,
  entdoppeln, RESYNC_GNADENFRIST_MS
} from './skriptEditorMessages.js';

const POLL_MS = 5000;
const CHANNEL_PROBLEM = ['CHANNEL_ERROR', 'TIMED_OUT'];

function stepsKey(steps) {
  return JSON.stringify(Array.isArray(steps) && steps.length ? steps : []);
}

function zeit(value) {
  const t = new Date(value || '').getTime();
  return Number.isFinite(t) ? t : null;
}

export class SkriptEditorRealtime {
  constructor(view) {
    this.view = view;
    this._resyncLaeuft = false;
    this._angezeigt = new Set(); // "<id>:langsam" / "<id>:abgelaufen": schon neu gerendert
    this._trigger = null;
  }

  subscribe() {
    const v = this.view;
    v.channel = skripteService.subscribeToChat(
      v.skript.id,
      (row, eventType) => this.applyMessageUpdate(row, eventType),
      (status) => this.onChannelStatus(status)
    );
    this.bindResyncTriggers();
  }

  /**
   * Channel-Status: nach (Re-)Connect oder Fehler die Liste aus der DB holen,
   * weil in der Luecke Events verloren gegangen sein koennen.
   */
  onChannelStatus(status) {
    if (status === 'SUBSCRIBED' || CHANNEL_PROBLEM.includes(status)) {
      this.resync();
    }
  }

  /** Tab wieder sichtbar / Netz wieder da: sofort abgleichen. */
  bindResyncTriggers() {
    if (this._trigger || typeof document === 'undefined') return;
    this._trigger = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      this.resync();
    };
    document.addEventListener('visibilitychange', this._trigger);
    window.addEventListener('online', this._trigger);
  }

  destroy() {
    if (this._trigger) {
      document.removeEventListener('visibilitychange', this._trigger);
      window.removeEventListener('online', this._trigger);
      this._trigger = null;
    }
    this._angezeigt.clear();
  }

  ensurePolling() {
    const v = this.view;
    if (v.pollInterval) return;
    v.pollInterval = setInterval(() => this.pollTick(), POLL_MS);
  }

  async pollTick() {
    const v = this.view;
    if (!v.messages.some(istOffen)) {
      clearInterval(v.pollInterval);
      v.pollInterval = null;
      return;
    }
    await this.resync();
    const ids = [...new Set(v.messages.filter(istOffen).map((m) => m.id))];
    for (const id of ids) await this.checkPendingTimeout(id);
    this.aktualisiereZeitAnzeigen();
  }

  /**
   * Komplette Liste aus der DB holen und den lokalen Stand angleichen.
   * Doppelte ids fliegen raus, fehlende Rows kommen dazu, lokale Rows ohne
   * DB-Gegenstueck (Geister) werden entfernt.
   */
  async resync() {
    const v = this.view;
    const skriptId = v.skript?.id;
    if (!skriptId || this._resyncLaeuft) return;
    this._resyncLaeuft = true;
    try {
      const rows = await skripteService.getChatMessages(skriptId);
      if (v.skript?.id !== skriptId || !Array.isArray(rows)) return;
      this.abgleichen(rows);
    } catch (_) { /* naechster Umlauf (Poll/Trigger) kommt */ } finally {
      this._resyncLaeuft = false;
    }
  }

  abgleichen(rows) {
    const v = this.view;
    let strukturGeaendert = entdoppeln(v.messages);

    for (const row of rows) {
      // Lokal schon neuer (Realtime kam waehrend des Fetch): nicht zuruecksetzen
      const lokal = v.messages.find((m) => m.id === row.id);
      const lokalZeit = zeit(lokal?.updated_at);
      const rowZeit = zeit(row.updated_at);
      if (lokalZeit !== null && rowZeit !== null && lokalZeit > rowZeit) continue;
      this.applyMessageUpdate(row, 'UPDATE');
    }

    const dbIds = new Set(rows.map((r) => r.id));
    const jetzt = Date.now();
    for (let i = v.messages.length - 1; i >= 0; i--) {
      const m = v.messages[i];
      if (dbIds.has(m.id)) continue;
      const alter = alterMs(m, jetzt);
      // Frisch angelegt: der Fetch kann vor dem Insert gestartet sein
      if (alter === null || alter < RESYNC_GNADENFRIST_MS) continue;
      v.messages.splice(i, 1);
      strukturGeaendert = true;
    }

    if (strukturGeaendert) {
      v.renderChat?.();
      v.renderCost?.();
    }
    if (v.messages.some(istOffen)) this.ensurePolling();
  }

  /**
   * Watchdog fuer verlorene Auftraege: pending > 45 s (Invoke verloren) oder
   * running > 12 min (Function tot) -> auf error setzen. Das Update ist
   * konditional (nurWennStatus), damit eine gleichzeitig fertig werdende
   * Function gewinnt.
   */
  async checkPendingTimeout(messageId) {
    const v = this.view;
    const m = v.messages.find((x) => x.id === messageId);
    if (!m || !istAbgelaufen(m)) return;
    const patch = { status: 'error', error_message: ablaufFehlertext(m) };
    let uebernommen = false;
    try {
      uebernommen = await skripteService.updateChatMessage(messageId, patch, { nurWennStatus: m.status });
    } catch (_) { return; }
    if (!uebernommen) {
      // Status hat sich in der DB geaendert: echten Stand holen
      await this.resync();
      return;
    }
    this.applyMessageUpdate({ ...m, ...patch }, 'UPDATE');
  }

  /** Hinweis "dauert laenger" bzw. Ablauf-Fehler erscheinen ohne DB-Event: einmal neu rendern. */
  aktualisiereZeitAnzeigen() {
    const v = this.view;
    const jetzt = Date.now();
    for (const m of v.messages) {
      const art = istAbgelaufen(m, jetzt) ? 'abgelaufen' : (istLangsam(m, jetzt) ? 'langsam' : null);
      if (!art) continue;
      const key = `${m.id}:${art}`;
      if (this._angezeigt.has(key)) continue;
      this._angezeigt.add(key);
      v.upsertMessageRow?.(m);
    }
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
      // (Resync liefert alle 5s auch unveraenderte Rows)
      const unveraendert = lokal.status === row.status
        && lokal.inhalt === row.inhalt
        && lokal.vorschlag_text === row.vorschlag_text
        && lokal.error_message === row.error_message
        && stepsKey(lokal.progress_steps) === stepsKey(row.progress_steps);
      const warOffen = ['pending', 'running'].includes(lokal.status);
      const jetztFinal = ['fertig', 'vorschlag'].includes(row.status);
      animateText = warOffen && jetztFinal;
      v.messages[idx] = row;
      if (unveraendert) return;
    }
    v.upsertMessageRow(row, { animateText });
    v.renderCost();
    // Offene Message (z.B. aus einem zweiten Tab): Watchdog + Resync muessen laufen
    if (istOffen(row)) v.ensurePolling?.();

    // Visual-Vorschlag direkt in die Zelle uebernehmen (kein Annehmen/Ablehnen)
    if (row.aktion === 'visuell' && row.status === 'vorschlag' && row.vorschlag_text) {
      v.applyVisuellVorschlag(row);
    }
  }
}
