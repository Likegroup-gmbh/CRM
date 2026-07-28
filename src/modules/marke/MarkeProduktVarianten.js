// MarkeProduktVarianten.js
// Varianten-Abschnitt im Produkt-Dokument, dargestellt als Tabelle im
// CRM-Look mit rahmenlosen Eingaben in den Zellen.
//
// Eine Variante traegt nur das Unterscheidende (Farbe, Modell, abweichender
// Preis) und erbt den Rest von der Kollektion. Der Zustand liegt in
// this.entries, nicht im DOM - sonst gehen beim Umsortieren Eingaben verloren.
// Aus demselben Grund loest Tippen kein Neu-Rendern aus.

import { MarkeProduktService } from './services/MarkeProduktService.js';

let idCounter = 0;
const nextKey = () => `v${++idCounter}`;

const ICONS = {
  trash: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.35 9m-4.78 0L9.26 9m9.97-3.21c.34.05.68.1 1.02.16m-1.02-.16L18.16 19.67a2.25 2.25 0 0 1-2.24 2.08H8.08a2.25 2.25 0 0 1-2.24-2.08L4.77 5.79m14.46 0a48 48 0 0 0-3.48-.4m-12 .56c.34-.06.68-.11 1.02-.16m0 0a48 48 0 0 1 3.48-.4v-.91c0-1.18.91-2.16 2.09-2.2a52 52 0 0 1 3.32 0c1.18.04 2.09 1.02 2.09 2.2v.92m-7.5 0a48.7 48.7 0 0 1 7.5 0"/></svg>',
  image: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.16-5.16a2.25 2.25 0 0 1 3.18 0l5.16 5.16m-1.5-1.5 1.41-1.41a2.25 2.25 0 0 1 3.18 0l2.16 2.16m-16.5 2.25h13.5a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v10.5a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>'
};

export class ProduktVariantenPanel {
  constructor() {
    this.root = null;
    this.entries = [];
    this.suggestions = [];
  }

  /**
   * @param {HTMLElement} root - Varianten-Slot im Produkt-Dokument
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
      <label>Varianten</label>
      <p class="produkt-doc__hint">Farbe, Modell oder Ausführung. Alles andere erbt die Variante von der Kollektion. Varianten sind optional.</p>
      ${this.renderSuggestions()}
      ${this.entries.length ? this.renderTable() : ''}
      <button type="button" class="secondary-btn btn-sm variante-add-btn">Variante hinzufügen</button>
    `;

    this.bind();
  }

  renderTable() {
    const mehrere = this.entries.length > 1;

    return `
      <div class="table-container varianten-table-container">
        <table class="data-table data-table--varianten">
          <thead>
            <tr>
              <th class="col-thumb"></th>
              <th class="col-name">Variante</th>
              <th class="col-modell">Modell / Kompatibilität</th>
              <th class="col-farbe">Farbe</th>
              <th class="col-preis">Preis</th>
              <th class="col-merkmal">Merkmal</th>
              ${mehrere ? '<th class="col-sort">Reihenfolge</th>' : ''}
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>${this.entries.map((e, i) => this.renderEntry(e, i, mehrere)).join('')}</tbody>
        </table>
      </div>
    `;
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

  /**
   * Eine Tabellenzeile. Die Eingaben tragen keine Werte im Markup - die setzt
   * bind() per Property, damit Anfuehrungszeichen im Text nicht aus dem
   * Attribut ausbrechen koennen.
   */
  renderEntry(entry, index, mehrere) {
    const thumb = this.thumbUrlFor(entry);

    const bildZelle = thumb
      ? `<button type="button" class="variante-bild-pick variante-bild-pick--thumb" title="Bild ersetzen">
           <img class="variante-bild__thumb" src="${this.escape(thumb)}" alt="">
         </button>
         <button type="button" class="variante-bild-clear" title="Bild entfernen" aria-label="Bild entfernen">×</button>`
      : `<button type="button" class="variante-bild-pick variante-bild-pick--empty" title="Bild wählen" aria-label="Variantenbild wählen">${ICONS.image}</button>`;

    return `
      <tr class="variante-row" data-key="${this.escape(entry.key)}">
        <td class="col-thumb">
          <div class="variante-bild">
            ${bildZelle}
            <input type="file" accept="image/png,image/jpeg,image/webp" class="variante-bild__input" hidden>
          </div>
        </td>
        <td class="col-name">
          <input type="text" class="cell-input" data-field="name" placeholder="z.B. iPhone 15 – Sand">
        </td>
        <td class="col-modell">
          <input type="text" class="cell-input" data-field="modell_kompatibilitaet" placeholder="z.B. iPhone 15 Pro">
        </td>
        <td class="col-farbe">
          <input type="text" class="cell-input" data-field="farbe" placeholder="z.B. Sand">
        </td>
        <td class="col-preis">
          <input type="number" step="0.01" min="0" class="cell-input cell-input--num" data-field="preis" placeholder="–">
        </td>
        <td class="col-merkmal">
          <input type="text" class="cell-input" data-field="merkmal" placeholder="z.B. mit MagSafe">
        </td>
        ${mehrere ? `
        <td class="col-sort">
          <div class="uploader-sort">
            <button type="button" class="uploader-move variante-move" data-dir="up" ${index === 0 ? 'disabled' : ''} title="Nach oben">↑</button>
            <button type="button" class="uploader-move variante-move" data-dir="down" ${index === this.entries.length - 1 ? 'disabled' : ''} title="Nach unten">↓</button>
          </div>
        </td>` : ''}
        <td class="col-actions">
          <button type="button" class="uploader-remove uploader-remove--icon variante-remove" title="Variante entfernen" aria-label="Variante entfernen">${ICONS.trash}</button>
        </td>
      </tr>
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
      const rows = root.querySelectorAll('.variante-row');
      rows[rows.length - 1]?.querySelector('[data-field="name"]')?.focus();
    });

    // Eingaben direkt in den Zustand schreiben, ohne Neu-Rendern
    root.querySelectorAll('.variante-row').forEach(card => {
      const entry = this.entries.find(e => e.key === card.dataset.key);
      if (!entry) return;

      card.querySelectorAll('[data-field]').forEach(input => {
        const feld = input.dataset.field;
        input.value = entry[feld] ?? '';
        input.addEventListener('input', () => {
          entry[feld] = input.value;
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

  /** Auch fuer Attributwerte gedacht, deshalb inklusive Anfuehrungszeichen. */
  escape(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML.replace(/"/g, '&quot;');
  }
}
