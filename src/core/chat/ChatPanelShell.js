// ChatPanelShell.js
// Generische Chat-Shell: gleiche Oberflaeche, zwei Placements.
//   trigger 'header' -> Icon in der Topbar, oeffnet wie zuletzt als rechter Drawer
//   trigger 'fab'    -> Bubble unten rechts, oeffnet compact
// Die Groesse (expanded|compact) ist unabhaengig vom Trigger ueber die
// Head-Buttons steuerbar. Content (Messages, Composer) liefert der Host.

import { icon } from '../icons/IconSystem.js';
import {
  registerHeaderChatToggle,
  unregisterHeaderChatToggle,
  syncHeaderChatToggle,
  setHeaderChatDot
} from './HeaderChatSlot.js';

const SIZES = new Set(['expanded', 'compact']);

export class ChatPanelShell {
  constructor() {
    this._root = null;
    this._opts = null;
    this._offen = false;
    this._size = 'compact';
    this._dot = false;
  }

  mount({
    trigger = 'header',
    persistKey = 'chat-panel',
    titleHtml = '',
    headerTitle = 'Chat öffnen',
    dialogLabel = 'Chat',
    bodyHtml = '',
    fabHtml = '',
    ids = {},
    panelClass = '',
    onOpen = null,
    onClose = null
  } = {}) {
    this.destroy();
    this._opts = { trigger, persistKey, ids, onOpen, onClose };

    const root = document.createElement('div');
    root.className = `chat-panel chat-panel--${trigger === 'fab' ? 'fab' : 'header'}`;
    if (ids.root) root.id = ids.root;
    root.innerHTML = `
      <section class="chat-panel__panel${panelClass ? ` ${panelClass}` : ''}"${ids.panel ? ` id="${ids.panel}"` : ''} role="dialog" aria-label="${dialogLabel}" hidden>
        <header class="chat-panel__head">
          <div class="chat-panel__title">${titleHtml}</div>
          <div class="chat-panel__head-actions">
            <button type="button" class="chat-panel__icon-btn chat-panel__size-btn"></button>
            <button type="button" class="chat-panel__icon-btn chat-panel__close-btn"
              title="Chat schließen" aria-label="Chat schließen">${icon('x-mark')}</button>
          </div>
        </header>
        <div class="chat-panel__body">${bodyHtml}</div>
      </section>
      ${trigger === 'fab' ? `
      <button type="button" class="chat-panel__fab"${ids.fab ? ` id="${ids.fab}"` : ''}
        title="${headerTitle}" aria-label="${headerTitle}" aria-expanded="false">
        ${fabHtml}<span class="chat-panel__dot" hidden></span>
      </button>` : ''}
    `;
    document.body.appendChild(root);
    this._root = root;

    root.querySelector('.chat-panel__close-btn')
      .addEventListener('click', () => this.close());
    root.querySelector('.chat-panel__size-btn')
      .addEventListener('click', () => this.setSize(this._size === 'expanded' ? 'compact' : 'expanded'));

    if (trigger === 'fab') {
      root.querySelector('.chat-panel__fab').addEventListener('click', () => this.toggle());
    } else {
      registerHeaderChatToggle({ title: headerTitle, onToggle: () => this.toggle() });
    }

    this._size = this.getStoredState().size || this._defaultSize();
    this._apply();
    return this;
  }

  get panel() {
    return this._root?.querySelector('.chat-panel__panel') || null;
  }

  isOpen() {
    return this._offen;
  }

  getSize() {
    return this._size;
  }

  /** Header oeffnet maximal ausgefahren, die Bubble als kleines Fenster. */
  _defaultSize() {
    return this._opts?.trigger === 'fab' ? 'compact' : 'expanded';
  }

  toggle() {
    if (this._offen) this.close();
    else this.open();
  }

  open({ size, persist = true } = {}) {
    if (!this._root) return;
    this._offen = true;
    // Nur bei expliziter Size umstellen - Header-Open sonst wie zuletzt
    if (SIZES.has(size)) this._size = size;
    if (persist) this._persist();
    this._apply();
    this._opts?.onOpen?.();
  }

  close({ persist = true } = {}) {
    if (!this._root) return;
    this._offen = false;
    if (persist) this._persistOffen();
    this._apply();
    this._opts?.onClose?.();
  }

  setSize(size, { persist = true } = {}) {
    if (!SIZES.has(size)) return;
    this._size = size;
    if (persist) this._persistSize();
    this._apply();
  }

  /** Activity-Dot am aktiven Trigger; nur sichtbar, solange das Panel zu ist. */
  setDot(aktiv) {
    this._dot = Boolean(aktiv);
    this._applyDot();
  }

  /** Body-Inhalt tauschen (z.B. beim Host-Wechsel). IDs bleiben dem Host ueberlassen. */
  setBody(html) {
    const body = this._root?.querySelector('.chat-panel__body');
    if (body) body.innerHTML = html;
  }

  /** Gespeicherter Zustand zum Restore nach dem Mount. */
  getStoredState() {
    let offen = false;
    let size = null;
    try {
      offen = localStorage.getItem(this._key('offen')) === 'true';
      const s = localStorage.getItem(this._key('size'));
      size = SIZES.has(s) ? s : null;
    } catch { /* Private Mode: startet zu */ }
    return { offen, size };
  }

  destroy() {
    if (this._opts && this._opts.trigger !== 'fab') unregisterHeaderChatToggle();
    this._root?.remove();
    this._root = null;
    this._opts = null;
    this._offen = false;
    this._dot = false;
  }

  // ------------------------------------------------------------------

  _key(suffix) {
    return `${this._opts?.persistKey || 'chat-panel'}-${suffix}`;
  }

  _persist() {
    this._persistOffen();
    this._persistSize();
  }

  _persistOffen() {
    try { localStorage.setItem(this._key('offen'), String(this._offen)); } catch { /* Private Mode */ }
  }

  _persistSize() {
    try { localStorage.setItem(this._key('size'), this._size); } catch { /* Private Mode */ }
  }

  _apply() {
    const panel = this.panel;
    if (!panel) return;
    panel.hidden = !this._offen;
    panel.classList.toggle('is-expanded', this._size === 'expanded');
    panel.classList.toggle('is-compact', this._size !== 'expanded');
    this._root.classList.toggle('is-offen', this._offen);

    const collapse = this._size === 'expanded';
    const sizeBtn = this._root.querySelector('.chat-panel__size-btn');
    sizeBtn.innerHTML = icon(collapse ? 'arrows-collapse' : 'arrows-expand');
    sizeBtn.title = collapse ? 'Chat verkleinern' : 'Chat vergrößern';
    sizeBtn.setAttribute('aria-label', sizeBtn.title);

    if (this._opts?.trigger === 'fab') {
      const fab = this._root.querySelector('.chat-panel__fab');
      fab?.setAttribute('aria-expanded', String(this._offen));
    } else {
      syncHeaderChatToggle(this._offen);
    }
    this._applyDot();
  }

  _applyDot() {
    const sichtbar = this._dot && !this._offen;
    if (this._opts?.trigger === 'fab') {
      const dot = this._root?.querySelector('.chat-panel__dot');
      if (dot) dot.hidden = !sichtbar;
    } else {
      setHeaderChatDot(sichtbar);
    }
  }
}
