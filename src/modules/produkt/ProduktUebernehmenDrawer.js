// Drawer: vorhandene Produkte des Unternehmens an die aktuelle Linie hängen (ADR 0052).
// Es entsteht nur die Verknüpfung; Personas und Briefing-Daten kommen nicht mit.

import { icon } from '../../core/icons/IconSystem.js';
import { loadUebernehmbareProdukte, uebernehmeProdukte } from '../briefing/BriefingProdukte.js';

const DRAWER_ID = 'produkt-uebernehmen-drawer';

const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (m) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]
));

/**
 * @param {{ briefingId: string, unternehmenId: string, markeId?: string|null, onDone?: Function }} opts
 */
export function openProduktUebernehmenDrawer(opts) {
  return new ProduktUebernehmenDrawer(opts).open();
}

export class ProduktUebernehmenDrawer {
  constructor({ briefingId, unternehmenId, markeId = null, onDone = null }) {
    this.drawerId = DRAWER_ID;
    this.briefingId = briefingId;
    this.unternehmenId = unternehmenId;
    this.markeId = markeId;
    this.onDone = onDone;
    this.produkte = [];
    this.selected = new Set();
  }

  async open() {
    try {
      this.createDrawer();
      this.produkte = await loadUebernehmbareProdukte({
        briefingId: this.briefingId,
        unternehmenId: this.unternehmenId,
        markeId: this.markeId
      });
      this.renderBody();
    } catch (error) {
      console.error('Fehler beim Öffnen von Produkt übernehmen:', error);
      window.toastSystem?.show(error.message || 'Fehler beim Öffnen', 'error');
      this.close();
    }
  }

  createDrawer() {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;
    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Produkt übernehmen</span>
          <p class="drawer-subtitle">Vorhandene Produkte an diese Linie hängen</p>
        </div>
        <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
      </div>
      <div class="drawer-body" id="${this.drawerId}-body">
        <div class="drawer-loading-state">Lade Produkte...</div>
      </div>
    `;

    overlay.addEventListener('click', () => this.close());
    panel.querySelector('.drawer-close-btn').addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));
  }

  renderBody() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    if (!this.produkte.length) {
      body.innerHTML = `
        <div class="add-to-video-empty">
          <p>Kein Produkt zum Übernehmen.</p>
          <p class="hint">Alle Produkte des Unternehmens hängen schon an dieser Linie, oder es gibt noch keins. Über „Produkt anlegen“ entsteht ein neues.</p>
        </div>
      `;
      return;
    }

    body.innerHTML = `
      <div class="produkt-uebernehmen-liste">
        ${this.produkte.map((p) => `
          <label class="produkt-uebernehmen-item">
            <input type="checkbox" value="${esc(p.id)}" data-produkt-check>
            <span>${esc(p.name || 'Ohne Namen')}</span>
          </label>`).join('')}
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
          <span class="mdc-btn__icon" aria-hidden="true">${icon('x-circle-filled')}</span>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button type="button" class="mdc-btn mdc-btn--create" id="${this.drawerId}-submit" disabled>
          <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${icon('check-filled')}</span>
          <span class="mdc-btn__label">Übernehmen</span>
        </button>
      </div>
    `;

    body.querySelector('[data-action="close"]')?.addEventListener('click', () => this.close());
    body.querySelectorAll('[data-produkt-check]').forEach((box) => {
      box.addEventListener('change', () => {
        if (box.checked) this.selected.add(box.value);
        else this.selected.delete(box.value);
        this.syncSubmit();
      });
    });
    document.getElementById(`${this.drawerId}-submit`)?.addEventListener('click', () => this.submit());
  }

  syncSubmit() {
    const btn = document.getElementById(`${this.drawerId}-submit`);
    if (btn) btn.disabled = this.selected.size === 0;
  }

  async submit() {
    if (!this.selected.size) return;
    const btn = document.getElementById(`${this.drawerId}-submit`);
    if (btn) btn.disabled = true;

    try {
      const neu = await uebernehmeProdukte(this.briefingId, [...this.selected]);
      window.toastSystem?.show(
        neu.length === 1 ? 'Produkt übernommen' : `${neu.length} Produkte übernommen`,
        'success'
      );
      this.close();
      if (this.onDone) await this.onDone(neu);
    } catch (error) {
      console.error('Fehler beim Übernehmen der Produkte:', error);
      window.toastSystem?.show(error.message || 'Übernehmen fehlgeschlagen', 'error');
      if (btn) btn.disabled = false;
    }
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => this.removeDrawer(), 250);
    } else {
      this.removeDrawer();
    }
  }

  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }
}
