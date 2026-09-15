// VideoideeVorschlagPanel.js
// Kopf + Job-Trigger fuer Videoidee-Vorschlaege (ADR 0015). Die Flag-Zeilen
// selbst rendert die Konzept-Tabelle. Gaeste und Kunden sehen den Block nie.

import { VideoideeVorschlagService } from './VideoideeVorschlagService.js';
import { countVideoideeVorschlaege } from './videoideeVorschlag.js';
import { icon } from '../../core/icons/IconSystem.js';

function esc(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

export class VideoideeVorschlagPanel {
  constructor(detail) {
    this.detail = detail;
    this.laeuft = false;
    this.fortschritt = '';
    this.fehler = '';
    this._token = 0;
    this._onProgress = null;
    this._onFinished = null;
    this._clickHandler = null;
    this._boundBlock = null;
  }

  get sichtbar() {
    if (!this.detail || this.detail.isKunde) return false;
    if (window.isGastReadonly?.()) return false;
    return !!(this.detail.canCreate || this.detail.canEdit);
  }

  get count() {
    return countVideoideeVorschlaege(this.detail?.items);
  }

  async mount() {
    const block = document.getElementById('videoidee-vorschlag-block');
    if (!block) return;
    if (!this.sichtbar) {
      block.remove();
      return;
    }
    this.render();
    this.bind();
  }

  unmount() {
    this._token++;
    this.unbindProgress();
    this.unbindClick();
  }

  unbindClick() {
    if (this._boundBlock && this._clickHandler) {
      this._boundBlock.removeEventListener('click', this._clickHandler);
    }
    this._boundBlock = null;
    this._clickHandler = null;
  }

  render() {
    const block = document.getElementById('videoidee-vorschlag-block');
    if (!block || !this.sichtbar) return;

    const count = this.count;
    const hatBriefing = !!this.detail.strategie?.briefing_id;
    const canCreate = !!this.detail.canCreate;
    const canEdit = !!this.detail.canEdit;

    const holenLabel = count ? 'Weitere Ideen' : 'Ideen vorschlagen';
    const holenBtn = this.laeuft
      ? `<span class="casting-vorschlag__progress">${esc(this.fortschritt || 'Läuft…')}</span>`
      : (canCreate
        ? `<button type="button" class="mdc-btn mdc-btn--secondary" id="btn-videoidee-vorschlag-holen"
             ${hatBriefing ? '' : 'disabled title="Konzept ohne Briefing: ohne Briefing kein Lauf"'}>
            ${icon('sparkles', { className: 'icon-16' })}
            ${holenLabel}
          </button>`
        : '');

    const bulk = (!this.laeuft && canEdit && count)
      ? `<button type="button" class="mdc-btn mdc-btn--secondary" id="btn-videoidee-vorschlag-alle-uebernehmen">
           ${icon('check-bold', { className: 'icon-16' })}
           Alle übernehmen
         </button>
         <button type="button" class="mdc-btn mdc-btn--secondary" id="btn-videoidee-vorschlag-alle-verwerfen">
           ${icon('trash', { className: 'icon-16' })}
           Alle verwerfen
         </button>`
      : '';

    block.innerHTML = `
      <div class="casting-vorschlag videoidee-vorschlag">
        <div class="casting-vorschlag__kopf">
          <div>
            <span class="casting-vorschlag__titel">KI-Vorschläge ${count ? `(${count})` : ''}</span>
            <p class="casting-vorschlag__sub">Aus Briefing, Produkt und Personas · in der Liste mit Rand markiert</p>
          </div>
          <div class="casting-vorschlag__aktionen">
            ${holenBtn}
            ${bulk}
          </div>
        </div>
        ${this.fehler ? `<p class="casting-vorschlag__fehler">${esc(this.fehler)}</p>` : ''}
        ${!hatBriefing && !count
          ? '<p class="casting-vorschlag__hinweis">Dieses Konzept hat kein Briefing – ohne Briefing gibt es keine Vorschläge.</p>'
          : ''}
      </div>
    `;
  }

  bind() {
    const block = document.getElementById('videoidee-vorschlag-block');
    if (!block) return;
    this.unbindClick();
    this._boundBlock = block;
    this._clickHandler = (e) => this.handleClick(e);
    block.addEventListener('click', this._clickHandler);
  }

  bindProgress() {
    this.unbindProgress();
    this._onProgress = (e) => {
      this.fortschritt = e.detail?.label || 'Läuft…';
      this.render();
    };
    this._onFinished = () => {
      this.laeuft = false;
      this.fortschritt = '';
      this.render();
      this.neuLaden();
    };
    document.addEventListener('videoideeVorschlagProgress', this._onProgress);
    document.addEventListener('videoideeVorschlagFinished', this._onFinished);
  }

  unbindProgress() {
    if (this._onProgress) document.removeEventListener('videoideeVorschlagProgress', this._onProgress);
    if (this._onFinished) document.removeEventListener('videoideeVorschlagFinished', this._onFinished);
    this._onProgress = null;
    this._onFinished = null;
  }

  async handleClick(e) {
    const holenBtn = e.target.closest('#btn-videoidee-vorschlag-holen');
    if (holenBtn && !holenBtn.disabled) {
      e.preventDefault();
      await this.holen();
      return;
    }
    if (e.target.closest('#btn-videoidee-vorschlag-alle-uebernehmen')) {
      e.preventDefault();
      await this.uebernehmenAlle();
      return;
    }
    if (e.target.closest('#btn-videoidee-vorschlag-alle-verwerfen')) {
      e.preventDefault();
      await this.verwerfenAlle();
    }
  }

  async holen() {
    if (this.laeuft) return;
    this.laeuft = true;
    this.fehler = '';
    this.fortschritt = 'Videoideen sind unterwegs…';
    this.bindProgress();
    this.render();
    try {
      await VideoideeVorschlagService.starteJob({ strategieId: this.detail.strategieId, input: {} });
    } catch (error) {
      console.error('Fehler bei den Videoidee-Vorschlägen:', error);
      this.laeuft = false;
      this.fortschritt = '';
      this.fehler = error.message || 'Generierung fehlgeschlagen.';
      this.unbindProgress();
      this.render();
      return;
    }
    if (!this.laeuft) return;
  }

  async neuLaden() {
    const token = ++this._token;
    try {
      this.detail.items = await this.detail.reloadItems();
      if (token !== this._token) return;
      this.render();
      this.detail.rerenderItemsTable();
    } catch (error) {
      if (token !== this._token) return;
      console.error('Fehler beim Neuladen der Videoidee-Vorschläge:', error);
    }
  }

  async uebernehmen(itemId) {
    try {
      const row = await VideoideeVorschlagService.uebernehmen(itemId);
      const item = this.detail.items.find((i) => i.id === itemId);
      if (item) Object.assign(item, row);
      window.toastSystem?.show('Vorschlag übernommen', 'success');
      this.render();
      this.detail.rerenderItemsTable();
    } catch (error) {
      console.error('Fehler beim Übernehmen:', error);
      window.toastSystem?.show(error.message || 'Übernehmen fehlgeschlagen', 'error');
    }
  }

  async verwerfen(itemId) {
    try {
      await VideoideeVorschlagService.verwerfen(itemId);
      this.detail.items = this.detail.items.filter((i) => i.id !== itemId);
      this.render();
      this.detail.rerenderItemsTable();
    } catch (error) {
      console.error('Fehler beim Verwerfen:', error);
      window.toastSystem?.show(error.message || 'Verwerfen fehlgeschlagen', 'error');
    }
  }

  async uebernehmenAlle() {
    try {
      await VideoideeVorschlagService.uebernehmenAlle(this.detail.strategieId);
      this.detail.items.forEach((item) => {
        if (item.ist_vorschlag) {
          item.ist_vorschlag = false;
          item.teilbereich = null;
        }
      });
      window.toastSystem?.show('Vorschläge übernommen', 'success');
      this.render();
      this.detail.rerenderItemsTable();
    } catch (error) {
      console.error('Fehler beim Übernehmen:', error);
      window.toastSystem?.show(error.message || 'Übernehmen fehlgeschlagen', 'error');
    }
  }

  async verwerfenAlle() {
    try {
      await VideoideeVorschlagService.verwerfenAlle(this.detail.strategieId);
      this.detail.items = this.detail.items.filter((i) => !i.ist_vorschlag);
      this.render();
      this.detail.rerenderItemsTable();
    } catch (error) {
      console.error('Fehler beim Verwerfen:', error);
      window.toastSystem?.show(error.message || 'Verwerfen fehlgeschlagen', 'error');
    }
  }
}
