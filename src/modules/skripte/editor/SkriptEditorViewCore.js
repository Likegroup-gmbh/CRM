// SkriptEditorViewCore.js
// Fassade des Skript-Editors: State, Rechte und stabile API.
// Lifecycle, Sidebar, Dokument und Liky haengen als Prototype-Mixins
// (SkriptEditorLifecycle, SkriptEditorListe, SkriptEditorDokument, SkriptEditorLiky).
// Fachlogik liegt in den Controllern (Generation, ChatActions, Selection,
// Versionen, Visuell, Realtime, Feedback), das Markup in den puren Renderern.

import { InlineEdit } from '../../../core/components/InlineEdit.js';
import { htmlToInlineMd } from '../../../core/utils/inlineFormat.js';
import { SkriptEditorGeneration } from './SkriptEditorGeneration.js';
import { SkriptEditorChatActions } from './SkriptEditorChatActions.js';
import { SkriptEditorSelection } from './SkriptEditorSelection.js';
import { SkriptEditorFormat } from './SkriptEditorFormat.js';
import { SkriptEditorVersionen } from './SkriptEditorVersionen.js';
import { SkriptEditorVisuell } from './SkriptEditorVisuell.js';
import { SkriptEditorRealtime } from './SkriptEditorRealtime.js';
import { SkriptFeedbackPanel } from './SkriptFeedbackPanel.js';

export class SkriptEditorView {
  constructor(page) {
    this.page = page;
    this.skript = null;
    this.skripte = [];
    this._listeKampagneId = undefined; // Scope der Sidebar; undefined = noch nicht gesetzt
    this.messages = [];
    this.kommentare = [];
    this.versionen = [];
    this.aktiveVersion = { version_nr: 1, sub_nr: 0 };
    this.docTab = 'skript';
    this.selektion = null; // { sektion, text, istVisuell }
    this.pendingAktion = null; // 'neu_schreiben' | 'kuerzen' | 'laenger' | 'anderer_ton' | null
    this.channel = null;
    this.pollInterval = null;
    this.onMouseUp = null;
    this.onDocMouseDown = null;
    this.inlineEdit = new InlineEdit({
      // Grid-Zellen lesen Markdown-sicher (strong/em -> **/*), Master-Zellen
      // (--md) behalten das bisherige innerText-Verhalten (null = Default)
      lesen: (el) => (el.classList?.contains('skripte-editor-sektion-text--md')
        ? null
        : htmlToInlineMd(el)),
      onChange: (feld, text) => {
        if (this.skript) this.skript[feld] = text || null;
      },
      onInput: () => { if (this.selektion || this.pendingAktion) this.clearPending(); },
      onSave: (feld, text, vorher) => this.saveManuell(feld, text, vorher)
    });

    this.genStatus = null; // null | { laeuft: true, step } | { error }
    this.genPayload = null; // RAM-Kopie fuer "Nochmal versuchen"
    this.genStubId = null;
    this.genJobId = null;
    this.genJobStop = null; // Auftrag-Handle (Realtime + Poll + In-Flight)
    this.visuellApplyLaeuft = false;
    this.modi = [];
    this._modiGeladen = false;
    this._listeCollapse = null;
    this._likyShell = null;
    this._chatLog = null;

    // Controller (Fachlogik), jeweils mit Blick auf diese Fassade
    this._generation = new SkriptEditorGeneration(this);
    this._chatActions = new SkriptEditorChatActions(this);
    this._selection = new SkriptEditorSelection(this);
    this._format = new SkriptEditorFormat(this);
    this._versionen = new SkriptEditorVersionen(this);
    this._visuell = new SkriptEditorVisuell(this);
    this._realtime = new SkriptEditorRealtime(this);
    this._feedback = new SkriptFeedbackPanel(this);
    this.verknuepfungen = [];
    this._koopDrawer = null;
  }

  /** Dokument selbst nicht editierbar (kein InlineEdit, keine Visual-Buttons). */
  get isReadonly() {
    // Intern-only-Tools (Liky, Visual-KI, Generator) haengen hieran: Kunde
    // wie bisher readonly, interne view-only Rollen (Investor) ebenfalls.
    return Boolean(window.isKunde?.()) || !(window.canEdit?.('skripte') ?? false);
  }

  /**
   * Dokument-Zellen duerfen interne Nutzer und Kunden bearbeiten; Kunden
   * speichern dabei ueber den RPC (Feld-Whitelist + Info-Zeile) statt
   * updateSkript + Version. Share-Gaeste duerfen nur mit dem Recht
   * 'feedback' (UI: "Bearbeiten") und speichern dann ueber den Gast-RPC.
   * isReadonly steuert weiterhin die Intern-only-Tools (Liky, Visual-KI,
   * Generator).
   */
  get kannDokumentEditieren() {
    if (window.permissionSystem?.isGast) return window.guestShare?.rechte === 'feedback';
    // Kunden-Edit laeuft ueber den RPC mit Feld-Whitelist - bleibt unveraendert.
    if (window.isKunde?.()) return true;
    // Intern: Capability statt Rolle (Investor ist intern, aber view-only).
    return window.canEdit?.('skripte') ?? false;
  }

  /** Liky-Bubble und die Rewrite-Aktionen im Selektionsmenue: nur intern. */
  get kannAiAktionen() {
    return !this.isReadonly;
  }

  /**
   * Feedback schreiben duerfen Kunden und Share-Gaeste mit Feedback-Recht.
   * Gaeste ohne Feedback-Recht ('ansehen') bleiben lesend. Share-Gaeste
   * haben keine benutzer-Row: ihr Kommentar laeuft mit created_by = NULL,
   * der DB-Trigger setzt Autor und guest_participant_id aus dem Gast-JWT.
   * Investor ist komplett raus (Feature skriptKommentieren = false).
   */
  get kannKommentieren() {
    if (window.permissionSystem?.isGast) return window.guestShare?.rechte === 'feedback';
    return window.canFeature?.('skriptKommentieren') ?? false;
  }

  /** Threads abhaken bleibt intern (serverseitig zusaetzlich per RPC erzwungen). */
  get kannErledigen() {
    return Boolean(window.isInternal?.()) && (window.canEdit?.('skripte') ?? false);
  }

  /** Teilen-Button im Doc-Kopf: nur intern und nur fuer ein geladenes Skript. */
  get kannTeilen() {
    return Boolean(window.isInternal?.()) && (window.canEdit?.('skripte') ?? false) && Boolean(this.skript?.id) && !this.neuModus;
  }

  /** Freigeben: nur Share-Gast mit Bearbeiten-Recht, und nur aus Status Final. */
  get kannFreigeben() {
    return Boolean(window.permissionSystem?.isGast)
      && window.guestShare?.rechte === 'feedback'
      && this.skript?.status === 'final';
  }

  /** Creator/Kooperation zuweisen: nur intern. */
  get kannZuweisen() {
    return Boolean(window.isInternal?.()) && (window.canEdit?.('skripte') ?? false);
  }

  /** Rueckfragen-Phase: Stub existiert, Skript ist noch nicht generiert. */
  istFragenModus() {
    return this.skript?.status === 'fragen';
  }

  // ------------------------------------------------------------------
  // Delegation an die Controller (API der Fassade bleibt stabil)
  // ------------------------------------------------------------------
  setVersionsState(versionen) { this._versionen.setState(versionen); }
  renderVersionSelect() { this._versionen.renderSelect(); }
  onVersionChange(key) { return this._versionen.onChange(key); }
  closeVersionMenu() { this._versionen.closeMenu(); }

  setGenButtonAktiv(aktiv) { this._generation.setGenButtonAktiv(aktiv); }
  startFragenRunde() { return this._generation.startFragenRunde(); }
  startGenerationAusFragen() { return this._generation.startGenerationAusFragen(); }
  sollFragenRundeStarten() {
    if (this.skript?.status !== 'fragen') return false;
    return !this.messages.some((m) => m.aktion === 'rueckfrage');
  }
  handleGenJobUpdate(job) { this._generation.handleGenJobUpdate(job); }
  finishGeneration(skriptId) { return this._generation.finishGeneration(skriptId); }
  cleanupGenJob() { this._generation.cleanupGenJob(); }
  brichGenerationAb() { return this._generation.brichGenerationAb(); }

  sendChat() { return this._chatActions.sendChat(); }
  sendMessagePair(args) { return this._chatActions.sendMessagePair(args); }
  retryMessage(msg) { return this._chatActions.retryMessage(msg); }
  handleMessageAction(action, messageId) { return this._chatActions.handleMessageAction(action, messageId); }
  acceptVorschlag(msg) { return this._chatActions.acceptVorschlag(msg); }
  hookUebertragen(feld) { return this._chatActions.hookUebertragen(feld); }
  saveManuell(feld, text, vorher) { return this._chatActions.saveManuell(feld, text, vorher); }

  checkSelection() { this._selection.checkSelection(); }
  setPendingAktion(aktion) { this._selection.setPendingAktion(aktion); }
  clearPending() { this._selection.clearPending(); }
  updateChip() { this._selection.updateChip(); }
  formatiereSelektion(aktion) { return this._format.anwendenAusMenue(aktion); }

  renderFeedback() { this._feedback.render(); }
  upsertFeedback(kommentar) { this._feedback.upsert(kommentar); }
  startNeuerKommentar(selektion) { this._feedback.startNeuerKommentar(selektion); }

  startVisuell(sektion, modus) { return this._visuell.startVisuell(sektion, modus); }
  openVisuellModusMenu(btn) { return this._visuell.openModusMenu(btn); }
  applyVisuellVorschlag(msg) { return this._visuell.applyVisuellVorschlag(msg); }
  applyOffeneVisuellvorschlaege() { return this._visuell.applyOffene(); }

  subscribe() { this._realtime.subscribe(); }
  ensurePolling() { this._realtime.ensurePolling(); }
  applyMessageUpdate(row, eventType) { this._realtime.applyMessageUpdate(row, eventType); }
}
