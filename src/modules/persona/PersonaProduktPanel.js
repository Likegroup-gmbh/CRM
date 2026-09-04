// PersonaProduktPanel.js
// Produkte-Band ganz unten im Persona-Worksheet: verknuepfte Produkte als
// Karten-Grid - gleiches Look & Feel wie die Personas am Produkt, damit das
// System nicht zwei Verknuepfungs-Oberflaechen pflegt. Hinzufuegen laeuft
// ueber eine Inline-Suche (EntitySearchInput), Entfernen per Karte.
//
// Der Stand lebt im Speicher und wird erst mit dem Persona-Save geschrieben
// (ProduktPersonaService.saveForPersona als Diff, siehe ADR 0002) -
// Hinzufuegen und Entfernen vor dem Save sind reine State-Wechsel.

import { ProduktPersonaService } from '../produkt/ProduktPersonaService.js';
import { ProduktService } from '../produkt/ProduktService.js';
import { toggleRelationSuche } from '../../core/components/EntitySearchInput.js';
import { icon } from '../../core/icons/IconSystem.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tempKey() {
  return `prod_${crypto.randomUUID()}`;
}

export class PersonaProduktPanel {
  constructor() {
    this.form = null;
    this.kontext = null; // { personaId, getUnternehmenId }
    this.produkte = [];
    this.suche = null;
    // true, wenn der persisted Stand nicht geladen werden konnte - der Save
    // darf dann nicht laufen, sonst diffed saveForPersona gegen einen leeren
    // Stand und loescht alle bestehenden Verknuepfungen.
    this.loadFehler = false;
    this._abort = null;
  }

  /**
   * @param {HTMLFormElement} form
   * @param {Object} kontext - { personaId, getUnternehmenId }
   */
  async mount(form, kontext) {
    this._abort?.abort();
    this._abort = new AbortController();
    this.form = form;
    this.kontext = kontext;
    this.produkte = [];
    this.loadFehler = false;

    this.render();

    if (kontext.personaId) {
      await this.loadPersisted(kontext.personaId);
    }

    this.bindEvents();
  }

  async loadPersisted(personaId) {
    try {
      const rows = await ProduktPersonaService.loadProdukteForPersona(personaId);
      this.produkte = rows
        .filter(r => r.produkt)
        .map(r => ({
          key: r.produkt_id,
          produkt_id: r.produkt_id,
          name: r.produkt.name || 'Produkt',
          sub: r.produkt.kurzbeschreibung || ''
        }));
      this.render();
    } catch (err) {
      this.loadFehler = true;
      console.error('Produkte der Persona konnten nicht geladen werden:', err);
    }
  }

  bindEvents() {
    const signal = this._abort?.signal;
    const opts = signal ? { signal } : undefined;
    const form = this.form;
    if (!form) return;

    form.addEventListener('click', (e) => this.handleClick(e), opts);

    // Standalone: wechselt das Unternehmen, passen die bisher verlinkten
    // Produkte nicht mehr - sie gehoeren dem alten Unternehmen.
    form.addEventListener('change', (e) => {
      const name = e.target?.name || e.target?.dataset?.fieldName;
      if (name !== 'unternehmen_id') return;
      if (!this.produkte.length) return;
      this.produkte = [];
      this.render();
    }, opts);
  }

  root() {
    return this.form?.querySelector('#persona-produkt-panel');
  }

  // --- State ---

  getProduktIds() {
    return this.produkte.map(p => p.produkt_id);
  }

  addProdukt(item) {
    if (this.produkte.some(p => p.produkt_id === item.id)) return;
    this.produkte.push({
      key: tempKey(),
      produkt_id: item.id,
      name: item.label,
      sub: item.data?.kurzbeschreibung || ''
    });
    this.render();
  }

  entfernProdukt(key) {
    const idx = this.produkte.findIndex(p => p.key === key);
    if (idx === -1) return;
    this.produkte.splice(idx, 1);
    this.render();
  }

  // --- Suche ---

  toggleSuche() {
    toggleRelationSuche(this, {
      placeholder: 'Produkte suchen und hinzufügen...',
      emptyText: 'Keine Produkte gefunden',
      search: (unternehmenId, term) => this.sucheProdukte(unternehmenId, term),
      onSelect: (item) => this.addProdukt(item)
    });
  }

  async sucheProdukte(unternehmenId, term) {
    const treffer = await ProduktService.searchByName(unternehmenId, term, {
      excludeIds: this.getProduktIds()
    });
    return treffer.map(p => ({
      id: p.id,
      label: p.name || 'Produkt',
      sub: p.kurzbeschreibung || '',
      data: p
    }));
  }

  // --- Events ---

  handleClick(e) {
    const action = e.target.closest('[data-rel-action]');
    if (!action) return;
    const key = action.closest('[data-key]')?.dataset.key;

    const aktionen = {
      'add-produkt': () => this.toggleSuche(),
      'open': () => this.openProdukt(key),
      'entfernen': () => this.entfernProdukt(key)
    };
    aktionen[action.dataset.relAction]?.();
  }

  openProdukt(key) {
    const produkt = this.produkte.find(p => p.key === key);
    if (!produkt) return;
    window.navigateTo(`/produkt/${produkt.produkt_id}`);
  }

  // --- Render ---

  render() {
    const root = this.root();
    if (root) root.innerHTML = this.renderPanel();
  }

  renderPanel() {
    const karten = this.produkte.map(p => this.renderKarte(p)).join('');

    return `
      <div class="rel-panel">
        <div class="rel-panel__head">
          <span class="rel-panel__title">Produkte</span>
          <div class="rel-panel__aktionen">
            <button type="button" class="rel-icon-btn" data-rel-action="add-produkt"
                    title="Produkt hinzufügen" aria-label="Produkt hinzufügen">${icon('plus-sign')}</button>
          </div>
        </div>
        <div class="rel-panel__suche"></div>
        ${this.produkte.length
          ? `<div class="rel-grid">${karten}</div>`
          : `<div class="rel-grid rel-grid--leer">
               <p class="rel-grid__leer">Noch keine Produkte verknüpft – über die Suche oben rechts hinzufügen.</p>
             </div>`}
      </div>
    `;
  }

  renderKarte(produkt) {
    return `
      <article class="rel-card rel-card--accepted" data-key="${escapeHtml(produkt.key)}">
        <header class="rel-card__kopf">
          <span class="rel-card__name">${escapeHtml(produkt.name)}</span>
          <div class="rel-card__aktionen">
            <button type="button" class="rel-icon-btn" data-rel-action="open"
                    title="Produkt öffnen" aria-label="Produkt öffnen">${icon('arrow-top-right-on-square')}</button>
            <button type="button" class="rel-icon-btn" data-rel-action="entfernen"
                    title="Verknüpfung entfernen" aria-label="Verknüpfung entfernen">${icon('trash')}</button>
          </div>
        </header>
        ${produkt.sub ? `<p class="rel-card__text">${escapeHtml(produkt.sub)}</p>` : ''}
      </article>
    `;
  }

  destroy() {
    this.suche?.destroy();
    this.suche = null;
    if (this._abort) {
      try { this._abort.abort(); } catch (_) { /* noop */ }
      this._abort = null;
    }
  }
}
