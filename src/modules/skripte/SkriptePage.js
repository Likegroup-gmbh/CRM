// SkriptePage.js
// KI-Skript-Generator (Layer 1): Generator, Skript-Liste + Feedback,
// DNA-Verwaltung, Auswertung. Erreichbar unter /skripte (nur intern).

import { SkriptGeneratorTab } from './SkriptGeneratorTab.js';
import { SkriptListeTab } from './SkriptListeTab.js';
import { SkriptDnaTab } from './SkriptDnaTab.js';
import { SkriptPersonasTab } from './SkriptPersonasTab.js';
import { SkriptAuswertungTab } from './SkriptAuswertungTab.js';
import { SkriptEditorView } from './SkriptEditorView.js';

const TABS = [
  { id: 'generator', label: 'Generator' },
  { id: 'skripte', label: 'Skripte & Feedback' },
  { id: 'dna', label: 'Skript-DNA' },
  { id: 'personas', label: 'Personas' },
  { id: 'auswertung', label: 'Auswertung' }
];

const KONTEXT_KEY = 'skripte:kontext';

// Einmaliger Fallback: nur wenn die Seite per echtem Browser-Reload (Cmd+R/F5)
// direkt auf /skripte geladen wurde. Wird beim ersten init() verbraucht, damit
// spaetere SPA-Navigationen (Breadcrumb, Sidebar) den Editor nicht ungewollt oeffnen.
let reloadFallbackOffen = (() => {
  try {
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    return nav?.type === 'reload' && new URL(nav.name).pathname.startsWith('/skripte');
  } catch {
    return false;
  }
})();

export class SkriptePage {
  constructor() {
    this.generatorTab = new SkriptGeneratorTab(this);
    this.listeTab = new SkriptListeTab(this);
    this.dnaTab = new SkriptDnaTab(this);
    this.personasTab = new SkriptPersonasTab(this);
    this.auswertungTab = new SkriptAuswertungTab(this);
    this.editorView = new SkriptEditorView(this);
    this.activeTab = 'generator';
  }

  async init() {
    if (!window.isInternal?.()) {
      window.setContentSafely(window.content, `
        <div class="empty-state">
          <p>Kein Zugriff – der Skript-Generator ist nur für interne Mitarbeiter.</p>
        </div>
      `);
      return;
    }

    // Aktiven Tab aus der URL wiederherstellen (?tab=<id>)
    const params = new URLSearchParams(window.location.search);
    let tabParam = params.get('tab');
    let skriptParam = params.get('skript');

    // Fallback: Query ging bei einem echten Browser-Reload verloren
    // (z.B. Extension, alte Session) -> zuletzt gemerkten Kontext nutzen
    if (!tabParam && !skriptParam && reloadFallbackOffen) {
      const kontext = this._leseKontext();
      if (kontext) {
        tabParam = kontext.tab || null;
        skriptParam = kontext.skript || null;
        const url = new URL(window.location.href);
        if (tabParam) url.searchParams.set('tab', tabParam);
        if (skriptParam) url.searchParams.set('skript', skriptParam);
        window.history.replaceState({ route: url.pathname + url.search }, '', url);
      }
    }
    reloadFallbackOffen = false;

    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      this.activeTab = tabParam;
    }

    window.setHeadline('Skript-Generator');
    window.setContentSafely(window.content, `
      <div class="skripte-page">
        <div class="skripte-tabs">
          ${TABS.map((t) => `
            <button class="skripte-tab ${t.id === this.activeTab ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>
          `).join('')}
        </div>
        <div id="skripte-tab-content"></div>
      </div>
    `);

    document.querySelectorAll('.skripte-tab').forEach((btn) => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Deep-Link: /skripte?skript=<id> oeffnet direkt den Editor
    if (skriptParam) {
      await this.openEditor(skriptParam);
      return;
    }

    await this.renderActiveTab();
  }

  async switchTab(tabId) {
    if (tabId === this.activeTab) return;
    this.cleanupTabs();
    this.activeTab = tabId;
    document.querySelectorAll('.skripte-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Tab in der URL persistieren (Reload-faehig)
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabId);
    window.history.replaceState({ route: url.pathname + url.search }, '', url);
    this._merkeKontext({ tab: tabId });

    await this.renderActiveTab();
  }

  async renderActiveTab() {
    const container = document.getElementById('skripte-tab-content');
    if (!container) return;
    const tab = {
      generator: this.generatorTab,
      skripte: this.listeTab,
      dna: this.dnaTab,
      personas: this.personasTab,
      auswertung: this.auswertungTab
    }[this.activeTab];
    await tab.render(container);
  }

  /** Vom Generator aus: Skript-Detail (Feedback) im Skripte-Tab oeffnen. */
  async openSkriptDetail(skriptId) {
    await this.switchTab('skripte');
    await this.listeTab.openDetailDrawer(skriptId);
  }

  // ------------------------------------------------------------------
  // Chat-Editor (3-Spalten-View, ersetzt den Tab-Inhalt)
  // ------------------------------------------------------------------
  async openEditor(skriptId) {
    const container = document.getElementById('skripte-tab-content');
    if (!container) return;

    this.cleanupTabs();
    document.querySelector('.skripte-page')?.classList.add('skripte-page--editor');
    const tabsEl = document.querySelector('.skripte-tabs');
    if (tabsEl) tabsEl.style.display = 'none';

    // URL fuer Reload/Teilen stabil halten
    const url = new URL(window.location.href);
    url.searchParams.set('skript', skriptId);
    window.history.replaceState({ route: url.pathname + url.search }, '', url);
    this._merkeKontext({ skript: skriptId });

    await this.editorView.render(container, skriptId);
  }

  // ------------------------------------------------------------------
  // Kontext-Persistenz (sessionStorage): Fallback fuer Reload ohne Query
  // ------------------------------------------------------------------
  _merkeKontext(update) {
    try {
      const alt = this._leseKontext() || {};
      const neu = { ...alt, tab: this.activeTab, ...update };
      if (neu.skript === null) delete neu.skript;
      sessionStorage.setItem(KONTEXT_KEY, JSON.stringify(neu));
    } catch { /* sessionStorage nicht verfuegbar -> Fallback entfaellt */ }
  }

  _leseKontext() {
    try {
      const raw = sessionStorage.getItem(KONTEXT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  cleanupTabs() {
    this.generatorTab.cleanup?.();
    this.listeTab.cleanup?.();
    this.dnaTab.cleanup?.();
    this.personasTab.cleanup?.();
    this.auswertungTab.cleanup?.();
    this.editorView.cleanup?.();
  }

  destroy() {
    this.cleanupTabs();
  }
}

export const skriptePage = new SkriptePage();
