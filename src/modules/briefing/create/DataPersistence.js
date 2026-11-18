// DataPersistence.js
// Formular -> formData -> DB-Payload für das Creator-Briefing (ADR 0073), plus Validierung.
// Geschrieben werden nur die Felder aus briefingFelder.json. Altfelder bleiben in der
// Zeile unberührt (v1 liest sie weiter). Speichern und Laden: BriefingSpeichern.js.

import { BriefingCreate } from './BriefingCreateCore.js';
import { getAllFields, inhaltsFelder, FLOW_STEPS, flattenFields } from './fieldConfig.js';
import { videolaengeOderNull, mindestlaengeOderNull } from '../videolaenge.js';
import { sekundenSpanneWert } from '../../../core/components/SekundenSpanne.js';
import { CustomDatePicker } from '../../../core/components/CustomDatePicker.js';
import { leiteBereichAb } from './bereichAbleiten.js';
import { mirrorLegacyColumns } from '../briefingLegacy.js';
import './BriefingSpeichern.js';

export { mirrorLegacyColumns } from '../briefingLegacy.js';

const ZUORDNUNG = FLOW_STEPS.flatMap(s => s.sections)
  .filter(s => s.id === 'zuordnung')
  .flatMap(s => flattenFields(s.fields));

function leseVideolaenge(form, field) {
  const root = form.querySelector(`[data-videolaenge="${field.name}"]`);
  if (!root) return undefined;
  const modus = root.querySelector(`input[name="${field.name}__modus"]:checked`)?.value || 'keine';
  if (modus === 'minimum') {
    return { modus, wert: mindestlaengeOderNull(root.querySelector(`[name="${field.name}__minimum"]`)?.value, null) };
  }
  if (modus === 'bereich') {
    return { modus, wert: sekundenSpanneWert(root.querySelector('[data-sekunden-spanne]')) };
  }
  return { modus, wert: null };
}

function leseIdeen(form, field) {
  const container = form.querySelector(`[data-ideenliste="${field.name}"]`);
  if (!container) return undefined;
  return [...container.querySelectorAll('[data-idee-row]')]
    .map(row => ({
      text: row.querySelector('[data-idee-text]')?.value.trim() || '',
      verbindlich: !!row.querySelector('[data-idee-verbindlich]')?.checked
    }))
    .filter(e => e.text);
}

/** Produktzeilen wie im DOM, leere Zeilen ohne verknüpftes Produkt fallen weg. */
export function leseProdukte(form, field) {
  const container = form.querySelector(`[data-produktliste="${field.name}"]`);
  if (!container) return undefined;
  return [...container.querySelectorAll('[data-produkt-row]')].map((row) => {
    const entry = { produkt_id: row.dataset.produktId || null };
    for (const sub of field.fields || []) {
      entry[sub.name] = row.querySelector(`[data-produkt-feld="${sub.name}"]`)?.value.trim() || '';
    }
    return entry;
  }).filter(e => e.produkt_id || (field.fields || []).some(sub => e[sub.name]));
}

BriefingCreate.prototype.saveCurrentStepData = function() {
  const form = document.getElementById('briefing-form');
  if (!form) return;

  for (const field of [...ZUORDNUNG, ...inhaltsFelder()]) {
    switch (field.type) {
      case 'checkbox': {
        const input = form.querySelector(`input[name="${field.name}"]`);
        if (input) this.formData[field.name] = input.checked;
        break;
      }
      case 'checkboxes': {
        const inputs = form.querySelectorAll(`input[name="${field.name}"]`);
        if (inputs.length) this.formData[field.name] = [...inputs].filter(cb => cb.checked).map(cb => cb.value);
        break;
      }
      case 'videolaenge': {
        const gelesen = leseVideolaenge(form, field);
        if (gelesen) {
          this.formData[field.name] = gelesen.wert;
          this.formData[`${field.name}_modus`] = gelesen.modus;
        }
        break;
      }
      case 'ideenListe': {
        const ideen = leseIdeen(form, field);
        if (ideen) this.formData[field.name] = ideen;
        break;
      }
      case 'produktListe': {
        const produkte = leseProdukte(form, field);
        if (produkte) this.formData[field.name] = produkte;
        break;
      }
      case 'date': {
        const input = form.querySelector(`[name="${field.name}"]`);
        if (input) this.formData[field.name] = CustomDatePicker.getValue(input);
        break;
      }
      default: {
        const input = form.querySelector(`[name="${field.name}"]`);
        if (input) this.formData[field.name] = input.value;
      }
    }
  }

  if (this.selectedBereich && !this.formData.bereich) {
    this.formData.bereich = this.selectedBereich;
  }
};

// Briefing-Name = Kampagnentitel. Leer und noch nie gesetzt fällt auf den
// Kampagnennamen zurück (ADR 0041). Ein geleertes Feld bleibt leer.
BriefingCreate.prototype.resolveBriefingName = function() {
  const roh = this.formData.aktivierung_name;
  const gesetzt = String(roh || '').trim();
  if (gesetzt) return gesetzt;
  if (roh !== undefined && roh !== null) return null;
  const kampagneId = this.formData.kampagne_id || this._produktionKontext?.kampagneId || null;
  const kampagne = (this.kampagnen || []).find(k => k.id === kampagneId);
  return String(kampagne?.kampagnenname || '').trim() || null;
};

function textOderNull(value) {
  const s = typeof value === 'string' ? value.trim() : value;
  return s === '' || s === undefined ? null : s;
}

/** Umsetzungsideen als [{ text, verbindlich }], leer: null. */
export function ideenFuerDB(value) {
  if (!Array.isArray(value)) return null;
  const eintraege = value
    .map(e => ({ text: String((typeof e === 'string' ? e : e?.text) ?? '').trim(), verbindlich: e?.verbindlich === true }))
    .filter(e => e.text);
  return eintraege.length ? eintraege : null;
}

BriefingCreate.prototype.prepareDataForDB = function() {
  const data = {
    unternehmen_id: this.formData.unternehmen_id || null,
    marke_id: this.formData.marke_id || null
  };

  for (const field of getAllFields()) {
    const value = this.formData[field.name];
    switch (field.type) {
      case 'checkbox':
        data[field.name] = value === true;
        break;
      case 'checkboxes':
        data[field.name] = Array.isArray(value) && value.length ? value : null;
        break;
      case 'videolaenge': {
        const laenge = videolaengeOderNull(value?.von, value?.bis);
        data.videolaenge_von = laenge?.von ?? null;
        data.videolaenge_bis = laenge?.bis ?? null;
        break;
      }
      case 'ideenListe':
        data[field.name] = ideenFuerDB(value);
        break;
      case 'date': {
        const datum = textOderNull(value);
        const start = field.nachDatum ? data[field.nachDatum] : null;
        data[field.name] = field.nachDatum && (!start || !datum || datum < start) ? null : datum;
        break;
      }
      default:
        data[field.name] = textOderNull(value) ?? null;
    }
  }

  data.bereich = leiteBereichAb(data, this.formData.bereich || this.selectedBereich);
  data.aktivierung_name = this.resolveBriefingName();
  mirrorLegacyColumns(data, data.bereich);
  return data;
};

// Radio mit ausschliesslich true/false-Optionen -> boolean-Spalte (NOT NULL DEFAULT false)
export function isBooleanRadio(field) {
  return field.type === 'radio'
    && Array.isArray(field.options) && field.options.length > 0
    && field.options.every(o => o.value === 'true' || o.value === 'false');
}

BriefingCreate.prototype.validateCurrentStep = function() {
  const form = document.getElementById('briefing-form');
  if (!form) return true;

  for (const field of form.querySelectorAll('[required]')) {
    if (field.closest('.hidden') || field.disabled) continue;
    const wert = field.closest('[data-custom-datepicker]') ? CustomDatePicker.getValue(field) : field.value;
    if (!wert) {
      field.focus();
      window.toastSystem?.show('Bitte füllen Sie alle Pflichtfelder aus.', 'warning');
      return false;
    }
  }
  if (form.querySelector('[data-group="content-verwendung"]')) {
    const gesetzt = [...form.querySelectorAll('[data-group="content-verwendung"] input[type="checkbox"]')]
      .some(cb => cb.checked);
    if (!gesetzt) {
      window.toastSystem?.show('Bitte angeben, wie der Content verwendet wird.', 'warning');
      return false;
    }
  }
  for (const bis of form.querySelectorAll('input[data-nach-datum]')) {
    const startInput = form.querySelector(`input[name="${bis.dataset.nachDatum}"]`);
    const start = CustomDatePicker.getValue(startInput);
    const bisWert = CustomDatePicker.getValue(bis);
    if (bis.value && (!start || !bisWert || bisWert < start)) {
      bis.focus();
      window.toastSystem?.show('Das „bis“-Datum braucht ein Startdatum davor.', 'warning');
      return false;
    }
  }
  return true;
};
