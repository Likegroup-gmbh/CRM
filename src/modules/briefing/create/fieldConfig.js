// fieldConfig.js
// Briefing-Formular nach dem Creator-Briefing-PDF (ADR 0073): erst der Typ-Baum, dann die
// drei Sektionen aus briefingFelder.json, für alle Typen gleich. Der Typ steuert nur
// Skript-Ton, Casting-Liste und das gesperrte Häkchen bei der Content-Verwendung.
// Was das PDF nicht fragt, steht in briefingAltfelder.js. DB-Werte für bereich bleiben (v1-kompatibel).

import BRIEFING_FELDER from '../briefingFelder.json';

export const BEREICH_OPTIONS = [
  { value: 'paid_creator_ads', label: 'Paid', desc: 'Primär für Werbeanzeigen produziert.' },
  { value: 'owned_social', label: 'Organic', desc: 'Primär für die organischen Kanäle der Marke.' },
  { value: 'influencer_marketing', label: 'Influencer', desc: 'Primär zur Veröffentlichung auf dem Creator-Kanal.' }
];

export const BEREICH_LABELS = Object.fromEntries(BEREICH_OPTIONS.map(b => [b.value, b.label]));

// Nur noch für ältere Briefings (Meta-Zeile im Dokument).
export const MAERKTE_OPTIONS = [
  { value: 'deutschland', label: 'Deutschland' },
  { value: 'oesterreich', label: 'Österreich' },
  { value: 'schweiz', label: 'Schweiz' }
];

export const SPRACHEN_OPTIONS = [
  { value: 'deutsch', label: 'Deutsch' },
  { value: 'englisch', label: 'Englisch' }
];

/** Titel der drei PDF-Sektionen in Reihenfolge (Doc, Creator-PDF, Bewerbung). */
export const SEKTIONEN = BRIEFING_FELDER.schritte.map(s => ({ id: s.id, titel: s.titel, hinweis: s.hinweis || '' }));

function fieldGroup(id, layout, fields) {
  return { type: 'fieldGroup', id, layout, fields };
}

// Zuordnung: bekannt (aus Produktion oder Kampagne) heißt ausgeblendet und im Hintergrund gesetzt.
// Sichtbar bleibt nur, was fehlt (FieldRenderer, syncZielProduktion).
const ZUORDNUNG = {
  id: 'zuordnung',
  title: 'Zuordnung',
  hideWhenKnown: true,
  fields: [
    fieldGroup('zuordnung-entities', 'stack', [
      { name: 'unternehmen_id', label: 'Unternehmen', type: 'entitySelect', table: 'unternehmen', displayField: 'firmenname', hideWhenKnown: true, required: true, placeholder: 'Unternehmen auswählen...' },
      { name: 'marke_id', label: 'Marke (optional)', type: 'entitySelect', table: 'marke', displayField: 'markenname', dependsOn: 'unternehmen_id', hideWhenKnown: true, placeholder: 'Marke auswählen...' },
      { name: 'kampagne_id', label: 'Kampagne', type: 'entitySelect', table: 'kampagne', displayField: 'label', dependsOn: 'unternehmen_id', scopeMarke: true, hideWhenKnown: true, required: true, placeholder: 'Kampagne auswählen...' },
      { name: 'produktion_id', label: 'Produktion', type: 'entitySelect', displayField: 'name', dependsOn: 'kampagne_id', required: true, placeholder: 'Produktion auswählen...' }
    ])
  ]
};

function sektion(schritt) {
  return {
    id: schritt.id,
    title: schritt.titel,
    description: schritt.hinweis || '',
    fields: schritt.felder
  };
}

export const FLOW_STEPS = BRIEFING_FELDER.schritte.map((schritt, i) => ({
  id: schritt.id,
  label: schritt.label,
  sections: i === 0 ? [ZUORDNUNG, sektion(schritt)] : [sektion(schritt)]
}));

function optionKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ');
}

/** Option-Wert zu Wert oder Label (ohne Beachtung von Gross-/Kleinschreibung und Strichart), sonst null. */
export function optionWert(options, raw) {
  const key = optionKey(raw);
  if (!key) return null;
  const hit = (options || []).find(o => optionKey(o.value) === key || optionKey(o.label) === key);
  return hit ? hit.value : null;
}

export function flattenFields(fields = []) {
  const out = [];
  for (const field of fields) {
    if (field.type === 'disclosure' || field.type === 'fieldGroup') {
      out.push(...flattenFields(field.fields || []));
    } else {
      out.push(field);
    }
  }
  return out;
}

export function getStepsForBereich(_bereich) {
  return FLOW_STEPS;
}

function alleFelder() {
  const fields = [];
  for (const step of FLOW_STEPS) {
    for (const section of step.sections) fields.push(...flattenFields(section.fields));
  }
  const seen = new Set();
  return fields.filter(f => {
    if (seen.has(f.name)) return false;
    seen.add(f.name);
    return true;
  });
}

const ALLE_FELDER = alleFelder();

/** Felder mit Spalte in campaign_briefings (ohne persist:false wie die Produktliste). */
export function getAllFields() {
  return ALLE_FELDER.filter(f => f.persist !== false);
}

/** Inhaltsfelder des Creator-Briefings (ohne Zuordnung), auch die ohne Spalte. */
export function inhaltsFelder() {
  return ALLE_FELDER.filter(f => f.type !== 'entitySelect');
}

export function feldNachName(name) {
  return ALLE_FELDER.find(f => f.name === name) || null;
}
