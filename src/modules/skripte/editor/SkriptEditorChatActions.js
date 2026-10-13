// SkriptEditorChatActions.js
// Chat-Aktionen im Editor: Senden (freie Anweisung, vorgemerkte Aktion,
// Rueckfragen-Antwort), Retry, Annehmen/Ablehnen von Vorschlaegen und
// manuelles Speichern aus dem Inline-Edit.

import { skripteService } from '../SkripteService.js';
import { skriptKommentarService } from '../SkriptKommentarService.js';
import { skriptAuftrag } from '../SkriptAuftrag.js';
import { AKTION_LABELS, VISUELL_FIELD, GRID_SEKTIONEN, HOOK_VARIANTE_FELDER, SEKTION_LABELS_KURZ } from './skriptEditorKonstanten.js';
import { pendingThinking } from '../../../core/chat/thinking.js';
import { sektionAnzeige, sektionAnzeigeKurz, skriptStand, manuellBeschreibung } from './skriptEditorVisuellHelfer.js';
import { istMasterSkript, replaceMasterSektion, masterSektionBody } from '../master/skriptMasterFormat.js';
import { istVeraltet } from './skriptEditorVeraltet.js';
import { zeitmarkerPatch, VISUELL_PAARE } from '../skriptSekunden.js';
import { pruefeDokument } from '../skriptPruefung.js';

const ZEIT_FELDER = new Set(VISUELL_PAARE.flat());
const GESPROCHEN = new Set(VISUELL_PAARE.map(([gesprochen]) => gesprochen));

/** Festlegung nach Ablehnen: „Abgelehnt für Hook: „…““. Ohne Vorschlagstext keine. */
export function festlegungAusAblehnungText(msg) {
  const liste = (Array.isArray(msg?.aenderungen) ? msg.aenderungen : [])
    .filter((a) => a?.sektion && String(a.vorschlag_text || '').trim());
  const einzel = String(msg?.vorschlag_text || '').trim();
  if (einzel && msg?.sektion && msg.sektion !== 'gesamt') {
    return `Abgelehnt für ${sektionAnzeigeKurz(msg.sektion, msg.ist_visuell)}: „${einzel.slice(0, 180)}“`;
  }
  if (!liste.length) return einzel ? `Abgelehnt: „${einzel.slice(0, 180)}“` : '';
  const zellen = [...new Set(liste.map((a) => sektionAnzeigeKurz(a.sektion, a.spalte === 'visuell')))].join(', ');
  const stueck = liste.map((a) => String(a.vorschlag_text).trim()).join(' / ').slice(0, 180);
  return `Abgelehnt für ${zellen}: „${stueck}“`;
}

/** Zellen eines Mehr-Zellen-Auftrags: [{ feld, text }]. */
function aenderungZellen(msg) {
  const liste = Array.isArray(msg?.aenderungen) ? msg.aenderungen : [];
  return liste
    .map((a) => {
      const sektion = String(a?.sektion || '').trim();
      if (!sektion) return null;
      const feld = sektion === 'titel'
        ? 'titel'
        : (a?.spalte === 'visuell' ? VISUELL_FIELD[sektion] : sektion);
      if (!feld) return null;
      const text = String(a?.vorschlag_text || '').trim();
      return text ? { feld, text } : null;
    })
    .filter(Boolean);
}

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

  async acceptVorschlag(msg) {
    const v = this.view;
    if (msg.aktion === 'visuell') return v.applyVisuellVorschlag(msg);
    // Doppelklick-Guard: parallele Accepts kollidieren auf version_nr
    if (v.acceptLaeuft) return;
    if (istVeraltet(msg, v.messages, v.skript)) {
      window.toastSystem?.error('Vorschlag ist veraltet – die Sektion wurde danach geändert');
      v.renderChat();
      return;
    }

    const zellen = aenderungZellen(msg);
    if (zellen.length) return this.acceptAenderungen(msg, zellen);

    const sektion = msg.sektion;
    const istTitel = sektion === 'titel';
    if (!istTitel && !GRID_SEKTIONEN.includes(sektion)) {
      if (istMasterSkript(v.skript)) {
        await this.acceptMasterVorschlag(msg);
        return;
      }
    }
    if ((!istTitel && !GRID_SEKTIONEN.includes(sektion)) || !msg.vorschlag_text) {
      window.toastSystem?.error('Vorschlag kann nicht zugeordnet werden');
      return;
    }

    const feld = istTitel ? 'titel' : (msg.ist_visuell ? VISUELL_FIELD[sektion] : sektion);
    if (!feld) {
      window.toastSystem?.error('Vorschlag kann nicht zugeordnet werden');
      return;
    }
    const alt = v.skript[feld] || '';
    let neu;
    if (istTitel) {
      neu = msg.vorschlag_text;
    } else if (msg.selektion_text && alt.includes(msg.selektion_text)) {
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
      const festgezogen = this.mitFestgezogen(feld);
      const extra = this.abgeleitet({ ...v.skript, [feld]: neu }, [feld]);
      await skripteService.updateSkript(v.skript.id, { [feld]: neu, ...extra, festgezogen });
      v.skript[feld] = neu;
      Object.assign(v.skript, extra);

      const beschreibung = `${AKTION_LABELS[msg.aktion] || 'Änderung'} · ${sektionAnzeigeKurz(sektion, msg.ist_visuell)}`;
      const neueVersion = await skripteService.createVersion(v.skript, beschreibung, vorherigerStand, v.aktiveVersion);
      v.aktiveVersion = neueVersion;
      v.skript.aktive_version_nr = neueVersion.version_nr;
      v.skript.aktive_sub_nr = neueVersion.sub_nr;
      v.versionen = await skripteService.getVersionen(v.skript.id);

      await skripteService.updateChatMessage(msg.id, { status: 'angenommen' });
      msg.status = 'angenommen';
      msg.updated_at = new Date().toISOString();

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

  /** Mehr-Zellen-Auftrag: alle Felder in einem Update, eine Version. */
  async acceptAenderungen(msg, zellen) {
    const v = this.view;
    const vorherigerStand = skriptStand(v.skript);
    await v.inlineEdit.flush();
    v.acceptLaeuft = true;
    const btns = v.container?.querySelectorAll(`[data-msg-id="${msg.id}"]`) || [];
    btns.forEach((b) => { b.disabled = true; });

    try {
      const patch = {};
      for (const z of zellen) patch[z.feld] = z.text;
      Object.assign(patch, this.abgeleitet({ ...v.skript, ...patch }, zellen.map((z) => z.feld)));
      const festgezogen = zellen.reduce((liste, z) => this.mitFestgezogen(z.feld, liste), null);
      await skripteService.updateSkript(v.skript.id, { ...patch, festgezogen });
      v.skript.festgezogen = festgezogen;
      Object.assign(v.skript, patch);

      const beschreibung = `${AKTION_LABELS[msg.aktion] || 'Änderung'} · ${zellen.length} Zellen`;
      const neueVersion = await skripteService.createVersion(v.skript, beschreibung, vorherigerStand, v.aktiveVersion);
      v.aktiveVersion = neueVersion;
      v.skript.aktive_version_nr = neueVersion.version_nr;
      v.skript.aktive_sub_nr = neueVersion.sub_nr;
      v.versionen = await skripteService.getVersionen(v.skript.id);

      await skripteService.updateChatMessage(msg.id, { status: 'angenommen' });
      msg.status = 'angenommen';
      msg.updated_at = new Date().toISOString();

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
      msg.updated_at = new Date().toISOString();
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

  async hookUebertragen(feld) {
    const v = this.view;
    if (!v.skript || v.isReadonly) return;
    if (!HOOK_VARIANTE_FELDER.includes(feld)) return;
    if (v.acceptLaeuft) return;

    const variante = v.skript[feld] || '';
    if (!variante.trim()) return;

    const vorherigerStand = skriptStand(v.skript);
    await v.inlineEdit.flush();

    const haupt = v.skript.hook || '';
    v.acceptLaeuft = true;
    const stempel = this.abgeleitet({ ...v.skript, hook: variante }, ['hook']);
    const visuellVorher = Object.fromEntries(Object.keys(stempel).map((k) => [k, v.skript[k]]));
    try {
      v.skript.hook = variante;
      v.skript[feld] = haupt;
      Object.assign(v.skript, stempel);
      await skripteService.updateSkript(v.skript.id, { hook: variante, [feld]: haupt || null, ...stempel });
      const neueVersion = await skripteService.createVersion(
        v.skript,
        `${AKTION_LABELS.hook_uebertragen} · ${SEKTION_LABELS_KURZ[feld]}`,
        vorherigerStand,
        v.aktiveVersion
      );
      v.aktiveVersion = neueVersion;
      v.skript.aktive_version_nr = neueVersion.version_nr;
      v.skript.aktive_sub_nr = neueVersion.sub_nr;
      v.versionen = await skripteService.getVersionen(v.skript.id);
      v.renderDoc();
      v.renderVersionSelect();
      window.toastSystem?.success(`Übernommen – jetzt ${skripteService.versionLabel(neueVersion)}`);
    } catch (err) {
      window.toastSystem?.error(err.message);
      v.skript.hook = haupt;
      v.skript[feld] = variante;
      Object.assign(v.skript, visuellVorher);
    } finally {
      v.acceptLaeuft = false;
    }
  }

  /**
   * Abgeleitete Felder nach einer Textaenderung (ADR 0035): Zeitmarker aller
   * Visual-Zellen aus dem Gesamtstand und die Pruefung des Dokuments.
   */
  abgeleitet(stand, felder, { ausser = [] } = {}) {
    const patch = {};
    if (felder.some((f) => ZEIT_FELDER.has(f))) Object.assign(patch, zeitmarkerPatch(stand, { ausser }));
    if (felder.some((f) => GESPROCHEN.has(f))) patch.pruefung = pruefeDokument({ ...stand, ...patch });
    return patch;
  }

  /** Extern geaenderte Zellen ohne vollen Re-Render ins DOM schreiben; die Zelle mit Fokus bleibt. */
  zeigeZellen(patch) {
    const v = this.view;
    const fokus = v.inlineEdit?.focusedFeld?.();
    for (const [feld, text] of Object.entries(patch || {})) {
      if (feld === fokus || !ZEIT_FELDER.has(feld)) continue;
      const zelle = v.container?.querySelector(`[data-feld="${feld}"]`);
      if (zelle) zelle.textContent = text || '';
      v.inlineEdit?.syncSaved?.(feld, text || '');
    }
  }

  mitFestgezogen(feld, liste = null) {
    const basis = liste || (Array.isArray(this.view.skript?.festgezogen) ? this.view.skript.festgezogen.slice() : []);
    if (feld && !basis.includes(feld)) basis.push(feld);
    if (!liste) this.view.skript.festgezogen = basis;
    return basis;
  }

  async haengeFestlegung(text, quelle) {
    const v = this.view;
    const t = String(text || '').trim();
    if (!t || !v.skript) return;
    const liste = Array.isArray(v.skript.festlegungen) ? v.skript.festlegungen.slice() : [];
    if (liste.some((f) => f?.text === t)) return;
    liste.push({ text: t, quelle });
    await skripteService.updateSkript(v.skript.id, { festlegungen: liste });
    v.skript.festlegungen = liste;
  }

  // Nur das abgelehnte Stueck: die Anweisung davor galt diesem Turn, sie als
  // Dauer-Fakt zu speichern hat spaetere Edits auf den alten Wunsch festgenagelt
  async festlegungAusAblehnung(msg) {
    const text = festlegungAusAblehnungText(msg);
    if (text) await this.haengeFestlegung(text, 'ablehnung');
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
    // Gesprochener Text bestimmt Sekunden und Pruefung; eine Visual-Zelle mit Fokus bleibt, wie sie ist.
    // Eine manuell bearbeitete Visual-Zelle wird nicht neu gestempelt.
    const fokus = v.inlineEdit?.focusedFeld?.();
    const stempel = GESPROCHEN.has(feld)
      ? this.abgeleitet(v.skript, [feld], { ausser: fokus ? [fokus] : [] })
      : {};
    Object.assign(v.skript, stempel);
    try {
      await skripteService.updateSkript(v.skript.id, { [feld]: wert, ...stempel });
      this.zeigeZellen(stempel);
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
