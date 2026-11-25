// TagCombobox.js
// Kleine Inline-Combobox: Suchfeld mit gruppierter Optionsliste, Mehrfachauswahl, "Neu anlegen".
// Entkoppelt vom Formular-System (FormSearchableSelect) und ohne Datenhaltung: der Aufrufer
// liefert die Optionen (`getOptions`) und nimmt Auswahl, Anlegen und Entfernen entgegen.
//
// Verhalten:
//  - Öffnen ersetzt den Inhalt von `host` durch Eingabefeld und Liste, das Feld hat sofort Fokus.
//  - Die Liste bleibt nach einer Auswahl offen, das Feld wird geleert und behält den Fokus.
//  - Pfeiltasten wandern zyklisch, der Fokus bleibt im Feld (aria-activedescendant).
//  - Enter oder Komma übernehmen die hervorgehobene Option, Backspace im leeren Feld entfernt
//    das letzte Element (onRemoveLast), Esc schließt, Tab schließt und gibt den Fokus weiter,
//    ein Klick außerhalb schließt mit kurzer Verzögerung.
//  - Ein Klick auf eine Option blurt das Feld nicht (pointerdown + preventDefault).

import { escapeHtml as esc } from '../format.js';

const BLUR_CLOSE_MS = 120;
let uid = 0;

/**
 * @typedef {{ id: string, label: string }} ComboItem
 * @typedef {{ groups: Array<{ label: string, items: ComboItem[] }>, create: string|null, emptyText?: string }} ComboOptions
 */
export class TagCombobox {
  /**
   * @param {{
   *   host: HTMLElement,
   *   getOptions: (query: string) => ComboOptions,
   *   onSelect: (item: ComboItem) => void,
   *   onCreate?: (label: string) => void,
   *   onRemoveLast?: () => void,
   *   onClose?: (reason: 'escape'|'blur'|'tab'|'api') => void,
   *   label?: string,
   *   placeholder?: string,
   *   createLabel?: (label: string) => string,
   *   onOpen?: (parts: { input: HTMLInputElement, list: HTMLElement }) => void
   * }} options
   */
  constructor(options) {
    this.o = options;
    this.id = `tag-combo-${++uid}`;
    this.entries = [];
    this.active = 0;
    this.input = null;
    this.list = null;
    this.blurTimer = null;
    this.isOpen = false;
    this._handlers = [];
  }

  open() {
    if (this.isOpen) { this.input?.focus(); return; }
    this.isOpen = true;
    const { host } = this.o;
    host.innerHTML = `
      <div class="tag-combo" data-tag-combo>
        <input type="text" class="form-input tag-combo__input" data-tag-combo-input
          role="combobox" aria-expanded="true" aria-haspopup="listbox" aria-autocomplete="list"
          aria-controls="${this.id}-list" aria-label="${esc(this.o.label || 'Tag hinzufügen')}"
          placeholder="${esc(this.o.placeholder || 'Tag suchen oder anlegen')}" autocomplete="off" />
        <ul class="tag-combo__list" id="${this.id}-list" role="listbox" data-tag-combo-list></ul>
      </div>`;
    this.input = host.querySelector('[data-tag-combo-input]');
    this.list = host.querySelector('[data-tag-combo-list]');
    this._bind();
    this.refresh({ resetActive: true });
    this.input.focus();
    this.o.onOpen?.({ input: this.input, list: this.list });
  }

  /** Liste für die aktuelle Eingabe neu aufbauen, z. B. nach einer Auswahl. */
  refresh({ resetActive = false } = {}) {
    if (!this.isOpen) return;
    const opts = this.o.getOptions(this.input.value);
    const entries = [];
    let html = '';
    opts.groups.forEach((group, gi) => {
      if (!group.items.length) return;
      html += `<li role="presentation" class="tag-combo__heading" id="${this.id}-g${gi}">${esc(group.label)}</li>`;
      group.items.forEach((item) => {
        entries.push({ kind: 'item', item });
        html += this._optionHtml(entries.length - 1, esc(item.label), `${this.id}-g${gi}`);
      });
    });
    if (opts.create) {
      entries.push({ kind: 'create', label: opts.create });
      const text = this.o.createLabel ? this.o.createLabel(opts.create) : `Neu anlegen: „${opts.create}“`;
      html += this._optionHtml(entries.length - 1, esc(text), null, ' tag-combo__option--create');
    }
    if (!entries.length) {
      html = `<li role="presentation" class="tag-combo__empty">${esc(opts.emptyText || 'Keine Treffer.')}</li>`;
    }
    this.entries = entries;
    this.active = resetActive || this.active >= entries.length ? 0 : this.active;
    this.list.innerHTML = html;
    this._paintActive();
  }

  close(reason = 'api') {
    if (!this.isOpen) return;
    clearTimeout(this.blurTimer);
    this.isOpen = false;
    this._unbind();
    this.input = null;
    this.list = null;
    this.entries = [];
    this.o.host.innerHTML = '';
    this.o.onClose?.(reason);
  }

  destroy() {
    clearTimeout(this.blurTimer);
    this._unbind();
    this.isOpen = false;
    this.input = null;
    this.list = null;
  }

  get value() {
    return this.input?.value || '';
  }

  /* ---- intern ---- */

  _optionHtml(index, label, groupId, extra = '') {
    return `<li role="option" id="${this.id}-o${index}" class="tag-combo__option${extra}" data-tag-combo-index="${index}" aria-selected="false"${groupId ? ` aria-describedby="${groupId}"` : ''}>${label}</li>`;
  }

  _paintActive() {
    if (!this.list || !this.input) return;
    const options = this.list.querySelectorAll('[role="option"]');
    options.forEach((el, i) => {
      const on = i === this.active;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) el.scrollIntoView?.({ block: 'nearest' });
    });
    if (options.length) this.input.setAttribute('aria-activedescendant', `${this.id}-o${this.active}`);
    else this.input.removeAttribute('aria-activedescendant');
  }

  _commit(index = this.active) {
    const entry = this.entries[index];
    if (!entry) return false;
    // Zuerst Eingabe leeren und Liste neu bauen, dann dem Aufrufer melden: der liest den neuen Zustand
    if (entry.kind === 'create') this.o.onCreate?.(entry.label);
    else this.o.onSelect?.(entry.item);
    if (this.isOpen) {
      this.input.value = '';
      this.refresh({ resetActive: true });
      this.input.focus();
    }
    return true;
  }

  _on(target, type, handler, opts) {
    target.addEventListener(type, handler, opts);
    this._handlers.push(() => target.removeEventListener(type, handler, opts));
  }

  _unbind() {
    this._handlers.forEach(off => off());
    this._handlers = [];
  }

  _bind() {
    const { input, list } = this;

    this._on(input, 'input', () => this.refresh({ resetActive: true }));

    this._on(input, 'keydown', (e) => {
      const n = this.entries.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!n) return;
        this.active = (this.active + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
        this._paintActive();
      } else if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        this._commit();
      } else if (e.key === 'Backspace' && !input.value) {
        this.o.onRemoveLast?.();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // Das Seitenblatt bzw. der Browser schließt nicht zusätzlich
        e.stopPropagation();
        this.close('escape');
      } else if (e.key === 'Tab') {
        this.close('tab');
      }
    });

    // Klick auf eine Option darf das Feld nicht blurren, sonst schließt sich die Liste vor dem Klick
    this._on(list, 'pointerdown', (e) => e.preventDefault());
    this._on(list, 'mousedown', (e) => e.preventDefault());
    this._on(list, 'click', (e) => {
      const el = e.target.closest('[data-tag-combo-index]');
      if (el) this._commit(Number(el.dataset.tagComboIndex));
    });
    this._on(list, 'mousemove', (e) => {
      const el = e.target.closest('[data-tag-combo-index]');
      if (!el) return;
      const i = Number(el.dataset.tagComboIndex);
      if (i !== this.active) { this.active = i; this._paintActive(); }
    });

    // Klick außerhalb bzw. Fokus weg: kurz warten, hat das Feld den Fokus zurück, bleibt es offen
    this._on(input, 'blur', () => {
      clearTimeout(this.blurTimer);
      this.blurTimer = setTimeout(() => {
        if (this.isOpen && document.activeElement !== this.input) this.close('blur');
      }, BLUR_CLOSE_MS);
    });
  }
}
