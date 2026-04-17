// SearchController.js
// Globaler Such-Controller: besitzt das Input-Element, managt Debounce, minChars und Lifecycle.
// Überlebt Shell-Re-Renders, weil er sein DOM per Slot-Pattern persistent hält.

import { SearchControllerDOM } from './SearchControllerDOM.js';

export class SearchController {
  /**
   * @param {Object} options
   * @param {string} options.entity - Entity-Typ (z.B. 'auftrag', 'marke')
   * @param {string} [options.placeholder] - Placeholder-Text
   * @param {number} [options.minChars=2] - Mindestzeichen bevor onSearch feuert
   * @param {number} [options.debounce=250] - Debounce-Delay in ms
   * @param {string} [options.initialValue=''] - Startwert
   * @param {Function} options.onSearch - Callback: (query: string) => void
   */
  constructor(options = {}) {
    this.entity = options.entity;
    this.onSearch = options.onSearch;
    this.minChars = options.minChars ?? 2;
    this.debounceDelay = options.debounce ?? 250;

    this._dom = new SearchControllerDOM(this.entity, {
      placeholder: options.placeholder,
      initialValue: options.initialValue || ''
    });

    this._abortController = null;
    this._debounceTimer = null;
    this._lastFiredQuery = options.initialValue || '';
    this._mounted = false;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────

  /**
   * Mountet das Input in den Slot. Kann beliebig oft aufgerufen werden
   * (z.B. nach Shell-Re-Render) – verschiebt das bestehende Element
   * ohne State-Verlust.
   * @returns {boolean} true wenn Mount erfolgreich
   */
  mount() {
    const success = this._dom.mountIntoSlot();
    if (!success) return false;

    if (!this._mounted) {
      this._bindEvents();
      this._mounted = true;
    }

    return true;
  }

  /**
   * Re-Mount: Sucht den Slot erneut und verschiebt das Input dorthin.
   * Nützlich nach Shell-Re-Renders, bei denen der alte Slot ersetzt wurde.
   */
  remount() {
    return this._dom.mountIntoSlot();
  }

  destroy() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }

    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }

    this._dom.destroy();
    this._mounted = false;
    this._lastFiredQuery = '';
  }

  // ─── Public API ─────────────────────────────────────────────────────

  getValue() {
    return this._dom.getValue();
  }

  setValue(value) {
    this._dom.setValue(value);
    this._lastFiredQuery = value;
  }

  clear() {
    this.setValue('');
    this._fireSearch('');
  }

  // ─── Event-Binding ──────────────────────────────────────────────────

  _bindEvents() {
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const input = this._dom.input;
    const clearBtn = this._dom.clearBtn;

    if (!input) return;

    input.addEventListener('input', (e) => {
      const value = e.target.value;
      this._dom.updateClearButton();
      this._handleInput(value);
    }, { signal });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.clear();
        input.blur();
      }
    }, { signal });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this._dom.setValue('');
        this._dom.input.focus();
        this._cancelDebounce();
        this._fireSearch('');
      }, { signal });
    }
  }

  // ─── Debounce + minChars Logik ──────────────────────────────────────

  _handleInput(rawValue) {
    const value = rawValue.trim();

    this._cancelDebounce();

    if (value.length === 0) {
      this._fireSearch('');
      return;
    }

    if (value.length < this.minChars) {
      if (this._lastFiredQuery !== '') {
        this._fireSearch('');
      }
      return;
    }

    this._debounceTimer = setTimeout(() => {
      this._fireSearch(value);
    }, this.debounceDelay);
  }

  _fireSearch(query) {
    this._lastFiredQuery = query;
    if (this.onSearch) {
      this.onSearch(query);
    }
  }

  _cancelDebounce() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }
}

export default SearchController;
