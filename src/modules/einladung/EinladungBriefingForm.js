// EinladungBriefingForm.js
// Öffentliches Briefing-Formular: dieselben Felder, Renderer und Feld-Events wie der
// interne Generator, aber ohne Zuordnung, ohne Liky und ohne Datenbankzugriff.
// Produkte werden nur erfasst (produktSyncAus), angelegt erst beim Anlegen der Einreichung.
// Abschicken erzeugt eine Einreichung (ADR 0055), nie ein Briefing.

import { BriefingCreate } from '../briefing/create/BriefingCreateCore.js';
import '../briefing/create/FormEvents.js';
import '../briefing/create/DataPersistence.js';
import { renderStep, escapeHtml } from '../briefing/create/FieldRenderer.js';
import { kundenSteps } from './einladungFelder.js';
import { sendeEinreichung, zeigeFormFehler } from './einladungFormBasis.js';

export class EinladungBriefingForm extends BriefingCreate {
  /**
   * @param {{ token: string, sitzung: string, typ: string, onFertig: () => void, onSitzungAbgelaufen: () => void }} opts
   */
  constructor({ token, sitzung, typ, onFertig, onSitzungAbgelaufen }) {
    super();
    this.token = token;
    this.sitzung = sitzung;
    this.selectedBereich = typ;
    this.formData = { bereich: typ };
    this.steps = kundenSteps();
    this.index = 0;
    this.onFertig = onFertig;
    this.onSitzungAbgelaufen = onSitzungAbgelaufen;
    this.sendet = false;
    this.produktSyncAus = true;
  }

  mount(root) {
    this.root = root;
    this.root.innerHTML = this.renderGeruest();
    this.form = this.root.querySelector('#briefing-form');
    this.bindFormularEvents();
    this.bindProduktListe();
    this.root.querySelector('[data-aktion="zurueck"]').addEventListener('click', () => this.gehe(-1));
    this.root.querySelector('[data-aktion="weiter"]').addEventListener('click', () => this.gehe(1));
    this.root.querySelector('[data-aktion="senden"]').addEventListener('click', () => this.senden());
    this.form.addEventListener('submit', (e) => e.preventDefault());
    this.zeige(0);
  }

  renderGeruest() {
    const context = { bereich: this.selectedBereich, einladung: true };
    const panels = this.steps.map((step, i) => `
      <section class="einladung-schritt" data-schritt="${i}" hidden>
        <header class="einladung-schritt__kopf">
          <h2>${escapeHtml(step.label)}</h2>
          ${step.info ? `<p>${escapeHtml(step.info)}</p>` : ''}
        </header>
        ${renderStep(step, this.formData, context)}
      </section>`).join('');

    return `
      <div class="einladung-fortschritt" data-fortschritt>
        ${this.steps.map((step, i) => `
          <button type="button" class="einladung-fortschritt__punkt" data-ziel="${i}">
            <span class="einladung-fortschritt__nr">${i + 1}</span>
            <span class="einladung-fortschritt__label">${escapeHtml(step.label)}</span>
          </button>`).join('')}
      </div>
      <form id="briefing-form" class="einladung-formular form-page--briefing" novalidate>${panels}</form>
      <p class="einladung-fehler" data-fehler hidden></p>
      <div class="einladung-aktionen">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-aktion="zurueck">Zurück</button>
        <button type="button" class="mdc-btn" data-aktion="weiter">Weiter</button>
        <button type="button" class="mdc-btn" data-aktion="senden">Absenden</button>
      </div>`;
  }

  zeige(i) {
    this.index = Math.max(0, Math.min(this.steps.length - 1, i));
    this.root.querySelectorAll('[data-schritt]').forEach((el) => {
      el.hidden = Number(el.dataset.schritt) !== this.index;
    });
    this.root.querySelectorAll('[data-ziel]').forEach((el) => {
      const nr = Number(el.dataset.ziel);
      el.classList.toggle('is-aktuell', nr === this.index);
      el.classList.toggle('is-erledigt', nr < this.index);
      el.onclick = () => {
        this.saveCurrentStepData();
        this.zeige(nr);
      };
    });
    const letzter = this.index === this.steps.length - 1;
    this.root.querySelector('[data-aktion="zurueck"]').hidden = this.index === 0;
    this.root.querySelector('[data-aktion="weiter"]').hidden = letzter;
    this.root.querySelector('[data-aktion="senden"]').hidden = !letzter;
    this.zeigeFehler('');
    this.root.scrollIntoView?.({ block: 'start' });
    window.scrollTo?.({ top: 0 });
  }

  gehe(delta) {
    this.saveCurrentStepData();
    this.zeige(this.index + delta);
  }

  zeigeFehler(text) {
    zeigeFormFehler(this.root, text);
  }

  async senden() {
    if (this.sendet) return;
    this.saveCurrentStepData();
    await sendeEinreichung(this, this.formData);
  }
}
