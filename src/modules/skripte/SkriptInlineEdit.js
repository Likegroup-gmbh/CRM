// SkriptInlineEdit.js
// Word-aehnliches Inline-Edit fuer Hook/Hauptteil/CTA + Visual-Zellen.
// View bleibt Orchestrator; dieses Modul haengt contenteditable an
// [data-feld]-Zellen und persistiert per onSave (Idle/Blur/Flush).

const IDLE_MS = 1000;

export class SkriptInlineEdit {
  constructor({ onChange, onSave, onInput } = {}) {
    this.onChange = onChange;
    this.onSave = onSave;
    this.onInput = onInput;
    this.root = null;
    this.readonly = false;
    this.saved = new Map();
    this.dirty = new Map();
    this.timer = null;
    this.composing = false;
    this._onInput = this._handleInput.bind(this);
    this._onBlur = this._handleBlur.bind(this);
    this._onPaste = this._handlePaste.bind(this);
    this._onCompositionStart = () => { this.composing = true; };
    this._onCompositionEnd = (e) => {
      this.composing = false;
      this._handleInput(e);
    };
  }

  attach(root, { readonly = false } = {}) {
    this.detach();
    this.root = root;
    this.readonly = readonly;
    if (!root || readonly) return;

    for (const el of this._zellen()) {
      const feld = el.dataset.feld;
      if (!feld) continue;
      el.setAttribute('contenteditable', 'plaintext-only');
      el.spellcheck = false;
      this.saved.set(feld, this._lesen(el));
      el.addEventListener('input', this._onInput);
      el.addEventListener('blur', this._onBlur);
      el.addEventListener('paste', this._onPaste);
      el.addEventListener('compositionstart', this._onCompositionStart);
      el.addEventListener('compositionend', this._onCompositionEnd);
    }
  }

  detach() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.root) {
      for (const el of this._zellen()) {
        el.removeEventListener('input', this._onInput);
        el.removeEventListener('blur', this._onBlur);
        el.removeEventListener('paste', this._onPaste);
        el.removeEventListener('compositionstart', this._onCompositionStart);
        el.removeEventListener('compositionend', this._onCompositionEnd);
        el.removeAttribute('contenteditable');
      }
    }
    this.root = null;
    this.saved.clear();
    this.dirty.clear();
    this.composing = false;
  }

  focusedFeld() {
    if (!this.root) return null;
    const el = this.root.querySelector('[data-feld]:focus');
    return el?.dataset.feld || null;
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const pending = [...this.dirty.entries()];
    this.dirty.clear();
    for (const [feld, text] of pending) {
      await this._persist(feld, text);
    }
  }

  /** Nach externem Patch (z.B. Visual-Apply) den gespeicherten Stand angleichen. */
  syncSaved(feld, text) {
    this.saved.set(feld, text ?? '');
    this.dirty.delete(feld);
  }

  _zellen() {
    return this.root?.querySelectorAll('[data-feld]') || [];
  }

  _lesen(el) {
    let text = (el.innerText ?? el.textContent ?? '').replace(/\u00a0/g, ' ');
    if (text === '\n') text = '';
    return text;
  }

  _handleInput(e) {
    if (this.composing) return;
    const el = e.currentTarget;
    const feld = el?.dataset?.feld;
    if (!feld) return;
    const text = this._lesen(el);
    this.onInput?.(feld, text);
    this.onChange?.(feld, text);
    if (text === (this.saved.get(feld) ?? '')) {
      this.dirty.delete(feld);
      return;
    }
    this.dirty.set(feld, text);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, IDLE_MS);
  }

  _handleBlur(e) {
    const feld = e.currentTarget?.dataset?.feld;
    if (!feld || !this.dirty.has(feld)) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const text = this.dirty.get(feld);
    this.dirty.delete(feld);
    this._persist(feld, text);
  }

  _handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    const el = e.currentTarget;
    if (!el) return;
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      const range = sel.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
      } else {
        el.textContent = `${el.textContent}${text}`;
      }
    } else {
      el.textContent = `${el.textContent}${text}`;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async _persist(feld, text) {
    const vorher = this.saved.get(feld) ?? '';
    if (text === vorher) return;
    try {
      await this.onSave?.(feld, text, vorher);
      this.saved.set(feld, text);
    } catch (err) {
      this.dirty.set(feld, text);
      throw err;
    }
  }
}
