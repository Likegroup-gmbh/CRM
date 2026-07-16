// SkriptePage.js
// KI-Skript-Generator (Layer 1): Generator, Skript-Liste + Feedback,
// DNA-Verwaltung, Auswertung. Erreichbar unter /skripte (nur intern).

import { SkriptGeneratorTab } from './SkriptGeneratorTab.js';
import { SkriptListeTab } from './SkriptListeTab.js';
import { SkriptDnaTab } from './SkriptDnaTab.js';
import { SkriptPersonasTab } from './SkriptPersonasTab.js';
import { SkriptAuswertungTab } from './SkriptAuswertungTab.js';

const TABS = [
  { id: 'generator', label: 'Generator' },
  { id: 'skripte', label: 'Skripte & Feedback' },
  { id: 'dna', label: 'Skript-DNA' },
  { id: 'personas', label: 'Personas' },
  { id: 'auswertung', label: 'Auswertung' }
];

export class SkriptePage {
  constructor() {
    this.generatorTab = new SkriptGeneratorTab(this);
    this.listeTab = new SkriptListeTab(this);
    this.dnaTab = new SkriptDnaTab(this);
    this.personasTab = new SkriptPersonasTab(this);
    this.auswertungTab = new SkriptAuswertungTab(this);
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

    await this.renderActiveTab();
  }

  async switchTab(tabId) {
    if (tabId === this.activeTab) return;
    this.cleanupTabs();
    this.activeTab = tabId;
    document.querySelectorAll('.skripte-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
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

  cleanupTabs() {
    this.generatorTab.cleanup?.();
    this.listeTab.cleanup?.();
    this.dnaTab.cleanup?.();
    this.personasTab.cleanup?.();
    this.auswertungTab.cleanup?.();
  }

  destroy() {
    this.cleanupTabs();
  }
}

export const skriptePage = new SkriptePage();
