// SkriptEditorView.js
// Skript-Editor (3 Spalten in einer Shell, nach Figma):
//   links   Skriptliste zum Umschalten
//   mitte   Skript (Hook/Hauptteil/CTA) mit Selektions-Menue
//   rechts  Feedback-Panel: Kommentar-Threads an markierten Stellen
// Der AI-Chat ("Liky") laeuft in der ChatPanelShell (src/core/chat): Toggle
// sitzt im globalen Header, das Panel oeffnet rechts als Drawer und kann
// im Kopf verkleinert/vergroessert werden. Die Assistant-Message in
// skript_chat_messages ist der Job (Realtime + Poll), Kommentare liegen
// getrennt in skript_kommentare.
//
// Fassade/Orchestrator: State + Lifecycle + Listen-/Doc-/Chat-Verdrahtung.
// Fachlogik liegt in den Controllern unter editor/ (Generation, ChatActions,
// Selection, Versionen, Visuell, Realtime, Feedback), das Markup in den
// puren Renderern (SkriptEditorDocRenderer, SkriptEditorChatRenderer,
// SkriptFeedbackRenderer).

import { bindCollapsible } from '../../core/collapsiblePanel.js';
import { ChatPanelShell } from '../../core/chat/ChatPanelShell.js';
import { icon } from '../../core/icons/IconSystem.js';
import { revealLines, cancelLineReveal } from '../../core/animation/lineReveal.js';
import { skripteService } from './SkripteService.js';
import { matchesKampagne } from './SkriptList.js';
import { openSkriptCreateDrawer } from './SkriptCreateDrawer.js';
import { InlineEdit } from '../../core/components/InlineEdit.js';
import { escapeHtml, formatDate, formatUsageCost, replaceSkriptUrl, skriptEditorPath } from './SkripteUtils.js';
import {
  SEND_ICON, PLACEHOLDER_DEFAULT, PLACEHOLDER_NEU, PLACEHOLDER_FRAGEN
} from './editor/skriptEditorKonstanten.js';
import {
  fragenModusHtml, skriptDocHtml, docHeadActionsHtml, vorgabenPanelHtml,
  verknuepfungenHtml
} from './editor/SkriptEditorDocRenderer.js';
import {
  chatLeerHtml, genStatusBubbleHtml, messageHtml, versionsHinweisHtml
} from './editor/SkriptEditorChatRenderer.js';
import { SkriptEditorGeneration } from './editor/SkriptEditorGeneration.js';
import { SkriptEditorChatActions } from './editor/SkriptEditorChatActions.js';
import { SkriptEditorSelection } from './editor/SkriptEditorSelection.js';
import { SkriptEditorFormat } from './editor/SkriptEditorFormat.js';
import { htmlToInlineMd } from '../../core/utils/inlineFormat.js';
import { SkriptEditorVersionen } from './editor/SkriptEditorVersionen.js';
import { SkriptEditorVisuell } from './editor/SkriptEditorVisuell.js';
import { SkriptEditorRealtime } from './editor/SkriptEditorRealtime.js';
import { SkriptFeedbackPanel } from './editor/SkriptFeedbackPanel.js';
import { SkriptKooperationDrawer } from './SkriptKooperationDrawer.js';

const MSG_TEXT_SEL = '.skripte-editor-msg-text, .skripte-editor-vorschlag-text';
const MSG_FOOTER_SEL = '.skripte-editor-msg-actions, .skripte-editor-msg-state, p.skripte-hint';

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function cancelRowReveal(row) {
  row?.querySelectorAll(MSG_TEXT_SEL).forEach((node) => cancelLineReveal(node));
}

/**
 * Text-Ziele und Footer leeren/verstecken, bevor die Row ins Live-DOM kommt.
 * Sonst malt der Browser einen Frame den kompletten Block.
 */
function prepareRevealTargets(row) {
  const textByTarget = [];
  for (const node of row.querySelectorAll(MSG_TEXT_SEL)) {
    const text = node.textContent ?? '';
    node.textContent = '';
    const wrap = node.classList.contains('skripte-editor-vorschlag-text')
      ? node.closest('.skripte-editor-vorschlag')
      : null;
    if (wrap) wrap.style.display = 'none';
    textByTarget.push({ el: node, text, wrap });
  }
  for (const f of row.querySelectorAll(MSG_FOOTER_SEL)) f.style.display = 'none';
  return textByTarget;
}

function bindRevealScroll(logEl) {
  const follow = { current: logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 120 };
  let pinning = false;
  const onScroll = () => {
    if (pinning) return;
    follow.current = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 120;
  };
  logEl.addEventListener('scroll', onScroll, { passive: true });
  const pin = () => {
    if (!follow.current) return;
    pinning = true;
    logEl.scrollTop = logEl.scrollHeight;
    pinning = false;
  };
  const stop = () => logEl.removeEventListener('scroll', onScroll);
  return { pin, stop };
}

/** Erst Kommentar, dann Vorschlag; Footer (Buttons) erst nach dem Reveal. */
async function revealMessageRow(row, { pin, textByTarget } = {}) {
  const footers = [...row.querySelectorAll(MSG_FOOTER_SEL)];
  for (const f of footers) f.style.display = 'none';

  const targets = textByTarget?.length
    ? textByTarget
    : [...row.querySelectorAll(MSG_TEXT_SEL)].map((el) => ({
      el,
      text: el.textContent ?? '',
      wrap: el.classList.contains('skripte-editor-vorschlag-text')
        ? el.closest('.skripte-editor-vorschlag')
        : null
    }));

  for (const { el, text, wrap } of targets) {
    if (!row.isConnected) return;
    if (!text) continue;
    if (wrap) wrap.style.display = '';
    await revealLines(el, { text, onLine: pin });
  }
  if (!row.isConnected) return;

  const reduce = prefersReducedMotion();
  for (const f of footers) {
    if (!f.isConnected) return;
    f.style.display = '';
    if (!reduce && typeof f.animate === 'function') {
      f.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 180, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }
      );
    }
  }
  pin?.();
}

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
   */
  get kannKommentieren() {
    if (window.permissionSystem?.isGast) return window.guestShare?.rechte === 'feedback';
    return Boolean(window.currentUser?.id);
  }

  /** Threads abhaken bleibt intern (serverseitig zusaetzlich per RPC erzwungen). */
  get kannErledigen() {
    return Boolean(window.isInternal?.()) && (window.canEdit?.('skripte') ?? false);
  }

  /** Teilen-Button im Doc-Kopf: nur intern und nur fuer ein geladenes Skript. */
  get kannTeilen() {
    return Boolean(window.isInternal?.()) && (window.canEdit?.('skripte') ?? false) && Boolean(this.skript?.id);
  }

  /** Creator/Kooperation zuweisen: nur intern. */
  get kannZuweisen() {
    return Boolean(window.isInternal?.()) && (window.canEdit?.('skripte') ?? false);
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------
  async render(container, skriptId) {
    await this.cleanup();
    this.container = container;

    container.innerHTML = '<div class="empty-state"><p>Skript wird geladen...</p></div>';

    const readonly = this.isReadonly;
    try {
      // Skript zuerst: die Sidebar wird auf dessen Kampagne gescoped
      const skript = await skripteService.loadSkript(skriptId);

      if (!skript) {
        container.innerHTML = '<div class="empty-state"><p>Kein Zugriff auf dieses Skript.</p></div>';
        return;
      }

      const [skripte, messages, versionen, modi, kommentare, verknuepfungen] = await Promise.all([
        skripteService.loadSkripte({ kampagneId: skript.kampagne_id ?? null }),
        readonly ? Promise.resolve([]) : skripteService.getChatMessages(skriptId),
        skripteService.getVersionen(skriptId),
        readonly ? Promise.resolve([]) : this.loadModiCached(),
        this._feedback.load(skriptId),
        skripteService.loadSkriptVerknuepfungen(skriptId).catch(() => [])
      ]);

      this.skript = skript;
      this.skripte = skripte;
      this._listeKampagneId = skript.kampagne_id ?? null;
      this.messages = messages;
      this.kommentare = kommentare;
      this.verknuepfungen = verknuepfungen || [];
      this.setVersionsState(versionen);
      if (!readonly) this.modi = modi || [];
      this.updateBreadcrumb();
      this.renderLayout();
      this.bindEvents();
      this._feedback.subscribe();
      if (!readonly) {
        this.subscribe();
        if (this.messages.some((m) => m.status === 'pending' || m.status === 'running')) {
          this.ensurePolling();
          // Laufender Job: Bubble aufmachen, sonst sieht der User den Fortschritt nicht
          this.setLikyOffen(true, { persist: false });
        } else if (this.sollFragenRundeStarten()) {
          this.setLikyOffen(true, { persist: false });
          this.startFragenRunde();
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
    const listeCollapsed = this.sollListeStartCollapsed();
    this.container.innerHTML = `
      <div class="skripte-editor${readonly ? ' skripte-editor--readonly' : ''}${listeCollapsed ? ' skripte-editor--liste-collapsed' : ''}">
        <div class="skripte-editor-shell">
          <nav class="skripte-editor-liste" id="ed-liste" aria-label="Skripte">
            <div class="skripte-editor-liste-head">
              <div class="skripte-editor-liste-head-start">
                <button type="button" class="sidebar-toggle-btn" id="ed-liste-toggle" title="Navigation verkleinern"></button>
                <span class="skripte-editor-liste-head-label">Skripte</span>
              </div>
              ${readonly ? '' : `
              <button type="button" class="mdc-btn mdc-btn--secondary" id="ed-neu" title="Neues Skript erstellen">
                <span class="mdc-btn__icon">${icon('ai-visual')}</span>
                <span class="mdc-btn__label">Neues Skript</span>
              </button>
              `}
            </div>
            <div id="ed-liste-items"></div>
          </nav>
          <main class="skripte-editor-main">
            <div class="skripte-editor-doc" id="ed-doc"></div>
          </main>
          <aside class="skripte-editor-fb" id="ed-fb" aria-label="Feedback">
            <div class="skripte-editor-fb-head tab-navigation" role="tablist">
              <button type="button" class="tab-button active" data-fb-tab="kommentare"
                role="tab" aria-selected="true">Kommentare <span class="tab-count" hidden></span></button>
              <button type="button" class="tab-button" data-fb-tab="aenderungen"
                role="tab" aria-selected="false">Änderungen <span class="tab-count" hidden></span></button>
            </div>
            <div class="skripte-editor-fb-log" id="ed-fb-log"></div>
          </aside>
        </div>
        <div class="crm-fmenu crm-fmenu--sm crm-fmenu--scroll skripte-editor-selmenu" id="ed-vermenu" hidden></div>
        ${this.kannKommentieren ? `
        <div class="crm-fmenu skripte-editor-selmenu" id="ed-selmenu" hidden></div>
        ` : ''}
        ${this.kannAiAktionen ? `
        <div class="crm-fmenu skripte-editor-selmenu" id="ed-modmenu" hidden></div>
        ` : ''}
      </div>
    `;

    this.bindListeHead();
    this.bindListeCollapse();
    this.bindFeedbackTabs();
    this.mountLikyChat();
    this.renderListe();
    this.renderDoc();
    this._feedback.render();
    if (!readonly) {
      this.renderChat();
      this.renderCost();
    }
  }

  /** Breadcrumb: "Skripte" (klickbar, fuehrt zur Hauptseite) > aktueller Skript-Titel. */
  updateBreadcrumb() {
    const label = this.skript?.titel || 'Skript';
    window.setHeadline('Skripte');
    // Gaeste duerfen nur die geteilte Route - kein Link auf die Gesamtliste
    if (window.permissionSystem?.isGast) {
      window.breadcrumbSystem?.updateBreadcrumb([{ label, clickable: false }]);
      return;
    }
    window.breadcrumbSystem?.updateBreadcrumb([
      { label: 'Skripte', url: '/skripte', clickable: true },
      { label, clickable: false }
    ]);
  }

  bindShareButton(el) {
    el.querySelector('#ed-share')?.addEventListener('click', () => {
      if (!this.kannTeilen) return;
      window.shareListDialog?.open({
        entityType: 'skript',
        entityId: this.skript.id,
        entityName: this.skript.titel || 'Skript'
      });
    });
  }

  /**
   * Skript-Wechsel in-place: Layout, Liste und Input bleiben stehen,
   * nur Breadcrumb, Doc (inkl. Tags/Version) und Chat werden ausgetauscht.
   */
  async switchSkript(skriptId) {
    if (this.skript && skriptId === this.skript.id) return;

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
    this._feedback.unsubscribe();
    this.clearPending();
    this.docTab = 'skript';
    this.closeVersionMenu();
    const selmenu = document.getElementById('ed-selmenu');
    if (selmenu) selmenu.hidden = true;
    const modmenu = document.getElementById('ed-modmenu');
    if (modmenu) modmenu.hidden = true;

    // Sofortiges Feedback: Active-State umschalten, Inhalte dimmen
    this.container.querySelectorAll('.skripte-editor-liste-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.id === skriptId);
    });
    document.getElementById('ed-doc')?.classList.add('skripte-editor--laedt');
    document.getElementById('ed-chat-log')?.classList.add('skripte-editor--laedt');
    document.getElementById('ed-fb-log')?.classList.add('skripte-editor--laedt');

    try {
      const [skript, messages, versionen, , kommentare, verknuepfungen] = await Promise.all([
        skripteService.loadSkript(skriptId),
        skripteService.getChatMessages(skriptId),
        skripteService.getVersionen(skriptId),
        this.loadModiCached(),
        this._feedback.load(skriptId),
        skripteService.loadSkriptVerknuepfungen(skriptId).catch(() => [])
      ]);

      if (!skript) {
        window.toastSystem?.error('Kein Zugriff auf dieses Skript');
        this.renderListe(); // Active-State zuruecksetzen
        return;
      }

      this.skript = skript;
      this.messages = messages;
      this.kommentare = kommentare;
      this.verknuepfungen = verknuepfungen || [];
      this.setVersionsState(versionen);

      // Liste nachladen, wenn das neue Skript in einer anderen Kampagne
      // liegt als der bisherige Sidebar-Scope (z.B. Neu-Modus -> Kampagne B)
      const neueKampagneId = skript.kampagne_id ?? null;
      if (neueKampagneId !== this._listeKampagneId) {
        this._listeKampagneId = neueKampagneId;
        this.skripte = await skripteService.loadSkripte({ kampagneId: neueKampagneId });
      }

      replaceSkriptUrl(skriptId);
      this.page._merkeKontext({ skript: skriptId });

      this.updateBreadcrumb();
      this.renderListe();
      this.renderDoc();
      this.renderChat({ forceScroll: true });
      this.renderCost();
      this._feedback.render();

      this.subscribe();
      this._feedback.subscribe();
      if (this.messages.some((m) => m.status === 'pending' || m.status === 'running')) {
        this.ensurePolling();
      } else if (this.sollFragenRundeStarten()) {
        this.setLikyOffen(true, { persist: false });
        this.startFragenRunde();
      }
      this.applyOffeneVisuellvorschlaege();
    } catch (err) {
      window.toastSystem?.error(err.message);
      this.renderListe();
    } finally {
      document.getElementById('ed-doc')?.classList.remove('skripte-editor--laedt');
      document.getElementById('ed-chat-log')?.classList.remove('skripte-editor--laedt');
      document.getElementById('ed-fb-log')?.classList.remove('skripte-editor--laedt');
    }
  }

  async cleanup() {
    this._likyShell?.destroy();
    this._likyShell = null;
    try { await this.inlineEdit.flush(); } catch (_) { /* Abbau trotzdem */ }
    this.inlineEdit.detach();
    this.cleanupGenJob();
    this.genStatus = null;
    this._listeKampagneId = undefined;
    if (this.channel) {
      window.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this._feedback.destroy();
    this._koopDrawer?.destroy?.();
    this._koopDrawer = null;
    this.verknuepfungen = [];
    if (this.onMouseUp) {
      document.removeEventListener('mouseup', this.onMouseUp);
      this.onMouseUp = null;
    }
    if (this.onDocMouseDown) {
      document.removeEventListener('mousedown', this.onDocMouseDown);
      this.onDocMouseDown = null;
    }
    this.closeVersionMenu();
    this._listeCollapse?.destroy();
    this._listeCollapse = null;
    this.kommentare = [];
    this.selektion = null;
    this.pendingAktion = null;
    this.visuellApplyLaeuft = false;
  }

  // ------------------------------------------------------------------
  // Linke Spalte: Skriptliste
  // ------------------------------------------------------------------
  /**
   * Einzelnes Skript in der Sidebar-Liste upserten statt nach jeder
   * Aktion die volle Liste (200 Rows) neu zu laden. Beim Stub kommen die
   * Join-Namen aus dem Generator-Formular (der Stub wurde genau mit diesen
   * IDs angelegt); sonst reicht ein frisch geladenes Skript (loadSkript
   * bringt die Joins mit).
   */
  upsertSkriptInListe(skript) {
    if (!skript) return;
    // Nur upserten, wenn das Skript zum aktuellen Sidebar-Scope passt.
    // Fremde Kampagnen wuerden sonst in der gefilterten Liste landen.
    if (this._listeKampagneId !== undefined
        && !matchesKampagne(skript, this._listeKampagneId)) return;
    const angereichert = { ...skript };
    const idx = this.skripte.findIndex((s) => s.id === skript.id);
    if (idx >= 0) this.skripte[idx] = { ...this.skripte[idx], ...angereichert };
    else this.skripte.unshift(angereichert);
  }

  bindListeHead() {
    this.container.querySelector('#ed-neu')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.isReadonly) return;
      openSkriptCreateDrawer();
    });
  }

  sollListeStartCollapsed() {
    try {
      return localStorage.getItem('skripte-liste-collapsed') === 'true';
    } catch {
      return false;
    }
  }

  bindListeCollapse() {
    this._listeCollapse?.destroy();
    const editor = this.container.querySelector('.skripte-editor');
    const btn = document.getElementById('ed-liste-toggle');
    if (!editor || !btn) return;
    this._listeCollapse = bindCollapsible({
      root: editor,
      toggleBtn: btn,
      collapsedClass: 'skripte-editor--liste-collapsed',
      storageKey: 'skripte-liste-collapsed'
    });
    this._listeCollapse.restore();
  }

  setListeCollapsed(collapsed, opts) {
    this._listeCollapse?.setCollapsed(collapsed, opts);
  }

  bindFeedbackTabs() {
    this.container.querySelectorAll('[data-fb-tab]').forEach((btn) => {
      btn.addEventListener('click', () => this._feedback.setTab(btn.dataset.fbTab));
    });
  }

  // ------------------------------------------------------------------
  // Liky: ChatPanelShell rechts, Toggle im globalen Header (ai-chat)
  // ------------------------------------------------------------------
  /** Shell nur fuer interne User; Kunden/Readonly sehen keinen Einstieg. */
  mountLikyChat() {
    this._likyShell?.destroy();
    this._likyShell = null;
    if (!this.kannAiAktionen) return;

    this._likyShell = new ChatPanelShell().mount({
      trigger: 'header',
      persistKey: 'skripte-liky',
      headerTitle: 'Liky',
      dialogLabel: 'Liky',
      ids: { root: 'ed-liky', panel: 'ed-chat' },
      panelClass: 'skripte-editor-chat',
      titleHtml: `
        <span class="skripte-editor-msg-head">
          <span class="skripte-editor-avatar">L</span>
          <span class="skripte-editor-msg-name">Liky</span>
        </span>`,
      bodyHtml: `
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
        </div>`,
      onOpen: () => {
        const log = document.getElementById('ed-chat-log');
        if (log) log.scrollTop = log.scrollHeight;
      }
    });

    const { offen, size } = this._likyShell.getStoredState();
    if (offen) this._likyShell.open({ size: size || undefined, persist: false });
  }

  istLikyOffen() {
    return Boolean(this._likyShell?.isOpen());
  }

  /** Nur ein-/ausschalten - die Groesse behaelt die Shell (Restore/letzter Zustand). */
  setLikyOffen(offen, { persist = true } = {}) {
    if (!this._likyShell) return;
    if (offen) this._likyShell.open({ persist });
    else this._likyShell.close({ persist });
    this.updateLikyDot();
  }

  /** Punkt am Header-Icon, solange Liky arbeitet oder ein Vorschlag offen ist. */
  updateLikyDot() {
    if (!this._likyShell) return;
    const aktiv = this.messages.some(
      (m) => m.status === 'pending' || m.status === 'running' || m.status === 'vorschlag'
    );
    this._likyShell.setDot(aktiv);
  }

  renderListe() {
    const el = document.getElementById('ed-liste-items');
    if (!el) return;
    // Safety-Net: nur Skripte derselben Kampagne wie das geoeffnete.
    // Das geoeffnete Skript bleibt immer sichtbar, auch wenn kampagne_id null ist.
    const kampagneId = this.skript?.kampagne_id ?? null;
    const items = this.skripte.filter((s) => s.id === this.skript?.id || matchesKampagne(s, kampagneId));
    el.innerHTML = items.map((s) => {
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
    }).join('');
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

    // Rueckfragen-Phase: Vorgaben + Hinweis statt (noch leerem) Skript-Inhalt
    if (this.istFragenModus()) {
      el.innerHTML = fragenModusHtml({
        skript: this.skript,
        genStatus: this.genStatus,
        docHeadActionsHtml: docHeadActionsHtml({
          kannTeilen: this.kannTeilen,
          verknuepfungenHtml: this.renderVerknuepfungenHtml()
        }),
        vorgabenPanelHtml: vorgabenPanelHtml(this.skript)
      });
      el.querySelector('#ed-fragen-gen')?.addEventListener('click', () => this.startGenerationAusFragen());
      this.bindShareButton(el);
      this.bindVerknuepfungen(el);
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
      docHeadActionsHtml: docHeadActionsHtml({
        kannTeilen: this.kannTeilen,
        verknuepfungenHtml: this.renderVerknuepfungenHtml()
      }),
      vorgabenPanelHtml: vorgabenPanelHtml(this.skript),
      docTab: this.docTab || 'skript'
    });
    el.querySelectorAll('[data-editor-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.docTab = btn.dataset.editorTab;
        this.renderDoc();
      });
    });
    this.bindShareButton(el);
    el.querySelectorAll('.skripte-editor-visual-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.openVisuellModusMenu(btn));
    });
    this.bindVerknuepfungen(el);
    this.inlineEdit.attach(el, { readonly: !this.kannDokumentEditieren });
    this.renderVersionSelect();
  }

  renderVerknuepfungenHtml() {
    return verknuepfungenHtml({
      verknuepfungen: this.verknuepfungen,
      kannZuweisen: this.kannZuweisen
    });
  }

  bindVerknuepfungen(el) {
    el.querySelector('#ed-skript-zuweisen')?.addEventListener('click', () => this.openKooperationDrawer());
  }

  async reloadVerknuepfungen() {
    if (!this.skript?.id) {
      this.verknuepfungen = [];
      return;
    }
    try {
      this.verknuepfungen = await skripteService.loadSkriptVerknuepfungen(this.skript.id);
    } catch (err) {
      console.warn('Skript-Verknüpfungen konnten nicht geladen werden:', err);
      this.verknuepfungen = [];
    }
  }

  openKooperationDrawer() {
    if (!this.kannZuweisen || !this.skript) return;
    if (!this._koopDrawer) this._koopDrawer = new SkriptKooperationDrawer();
    this._koopDrawer.open({
      skript: this.skript,
      verknuepfungen: this.verknuepfungen,
      onSuccess: async () => {
        await this.reloadVerknuepfungen();
        this.renderDoc();
      }
    });
  }

  // ------------------------------------------------------------------
  // Rechte Spalte: Chat-Verlauf ("Liky")
  // ------------------------------------------------------------------
  renderChat({ forceScroll = false } = {}) {
    const el = document.getElementById('ed-chat-log');
    if (!el) return;
    this.updateLikyDot();

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
  upsertMessageRow(m, { animateText = false } = {}) {
    const el = document.getElementById('ed-chat-log');
    if (!el) {
      this.renderChat();
      return;
    }
    const html = this.renderMessage(m);
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    const newRow = tpl.content.firstElementChild;
    if (!newRow) return;

    // Follow-State VOR dem Insert: nach einem Riesenblock waere
    // scrollHeight-scrollTop nicht mehr < 120, obwohl der User unten war.
    const { pin, stop } = bindRevealScroll(el);
    const textByTarget = animateText ? prepareRevealTargets(newRow) : [];

    const existing = el.querySelector(`[data-msg-row="${m.id}"]`);
    if (existing) {
      cancelRowReveal(existing);
      existing.replaceWith(newRow);
    } else {
      // Vor der Gen-Status-Bubble einfuegen, damit sie immer unten bleibt
      const bubble = el.querySelector('#ed-gen-thinking')?.closest('.skripte-editor-msg');
      if (bubble) bubble.before(newRow);
      else el.append(newRow);
    }
    el.querySelectorAll(`[data-msg-id="${m.id}"]`).forEach((btn) => {
      btn.addEventListener('click', () => this.handleMessageAction(btn.dataset.msgAction, btn.dataset.msgId));
    });
    this.updateLikyDot();
    pin();

    if (animateText) {
      revealMessageRow(newRow, { pin, textByTarget }).finally(stop);
    } else {
      stop();
    }
  }

  renderMessage(m) {
    return messageHtml(m, {
      istFragenModus: this.istFragenModus(),
      genLaeuft: !!this.genStatus?.laeuft
    });
  }

  versionsHinweisHtml() {
    return versionsHinweisHtml({
      neuModus: false,
      versionen: this.versionen,
      aktiveVersion: this.aktiveVersion
    });
  }

  bindGenRetry(el) {
    el.querySelector('#ed-gen-retry')?.addEventListener('click', () => {
      this.startGenerationAusFragen();
    });
    el.querySelector('#ed-gen-cancel')?.addEventListener('click', () => this.brichGenerationAb());
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
    this.onDocMouseDown = (e) => {
      for (const id of ['ed-selmenu', 'ed-modmenu', 'ed-vermenu']) {
        const menu = document.getElementById(id);
        if (!menu || menu.hidden || menu.contains(e.target)) continue;
        if (id === 'ed-vermenu' && e.target.closest('#ed-version')) continue;
        if (id === 'ed-vermenu') this.closeVersionMenu();
        else menu.hidden = true;
      }
    };
    document.addEventListener('mousedown', this.onDocMouseDown);

    // Selektions-Menue: nach Mouseup pruefen, ob Auswahl in einer Sektion liegt.
    // Laeuft auch fuer Kunden - sie sehen im Menue nur "Kommentieren".
    if (this.kannKommentieren) {
      this.onMouseUp = (e) => {
        const menu = document.getElementById('ed-selmenu');
        if (!menu || menu.contains(e.target)) return;
        // Timeout: Selection ist erst nach dem Event final
        setTimeout(() => this.checkSelection(), 10);
      };
      document.addEventListener('mouseup', this.onMouseUp);
    }

    if (!this.kannAiAktionen) return;
    const input = document.getElementById('ed-input');

    // Mini-WYSIWYG: Cmd/Ctrl+B/I direkt in den Grid-Zellen (nicht Master)
    const doc = document.getElementById('ed-doc');
    doc?.addEventListener('keydown', (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const taste = e.key.toLowerCase();
      if (taste !== 'b' && taste !== 'i') return;
      const zelle = this._format.zelleFuer(e.target);
      if (!zelle || !doc.contains(zelle)) return;
      e.preventDefault();
      this._format.anwendenShortcut(zelle, taste === 'b' ? 'bold' : 'italic');
    });

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
        this.closeVersionMenu();
        if (this.pendingAktion) this.clearPending();
      }
    });
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
