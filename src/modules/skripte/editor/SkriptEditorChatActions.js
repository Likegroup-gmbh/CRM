// SkriptEditorChatActions.js
// Chat-Aktionen im Editor: Senden (freie Anweisung, vorgemerkte Aktion,
// Rueckfragen-Antwort), Retry, Annehmen/Ablehnen von Vorschlaegen und
// manuelles Speichern aus dem Inline-Edit.
// Annahme und Speichern liegen in SkriptEditorChatAccept / SkriptEditorChatStand.

import { skripteService } from '../SkripteService.js';
import { skriptAuftrag } from '../SkriptAuftrag.js';
import { pendingThinking } from '../../../core/chat/thinking.js';
import { chatAcceptMethoden } from './SkriptEditorChatAccept.js';
import { chatStandMethoden } from './SkriptEditorChatStand.js';

export { festlegungAusAblehnungText } from './SkriptEditorChatStand.js';

export class SkriptEditorChatActions {
  constructor(view) {
    this.view = view;
  }

  // ------------------------------------------------------------------
  // Senden (freie Anweisung oder vorgemerkte Aktion)
  // ------------------------------------------------------------------
  async sendChat() {
    const v = this.view;
    // In-Flight-Guard wie acceptLaeuft: Doppel-Enter/Doppel-Klick wuerde
    // sonst zwei User-Messages + zwei pending Jobs + zwei Claude-Calls bauen
    if (v.sendLaeuft) return;
    // Laufender Auftrag: keine zweite Nachricht (der Button ist dann Stopp)
    if (v.likyLaeuft?.()) return;
    v.sendLaeuft = true;
    try {
      await this._sendChat();
    } finally {
      v.sendLaeuft = false;
    }
  }

  async _sendChat() {
    const v = this.view;
    const input = document.getElementById('ed-input');
    const text = input?.value.trim() || '';

    // Rueckfragen-Phase: Antwort geht an die Fragen-Function, nicht an den Editor
    if (v.istFragenModus()) {
      if (!text) return;
      input.value = '';
      v.clearPending();
      await this.sendMessagePair({ aktion: 'rueckfrage', sektion: 'gesamt', selektion_text: null, inhalt: text });
      return;
    }

    // Vorgemerkte Aktion: Anweisung ist optional, leer erlaubt
    if (v.pendingAktion && v.selektion) {
      const { sektion, text: selektionText, istVisuell } = v.selektion;
      const aktion = v.pendingAktion;
      input.value = '';
      v.clearPending();
      await this.sendMessagePair({
        aktion, sektion, selektion_text: selektionText, inhalt: text || null, ist_visuell: !!istVisuell
      });
      return;
    }

    // Freie Anweisung braucht Text
    if (!text) return;
    input.value = '';

    const sel = v.selektion;
    v.clearPending();

    await this.sendMessagePair({
      aktion: 'chat',
      sektion: sel?.sektion || 'gesamt',
      selektion_text: sel?.text || null,
      inhalt: text,
      ist_visuell: !!sel?.istVisuell
    });
  }

  /** User-Message + pending Assistant-Message anlegen, dann Function triggern. */
  async sendMessagePair({ aktion, sektion, selektion_text, inhalt, ist_visuell = false, modus = null }) {
    const v = this.view;
    let assistantMsg;
    try {
      // Der Edit-Job liest den Skriptstand aus der DB. Offene Zellen sind bis
      // Flush oder Blur nur lokal – sonst sieht der Bot den Stand von vor der letzten Eingabe.
      await v.inlineEdit?.flush();

      const userMsg = await skripteService.createChatMessage({
        skript_id: v.skript.id,
        rolle: 'user',
        aktion,
        sektion,
        selektion_text,
        inhalt,
        ist_visuell: !!ist_visuell,
        modus: modus || null,
        status: 'fertig'
      });
      // upsert statt push: das Realtime-INSERT kann vor dieser Antwort da sein
      v.upsertMessage(userMsg);

      // inhalt der pending Message = User-Anweisung (wird von der Function
      // als Auftrag gelesen und mit der Modell-Antwort ueberschrieben)
      assistantMsg = await skripteService.createChatMessage({
        skript_id: v.skript.id,
        rolle: 'assistant',
        aktion,
        sektion,
        selektion_text,
        inhalt,
        ist_visuell: !!ist_visuell,
        modus: modus || null,
        status: 'pending',
        progress_steps: pendingThinking()
      });
      assistantMsg = v.upsertMessage(assistantMsg);
      v.renderChat({ forceScroll: true });

      v.ensurePolling();
    } catch (err) {
      window.toastSystem?.error(err.message);
      return null;
    }
    await this.triggerNachricht(aktion, assistantMsg.id);
    return assistantMsg;
  }

  /**
   * Function zur Message triggern. Transiente Invoke-Fehler (502/503/Netz,
   * err.transient) werden NICHT getoastet: Netlify queued den Job oft
   * trotzdem, und Poll + Pending-Timeout in SkriptEditorRealtime faengt
   * die seltenen echten Drops als Fehler-Bubble mit Retry auf.
   */
  async triggerNachricht(aktion, messageId) {
    try {
      await skriptAuftrag.starteVonNachricht({
        art: aktion === 'rueckfrage' ? 'fragen' : 'edit',
        messageId
      });
    } catch (err) {
      if (!err.transient) window.toastSystem?.error(err.message);
    }
  }

  /** Erneuter Versuch: gleiche Anfrage als neue pending Assistant-Message. */
  async retryMessage(msg) {
    const v = this.view;
    // Zugehoerige User-Anweisung aus dem Verlauf ziehen (letzte User-Message davor)
    const idx = v.messages.findIndex((m) => m.id === msg.id);
    let userInhalt = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (v.messages[i].rolle === 'user') {
        userInhalt = v.messages[i].inhalt;
        break;
      }
    }

    try {
      if (msg.status === 'vorschlag') {
        await skripteService.updateChatMessage(msg.id, { status: 'abgelehnt' });
        msg.status = 'abgelehnt';
      }
      const angelegt = await skripteService.createChatMessage({
        skript_id: v.skript.id,
        rolle: 'assistant',
        aktion: msg.aktion,
        sektion: msg.sektion,
        selektion_text: msg.selektion_text,
        inhalt: userInhalt,
        ist_visuell: !!msg.ist_visuell,
        modus: msg.modus || null,
        status: 'pending',
        progress_steps: pendingThinking()
      });
      const assistantMsg = v.upsertMessage(angelegt);
      v.renderChat({ forceScroll: true });
      v.ensurePolling();
      await this.triggerNachricht(msg.aktion, assistantMsg.id);
    } catch (err) {
      window.toastSystem?.error(err.message);
    }
  }

  // ------------------------------------------------------------------
  // Vorschlag annehmen / ablehnen
  // ------------------------------------------------------------------
  async handleMessageAction(action, messageId) {
    const v = this.view;
    if (action === 'festlegung-loeschen') {
      const index = Number(messageId);
      const liste = Array.isArray(v.skript?.festlegungen) ? v.skript.festlegungen.slice() : [];
      if (!Number.isInteger(index) || index < 0 || index >= liste.length) return;
      liste.splice(index, 1);
      try {
        await skripteService.updateSkript(v.skript.id, { festlegungen: liste });
        v.skript.festlegungen = liste;
        v.renderChat();
      } catch (err) {
        window.toastSystem?.error(err.message);
      }
      return;
    }
    const msg = v.messages.find((m) => m.id === messageId);
    if (!msg) {
      // Button ohne Message im Verlauf: lokaler Stand ist veraltet
      if (action === 'cancel') v.resync?.();
      return;
    }

    if (action === 'retry') {
      await this.retryMessage(msg);
      return;
    }

    // Abbruch einer pending/running Assistant-Message (der Auftrag)
    if (action === 'cancel') {
      if (msg.status !== 'pending' && msg.status !== 'running') {
        // Nichts mehr zu stoppen: echten Stand aus der DB holen statt still nichts zu tun
        v.resync?.();
        return;
      }
      let abgebrochen = true;
      try {
        abgebrochen = await skriptAuftrag.brichNachrichtAb(msg.id);
      } catch (err) {
        // DB-Update gescheitert: UI trotzdem loesen, Resync holt den echten Stand
        window.toastSystem?.error(err.message);
        v.resync?.();
      }
      if (abgebrochen) {
        msg.status = 'cancelled';
        v.renderChat();
      }
      // false: Message war schon fertig, Resync zeigt das Ergebnis
      if (!abgebrochen) v.resync?.();
      return;
    }

    // Rueckfragen-Phase abgeschlossen -> finale Generierung starten
    if (action === 'generieren') {
      await v.startGenerationAusFragen();
      return;
    }

    if (action === 'reject') {
      try {
        await skripteService.updateChatMessage(msg.id, { status: 'abgelehnt' });
        msg.status = 'abgelehnt';
        await this.festlegungAusAblehnung(msg);
        v.renderChat();
      } catch (err) {
        window.toastSystem?.error(err.message);
      }
      return;
    }

    if (action === 'accept') {
      await this.acceptVorschlag(msg);
    }
  }
}

Object.assign(SkriptEditorChatActions.prototype, chatAcceptMethoden, chatStandMethoden);
