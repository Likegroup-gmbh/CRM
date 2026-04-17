// SearchControllerDOM.js
// DOM-Rendering, Slot-Handling und Focus-Utilities für SearchController

const CLEAR_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
</svg>`;

export class SearchControllerDOM {
  /**
   * @param {string} entity - z.B. 'auftrag', 'marke'
   * @param {Object} options
   * @param {string} options.placeholder
   * @param {string} options.initialValue
   */
  constructor(entity, options = {}) {
    this.entity = entity;
    this.placeholder = options.placeholder || `${this._capitalize(entity)} suchen...`;
    this.initialValue = options.initialValue || '';

    this._container = null;
    this._input = null;
    this._clearBtn = null;
    this._created = false;
  }

  /**
   * Erzeugt die DOM-Elemente (einmalig, idempotent).
   * Gibt { container, input, clearBtn } zurück.
   */
  createElement() {
    if (this._created) {
      return { container: this._container, input: this._input, clearBtn: this._clearBtn };
    }

    const container = document.createElement('div');
    container.className = 'search-input-container input-with-clear';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `${this.entity}-search-input`;
    input.className = 'form-input search-input-field';
    input.placeholder = this.placeholder;
    input.value = this.initialValue;

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.id = `${this.entity}-search-clear`;
    clearBtn.className = 'clear-input-btn';
    clearBtn.title = 'Suche löschen';
    clearBtn.style.display = this.initialValue ? 'flex' : 'none';
    clearBtn.innerHTML = CLEAR_ICON_SVG;

    container.appendChild(input);
    container.appendChild(clearBtn);

    this._container = container;
    this._input = input;
    this._clearBtn = clearBtn;
    this._created = true;

    return { container, input, clearBtn };
  }

  // ─── Slot-Handling ──────────────────────────────────────────────────

  /**
   * Findet den Slot im DOM: <div data-search-slot data-entity="...">
   * @returns {HTMLElement|null}
   */
  findSlot() {
    return document.querySelector(`[data-search-slot][data-entity="${this.entity}"]`);
  }

  /**
   * Mountet den Container in den Slot.
   * Falls der Container bereits im DOM ist (vorheriger Mount),
   * wird er ohne Neuerstellung in den neuen Slot verschoben.
   * Fokus und Cursor-Position bleiben erhalten.
   * @returns {boolean} true wenn Mount erfolgreich
   */
  mountIntoSlot() {
    const slot = this.findSlot();
    if (!slot) {
      console.warn(`⚠️ SearchControllerDOM: Slot für "${this.entity}" nicht gefunden`);
      return false;
    }

    const { container } = this.createElement();

    const hadFocus = this._inputHasFocus();
    const caretPos = hadFocus ? this._getCaretPosition() : null;

    if (container.parentNode === slot) {
      return true;
    }

    slot.innerHTML = '';
    slot.appendChild(container);

    if (hadFocus) {
      this._restoreFocus(caretPos);
    }

    return true;
  }

  // ─── Focus / Caret Utilities ────────────────────────────────────────

  _inputHasFocus() {
    return this._input && document.activeElement === this._input;
  }

  _getCaretPosition() {
    if (!this._input) return null;
    return {
      start: this._input.selectionStart,
      end: this._input.selectionEnd
    };
  }

  _restoreFocus(caretPos) {
    if (!this._input) return;
    this._input.focus();
    if (caretPos !== null && caretPos !== undefined) {
      try {
        this._input.setSelectionRange(caretPos.start, caretPos.end);
      } catch (_) {
        // setSelectionRange kann bei manchen Input-Typen fehlschlagen
      }
    }
  }

  // ─── Getter ─────────────────────────────────────────────────────────

  get input() {
    return this._input;
  }

  get clearBtn() {
    return this._clearBtn;
  }

  get container() {
    return this._container;
  }

  // ─── Value-Zugriff ──────────────────────────────────────────────────

  getValue() {
    return this._input ? this._input.value : '';
  }

  setValue(value) {
    if (!this._input) return;
    this._input.value = value;
    this.updateClearButton();
  }

  updateClearButton() {
    if (!this._clearBtn || !this._input) return;
    this._clearBtn.style.display = this._input.value ? 'flex' : 'none';
  }

  // ─── Cleanup ────────────────────────────────────────────────────────

  destroy() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
    this._input = null;
    this._clearBtn = null;
    this._created = false;
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  _capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
