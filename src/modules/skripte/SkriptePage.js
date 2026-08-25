// SkriptePage.js
// /skripte = Table-Liste, /skripte/new und /skripte/:id = 3-Spalten-Editor,
// /skripte/dna|/master = Regelwerk-Liste, /new und /:id = Dokument-Seite.

import { SkriptEditorView } from './SkriptEditorView.js';
import { SkriptList } from './SkriptList.js';
import { SkriptRegelwerkList } from './regelwerk/SkriptRegelwerkList.js';
import { SkriptRegelwerkDetail } from './regelwerk/SkriptRegelwerkDetail.js';
import { dnaAdapter, masterAdapter } from './regelwerk/regelwerkAdapters.js';
import { replaceSkriptUrl } from './SkripteUtils.js';

const KONTEXT_KEY = 'skripte:kontext';
const REGELWERK = { dna: dnaAdapter, master: masterAdapter };

export class SkriptePage {
  constructor() {
    this.list = new SkriptList();
    this.editorView = new SkriptEditorView(this);
    this.regelwerkListen = {
      dna: new SkriptRegelwerkList(dnaAdapter),
      master: new SkriptRegelwerkList(masterAdapter)
    };
    this.regelwerkDetail = new SkriptRegelwerkDetail();
  }

  async init(id, childId = null) {
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
    this.regelwerkListen.dna.cleanup();
    this.regelwerkListen.master.cleanup();
    await this.regelwerkDetail.cleanup();

    if (id === 'dna' || id === 'master') {
      if (window.isKunde?.()) {
        window.history.replaceState({ route: '/skripte' }, '', '/skripte');
        id = null;
      } else {
        await this.openRegelwerk(id, childId);
        return;
      }
    }

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

  async openRegelwerk(kind, childId) {
    const adapter = REGELWERK[kind];
    if (childId) {
      window.setHeadline(adapter.headline);
      window.setContentSafely(window.content, `
        <div class="skripte-page skripte-page--regelwerk">
          <div id="skripte-regelwerk-content"></div>
        </div>
      `);
      const container = document.getElementById('skripte-regelwerk-content');
      if (container) await this.regelwerkDetail.render(container, kind, childId);
      return;
    }

    window.setHeadline(adapter.headline);
    window.setContentSafely(window.content, `
      <div class="skripte-page">
        <div id="skripte-regelwerk-content"></div>
      </div>
    `);
    const container = document.getElementById('skripte-regelwerk-content');
    if (container) await this.regelwerkListen[kind].render(container);
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
    this.regelwerkListen.dna.cleanup();
    this.regelwerkListen.master.cleanup();
    const detail = this.regelwerkDetail.cleanup();
    const editor = this.editorView.cleanup?.();
    return Promise.all([detail, editor].filter(Boolean));
  }
}

export const skriptePage = new SkriptePage();
