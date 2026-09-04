// EntitySearchInput.js
// Inline-Suche zum Anhaengen verknuepfter Eintraege in Relation-Panels
// (z.B. Produkte an der Persona, Personas am Produkt): Eingabefeld mit
// Dropdown, Tippen filtert serverseitig, Klick oder Enter waehlt.
//
// Bewusst kein Formularfeld: der Stand lebt im Panel, nicht im <form>.

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class EntitySearchInput {
  /**
   * @param {Object} opts
   * @param {string} opts.placeholder
   * @param {(term: string) => Promise<Array<{id: string, label: string, sub?: string, data?: *}>>} opts.search
   * @param {(item) => void} opts.onSelect
   * @param {() => void} [opts.onClose] - ESC/Klick daneben/schliessen
   * @param {string} [opts.emptyText] - Hinweis bei keinen Treffern
   */
  constructor({ placeholder = 'Suchen...', search, onSelect, onClose = null, emptyText = 'Keine Treffer' }) {
    this.placeholder = placeholder;
    this.search = search;
    this.onSelect = onSelect;
    this.onClose = onClose;
    this.emptyText = emptyText;
    this.root = null;
    this.items = [];
    this._timer = null;
    this._abort = null;
    this._ladelauf = 0;
  }

  /** @param {HTMLElement} container - wird gefuellt und uebernommen */
  mount(container) {
    this.destroy();
    this._abort = new AbortController();
    const { signal } = this._abort;

    this.root = document.createElement('div');
    this.root.className = 'rel-add';
    this.root.innerHTML = `
      <input type="text" class="rel-add__input" autocomplete="off" spellcheck="false"
             placeholder="${escapeHtml(this.placeholder)}" aria-label="${escapeHtml(this.placeholder)}">
      <div class="rel-add__dropdown" hidden></div>
    `;
    container.appendChild(this.root);

    const input = this.root.querySelector('.rel-add__input');
    input.addEventListener('input', () => this.scheduleSearch(input.value), { signal });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.items[0]) this.pick(this.items[0]);
      }
    }, { signal });

    this.root.querySelector('.rel-add__dropdown').addEventListener('mousedown', (e) => {
      // mousedown statt click: das input-blur darf die Auswahl nicht wegnehmen
      e.preventDefault();
      const item = e.target.closest('[data-rel-add-id]');
      if (!item) return;
      const treffer = this.items.find(i => String(i.id) === item.dataset.relAddId);
      if (treffer) this.pick(treffer);
    }, { signal });

    // Klick daneben schliesst - im Capture, damit Panel-Render nichts verschluckt
    document.addEventListener('mousedown', (e) => {
      if (this.root && !this.root.contains(e.target)) this.close();
    }, { signal, capture: true });

    input.focus();
    this.scheduleSearch('');
  }

  scheduleSearch(term) {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.runSearch(term), 200);
  }

  async runSearch(term) {
    const lauf = ++this._ladelauf;
    const dropdown = this.root?.querySelector('.rel-add__dropdown');
    if (!dropdown) return;

    let items = [];
    try {
      items = await this.search(term.trim()) || [];
    } catch (err) {
      console.error('Entity-Suche fehlgeschlagen:', err);
      items = [];
    }
    // Nur den letzten Aufruf rendern - aeltere Antworten duerfen nie zurueckkommen
    if (lauf !== this._ladelauf || !this.root) return;

    this.items = items;
    dropdown.innerHTML = items.length
      ? items.map(i => `
          <button type="button" class="rel-add__item" data-rel-add-id="${escapeHtml(i.id)}">
            <span class="rel-add__item-label">${escapeHtml(i.label)}</span>
            ${i.sub ? `<span class="rel-add__item-sub">${escapeHtml(i.sub)}</span>` : ''}
          </button>
        `).join('')
      : `<p class="rel-add__leer">${escapeHtml(this.emptyText)}</p>`;
    dropdown.hidden = false;
  }

  pick(item) {
    const cb = this.onSelect;
    this.close();
    cb?.(item);
  }

  close() {
    const cb = this.onClose;
    this.destroy();
    cb?.();
  }

  destroy() {
    clearTimeout(this._timer);
    this._ladelauf++;
    if (this._abort) {
      try { this._abort.abort(); } catch (_) { /* noop */ }
      this._abort = null;
    }
    this.root?.remove();
    this.root = null;
    this.items = [];
  }
}

/**
 * Oeffnet/schließt die Inline-Suche eines Relation-Panels (.rel-panel__suche)
 * und verwaltet den suche-Slot auf dem Panel (panel.suche) zentral, damit
 * beide Panels (Produkte an Persona, Personas an Produkt) nicht dieselbe
 * Wiring-Strecke pflegen.
 *
 * @param {Object} panel - Panel mit .suche, .kontext.getUnternehmenId() und .root()
 * @param {Object} opts
 * @param {string} opts.placeholder
 * @param {string} opts.emptyText
 * @param {(unternehmenId: string, term: string) => Promise<Array>} opts.search
 * @param {(item) => void} opts.onSelect
 */
export function toggleRelationSuche(panel, { placeholder, emptyText, search, onSelect }) {
  if (panel.suche) {
    panel.suche.close();
    return;
  }

  const unternehmenId = panel.kontext?.getUnternehmenId?.();
  if (!unternehmenId) {
    window.toastSystem?.warning?.('Bitte zuerst ein Unternehmen wählen');
    return;
  }

  const container = panel.root()?.querySelector('.rel-panel__suche');
  if (!container) return;

  panel.suche = new EntitySearchInput({
    placeholder,
    emptyText,
    search: (term) => search(unternehmenId, term),
    onSelect,
    onClose: () => { panel.suche = null; }
  });
  panel.suche.mount(container);
}
