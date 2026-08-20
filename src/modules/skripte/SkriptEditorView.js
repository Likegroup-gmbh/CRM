// SkriptEditorView.js
// Chat-basierter Skript-Editor (3 Spalten in einer Shell, nach Figma):
//   links   Skriptliste zum Umschalten
//   mitte   Skript (Hook/Hauptteil/CTA) mit Selektions-Menue + Chat-Eingabe
//   rechts  Chat-Verlauf ("Liky") mit Aktions-Tag, Status und Annehmen/Ablehnen
// Die Assistant-Message in skript_chat_messages ist der Job (Realtime + Poll).
//
// Fassade/Orchestrator: State + Lifecycle + Listen-/Doc-/Chat-Verdrahtung.
// Fachlogik liegt in den Controllern unter editor/ (Generation, ChatActions,
// Feedback, Selection, Versionen, Visuell, Realtime), das Markup in den
// puren Renderern (SkriptEditorDocRenderer, SkriptEditorChatRenderer).

import { skripteService } from './SkripteService.js';
import { SkriptGeneratorForm } from './SkriptGeneratorForm.js';
import { SkriptFeedbackDrawer } from './SkriptFeedbackDrawer.js';
import { SkriptInlineEdit } from './SkriptInlineEdit.js';
import { escapeHtml, formatDate, formatUsageCost, replaceSkriptUrl, skriptEditorPath } from './SkripteUtils.js';
import { icon } from '../../core/icons/IconSystem.js';
import {
  SEND_ICON, PLACEHOLDER_DEFAULT, PLACEHOLDER_NEU, PLACEHOLDER_FRAGEN
} from './editor/skriptEditorKonstanten.js';
import {
  neuModusHtml, fragenModusHtml, skriptDocHtml, docHeadActionsHtml, vorgabenPanelHtml
} from './editor/SkriptEditorDocRenderer.js';
import {
  chatLeerNeuHtml, chatLeerHtml, genStatusBubbleHtml, messageHtml, versionsHinweisHtml
} from './editor/SkriptEditorChatRenderer.js';
import { SkriptEditorGeneration } from './editor/SkriptEditorGeneration.js';
import { SkriptEditorChatActions } from './editor/SkriptEditorChatActions.js';
import { SkriptEditorFeedback } from './editor/SkriptEditorFeedback.js';
import { SkriptEditorSelection } from './editor/SkriptEditorSelection.js';
import { SkriptEditorVersionen } from './editor/SkriptEditorVersionen.js';
import { SkriptEditorVisuell } from './editor/SkriptEditorVisuell.js';
import { SkriptEditorRealtime } from './editor/SkriptEditorRealtime.js';

export class SkriptEditorView {
  constructor(page) {
    this.page = page;
    this.skript = null;
    this.skripte = [];
    this.messages = [];
    this.versionen = [];
    this.aktiveVersion = { version_nr: 1, sub_nr: 0 };
    this.selektion = null; // { sektion, text, istVisuell }
    this.pendingAktion = null; // 'neu_schreiben' | 'kuerzen' | 'laenger' | 'anderer_ton' | null
    this.channel = null;
    this.pollInterval = null;
    this.onMouseUp = null;
    this.onDocMouseDown = null;
    this.feedbackDrawer = new SkriptFeedbackDrawer();
    this.inlineEdit = new SkriptInlineEdit({
      onChange: (feld, text) => {
        if (this.skript) this.skript[feld] = text || null;
      },
      onInput: () => { if (this.selektion || this.pendingAktion) this.clearPending(); },
      onSave: (feld, text, vorher) => this.saveManuell(feld, text, vorher)
    });

    // Neu-Modus: Generator-Formular in der Mitte statt Hook/Hauptteil/CTA
    this.neuModus = false;
    this.genForm = null;
    this.genStatus = null; // null | { laeuft: true, step } | { error }
    this.genPayload = null; // RAM-Kopie fuer "Nochmal versuchen"
    this.genStubId = null; // persistenter Stub (Payload ueberlebt Fehler/Reload)
    this.genJobId = null;
    this.genChannel = null;
    this.genPoll = null;
    this.visuellApplyLaeuft = false;
    this.modi = [];
    this._modiGeladen = false;

    // Controller (Fachlogik), jeweils mit Blick auf diese Fassade
    this._generation = new SkriptEditorGeneration(this);
    this._chatActions = new SkriptEditorChatActions(this);
    this._feedback = new SkriptEditorFeedback(this);
    this._selection = new SkriptEditorSelection(this);
    this._versionen = new SkriptEditorVersionen(this);
    this._visuell = new SkriptEditorVisuell(this);
    this._realtime = new SkriptEditorRealtime(this);
  }

  get isReadonly() {
    return Boolean(window.isKunde?.());
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------
  async render(container, skriptId) {
    await this.cleanup();
    this.container = container;

    container.innerHTML = '<div class="empty-state"><p>Skript wird geladen...</p></div>';

    // Neu-Modus: Editor-Shell mit leerer Mitte (Generator) statt Skript-Load
    if (skriptId === 'neu') {
      if (this.isReadonly) {
        container.innerHTML = '<div class="empty-state"><p>Kein Zugriff – Skripte können nur gelesen werden.</p></div>';
        return;
      }
      this.skripte = await skripteService.loadSkripte();
      this.skript = null;
      this.messages = [];
      this.neuModus = true;
      this.genStatus = null;
      this.updateBreadcrumb();
      this.renderLayout();
      this.bindEvents();
      this.setChatInputAktiv(false);
      return;
    }

    const readonly = this.isReadonly;
    try {
      const [skript, skripte, messages, versionen, modi] = await Promise.all([
        skripteService.loadSkript(skriptId),
        skripteService.loadSkripte(),
        readonly ? Promise.resolve([]) : skripteService.getChatMessages(skriptId),
        skripteService.getVersionen(skriptId),
        readonly ? Promise.resolve([]) : this.loadModiCached()
      ]);

      if (!skript) {
        container.innerHTML = '<div class="empty-state"><p>Kein Zugriff auf dieses Skript.</p></div>';
        return;
      }

      this.skript = skript;
      this.skripte = skripte;
      this.messages = messages;
      this.setVersionsState(versionen);
      if (!readonly) this.modi = modi || [];
      this.neuModus = false;

      this.updateBreadcrumb();
      this.renderLayout();
      this.bindEvents();
      if (!readonly) {
        this.subscribe();
        if (this.messages.some((m) => m.status === 'pending' || m.status === 'running')) {
          this.ensurePolling();
        }
        this.applyOffeneVisuellvorschlaege();
      }
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Skript konnte nicht geladen werden.</p>
          <p class="empty-state-detail" style="font-size: var(--text-sm); opacity: 0.7;">${escapeHtml(err.message)}</p>
          <button type="button" class="mdc-btn mdc-btn--secondary" data-retry="${escapeHtml(skriptId)}">Erneut versuchen</button>
        </div>
      `;
      container.querySelector('[data-retry]')?.addEventListener('click', () => {
        this.render(container, skriptId);
      });
    }
  }

  renderLayout() {
    const readonly = this.isReadonly;
    this.container.innerHTML = `
      <div class="skripte-editor${readonly ? ' skripte-editor--readonly' : ''}">
        <div class="skripte-editor-shell">
          <nav class="skripte-editor-liste" id="ed-liste" aria-label="Skripte"></nav>
          <main class="skripte-editor-main">
            <div class="skripte-editor-doc" id="ed-doc"></div>
          </main>
          ${readonly ? '' : `
          <aside class="skripte-editor-chat" id="ed-chat">
            <div class="skripte-editor-chat-log" id="ed-chat-log"></div>
            <div class="skripte-editor-inputwrap">
              <div class="skripte-editor-chip" id="ed-chip" hidden></div>
              <div class="skripte-editor-input">
                <textarea id="ed-input" rows="2" placeholder="${PLACEHOLDER_DEFAULT}"></textarea>
                <div class="skripte-editor-input-footer">
                  <div class="skripte-editor-input-actions">
                    <span class="skripte-editor-cost" id="ed-cost"></span>
                    <button id="ed-send" class="skripte-editor-send" title="Senden" aria-label="Senden">${SEND_ICON}</button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
          `}
        </div>
        ${readonly ? '' : `
        <div class="crm-fmenu skripte-editor-selmenu" id="ed-selmenu" hidden></div>
        <div class="crm-fmenu skripte-editor-selmenu" id="ed-modmenu" hidden></div>
        `}
      </div>
    `;

    this.renderListe();
    this.renderDoc();
    if (!readonly) {
      this.renderChat();
      this.renderCost();
    }
  }

  /** Breadcrumb: "Skripte" (klickbar, fuehrt zur Hauptseite) > aktueller Skript-Titel. */
  updateBreadcrumb() {
    const label = this.neuModus ? 'Neues Skript' : (this.skript?.titel || 'Skript');
    window.setHeadline(this.neuModus ? 'Neues Skript' : 'Skripte');
    window.breadcrumbSystem?.updateBreadcrumb([
      { label: 'Skripte', url: '/skripte', clickable: true },
      { label, clickable: false }
    ]);
  }

  /**
   * Skript-Wechsel in-place: Layout, Liste und Input bleiben stehen,
   * nur Breadcrumb, Doc (inkl. Tags/Version) und Chat werden ausgetauscht.
   */
  async switchSkript(skriptId) {
    if (this.skript && skriptId === this.skript.id) return;

    // Offener Feedback-Drawer gehoert zum alten Skript -> schliessen,
    // sonst wuerde Speichern/Loeschen das falsche Skript treffen
    this.feedbackDrawer.close();

    try { await this.inlineEdit.flush(); } catch (_) { /* Wechsel trotzdem */ }

    // Verbindungen des alten Skripts beenden (DOM und Maus-Listener bleiben)
    if (this.channel) {
      window.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.clearPending();
    const selmenu = document.getElementById('ed-selmenu');
    if (selmenu) selmenu.hidden = true;
    const modmenu = document.getElementById('ed-modmenu');
    if (modmenu) modmenu.hidden = true;

    // Ggf. Neu-Modus verlassen (laufende Generierung bleibt bewusst bestehen,
    // ihr Ergebnis wird beim Job-Done trotzdem geladen)
    if (this.neuModus) {
      this.neuModus = false;
      this.genStatus = null;
      this.genForm?.destroy?.();
      this.genForm = null;
      this.setChatInputAktiv(true);
    }

    // Sofortiges Feedback: Active-State umschalten, Inhalte dimmen
    this.container.querySelectorAll('.skripte-editor-liste-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.id === skriptId);
    });
    document.getElementById('ed-doc')?.classList.add('skripte-editor--laedt');
    document.getElementById('ed-chat-log')?.classList.add('skripte-editor--laedt');

    try {
      const [skript, messages, versionen] = await Promise.all([
        skripteService.loadSkript(skriptId),
        skripteService.getChatMessages(skriptId),
        skripteService.getVersionen(skriptId),
        this.loadModiCached()
      ]);

      if (!skript) {
        window.toastSystem?.error('Kein Zugriff auf dieses Skript');
        this.renderListe(); // Active-State zuruecksetzen
        return;
      }

      this.skript = skript;
      this.messages = messages;
      this.setVersionsState(versionen);

      replaceSkriptUrl(skriptId);
      this.page._merkeKontext({ skript: skriptId });

      this.updateBreadcrumb();
      this.renderListe();
      this.renderDoc();
      this.renderChat({ forceScroll: true });
      this.renderCost();

      this.subscribe();
      if (this.messages.some((m) => m.status === 'pending' || m.status === 'running')) {
        this.ensurePolling();
      }
      this.applyOffeneVisuellvorschlaege();
    } catch (err) {
      window.toastSystem?.error(err.message);
      this.renderListe();
    } finally {
      document.getElementById('ed-doc')?.classList.remove('skripte-editor--laedt');
      document.getElementById('ed-chat-log')?.classList.remove('skripte-editor--laedt');
    }
  }

  async cleanup() {
    try { await this.inlineEdit.flush(); } catch (_) { /* Abbau trotzdem */ }
    this.inlineEdit.detach();
    this.feedbackDrawer.close();
    this.cleanupGenJob();
    this.neuModus = false;
    this.genStatus = null;
    this.genForm?.destroy?.();
    this.genForm = null;
    if (this.channel) {
      window.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.onMouseUp) {
      document.removeEventListener('mouseup', this.onMouseUp);
      this.onMouseUp = null;
    }
    if (this.onDocMouseDown) {
      document.removeEventListener('mousedown', this.onDocMouseDown);
      this.onDocMouseDown = null;
    }
    this.selektion = null;
    this.pendingAktion = null;
    this.visuellApplyLaeuft = false;
  }

  // ------------------------------------------------------------------
  // Linke Spalte: Skriptliste
  // ------------------------------------------------------------------
  renderListe() {
    const el = document.getElementById('ed-liste');
    if (!el) return;
    el.innerHTML = `
      <div class="skripte-editor-liste-head">
        <span>Skripte</span>
        ${this.isReadonly ? '' : `
        <a href="${skriptEditorPath('new')}" class="mdc-btn mdc-btn--secondary" id="ed-neu" title="Neues Skript erstellen">
          <span class="mdc-btn__icon">${icon('ai-visual')}</span>
          <span class="mdc-btn__label">Neues Skript</span>
        </a>
        `}
      </div>
      ${this.skripte.map((s) => {
        const badgeText = s.unternehmen?.internes_kuerzel
          || s.unternehmen?.firmenname
          || s.marke?.markenname
          || 'Skripte';
        const aktiv = s.id === this.skript?.id;
        return `
        <a href="${skriptEditorPath(s.id)}" class="skripte-editor-liste-item ${aktiv ? 'active' : ''}"
          data-id="${s.id}"${aktiv ? ' aria-current="page"' : ''}>
          <span class="skripte-editor-liste-top">
            <span class="skripte-badge skripte-badge--pink">${escapeHtml(badgeText)}</span>
            <span class="skripte-editor-liste-datum">${escapeHtml(formatDate(s.created_at))}</span>
          </span>
          <span class="skripte-editor-liste-titel">${escapeHtml(s.titel || s.hook?.slice(0, 50) || '(ohne Titel)')}</span>
        </a>
      `;
      }).join('')}
    `;
    el.querySelector('#ed-neu')?.addEventListener('click', (e) => {
      if (this.isModifiedClick(e)) return;
      e.preventDefault();
      this.startNeuModus();
    });
    el.querySelectorAll('.skripte-editor-liste-item').forEach((link) => {
      link.addEventListener('click', (e) => {
        if (this.isModifiedClick(e)) return;
        e.preventDefault();
        if (link.dataset.id !== this.skript?.id) this.switchSkript(link.dataset.id);
      });
    });
  }

  /** Cmd/Ctrl/Shift/Mittelklick: Browser-Default (neuer Tab), kein In-Place-Switch. */
  isModifiedClick(e) {
    return e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1;
  }

  // ------------------------------------------------------------------
  // Mitte: Skript-Dokument
  // ------------------------------------------------------------------
  renderDoc() {
    const el = document.getElementById('ed-doc');
    if (!el) return;

    this.inlineEdit.detach();

    // Neu-Modus: Generator-Formular statt Skript-Inhalt
    if (this.neuModus) {
      el.innerHTML = neuModusHtml();
      // Alte Instanz sauber abbauen (Transcribe-Subscriptions!), sonst
      // leaken Channels/Polls bei jedem Re-Render im Neu-Modus
      this.genForm?.destroy?.();
      this.genForm = new SkriptGeneratorForm({ prefix: 'edgen' });
      // Selects laden asynchron nach – Formular steht sofort
      this.genForm.render(el.querySelector('#ed-genform'));
      el.querySelector('#ed-gen-start').addEventListener('click', () => this.startFragenFlow());
      el.querySelector('#ed-gen-direkt').addEventListener('click', () => this.startGenerationImEditor());
      if (this.genStatus?.laeuft) this.setGenButtonAktiv(false);
      return;
    }

    // Rueckfragen-Phase: Vorgaben + Hinweis statt (noch leerem) Skript-Inhalt
    if (this.istFragenModus()) {
      el.innerHTML = fragenModusHtml({
        skript: this.skript,
        genStatus: this.genStatus,
        docHeadActionsHtml: docHeadActionsHtml({ skript: this.skript, isReadonly: this.isReadonly }),
        vorgabenPanelHtml: vorgabenPanelHtml(this.skript)
      });
      el.querySelector('#ed-fragen-gen')?.addEventListener('click', () => this.startGenerationAusFragen());
      const input = document.getElementById('ed-input');
      if (input && !input.disabled) input.placeholder = PLACEHOLDER_FRAGEN;
      this.renderVersionSelect();
      return;
    }

    const inputEl = document.getElementById('ed-input');
    if (inputEl && inputEl.placeholder === PLACEHOLDER_FRAGEN) inputEl.placeholder = PLACEHOLDER_DEFAULT;

    el.innerHTML = skriptDocHtml({
      skript: this.skript,
      messages: this.messages,
      isReadonly: this.isReadonly,
      docHeadActionsHtml: docHeadActionsHtml({ skript: this.skript, isReadonly: this.isReadonly, feedback: true }),
      vorgabenPanelHtml: vorgabenPanelHtml(this.skript)
    });
    el.querySelector('#ed-feedback')?.addEventListener('click', () => this.openVollFeedback());
    el.querySelectorAll('.skripte-editor-visual-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.openVisuellModusMenu(btn));
    });
    this.inlineEdit.attach(el, { readonly: this.isReadonly });
    this.renderVersionSelect();
  }

  // ------------------------------------------------------------------
  // Rechte Spalte: Chat-Verlauf ("Liky")
  // ------------------------------------------------------------------
  renderChat({ forceScroll = false } = {}) {
    const el = document.getElementById('ed-chat-log');
    if (!el) return;

    // Neu-Modus: Generierungs-Fortschritt als Liky-Bubble (lokal, ohne DB-Message)
    if (this.neuModus) {
      const bubble = genStatusBubbleHtml(this.genStatus);
      if (bubble) {
        el.innerHTML = bubble;
        this.bindGenRetry(el);
      } else {
        el.innerHTML = chatLeerNeuHtml();
      }
      if (forceScroll) el.scrollTop = el.scrollHeight;
      return;
    }

    if (!this.messages.length) {
      el.innerHTML = this.versionsHinweisHtml()
        + genStatusBubbleHtml(this.genStatus)
        + chatLeerHtml();
      this.bindGenRetry(el);
      return;
    }

    // Scrollposition erhalten: nur ans Ende springen, wenn der User schon
    // (nahezu) unten war oder gerade selbst etwas abgeschickt hat
    const warUnten = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    const vorherigerScroll = el.scrollTop;

    el.innerHTML = this.versionsHinweisHtml()
      + this.messages.map((m) => this.renderMessage(m)).join('')
      + genStatusBubbleHtml(this.genStatus);

    el.querySelectorAll('[data-msg-action]').forEach((btn) => {
      btn.addEventListener('click', () => this.handleMessageAction(btn.dataset.msgAction, btn.dataset.msgId));
    });
    this.bindGenRetry(el);

    if (forceScroll || warUnten) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTop = vorherigerScroll;
    }
  }

  /**
   * Einzelne Message aktualisieren oder anhaengen, ohne den ganzen Verlauf
   * neu zu rendern (Realtime/Poll-Pfad). Faellt auf renderChat() zurueck,
   * wenn die Row nicht existiert (z.B. leerer Verlauf oder Neu-Modus).
   */
  upsertMessageRow(m) {
    const el = document.getElementById('ed-chat-log');
    if (!el || this.neuModus) {
      this.renderChat();
      return;
    }
    const html = this.renderMessage(m);
    const existing = el.querySelector(`[data-msg-row="${m.id}"]`);
    if (existing) {
      const tpl = document.createElement('template');
      tpl.innerHTML = html.trim();
      existing.replaceWith(tpl.content.firstElementChild);
    } else {
      // Vor der Gen-Status-Bubble einfuegen, damit sie immer unten bleibt
      const bubble = el.querySelector('#ed-gen-step')?.closest('.skripte-editor-msg');
      if (bubble) bubble.insertAdjacentHTML('beforebegin', html);
      else el.insertAdjacentHTML('beforeend', html);
    }
    el.querySelectorAll(`[data-msg-id="${m.id}"]`).forEach((btn) => {
      btn.addEventListener('click', () => this.handleMessageAction(btn.dataset.msgAction, btn.dataset.msgId));
    });
    const warUnten = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (warUnten) el.scrollTop = el.scrollHeight;
  }

  renderMessage(m) {
    return messageHtml(m, {
      istFragenModus: this.istFragenModus(),
      genLaeuft: !!this.genStatus?.laeuft
    });
  }

  versionsHinweisHtml() {
    return versionsHinweisHtml({
      neuModus: this.neuModus,
      versionen: this.versionen,
      aktiveVersion: this.aktiveVersion
    });
  }

  bindGenRetry(el) {
    el.querySelector('#ed-gen-retry')?.addEventListener('click', () => {
      if (this.neuModus) this.startGenerationImEditor({ retry: true });
      else this.startGenerationAusFragen();
    });
  }

  renderCost() {
    const el = document.getElementById('ed-cost');
    if (!el) return;
    if (!this.skript) {
      el.textContent = '';
      el.title = '';
      return;
    }
    const entries = [
      { model: this.skript.model, usage: this.skript.prompt_kontext?.usage },
      ...this.messages.map((m) => ({ model: m.model, usage: m.usage }))
    ];
    const cost = formatUsageCost(entries);
    el.textContent = cost ? cost.label : '';
    if (cost) el.title = cost.tooltip;
  }

  // ------------------------------------------------------------------
  // Events: Selektion, Menue, Chat-Input
  // ------------------------------------------------------------------
  bindEvents() {
    if (this.isReadonly) return;
    const input = document.getElementById('ed-input');
    document.getElementById('ed-send')?.addEventListener('click', () => this.sendChat());
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChat();
      }
      if (e.key === 'Escape') {
        const mod = document.getElementById('ed-modmenu');
        if (mod) mod.hidden = true;
        const sel = document.getElementById('ed-selmenu');
        if (sel) sel.hidden = true;
        if (this.pendingAktion) this.clearPending();
      }
    });

    // Selektions-Menue: nach Mouseup pruefen, ob Auswahl in einer Sektion liegt
    this.onMouseUp = (e) => {
      const menu = document.getElementById('ed-selmenu');
      if (!menu || menu.contains(e.target)) return;
      // Timeout: Selection ist erst nach dem Event final
      setTimeout(() => this.checkSelection(), 10);
    };
    document.addEventListener('mouseup', this.onMouseUp);

    this.onDocMouseDown = (e) => {
      for (const id of ['ed-selmenu', 'ed-modmenu']) {
        const menu = document.getElementById(id);
        if (menu && !menu.hidden && !menu.contains(e.target)) {
          menu.hidden = true;
        }
      }
    };
    document.addEventListener('mousedown', this.onDocMouseDown);
  }

  setChatInputAktiv(aktiv) {
    const input = document.getElementById('ed-input');
    const send = document.getElementById('ed-send');
    if (input) {
      input.disabled = !aktiv;
      input.placeholder = aktiv ? PLACEHOLDER_DEFAULT : PLACEHOLDER_NEU;
    }
    if (send) send.disabled = !aktiv;
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

  startNeuModus() { this._generation.startNeuModus(); }
  setGenButtonAktiv(aktiv) { this._generation.setGenButtonAktiv(aktiv); }
  startFragenFlow() { return this._generation.startFragenFlow(); }
  startFragenRunde() { return this._generation.startFragenRunde(); }
  startGenerationAusFragen() { return this._generation.startGenerationAusFragen(); }
  startGenerationImEditor(opts) { return this._generation.startGenerationImEditor(opts); }
  handleGenJobUpdate(job) { this._generation.handleGenJobUpdate(job); }
  finishGeneration(skriptId) { return this._generation.finishGeneration(skriptId); }
  cleanupGenJob() { this._generation.cleanupGenJob(); }

  sendChat() { return this._chatActions.sendChat(); }
  sendMessagePair(args) { return this._chatActions.sendMessagePair(args); }
  retryMessage(msg) { return this._chatActions.retryMessage(msg); }
  handleMessageAction(action, messageId) { return this._chatActions.handleMessageAction(action, messageId); }
  acceptVorschlag(msg) { return this._chatActions.acceptVorschlag(msg); }
  saveManuell(feld, text, vorher) { return this._chatActions.saveManuell(feld, text, vorher); }

  openSektionsFeedback() { return this._feedback.openSektionsFeedback(); }
  submitSektionsFeedback(args) { return this._feedback.submitSektionsFeedback(args); }
  openVollFeedback() { return this._feedback.openVollFeedback(); }

  checkSelection() { this._selection.checkSelection(); }
  setPendingAktion(aktion) { this._selection.setPendingAktion(aktion); }
  clearPending() { this._selection.clearPending(); }
  updateChip() { this._selection.updateChip(); }

  startVisuell(sektion, modus) { return this._visuell.startVisuell(sektion, modus); }
  openVisuellModusMenu(btn) { return this._visuell.openModusMenu(btn); }
  applyVisuellVorschlag(msg) { return this._visuell.applyVisuellVorschlag(msg); }
  applyOffeneVisuellvorschlaege() { return this._visuell.applyOffene(); }

  async loadModiCached() {
    if (this.isReadonly || this._modiGeladen) return this.modi;
    try {
      this.modi = await skripteService.loadAktiveModi() || [];
    } catch (_) {
      this.modi = [];
    }
    this._modiGeladen = true;
    return this.modi;
  }

  subscribe() { this._realtime.subscribe(); }
  ensurePolling() { this._realtime.ensurePolling(); }
  applyMessageUpdate(row, eventType) { this._realtime.applyMessageUpdate(row, eventType); }
}
