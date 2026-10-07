// SelectionBar.js
// Gemeinsame Mehrfachauswahl für Tabellen mit schwebender Aktionsleiste:
//
//   bindCheckboxSelection  Checkbox je Zeile, Select-All im Kopf, optional Zeilenklick.
//                          Hält die Auswahl in einem Set (IDs) oder einer Map (Schlüssel -> Snapshot).
//   SelectionBar           Die Leiste unten: Zähler, Aktions-Slot, "Auswahl aufheben".
//
// Die Liste liefert nur die Aktionen (HTML) und reagiert in onAction. Welche Zeilen
// gewählt sind und wie sie heißen, bleibt Sache der Liste.
//
// Einbinden:
//   const bar = new SelectionBar({ id: 'meine-leiste', countLabel: 'Creator ausgewählt',
//     onAction: (name) => ..., onDeselect: () => ... });
//   bar.mount('<button data-selection-action="assign">Zuweisen</button>');
//   const sel = bindCheckboxSelection({ root, signal, selected: new Set(), itemSelector: '.row-check',
//     selectAllSelector: '.select-all', onChange: () => bar.update(selected.size) });

const INTERAKTIV = 'a, button, input, select, textarea, label, .avatar-bubble';

function writeSelection(selected, key, checked, snapshot) {
  if (!key) return;
  if (!checked) {
    selected.delete(key);
    return;
  }
  if (selected instanceof Map) selected.set(key, snapshot);
  else selected.add(key);
}

/**
 * Bindet Checkbox-Auswahl per Event-Delegation auf `root`.
 *
 * @param {Object} params
 * @param {HTMLElement|Document} params.root - stabiler Container, Zeilen dürfen neu gerendert werden
 * @param {AbortSignal} [params.signal]
 * @param {Set<string>|Map<string, any>} params.selected - Auswahl (Identität bleibt stabil)
 * @param {string} params.itemSelector - Checkbox je Zeile
 * @param {string} [params.selectAllSelector] - Select-All-Checkbox im Kopf
 * @param {(cb: HTMLInputElement) => string} [params.keyOf] - Schlüssel einer Zeile (Standard: data-id)
 * @param {(cb: HTMLInputElement) => any} [params.snapshotOf] - Wert für Map-Auswahlen
 * @param {string} [params.rowSelector] - Wenn gesetzt, wählt ein Klick auf die Zeile
 * @param {() => boolean} [params.rowEnabled] - schaltet den Zeilenklick zur Laufzeit ein/aus
 * @param {(change: {source: 'item'|'all'|'row', checkbox: HTMLInputElement, checked: boolean}) => void} [params.onChange]
 * @returns {{restore: Function, syncSelectAll: Function, clear: Function}}
 */
export function bindCheckboxSelection({
  root,
  signal,
  selected,
  itemSelector,
  selectAllSelector = null,
  keyOf = (cb) => cb.dataset.id,
  snapshotOf = () => true,
  rowSelector = null,
  rowEnabled = () => true,
  onChange = () => {}
}) {
  const items = () => Array.from(root.querySelectorAll(itemSelector));
  const selectAll = () => (selectAllSelector ? root.querySelector(selectAllSelector) : null);

  const syncSelectAll = () => {
    const header = selectAll();
    if (!header) return;
    const all = items();
    const checked = all.filter(cb => cb.checked);
    header.checked = all.length > 0 && checked.length === all.length;
    header.indeterminate = checked.length > 0 && checked.length < all.length;
  };

  const set = (cb, checked) => {
    cb.checked = checked;
    writeSelection(selected, keyOf(cb), checked, checked ? snapshotOf(cb) : undefined);
  };

  root.addEventListener('change', (e) => {
    const target = e.target;
    if (!target?.matches) return;

    if (selectAllSelector && target.matches(selectAllSelector)) {
      items().forEach(cb => set(cb, target.checked));
      target.indeterminate = false;
      onChange({ source: 'all', checkbox: target, checked: target.checked });
      return;
    }

    if (target.matches(itemSelector)) {
      set(target, target.checked);
      syncSelectAll();
      onChange({ source: 'item', checkbox: target, checked: target.checked });
    }
  }, { signal });

  if (rowSelector) {
    root.addEventListener('click', (e) => {
      if (!rowEnabled()) return;
      if (e.target.closest?.(INTERAKTIV)) return;
      const row = e.target.closest?.(rowSelector);
      if (!row || !root.contains(row)) return;
      const cb = row.querySelector(itemSelector);
      if (!cb) return;
      set(cb, !cb.checked);
      syncSelectAll();
      onChange({ source: 'row', checkbox: cb, checked: cb.checked });
    }, { signal });
  }

  return {
    /**
     * Nach einem Render: Checkboxen passend zur Auswahl setzen.
     * Mit prune werden Schlüssel entfernt, die nicht mehr im DOM stehen.
     */
    restore({ prune = false } = {}) {
      const boxes = items();
      const present = new Set();
      boxes.forEach(cb => {
        const key = keyOf(cb);
        present.add(key);
        cb.checked = selected.has(key);
      });
      if (prune) {
        Array.from(selected instanceof Map ? selected.keys() : selected)
          .filter(key => !present.has(key))
          .forEach(key => selected.delete(key));
      }
      syncSelectAll();
    },

    syncSelectAll,

    /** Auswahl leeren und alle Checkboxen zurücksetzen. */
    clear() {
      selected.clear();
      items().forEach(cb => { cb.checked = false; });
      const header = selectAll();
      if (header) {
        header.checked = false;
        header.indeterminate = false;
      }
    }
  };
}

export class SelectionBar {
  /**
   * @param {Object} params
   * @param {string} params.id - DOM-ID der Leiste
   * @param {string} [params.countLabel] - Text hinter der Zahl
   * @param {(name: string, event: Event) => void} [params.onAction] - Klick auf [data-selection-action]
   * @param {() => void} [params.onDeselect] - Klick auf "Auswahl aufheben"
   */
  constructor({ id, countLabel = 'ausgewählt', onAction = () => {}, onDeselect = () => {} }) {
    this.id = id;
    this.countLabel = countLabel;
    this.onAction = onAction;
    this.onDeselect = onDeselect;
    this.el = null;
  }

  /** Leiste (neu) aufbauen, versteckt. Ersetzt eine vorhandene Leiste gleicher ID. */
  mount(actionsHtml = '') {
    document.getElementById(this.id)?.remove();

    const bar = document.createElement('div');
    bar.id = this.id;
    bar.className = 'selection-bar';
    bar.innerHTML = `
      <span class="bulk-count">0 ${this.countLabel}</span>
      <div class="bulk-bar-actions">
        ${actionsHtml}
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-selection-deselect>Auswahl aufheben</button>
      </div>
    `;
    bar.addEventListener('click', (e) => {
      const action = e.target.closest('[data-selection-action]');
      if (action && !action.disabled) {
        this.onAction(action.dataset.selectionAction, e);
        return;
      }
      if (e.target.closest('[data-selection-deselect]')) this.onDeselect();
    });
    bar.style.display = 'none';

    document.body.appendChild(bar);
    this.el = bar;
    return bar;
  }

  /** Zähler setzen, Leiste ab einer Auswahl zeigen. */
  update(count) {
    if (!this.el) return;
    this.el.style.display = count > 0 ? 'flex' : 'none';
    const countEl = this.el.querySelector('.bulk-count');
    if (countEl) countEl.textContent = `${count} ${this.countLabel}`;
  }

  query(selector) {
    return this.el?.querySelector(selector) || null;
  }

  destroy() {
    this.el?.remove();
    this.el = null;
  }
}
