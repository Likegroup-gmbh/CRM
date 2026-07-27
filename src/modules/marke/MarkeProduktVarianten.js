// MarkeProduktVarianten.js
// Varianten-Panel in der rechten Haelfte des Produkt-Formulars.
//
// Eine Variante traegt nur das Unterscheidende (Farbe, Modell, abweichender
// Preis) und erbt den Rest von der Kollektion. Der Zustand liegt in
// this.entries, nicht im DOM - sonst gehen beim Umsortieren Eingaben verloren.

import { MarkeProduktService } from './services/MarkeProduktService.js';

let idCounter = 0;
const nextKey = () => `v${++idCounter}`;

export class ProduktVariantenPanel {
  constructor() {
    this.root = null;
    this.entries = [];
    this.suggestions = [];
  }

  /**
   * @param {HTMLElement} root - Container in .form-split-right
   * @param {Array<Object>} varianten - bestehende Varianten aus der DB
   * @param {Array<Object>} bilder - produkt_bilder mit variante_id
   */
  mount(root, varianten = [], bilder = []) {
    this.root = root;
    this.entries = varianten.map(v => ({
      key: nextKey(),
      id: v.id,
      name: v.name || '',
      modell_kompatibilitaet: v.modell_kompatibilitaet || '',
      farbe: v.farbe || '',
      preis: v.preis ?? '',
      merkmal: v.merkmal || '',
      bildFile: null,
      bildId: bilder.find(b => b.variante_id === v.id)?.id || null,
      bildUrl: this.bildUrlFor(bilder, v.id)
    }));
    this.render();
  }

  bildUrlFor(bilder, varianteId) {
    const bild = bilder.find(b => b.variante_id === varianteId);
    return bild ? MarkeProduktService.publicUrl(bild.storage_pfad) : null;
  }

  // --- Oeffentliche API fuers Formular ---

  /** Varianten im aktuellen Zustand, leere Zeilen ohne Namen fallen raus. */
  getVarianten() {
    return this.entries
      .filter(e => e.name.trim())
      .map(e => ({
        id: e.id || null,
        name: e.name.trim(),
        modell_kompatibilitaet: e.modell_kompatibilitaet.trim() || null,
        farbe: e.farbe.trim() || null,
        preis: e.preis === '' ? null : e.preis,
        merkmal: e.merkmal.trim() || null
      }));
  }

  /** Variantenbilder, die nach dem Speichern der Varianten hochgeladen werden. */
  getBildAufgaben() {
    return this.entries
      .filter(e => e.name.trim() && e.bildFile)
      .map(e => ({ varianteName: e.name.trim(), varianteId: e.id || null, file: e.bildFile, altesBildId: e.bildId }));
  }

  /** KI-Vorschlaege zur Auswahl anbieten, statt sie direkt zu uebernehmen. */
  setSuggestions(varianten = []) {
    const vorhandene = new Set(this.entries.map(e => e.name.trim().toLowerCase()));
    this.suggestions = varianten
      .filter(v => v?.name && !vorhandene.has(String(v.name).trim().toLowerCase()))
      .map(v => ({
        key: nextKey(),
        name: String(v.name).trim(),
        modell_kompatibilitaet: v.modell_kompatibilitaet || v.modell || '',
        farbe: v.farbe || '',
        preis: v.preis ?? '',
        merkmal: v.merkmal || '',
        checked: true
      }));
    this.render();
  }

  // --- Render ---

  render() {
    if (!this.root) return;

    this.root.innerHTML = `
      <div class="form-split-header">
        <h2>Varianten</h2>
        <p class="form-hint">Farbe, Modell oder Ausführung. Alles andere erbt die Variante von der Kollektion. Varianten sind optional.</p>
      </div>
      ${this.renderSuggestions()}
      <div class="varianten-list">${this.entries.map((e, i) => this.renderEntry(e, i)).join('')}</div>
      <button type="button" class="secondary-btn variante-add-btn">Variante hinzufügen</button>
    `;

    this.bind();
  }

  renderSuggestions() {
    if (!this.suggestions.length) return '';

    const items = this.suggestions.map(s => `
      <label class="variante-suggestion">
        <input type="checkbox" data-suggestion-key="${s.key}" ${s.checked ? 'checked' : ''}>
        <span class="variante-suggestion__name">${this.escape(s.name)}</span>
        ${s.farbe ? `<span class="variante-suggestion__meta">${this.escape(s.farbe)}</span>` : ''}
        ${s.preis !== '' && s.preis != null ? `<span class="variante-suggestion__meta">${this.escape(String(s.preis))} €</span>` : ''}
      </label>
    `).join('');

    return `
      <div class="varianten-suggestions">
        <div class="varianten-suggestions__head">
          <span class="tag tag--extract">Vorschlag</span>
          <span>Von der Produktseite gefunden</span>
        </div>
        ${items}
        <div class="varianten-suggestions__actions">
          <button type="button" class="primary-btn btn-sm variante-suggestions-apply">Ausgewählte übernehmen</button>
          <button type="button" class="secondary-btn btn-sm variante-suggestions-dismiss">Verwerfen</button>
        </div>
      </div>
    `;
  }

  /**
   * Blob-URL einer noch nicht hochgeladenen Datei. Wird am Entry gecacht, weil
   * render() bei jeder Aenderung neu laeuft und sonst URLs anhaeufen wuerde.
   */
  thumbUrlFor(entry) {
    if (!entry.bildFile) {
      if (entry._blobUrl) {
        URL.revokeObjectURL(entry._blobUrl);
        entry._blobUrl = null;
      }
      return entry.bildUrl;
    }
    if (entry._blobFile !== entry.bildFile) {
      if (entry._blobUrl) URL.revokeObjectURL(entry._blobUrl);
      entry._blobUrl = URL.createObjectURL(entry.bildFile);
      entry._blobFile = entry.bildFile;
    }
    return entry._blobUrl;
  }

  renderEntry(entry, index) {
    const thumb = this.thumbUrlFor(entry);

    return `
      <div class="variante-card" data-key="${entry.key}">
        <div class="variante-card__head">
          <span class="variante-card__index">${index + 1}</span>
          <div class="variante-card__actions">
            <button type="button" class="icon-btn variante-move" data-dir="up" ${index === 0 ? 'disabled' : ''} title="Nach oben">↑</button>
            <button type="button" class="icon-btn variante-move" data-dir="down" ${index === this.entries.length - 1 ? 'disabled' : ''} title="Nach unten">↓</button>
            <button type="button" class="icon-btn icon-btn--danger variante-remove" title="Variante entfernen">×</button>
          </div>
        </div>

        <div class="form-field">
          <label>Variantenname</label>
          <input type="text" class="form-input" data-field="name" value="${this.escape(entry.name)}" placeholder="z.B. iPhone 15 – Farbe Sand">
        </div>

        <div class="form-row-group">
          <div class="form-field form-field--grow">
            <label>Modell / Kompatibilität</label>
            <input type="text" class="form-input" data-field="modell_kompatibilitaet" value="${this.escape(entry.modell_kompatibilitaet)}" placeholder="z.B. iPhone 15 Pro">
          </div>
          <div class="form-field form-field--grow">
            <label>Farbe / Ausführung</label>
            <input type="text" class="form-input" data-field="farbe" value="${this.escape(entry.farbe)}" placeholder="z.B. Sand">
          </div>
        </div>

        <div class="form-row-group">
          <div class="form-field form-field--small">
            <label>Abweichender Preis (€)</label>
            <input type="number" step="0.01" min="0" class="form-input" data-field="preis" value="${this.escape(String(entry.preis ?? ''))}" placeholder="optional">
          </div>
          <div class="form-field form-field--grow">
            <label>Besonderes Merkmal</label>
            <input type="text" class="form-input" data-field="merkmal" value="${this.escape(entry.merkmal)}" placeholder="z.B. mit MagSafe">
          </div>
        </div>

        <div class="form-field">
          <label>Variantenbild</label>
          <div class="variante-bild">
            ${thumb ? `<img class="variante-bild__thumb" src="${this.escape(thumb)}" alt="">` : '<span class="variante-bild__placeholder" aria-hidden="true"></span>'}
            <input type="file" accept="image/png,image/jpeg,image/webp" class="variante-bild__input" hidden>
            <button type="button" class="secondary-btn btn-sm variante-bild-pick">${thumb ? 'Bild ersetzen' : 'Bild wählen'}</button>
            ${thumb ? '<button type="button" class="secondary-btn btn-sm variante-bild-clear">Entfernen</button>' : ''}
          </div>
          <span class="form-hint">Wichtig fürs Skript: Creator und KI müssen sehen, wie diese Variante aussieht.</span>
        </div>
      </div>
    `;
  }

  // --- Events ---

  bind() {
    const root = this.root;

    root.querySelector('.variante-add-btn')?.addEventListener('click', () => {
      this.entries.push({
        key: nextKey(),
        id: null,
        name: '',
        modell_kompatibilitaet: '',
        farbe: '',
        preis: '',
        merkmal: '',
        bildFile: null,
        bildId: null,
        bildUrl: null
      });
      this.render();
      // Fokus auf das neue Namensfeld, damit direkt getippt werden kann
      const cards = root.querySelectorAll('.variante-card');
      cards[cards.length - 1]?.querySelector('[data-field="name"]')?.focus();
    });

    // Eingaben direkt in den Zustand schreiben, ohne Neu-Rendern
    root.querySelectorAll('.variante-card').forEach(card => {
      const entry = this.entries.find(e => e.key === card.dataset.key);
      if (!entry) return;

      card.querySelectorAll('[data-field]').forEach(input => {
        input.addEventListener('input', () => {
          entry[input.dataset.field] = input.value;
        });
      });

      card.querySelector('.variante-remove')?.addEventListener('click', () => {
        if (entry._blobUrl) URL.revokeObjectURL(entry._blobUrl);
        this.entries = this.entries.filter(e => e.key !== entry.key);
        this.render();
      });

      card.querySelectorAll('.variante-move').forEach(btn => {
        btn.addEventListener('click', () => {
          const index = this.entries.indexOf(entry);
          const ziel = btn.dataset.dir === 'up' ? index - 1 : index + 1;
          if (ziel < 0 || ziel >= this.entries.length) return;
          this.entries.splice(index, 1);
          this.entries.splice(ziel, 0, entry);
          this.render();
        });
      });

      const fileInput = card.querySelector('.variante-bild__input');
      card.querySelector('.variante-bild-pick')?.addEventListener('click', () => fileInput?.click());
      fileInput?.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        entry.bildFile = file;
        this.render();
      });
      card.querySelector('.variante-bild-clear')?.addEventListener('click', () => {
        entry.bildFile = null;
        entry.bildUrl = null;
        this.render();
      });
    });

    root.querySelectorAll('[data-suggestion-key]').forEach(box => {
      box.addEventListener('change', () => {
        const suggestion = this.suggestions.find(s => s.key === box.dataset.suggestionKey);
        if (suggestion) suggestion.checked = box.checked;
      });
    });

    root.querySelector('.variante-suggestions-apply')?.addEventListener('click', () => {
      const uebernehmen = this.suggestions.filter(s => s.checked);
      uebernehmen.forEach(s => {
        this.entries.push({
          key: nextKey(),
          id: null,
          name: s.name,
          modell_kompatibilitaet: s.modell_kompatibilitaet,
          farbe: s.farbe,
          preis: s.preis ?? '',
          merkmal: s.merkmal,
          bildFile: null,
          bildId: null,
          bildUrl: null
        });
      });
      this.suggestions = [];
      this.render();
    });

    root.querySelector('.variante-suggestions-dismiss')?.addEventListener('click', () => {
      this.suggestions = [];
      this.render();
    });
  }

  /** Blob-URLs freigeben, wenn das Formular verlassen wird. */
  destroy() {
    this.entries.forEach(e => {
      if (e._blobUrl) URL.revokeObjectURL(e._blobUrl);
      e._blobUrl = null;
      e._blobFile = null;
    });
  }

  escape(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }
}
