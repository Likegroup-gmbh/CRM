// SkriptePage.js
// /skripte = Table-Liste, /skripte/new und /skripte/:id = 3-Spalten-Editor.
// Tab-Module (Generator, DNA, Personas, Auswertung) bleiben im Repo,
// werden hier aber nicht mehr gerendert.

import { SkriptEditorView } from './SkriptEditorView.js';
import { SkriptList } from './SkriptList.js';
import { replaceSkriptUrl } from './SkripteUtils.js';

const KONTEXT_KEY = 'skripte:kontext';

export class SkriptePage {
  constructor() {
    this.list = new SkriptList();
    this.editorView = new SkriptEditorView(this);
  }

  async init(id) {
    const canView = window.canViewPage?.('skripte')
      || window.checkUserPermission?.('skripte', 'can_view');
    if (!canView) {
      window.setContentSafely(window.content, `
        <div class="empty-state">
          <p>Kein Zugriff – Sie haben keine Berechtigung für Skripte.</p>
        </div>
      `);
      return;
    }

    await this.editorView.cleanup?.();
    this.list.destroy?.();

    // Kunden: nur lesen, kein Generator
    if (window.isKunde?.() && (id === 'new' || id === 'neu')) {
      window.history.replaceState({ route: '/skripte' }, '', '/skripte');
      id = null;
    }

    // Legacy: /skripte?skript=<id|neu> → neue Pfade (ohne navigateTo, Router ist schon aktiv)
    if (!id) {
      const skriptParam = new URLSearchParams(window.location.search).get('skript');
      if (skriptParam) {
        if (window.isKunde?.() && (skriptParam === 'neu' || skriptParam === 'new')) {
          window.history.replaceState({ route: '/skripte' }, '', '/skripte');
        } else {
          const editorId = skriptParam === 'neu' ? 'neu' : skriptParam;
          replaceSkriptUrl(editorId);
          await this.openEditor(editorId);
          return;
        }
      }
    }

    if (id === 'new' || id) {
      await this.openEditor(id === 'new' ? 'neu' : id);
      return;
    }

    window.setHeadline('Skripte');
    await this.list.init();
  }

  /** Vom Generator aus: Skript direkt im Editor oeffnen. */
  async openSkriptDetail(skriptId) {
    await this.openEditor(skriptId);
  }

  async openEditor(skriptId) {
    const isNeu = skriptId === 'neu' || skriptId === 'new';
    window.setHeadline(isNeu ? 'Neues Skript' : 'Skripte');
    window.setContentSafely(window.content, `
      <div class="skripte-page skripte-page--editor">
        <div id="skripte-tab-content"></div>
      </div>
    `);

    const container = document.getElementById('skripte-tab-content');
    if (!container) return;

    replaceSkriptUrl(skriptId);
    this._merkeKontext({ skript: isNeu ? 'neu' : skriptId });
    await this.editorView.render(container, isNeu ? 'neu' : skriptId);
  }

  _merkeKontext(update) {
    try {
      const alt = this._leseKontext() || {};
      const neu = { ...alt, ...update };
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

  destroy() {
    this.list.destroy?.();
    return this.editorView.cleanup?.();
  }
}

export const skriptePage = new SkriptePage();
