// SkriptEditorChatActions.js
// Chat-Aktionen im Editor: Senden (freies Feedback, vorgemerkte Aktion,
// Rueckfragen-Antwort), Retry, Annehmen/Ablehnen von Vorschlaegen und
// manuelles Speichern aus dem Inline-Edit.

import { skripteService } from '../SkripteService.js';
import { skriptKommentarService } from '../SkriptKommentarService.js';
import { skriptAuftrag } from '../SkriptAuftrag.js';
import { AKTION_LABELS, VISUELL_FIELD } from './skriptEditorKonstanten.js';
import { pendingThinking } from '../../../core/chat/thinking.js';
import { sektionAnzeige, sektionAnzeigeKurz, skriptStand, manuellBeschreibung } from './skriptEditorVisuellHelfer.js';
import { istMasterSkript, replaceMasterSektion, masterSektionBody } from '../master/skriptMasterFormat.js';

export class SkriptEditorChatActions {
  constructor(view) {
    this.view = view;
  }

  // ------------------------------------------------------------------
  // Senden (freies Feedback oder vorgemerkte Aktion)
  // ------------------------------------------------------------------
  async sendChat() {
    const v = this.view;
    // In-Flight-Guard wie acceptLaeuft: Doppel-Enter/Doppel-Klick wuerde
    // sonst zwei User-Messages + zwei pending Jobs + zwei Claude-Calls bauen
    if (v.sendLaeuft) return;
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

    // Freies Feedback braucht Text
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
      v.messages.push(userMsg);

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
      v.messages.push(assistantMsg);
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
      const assistantMsg = await skripteService.createChatMessage({
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
      v.messages.push(assistantMsg);
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
    const msg = v.messages.find((m) => m.id === messageId);
    if (!msg) return;

    if (action === 'retry') {
      await this.retryMessage(msg);
      return;
    }

    // Abbruch einer pending/running Assistant-Message (der Auftrag)
    if (action === 'cancel') {
      if (msg.status !== 'pending' && msg.status !== 'running') return;
      try {
        await skriptAuftrag.brichNachrichtAb(msg.id);
        msg.status = 'cancelled';
        v.renderChat();
      } catch (err) {
        window.toastSystem?.error(err.message);
      }
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

  async acceptVorschlag(msg) {
    const v = this.view;
    if (msg.aktion === 'visuell') return v.applyVisuellVorschlag(msg);
    // Doppelklick-Guard: parallele Accepts kollidieren auf version_nr
    if (v.acceptLaeuft) return;

    const sektion = msg.sektion;
    if (!['hook', 'hauptteil', 'cta'].includes(sektion)) {
      if (istMasterSkript(v.skript)) {
        await this.acceptMasterVorschlag(msg);
        return;
      }
    }
    if (!['hook', 'hauptteil', 'cta'].includes(sektion) || !msg.vorschlag_text) {
      window.toastSystem?.error('Vorschlag kann nicht zugeordnet werden');
      return;
    }

    const feld = msg.ist_visuell ? VISUELL_FIELD[sektion] : sektion;
    if (!feld) {
      window.toastSystem?.error('Vorschlag kann nicht zugeordnet werden');
      return;
    }
    const alt = v.skript[feld] || '';
    let neu;
    if (msg.selektion_text && alt.includes(msg.selektion_text)) {
      neu = alt.replace(msg.selektion_text, msg.vorschlag_text);
    } else if (msg.selektion_text) {
      // Markierte Stelle existiert nicht mehr (Sektion wurde zwischenzeitlich
      // geaendert) -> nicht still die ganze Sektion ueberschreiben
      const res = await window.confirmationModal?.open({
        title: 'Markierte Stelle nicht mehr gefunden',
        message: `Die ursprünglich markierte Stelle kommt in der Sektion ${sektionAnzeige(sektion, msg.ist_visuell)} nicht mehr vor (wurde sie zwischenzeitlich geändert?). Soll der Vorschlag die GESAMTE Sektion ersetzen?`,
        confirmText: 'Gesamte Sektion ersetzen',
        danger: true
      });
      if (!res?.confirmed) return;
      neu = msg.vorschlag_text;
    } else {
      neu = msg.vorschlag_text;
    }

    const vorherigerStand = skriptStand(v.skript);

    await v.inlineEdit.flush();

    v.acceptLaeuft = true;
    const btns = v.container?.querySelectorAll(`[data-msg-id="${msg.id}"]`) || [];
    btns.forEach((b) => { b.disabled = true; });

    try {
      await skripteService.updateSkript(v.skript.id, { [feld]: neu });
      v.skript[feld] = neu;

      const beschreibung = `${AKTION_LABELS[msg.aktion] || 'Änderung'} · ${sektionAnzeigeKurz(sektion, msg.ist_visuell)}`;
      const neueVersion = await skripteService.createVersion(v.skript, beschreibung, vorherigerStand, v.aktiveVersion);
      v.aktiveVersion = neueVersion;
      v.skript.aktive_version_nr = neueVersion.version_nr;
      v.skript.aktive_sub_nr = neueVersion.sub_nr;
      v.versionen = await skripteService.getVersionen(v.skript.id);

      await skripteService.updateChatMessage(msg.id, { status: 'angenommen' });
      msg.status = 'angenommen';

      v.renderDoc();
      v.renderChat();
      v.renderVersionSelect();
      window.toastSystem?.success(`Übernommen – jetzt ${skripteService.versionLabel(neueVersion)}`);
    } catch (err) {
      window.toastSystem?.error(err.message);
      btns.forEach((b) => { b.disabled = false; });
    } finally {
      v.acceptLaeuft = false;
    }
  }

  async acceptMasterVorschlag(msg) {
    const v = this.view;
    if (v.acceptLaeuft) return;
    const sektion = msg.sektion;
    if (!sektion || sektion === 'gesamt' || !msg.vorschlag_text) {
      window.toastSystem?.error('Vorschlag kann nicht zugeordnet werden');
      return;
    }

    const alt = v.skript.inhalt_md || '';
    const body = masterSektionBody(alt, sektion);
    let neu;
    if (msg.selektion_text && body.includes(msg.selektion_text)) {
      neu = replaceMasterSektion(alt, sektion, msg.vorschlag_text, { selektion: msg.selektion_text });
    } else if (msg.selektion_text) {
      const res = await window.confirmationModal?.open({
        title: 'Markierte Stelle nicht mehr gefunden',
        message: `Die ursprünglich markierte Stelle kommt in „${sektion}“ nicht mehr vor. Soll der Vorschlag die gesamte Sektion ersetzen?`,
        confirmText: 'Gesamte Sektion ersetzen',
        danger: true
      });
      if (!res?.confirmed) return;
      neu = replaceMasterSektion(alt, sektion, msg.vorschlag_text);
    } else {
      neu = replaceMasterSektion(alt, sektion, msg.vorschlag_text);
    }
    if (!neu) {
      window.toastSystem?.error('Sektion nicht gefunden');
      return;
    }

    const vorherigerStand = skriptStand(v.skript);
    await v.inlineEdit.flush();
    v.acceptLaeuft = true;
    const btns = v.container?.querySelectorAll(`[data-msg-id="${msg.id}"]`) || [];
    btns.forEach((b) => { b.disabled = true; });

    try {
      await skripteService.updateSkript(v.skript.id, { inhalt_md: neu });
      v.skript.inhalt_md = neu;
      const beschreibung = `${AKTION_LABELS[msg.aktion] || 'Änderung'} · ${sektionAnzeigeKurz(sektion, false)}`;
      const neueVersion = await skripteService.createVersion(v.skript, beschreibung, vorherigerStand, v.aktiveVersion);
      v.aktiveVersion = neueVersion;
      v.skript.aktive_version_nr = neueVersion.version_nr;
      v.skript.aktive_sub_nr = neueVersion.sub_nr;
      v.versionen = await skripteService.getVersionen(v.skript.id);
      await skripteService.updateChatMessage(msg.id, { status: 'angenommen' });
      msg.status = 'angenommen';
      v.renderDoc();
      v.renderChat();
      v.renderVersionSelect();
      window.toastSystem?.success(`Übernommen – jetzt ${skripteService.versionLabel(neueVersion)}`);
    } catch (err) {
      window.toastSystem?.error(err.message);
      btns.forEach((b) => { b.disabled = false; });
    } finally {
      v.acceptLaeuft = false;
    }
  }

  async saveManuell(feld, text, vorherText) {
    const v = this.view;
    if (!v.skript) return;
    const wert = text || null;

    // Kunden und Share-Gaeste mit Feedback-Recht: Feld-Update + Info-Zeile
    // kommen atomar aus dem RPC, ohne Version (die Versionshistorie bleibt
    // der interne Changelog). Gaeste haben keinen benutzer-Eintrag und
    // speichern ueber den eigenen RPC (Autor kommt aus dem Gast-JWT).
    if (v.isReadonly) {
      v.skript[feld] = wert;
      try {
        const kommentarId = window.permissionSystem?.isGast
          ? await skripteService.saveGastAenderung(v.skript.id, feld, wert)
          : await skripteService.saveKundeAenderung(v.skript.id, feld, wert);
        // Nachladen mit Autor-Join; schlaegt das fehl, liefert Realtime die Zeile
        try {
          const kommentar = await skriptKommentarService.loadKommentar(kommentarId);
          if (kommentar) {
            v.upsertFeedback(kommentar);
            v.renderFeedback();
          }
        } catch (_) { /* Realtime holt die Info-Zeile nach */ }
      } catch (err) {
        window.toastSystem?.error(err.message);
        throw err;
      }
      return;
    }

    const vorherigerStand = skriptStand(v.skript);
    vorherigerStand[feld] = vorherText || null;
    v.skript[feld] = wert;
    try {
      await skripteService.updateSkript(v.skript.id, { [feld]: wert });
      const neueVersion = await skripteService.createVersion(
        v.skript, manuellBeschreibung(feld), vorherigerStand, v.aktiveVersion
      );
      v.aktiveVersion = neueVersion;
      v.skript.aktive_version_nr = neueVersion.version_nr;
      v.skript.aktive_sub_nr = neueVersion.sub_nr;
      v.versionen = await skripteService.getVersionen(v.skript.id);
      v.renderVersionSelect();
    } catch (err) {
      window.toastSystem?.error(err.message);
      throw err;
    }
  }
}
