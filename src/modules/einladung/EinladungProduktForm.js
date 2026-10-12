// EinladungProduktForm.js
// Öffentliches Produkt-Formular (ADR 0055). Ein Formular, ein Absenden.
// Das Ergebnis ist eine Einreichung, kein Produkt.

import { escapeHtml } from '../briefing/create/FieldRenderer.js';
import { PRODUKT_ABSCHNITTE, PRODUKT_FELD, VARIANTEN_SPALTEN } from './einladungFelder.js';
import { einladungSubmit, ladeDateiHoch } from './einladungApi.js';

const MAX_BILDER = 5;
const MAX_VARIANTEN = 30;
const MAX_DATEI_BYTES = 25 * 1024 * 1024;
const BILD_TYPEN = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];

export class EinladungProduktForm {
  /**
   * @param {{ token: string, sitzung: string, onFertig: () => void, onSitzungAbgelaufen: () => void }} opts
   */
  constructor({ token, sitzung, onFertig, onSitzungAbgelaufen }) {
    this.token = token;
    this.sitzung = sitzung;
    this.onFertig = onFertig;
    this.onSitzungAbgelaufen = onSitzungAbgelaufen;
    this.bilder = [];
    this.laufendeUploads = 0;
    this.sendet = false;
  }

  mount(root) {
    this.root = root;
    root.innerHTML = `
      <form class="einladung-formular einladung-formular--produkt" id="einladung-produkt-form" novalidate>
        ${PRODUKT_ABSCHNITTE.map((a) => this.renderAbschnitt(a)).join('')}
      </form>
      <p class="einladung-fehler" data-fehler hidden></p>
      <div class="einladung-aktionen">
        <button type="button" class="mdc-btn" data-aktion="senden">Absenden</button>
      </div>`;
    this.form = root.querySelector('form');
    this.form.addEventListener('submit', (e) => e.preventDefault());
    root.querySelector('[data-aktion="senden"]').addEventListener('click', () => this.senden());
    this.bindListen();
    this.bindVarianten();
    this.bindBilder();
  }

  renderAbschnitt(a) {
    let inhalt = '';
    if (a.felder) inhalt = a.felder.map((n) => this.renderFeld(n)).join('');
    if (a.liste) inhalt = this.renderListe(a);
    if (a.varianten) inhalt = this.renderVarianten();
    if (a.bilder) inhalt = this.renderBilder();
    return `
      <section class="einladung-abschnitt" data-abschnitt="${a.id}">
        <header class="einladung-abschnitt__kopf">
          <h2>${escapeHtml(a.titel)}</h2>
          ${a.text ? `<p>${escapeHtml(a.text)}</p>` : ''}
        </header>
        <div class="einladung-abschnitt__body">${inhalt}</div>
      </section>`;
  }

  renderFeld(name) {
    const f = PRODUKT_FELD[name];
    const pflicht = f.pflicht ? ' <span class="required">*</span>' : '';
    const platzhalter = f.platzhalter ? ` placeholder="${escapeHtml(f.platzhalter)}"` : '';
    let eingabe;
    if (f.typ === 'textarea') {
      eingabe = `<textarea id="${name}" name="${name}" rows="3"${platzhalter}></textarea>`;
    } else if (f.typ === 'number') {
      eingabe = `<input type="number" id="${name}" name="${name}" min="0" step="0.01"${platzhalter}>`;
    } else {
      eingabe = `<input type="${f.typ}" id="${name}" name="${name}"${platzhalter}${f.pflicht ? ' required' : ''}>`;
    }
    return `
      <div class="form-field">
        <label for="${name}">${escapeHtml(f.label)}${pflicht}</label>
        ${eingabe}
        ${f.hilfe ? `<p class="field-helper">${escapeHtml(f.hilfe)}</p>` : ''}
      </div>`;
  }

  // --- Einsatzsituationen -------------------------------------------------
  renderListe(a) {
    return `
      <div class="bf-repeatable" data-liste="${a.liste}" data-platzhalter="${escapeHtml(a.listePlatzhalter || '')}">
        ${this.listenZeile(a.listePlatzhalter)}
      </div>
      <button type="button" class="mdc-btn mdc-btn--secondary" data-liste-add="${a.liste}">Eintrag hinzufügen</button>`;
  }

  listenZeile(platzhalter = '') {
    return `
      <div class="bf-repeatable-row" data-liste-zeile>
        <input type="text" data-item placeholder="${escapeHtml(platzhalter)}" maxlength="300">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-zeile-weg aria-label="Entfernen">Entfernen</button>
      </div>`;
  }

  bindListen() {
    this.root.addEventListener('click', (e) => {
      const add = e.target.closest('[data-liste-add]');
      if (add) {
        const container = this.root.querySelector(`[data-liste="${add.dataset.listeAdd}"]`);
        if (container.querySelectorAll('[data-liste-zeile]').length >= 30) return;
        container.insertAdjacentHTML('beforeend', this.listenZeile(container.dataset.platzhalter));
        container.lastElementChild.querySelector('input').focus();
        return;
      }
      const weg = e.target.closest('[data-zeile-weg]');
      if (weg) {
        const zeile = weg.closest('[data-liste-zeile]');
        const container = zeile.parentElement;
        if (container.querySelectorAll('[data-liste-zeile]').length > 1) zeile.remove();
        else zeile.querySelector('input').value = '';
      }
    });
  }

  // --- Varianten ----------------------------------------------------------
  renderVarianten() {
    return `
      <div class="einladung-varianten" data-varianten></div>
      <button type="button" class="mdc-btn mdc-btn--secondary" data-variante-add>Variante hinzufügen</button>`;
  }

  varianteZeile(index) {
    const felder = VARIANTEN_SPALTEN.map((s) => `
      <div class="form-field">
        <label>${escapeHtml(s.label)}</label>
        <input type="${s.typ || 'text'}" data-var="${s.key}" ${s.typ === 'number' ? 'min="0" step="0.01"' : ''}
               placeholder="${escapeHtml(s.platzhalter || '')}">
      </div>`).join('');
    return `
      <div class="einladung-variante" data-variante>
        <div class="einladung-variante__kopf">
          <strong>Variante ${index + 1}</strong>
          <button type="button" class="mdc-btn mdc-btn--secondary" data-variante-weg>Entfernen</button>
        </div>
        <div class="einladung-variante__felder">${felder}</div>
      </div>`;
  }

  bindVarianten() {
    const container = this.root.querySelector('[data-varianten]');
    this.root.querySelector('[data-variante-add]').addEventListener('click', () => {
      const n = container.querySelectorAll('[data-variante]').length;
      if (n >= MAX_VARIANTEN) return;
      container.insertAdjacentHTML('beforeend', this.varianteZeile(n));
    });
    container.addEventListener('click', (e) => {
      const weg = e.target.closest('[data-variante-weg]');
      if (!weg) return;
      weg.closest('[data-variante]').remove();
      container.querySelectorAll('[data-variante] strong').forEach((el, i) => {
        el.textContent = `Variante ${i + 1}`;
      });
    });
  }

  // --- Bilder -------------------------------------------------------------
  renderBilder() {
    return `
      <div class="einladung-bilder" data-bilder></div>
      <input type="file" class="hidden" data-bild-datei accept="${BILD_TYPEN.join(',')}" multiple>
      <button type="button" class="mdc-btn mdc-btn--secondary" data-bild-add>Bilder auswählen</button>
      <p class="einladung-bilder__status" data-bild-status></p>`;
  }

  bindBilder() {
    const input = this.root.querySelector('[data-bild-datei]');
    this.root.querySelector('[data-bild-add]').addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const dateien = Array.from(input.files || []);
      input.value = '';
      await this.ladeBilder(dateien);
    });
    this.root.querySelector('[data-bilder]').addEventListener('click', (e) => {
      const weg = e.target.closest('[data-bild-weg]');
      if (!weg) return;
      const pfad = weg.dataset.bildWeg;
      const bild = this.bilder.find((b) => b.pfad === pfad);
      if (bild?.vorschau) URL.revokeObjectURL(bild.vorschau);
      this.bilder = this.bilder.filter((b) => b.pfad !== pfad);
      this.zeichneBilder();
    });
  }

  setBildStatus(text) {
    const el = this.root.querySelector('[data-bild-status]');
    if (el) el.textContent = text || '';
  }

  async ladeBilder(dateien) {
    this.setBildStatus('');
    const frei = MAX_BILDER - this.bilder.length;
    if (frei <= 0) {
      this.setBildStatus(`Maximal ${MAX_BILDER} Bilder.`);
      return;
    }
    const auswahl = dateien.slice(0, frei);
    if (dateien.length > frei) this.setBildStatus(`Maximal ${MAX_BILDER} Bilder, der Rest wurde übersprungen.`);

    for (const datei of auswahl) {
      if (!BILD_TYPEN.includes(datei.type)) {
        this.setBildStatus(`${datei.name}: nur PNG, JPG, WebP oder AVIF.`);
        continue;
      }
      if (datei.size > MAX_DATEI_BYTES) {
        this.setBildStatus(`${datei.name}: Datei zu groß (max. 25 MB).`);
        continue;
      }
      this.laufendeUploads += 1;
      this.setBildStatus('Lädt hoch …');
      const ergebnis = await ladeDateiHoch({ token: this.token, sitzung: this.sitzung, datei, slot: 'bild' });
      this.laufendeUploads -= 1;

      if (!ergebnis.ok) {
        if (ergebnis.sitzungAbgelaufen) {
          this.onSitzungAbgelaufen();
          return;
        }
        this.setBildStatus(`${datei.name}: ${ergebnis.fehler}`);
        continue;
      }
      this.bilder.push({ pfad: ergebnis.pfad, name: ergebnis.name, vorschau: URL.createObjectURL(datei) });
      this.zeichneBilder();
      if (this.laufendeUploads === 0) this.setBildStatus('');
    }
  }

  zeichneBilder() {
    const container = this.root.querySelector('[data-bilder]');
    container.innerHTML = this.bilder.map((b) => `
      <figure class="einladung-bild">
        <img src="${escapeHtml(b.vorschau)}" alt="${escapeHtml(b.name)}">
        <figcaption>${escapeHtml(b.name)}</figcaption>
        <button type="button" class="mdc-btn mdc-btn--secondary" data-bild-weg="${escapeHtml(b.pfad)}">Entfernen</button>
      </figure>`).join('');
    this.root.querySelector('[data-bild-add]').hidden = this.bilder.length >= MAX_BILDER;
  }

  // --- Absenden -----------------------------------------------------------
  sammle() {
    const daten = {};
    for (const name of Object.keys(PRODUKT_FELD)) {
      const el = this.form.elements[name];
      if (el && el.value !== '') daten[name] = el.value;
    }
    daten.einsatzsituationen = Array.from(this.form.querySelectorAll('[data-liste="einsatzsituationen"] [data-item]'))
      .map((i) => i.value.trim())
      .filter(Boolean);
    daten.varianten = Array.from(this.form.querySelectorAll('[data-variante]')).map((zeile) => {
      const eintrag = {};
      zeile.querySelectorAll('[data-var]').forEach((i) => {
        if (i.value !== '') eintrag[i.dataset.var] = i.value;
      });
      return eintrag;
    }).filter((v) => v.name);
    daten.bilder = this.bilder.map((b) => ({ pfad: b.pfad, name: b.name }));
    return daten;
  }

  zeigeFehler(text) {
    const el = this.root.querySelector('[data-fehler]');
    el.textContent = text;
    el.hidden = !text;
  }

  async senden() {
    if (this.sendet) return;
    this.zeigeFehler('');
    if (this.laufendeUploads > 0) {
      this.zeigeFehler('Bitte warten Sie, bis alle Bilder hochgeladen sind.');
      return;
    }
    const daten = this.sammle();
    if (String(daten.name || '').trim().length < 2) {
      this.zeigeFehler('Bitte den Produktnamen eintragen.');
      this.form.elements.name.focus();
      return;
    }
    if (!/^https?:\/\/\S+\.\S+/i.test(String(daten.url || '').trim())) {
      this.zeigeFehler('Bitte einen gültigen Produkt-Link mit https:// eintragen.');
      this.form.elements.url.focus();
      return;
    }

    this.sendet = true;
    const knopf = this.root.querySelector('[data-aktion="senden"]');
    knopf.disabled = true;
    knopf.textContent = 'Wird gesendet …';

    const antwort = await einladungSubmit(this.token, this.sitzung, daten);

    this.sendet = false;
    knopf.disabled = false;
    knopf.textContent = 'Absenden';

    if (antwort.ok) {
      this.bilder.forEach((b) => b.vorschau && URL.revokeObjectURL(b.vorschau));
      this.onFertig();
      return;
    }
    if (antwort.sitzungAbgelaufen) {
      this.onSitzungAbgelaufen();
      return;
    }
    this.zeigeFehler(antwort.fehler);
  }
}
