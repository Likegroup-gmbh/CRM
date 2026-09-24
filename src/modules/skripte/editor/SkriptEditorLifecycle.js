// SkriptEditorLifecycle.js
// Oeffnen, Wechseln, Abbauen und Shell-Events des Skript-Editors (Prototype-Mixin).

import { icon } from '../../../core/icons/IconSystem.js';
import { skripteService } from '../SkripteService.js';
import { escapeHtml, replaceSkriptUrl } from '../SkripteUtils.js';
import { SkriptEditorView } from './SkriptEditorViewCore.js';
import { showProduktionLeaf } from '../../../core/navHerkunft.js';

SkriptEditorView.prototype.render = async function(container, skriptId) {
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
    this.warmSkriptAnschreiben();
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
};

SkriptEditorView.prototype.renderLayout = function() {
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
};

/** Breadcrumb: "Skripte" (klickbar, fuehrt zur Hauptseite) > aktueller Skript-Titel.
 *  Aus einer Produktion: Kampagnen > Kampagne > Produktion > Titel. */
SkriptEditorView.prototype.updateBreadcrumb = async function() {
  const label = this.skript?.titel || 'Skript';
  window.setHeadline('Skripte');
  // Gaeste duerfen nur die geteilte Route - kein Link auf die Gesamtliste
  if (window.permissionSystem?.isGast) {
    window.breadcrumbSystem?.updateBreadcrumb([{ label, clickable: false }]);
    return;
  }
  if (await showProduktionLeaf(label)) return;
  window.breadcrumbSystem?.updateBreadcrumb([
    { label: 'Skripte', url: '/skripte', clickable: true },
    { label, clickable: false }
  ]);
};

/**
 * Skript-Wechsel in-place: Layout, Liste und Input bleiben stehen,
 * nur Breadcrumb, Doc (inkl. Tags/Version) und Chat werden ausgetauscht.
 */
SkriptEditorView.prototype.switchSkript = async function(skriptId) {
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
    this.warmSkriptAnschreiben();
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
};

SkriptEditorView.prototype.cleanup = async function() {
  this._chatLog?.destroy();
  this._chatLog = null;
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
};

SkriptEditorView.prototype.bindFeedbackTabs = function() {
  this.container.querySelectorAll('[data-fb-tab]').forEach((btn) => {
    btn.addEventListener('click', () => this._feedback.setTab(btn.dataset.fbTab));
  });
};

SkriptEditorView.prototype.loadModiCached = async function() {
  if (this.isReadonly || this._modiGeladen) return this.modi;
  try {
    this.modi = await skripteService.loadAktiveModi() || [];
  } catch (_) {
    this.modi = [];
  }
  this._modiGeladen = true;
  return this.modi;
};

// Events: Selektion, Menue, Chat-Input. Einmal beim Oeffnen verdrahtet.
SkriptEditorView.prototype.bindEvents = function() {
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
};
