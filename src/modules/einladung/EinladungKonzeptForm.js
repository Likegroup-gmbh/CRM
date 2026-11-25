// EinladungKonzeptForm.js
// Öffentliches Creator-Sheet (ADR 0059): das PDF „Creator Concept Sheet“ als Webformular.
// Ein Formular, ein Absenden. Das Ergebnis ist eine Einreichung, noch keine Videoidee.
// Name/@Handle und Marke/Projektname stehen im Kopf der Seite (EinladungApp), nicht hier.

import { escapeHtml } from '../briefing/create/FieldRenderer.js';
import { KONZEPT_ABSCHNITTE, KONZEPT_FELD, KONZEPT_PFLICHT } from './konzeptSheet.js';
import { sendeEinreichung, zeigeFormFehler } from './einladungFormBasis.js';

const URL_MUSTER = /^https?:\/\/\S+\.\S+/i;

export class EinladungKonzeptForm {
  /**
   * @param {{ token: string, sitzung: string, onFertig: () => void, onSitzungAbgelaufen: () => void }} opts
   */
  constructor({ token, sitzung, onFertig, onSitzungAbgelaufen }) {
    this.token = token;
    this.sitzung = sitzung;
    this.onFertig = onFertig;
    this.onSitzungAbgelaufen = onSitzungAbgelaufen;
    this.sendet = false;
  }

  mount(root) {
    this.root = root;
    root.innerHTML = `
      <form class="einladung-formular einladung-formular--konzept" id="einladung-konzept-form" novalidate>
        ${KONZEPT_ABSCHNITTE.map((a) => this.renderAbschnitt(a)).join('')}
      </form>
      <p class="einladung-fehler" data-fehler hidden></p>
      <div class="einladung-aktionen">
        <button type="button" class="mdc-btn" data-aktion="senden">Absenden</button>
      </div>`;
    this.form = root.querySelector('form');
    this.form.addEventListener('submit', (e) => e.preventDefault());
    root.querySelector('[data-aktion="senden"]').addEventListener('click', () => this.senden());
  }

  renderAbschnitt(a) {
    const inhalt = a.felder
      ? a.felder.map((n) => this.renderFeld(n)).join('')
      : a.gruppen.map((g) => `
          <div class="einladung-gruppe">
            <h3>${escapeHtml(g.frage)}</h3>
            ${g.hilfe ? `<p class="field-helper">${escapeHtml(g.hilfe)}</p>` : ''}
            ${g.felder.map((n) => this.renderFeld(n)).join('')}
          </div>`).join('');
    return `
      <section class="einladung-abschnitt" data-abschnitt="${a.id}">
        <header class="einladung-abschnitt__kopf">
          <h2>${a.nr ? `<span class="einladung-abschnitt__nr">${escapeHtml(a.nr)}</span> ` : ''}${escapeHtml(a.titel)}</h2>
          ${a.text ? `<p>${escapeHtml(a.text)}</p>` : ''}
        </header>
        <div class="einladung-abschnitt__body">${inhalt}</div>
      </section>`;
  }

  renderFeld(name) {
    const f = KONZEPT_FELD[name];
    const pflicht = f.pflicht ? ' <span class="required">*</span>' : '';
    const platzhalter = f.platzhalter ? ` placeholder="${escapeHtml(f.platzhalter)}"` : '';
    const eingabe = f.typ === 'textarea'
      ? `<textarea id="${name}" name="${name}" rows="3"${platzhalter}></textarea>`
      : `<input type="${f.typ}" id="${name}" name="${name}"${platzhalter}${f.max ? ` maxlength="${f.max}"` : ''}>`;
    return `
      <div class="form-field">
        <label for="${name}">${escapeHtml(f.label)}${pflicht}</label>
        ${eingabe}
      </div>`;
  }

  sammle() {
    const daten = {};
    for (const name of Object.keys(KONZEPT_FELD)) {
      const el = this.form.elements[name];
      const wert = el ? String(el.value).trim() : '';
      if (wert) daten[name] = wert;
    }
    return daten;
  }

  zeigeFehler(text) {
    zeigeFormFehler(this.root, text);
  }

  async senden() {
    if (this.sendet) return;
    this.zeigeFehler('');
    const daten = this.sammle();

    for (const name of KONZEPT_PFLICHT) {
      if (!daten[name]) {
        this.zeigeFehler(`Bitte ausfüllen: ${KONZEPT_FELD[name].label}.`);
        this.form.elements[name].focus();
        return;
      }
    }
    for (const name of ['eigenes_video_url', 'referenz_video_url']) {
      if (daten[name] && !URL_MUSTER.test(daten[name])) {
        this.zeigeFehler('Bitte einen gültigen Link mit https:// eintragen.');
        this.form.elements[name].focus();
        return;
      }
    }

    await sendeEinreichung(this, daten);
  }
}
