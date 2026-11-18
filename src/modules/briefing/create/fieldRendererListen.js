// fieldRendererListen.js
// Zusammengesetzte Feldtypen des Creator-Briefings: Videolänge (Mindestlänge oder von/bis),
// Produktliste (je Produkt die PDF-Felder, angelegt wird im Hintergrund) und
// Umsetzungsideen (Eintrag plus Schalter „verbindlich“). Zeilen-HTML wird auch von
// FormEvents beim Hinzufügen genutzt.

import { escapeHtml } from '../../../core/format.js';
import { icon } from '../../../core/icons/IconSystem.js';
import { renderSekundenSpanne, sekundenSpanneAttrs } from '../../../core/components/SekundenSpanne.js';
import { renderLabel, renderHelper } from './fieldRendererBasis.js';

export const VIDEOLAENGE_MODI = [
  { value: 'minimum', label: 'Mindestlänge' },
  { value: 'bereich', label: 'Gewünschte Länge von / bis' },
  { value: 'keine', label: 'Keine Vorgabe' }
];

/** Modus aus dem Wert: { von, bis:null } ist eine Mindestlänge, leer heißt keine Vorgabe. */
export function videolaengeModus(value, gemerkt) {
  if (gemerkt && VIDEOLAENGE_MODI.some(m => m.value === gemerkt)) return gemerkt;
  if (!value || value.von == null) return 'keine';
  return value.bis == null ? 'minimum' : 'bereich';
}

export function renderVideolaenge(field, formData) {
  const name = field.name;
  const value = formData[name];
  const modus = videolaengeModus(value, formData[`${name}_modus`]);
  const min = field.min ?? 1;
  const max = field.max ?? 180;
  const spanne = modus === 'bereich' ? { von: value?.von, bis: value?.bis, min, max } : { min, max };
  const mindest = modus === 'minimum' ? (value?.von ?? '') : '';
  const radios = VIDEOLAENGE_MODI.map(m => `
    <label class="radio-option">
      <input type="radio" name="${escapeHtml(name)}__modus" value="${m.value}" ${modus === m.value ? 'checked' : ''}>
      <span>${escapeHtml(m.label)}</span>
    </label>
  `).join('');
  return `
    <div class="form-field bf-videolaenge" data-videolaenge="${escapeHtml(name)}">
      ${renderLabel(field)}
      <div class="radio-group">${radios}</div>
      <div class="bf-videolaenge__minimum${modus === 'minimum' ? '' : ' hidden'}" data-videolaenge-teil="minimum">
        <input type="text" inputmode="numeric" autocomplete="off" name="${escapeHtml(name)}__minimum"
               value="${escapeHtml(mindest)}" placeholder="z.B. 30" aria-label="Mindestlänge in Sekunden">
        <span>Sekunden</span>
      </div>
      <div class="bf-videolaenge__bereich${modus === 'bereich' ? '' : ' hidden'}" data-videolaenge-teil="bereich"
           ${sekundenSpanneAttrs({ name, ...spanne })}>${renderSekundenSpanne(spanne)}</div>
      ${renderHelper(field)}
    </div>
  `;
}

// ---------------------------------------------------------------
// Produktliste
// ---------------------------------------------------------------

function produktStatus(entry) {
  if (entry?.produkt_id) return 'Am Briefing';
  if (entry?.name || entry?.url) return 'Wird angelegt';
  return '';
}

function produktUnterfeld(sub, entry) {
  const value = entry?.[sub.name] ?? '';
  const attrs = `data-produkt-feld="${escapeHtml(sub.name)}" ${sub.placeholder ? `placeholder="${escapeHtml(sub.placeholder)}"` : ''}`;
  const input = sub.type === 'textarea'
    ? `<textarea rows="${sub.rows || 2}" ${attrs}>${escapeHtml(value)}</textarea>`
    : `<input type="${sub.type === 'url' ? 'url' : 'text'}" value="${escapeHtml(value)}" ${attrs}>`;
  return `<div class="form-field bf-produkt__feld bf-produkt__feld--${escapeHtml(sub.name)}"><label>${escapeHtml(sub.label)}</label>${input}</div>`;
}

/** Eine Produktzeile. ohneUpload: Einladung (Kunde lädt keine Unterlagen ins Produkt). */
export function produktZeileHtml(field, entry = {}, { ohneUpload = false } = {}) {
  const status = produktStatus(entry);
  const upload = ohneUpload ? '' : `
      <div class="bf-produkt__unterlagen">
        <input type="file" accept="application/pdf" class="hidden" data-produkt-pdf>
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-produkt-pdf-trigger>${icon('upload')} Unterlagen (PDF) auslesen</button>
        <span class="bf-produkt__hinweis" data-produkt-pdf-label></span>
      </div>`;
  return `
    <div class="bf-produkt" data-produkt-row data-produkt-id="${escapeHtml(entry.produkt_id || '')}">
      <div class="bf-produkt__kopf">
        <span class="bf-produkt__status" data-produkt-status>${escapeHtml(status)}</span>
        <button type="button" class="mdc-btn mdc-btn--icon" data-produkt-remove title="Produkt aus dem Briefing nehmen">${icon('trash')}</button>
      </div>
      <div class="bf-produkt__felder">${(field.fields || []).map(sub => produktUnterfeld(sub, entry)).join('')}</div>
      ${upload}
    </div>
  `;
}

export function renderProduktListe(field, formData, context) {
  const rows = Array.isArray(formData[field.name]) && formData[field.name].length ? formData[field.name] : [{}];
  const ohneUpload = !!context?.einladung;
  return `
    <div class="form-field bf-produkte">
      ${renderLabel(field)}
      <div class="bf-produkte__liste" data-produktliste="${escapeHtml(field.name)}" data-max="${field.max || 10}">
        ${rows.map(entry => produktZeileHtml(field, entry, { ohneUpload })).join('')}
      </div>
      <button type="button" class="mdc-btn mdc-btn--secondary" data-produkt-add>${icon('plus')} Weiteres Produkt</button>
      ${renderHelper(field)}
    </div>
  `;
}

// ---------------------------------------------------------------
// Umsetzungsideen & Referenzen
// ---------------------------------------------------------------

export function ideeZeileHtml(field, entry = {}) {
  const text = typeof entry === 'string' ? entry : (entry?.text ?? '');
  const verbindlich = entry?.verbindlich === true;
  return `
    <div class="bf-repeatable-row bf-idee" data-repeatable-row data-idee-row>
      <textarea rows="2" data-idee-text placeholder="${escapeHtml(field.placeholder || 'Idee oder Link')}">${escapeHtml(text)}</textarea>
      <label class="bf-idee__schalter" title="Verbindliche Ideen werden 1:1 zu Videoideen im Konzept">
        <span class="toggle-switch">
          <input type="checkbox" data-idee-verbindlich ${verbindlich ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </span>
        <span class="bf-idee__art" data-idee-art>${verbindlich ? 'Verbindlich' : 'Inspiration'}</span>
      </label>
      <button type="button" class="mdc-btn mdc-btn--icon bf-repeatable-remove" title="Entfernen">${icon('trash')}</button>
    </div>
  `;
}

export function renderIdeenListe(field, formData) {
  const rows = Array.isArray(formData[field.name]) && formData[field.name].length ? formData[field.name] : [{}];
  return `
    <div class="form-field bf-ideen">
      ${renderLabel(field)}
      <div class="bf-repeatable" data-ideenliste="${escapeHtml(field.name)}" data-max="${field.max || 20}">
        ${rows.map(entry => ideeZeileHtml(field, entry)).join('')}
      </div>
      <button type="button" class="mdc-btn mdc-btn--secondary bf-repeatable-add" data-ideen-add="${escapeHtml(field.name)}">${icon('plus')} Idee oder Referenz</button>
      ${renderHelper(field)}
    </div>
  `;
}
