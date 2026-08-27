// PersonaProfil.js
// Read-only-Ansicht eines Persona-Profils. Baut aus personaConfig.fields die
// gleiche Ansicht wie das Formular - gleiche Labels, gleiche Reihenfolge,
// gleiche Sektionen - damit Drawer und Formular nie auseinanderlaufen.
// Genutzt vom Persona-Drawer am Produkt (Vorschau der Vorschlaege).

import { personaConfig } from '../../core/form/config/PersonaFormConfig.js';

const SECTION_TITLES = {
  identitaet: 'Wer ist diese Persona?',
  demografie: 'Demografische Merkmale',
  lebensrealitaet: 'Lebensrealität',
  kaufverhalten: 'Kaufverhalten',
  ansprache: 'Sprache und Ansprache',
  sonstiges: 'Sonstiges'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wert eines Feldes fuer die Anzeige aufbereiten. Leer -> null. */
function formatValue(field, data) {
  if (field.type === 'daterange') {
    const von = data[field.nameFrom];
    const bis = data[field.nameTo];
    if (von != null && von !== '' && bis != null && bis !== '') return `${von}–${bis} Jahre`;
    if (von != null && von !== '') return `ab ${von} Jahre`;
    if (bis != null && bis !== '') return `bis ${bis} Jahre`;
    return null;
  }

  const raw = data[field.name];
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;

  if (field.type === 'select' && Array.isArray(field.options)) {
    const option = field.options.find(o => o.value === raw);
    return option ? option.label : String(raw);
  }

  return String(raw);
}

function fieldHtml(field, data) {
  const value = formatValue(field, data);
  const grosse = field.type === 'textarea' ? ' persona-profil__field--lang' : '';
  return `
    <div class="form-field persona-profil__field${grosse}">
      <label>${escapeHtml(field.label)}</label>
      <div class="persona-profil__wert${value === null ? ' persona-profil__wert--leer' : ''}">${value === null ? '—' : escapeHtml(value)}</div>
    </div>`;
}

/**
 * Komplettes Profil als HTML. Felder ohne eigenen sichtbaren Wert bleiben
 * sichtbar (mit Gedankenstrich), damit die Ansicht das Formular spiegelt.
 * Verwaltungsfelder (hidden, Marken-/Unternehmens-Zuordnung) fallen raus.
 */
export function renderPersonaProfil(data = {}) {
  const teile = [];
  let aktuelleSektion = null;

  for (const field of personaConfig.fields) {
    if (field.type === 'hidden' || field.name === 'marke_ids') continue;

    if (field.section !== aktuelleSektion) {
      if (aktuelleSektion !== null) teile.push('</div></section>');
      aktuelleSektion = field.section || null;
      const titel = field.sectionTitle || SECTION_TITLES[aktuelleSektion];
      teile.push(`<section class="form-section persona-profil__sektion"${aktuelleSektion ? ` data-sektion="${aktuelleSektion}"` : ''}>`);
      if (titel) teile.push(`<h3>${titel}</h3>`);
      teile.push('<div class="persona-profil__grid">');
    }

    teile.push(fieldHtml(field, data));
  }

  if (aktuelleSektion !== null || teile.length) teile.push('</div></section>');
  return `<div class="persona-profil">${teile.join('')}</div>`;
}
