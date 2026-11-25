// TableSelection.js
// Checkbox-Auswahl einer Tabelle: Set der gewählten IDs plus Sync der Auswahl-UI
// (Select-All-Header, Zähler, Buttons). Kennt nur ein ListScope, nicht die Liste.
//
// Hinweis: Die Methoden hier aktualisieren den Zähler/die Buttons NICHT von selbst
// (außer renderSummary). Die Liste ruft danach updateSelection() auf, damit
// Unterklassen den Hook überschreiben können und die UI pro Aktion nur einmal
// aktualisiert wird.

export class TableSelection {
  /**
   * @param {Object} params
   * @param {import('./ListScope.js').ListScope} params.scope - DOM-Scoping
   * @param {() => {checkboxClass: string, selectAllId: string}} params.getConfig
   *   liefert die aktuellen Selektoren (lazy, Optionen sind veränderbar)
   * @param {Set<string>} [params.items] - Set der gewählten IDs (Identität bleibt stabil,
   *   Unterklassen halten Aliase darauf)
   */
  constructor({ scope, getConfig, items = new Set() }) {
    this.scope = scope;
    this.getConfig = getConfig;
    this.items = items;
  }

  /** Einzelnes Item (de)selektieren. Items ohne ID werden ignoriert. */
  toggle(id, selected) {
    if (!id) return;
    if (selected) {
      this.items.add(id);
    } else {
      this.items.delete(id);
    }
  }

  /** Select-All-Header: alle sichtbaren Checkboxen auf `checked` setzen. */
  setAllVisible(checked) {
    const { checkboxClass } = this.getConfig();
    this.scope.queryAll(`.${checkboxClass}`).forEach(cb => {
      cb.checked = checked;
      this.toggle(cb.dataset.id, checked);
    });
  }

  /** Button "Alle auswählen": alle sichtbaren wählen, Header auf checked. */
  selectAllVisible() {
    const { checkboxClass, selectAllId } = this.getConfig();
    this.scope.queryAll(`.${checkboxClass}`).forEach(cb => {
      cb.checked = true;
      if (cb.dataset.id) this.items.add(cb.dataset.id);
    });
    const header = this.scope.byId(selectAllId);
    if (header) {
      header.indeterminate = false;
      header.checked = true;
    }
  }

  /** Auswahl aufheben: Set leeren, Checkboxen und Header zurücksetzen. */
  clear() {
    const { checkboxClass, selectAllId } = this.getConfig();
    this.items.clear();
    this.scope.queryAll(`.${checkboxClass}`).forEach(cb => { cb.checked = false; });
    const header = this.scope.byId(selectAllId);
    if (header) {
      header.checked = false;
      header.indeterminate = false;
    }
  }

  /** Select-All-Header an den Zustand der Einzel-Checkboxen anpassen. */
  syncSelectAll() {
    const { checkboxClass, selectAllId } = this.getConfig();
    const header = this.scope.byId(selectAllId);
    const all = this.scope.queryAll(`.${checkboxClass}`);

    if (!header || all.length === 0) return;

    const checked = this.scope.queryAll(`.${checkboxClass}:checked`);
    const allChecked = checked.length === all.length;
    const someChecked = checked.length > 0;

    header.checked = allChecked;
    header.indeterminate = someChecked && !allChecked;
  }

  /** Zähler und Aktions-Buttons passend zur Auswahlgröße ein-/ausblenden. */
  renderSummary() {
    const count = this.items.size;
    const countEl = this.scope.byId('selected-count');
    const selectBtn = this.scope.byId('btn-select-all');
    const deselectBtn = this.scope.byId('btn-deselect-all');
    const deleteBtn = this.scope.byId('btn-delete-selected');

    if (countEl) {
      countEl.textContent = `${count} ausgewählt`;
      countEl.style.display = count > 0 ? 'inline' : 'none';
    }

    if (selectBtn) {
      selectBtn.style.display = count > 0 ? 'none' : 'inline-block';
    }

    if (deselectBtn) {
      deselectBtn.style.display = count > 0 ? 'inline-block' : 'none';
    }

    if (deleteBtn) {
      deleteBtn.style.display = count > 0 ? 'inline-block' : 'none';
    }
  }
}
