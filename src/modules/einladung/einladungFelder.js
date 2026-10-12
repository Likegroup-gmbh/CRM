// einladungFelder.js
// Was der Kunde auf dem Einladungsformular sieht (ADR 0055).
// Briefing: dieselbe Feld-Config wie intern (fieldConfig.js), ohne die internen Felder.
// Produkt: Felder aus ProduktFormConfig, ohne Zuordnung, Personas und Liky.
// Die serverseitige Allowlist (supabase/functions/einladung/felder.ts) muss dazu passen;
// src/__tests__/Einladung.test.js gleicht beide ab.

import { FLOW_STEPS, flattenFields } from '../briefing/create/fieldConfig.js';

/** Briefing-Felder, die nur das Team sieht. */
export const BRIEFING_INTERN = new Set([
  'unternehmen_id',
  'marke_id',
  'kampagne_id',
  'produktion_id',
  'tkp',
  'verhandlungshinweis'
]);

const STEP_LABEL = {
  vertrag: 'Kanäle und Nutzung'
};

const SECTION_TITLE = {
  zuordnung: 'Worum geht es?'
};

/** Hilfetexte, wo das interne Formular keinen hat. */
export const BRIEFING_HILFE = {
  beschreibung: 'Ein bis zwei Sätze: Was soll mit diesem Briefing erreicht werden?',
  nischen: 'Wählen Sie die Themenwelten, in denen die Creator unterwegs sein sollen. „Keine Vorgabe“ überlässt uns die Auswahl.',
  beteiligte_personen: 'Soll der Creator allein im Video sein, oder darf jemand dazukommen?',
  voraussetzungen_sonstiges: 'Alles, was in keine Checkbox passt.',
  aufgabe: 'Beschreiben Sie, was die Creator im Video tun sollen. Je konkreter, desto besser passt das Ergebnis.',
  setting: 'Wo und in welcher Stimmung soll gedreht werden?',
  produktionsvoraussetzungen: 'Zum Beispiel Drehorte, Produktmuster oder Dinge, die vorab geklärt werden müssen.',
  umsetzungsideen: 'Haben Sie schon Ideen für Videos? Dann gerne hier, eine pro Eintrag.',
  learnings_text: 'Was hat bei früheren Videos gut oder schlecht funktioniert?',
  cta: 'Was soll der Zuschauer am Ende tun?',
  ziel_url: 'Wohin sollen Zuschauer geleitet werden?',
  nutzungsdauer: 'Wie lange darf das Video von der Marke genutzt werden?',
  rohmaterial: 'Brauchen Sie das ungeschnittene Material zusätzlich zum fertigen Video?'
};

export const BRIEFING_SCHRITT_INFO = {
  grundlage: 'Ein paar Eckdaten zum Briefing.',
  casting: 'Wen suchen wir? Alles, was Sie hier nicht festlegen, entscheiden wir mit unserer Erfahrung.',
  aufgabe: 'Was sollen die Creator umsetzen?',
  konzepte: 'Ideen, Referenzen und Regeln für die Umsetzung.',
  vertrag: 'Auf welchen Plattformen läuft das Video, wie lang ist es und wie wird es genutzt?'
};

function filterFields(fields = []) {
  const out = [];
  for (const field of fields) {
    if (field.name && BRIEFING_INTERN.has(field.name)) continue;
    if (field.fields && (field.type === 'fieldGroup' || field.type === 'disclosure')) {
      const inner = filterFields(field.fields);
      if (inner.length === 0) continue;
      out.push({ ...field, fields: inner });
      continue;
    }
    const helper = field.helper || BRIEFING_HILFE[field.name];
    let feld = helper && helper !== field.helper ? { ...field, helper } : field;
    // Kunden dürfen den Katalog nicht erweitern: einfache Auswahl statt Suchfeld mit Anlegen.
    if (feld.allowCreate) feld = { ...feld, searchable: false, allowCreate: false };
    out.push(feld);
  }
  return out;
}

/** Schritte des Kundenformulars: interne Felder fehlen, leere Abschnitte und Schritte entfallen. */
export function kundenSteps() {
  const steps = [];
  for (const step of FLOW_STEPS) {
    const sections = [];
    for (const section of step.sections) {
      const fields = filterFields(section.fields);
      if (fields.length === 0) continue;
      sections.push({
        ...section,
        title: SECTION_TITLE[section.id] || section.title,
        fields
      });
    }
    if (sections.length === 0) continue;
    steps.push({
      ...step,
      label: STEP_LABEL[step.id] || step.label,
      info: BRIEFING_SCHRITT_INFO[step.id] || '',
      sections
    });
  }
  return steps;
}

/** Namen aller Felder, die das Kundenformular erheben kann. */
export function kundenFeldNamen() {
  const names = new Set();
  for (const step of kundenSteps()) {
    for (const section of step.sections) {
      for (const field of flattenFields(section.fields)) {
        if (field.persist !== false && field.name) names.add(field.name);
      }
    }
  }
  return names;
}

export const PRODUKT_FELD = {
  name: { label: 'Produkt- oder Kollektionsname', typ: 'text', platzhalter: "z.B. 'Clear Case Kollektion'", pflicht: true },
  url: { label: 'Link zum Produkt im Shop', typ: 'url', platzhalter: 'https://muster-shop.de/products/produktname', pflicht: true },
  kurzbeschreibung: { label: 'Kurzbeschreibung', typ: 'textarea' },
  usp: { label: 'Besonderheiten (USP)', typ: 'textarea', hilfe: 'Was macht das Produkt besser oder anders? Ein Eintrag pro Zeile.' },
  pain_points: { label: 'Probleme der Kunden', typ: 'textarea', hilfe: 'Welche Probleme haben Kunden, bevor sie das Produkt kaufen? Ein Eintrag pro Zeile.' },
  loesung: { label: 'Lösung, die es bietet', typ: 'textarea' },
  preis_von: { label: 'Preis von (€)', typ: 'number', platzhalter: '29.90' },
  preis_bis: { label: 'Preis bis (€)', typ: 'number', platzhalter: '49.90' },
  preis_uvp: { label: 'UVP / regulärer Preis (€)', typ: 'number', platzhalter: '399.00', hilfe: 'Nur bei Rabatt.' },
  inhaltsstoffe: { label: 'Inhaltsstoffe', typ: 'textarea', hilfe: 'Ein Eintrag pro Zeile.' },
  erlaubte_claims: { label: 'Erlaubte Aussagen', typ: 'textarea', hilfe: 'Was dürfen Creator über das Produkt sagen? Ein Eintrag pro Zeile.' },
  verbotene_claims: { label: 'Verbotene Aussagen', typ: 'textarea', hilfe: 'Was dürfen Creator nicht sagen? Ein Eintrag pro Zeile.' },
  rechtliche_hinweise: { label: 'Rechtliche Hinweise', typ: 'textarea' }
};

export const PRODUKT_ABSCHNITTE = [
  {
    id: 'basis',
    titel: 'Was ist das Produkt?',
    text: 'Name und Shop-Link genügen für den Anfang. Alles andere hilft uns, bessere Skripte zu schreiben.',
    felder: ['name', 'url', 'kurzbeschreibung']
  },
  {
    id: 'nutzen',
    titel: 'Warum kauft man es?',
    text: 'Das ist die Grundlage für Skripte und Briefings.',
    felder: ['usp', 'pain_points', 'loesung']
  },
  {
    id: 'situationen',
    titel: 'Wann wird es benutzt?',
    text: 'Typische Alltagssituationen, in denen das Produkt hilft. Eine pro Eintrag.',
    liste: 'einsatzsituationen',
    listePlatzhalter: 'z.B. Morgens im Bad'
  },
  {
    id: 'preis',
    titel: 'Preis',
    text: 'Von-bis, wenn es mehrere Preise gibt.',
    felder: ['preis_von', 'preis_bis', 'preis_uvp']
  },
  {
    id: 'varianten',
    titel: 'Varianten',
    text: 'Nur, wenn es das Produkt in mehreren Ausführungen gibt. Tragen Sie ein, was sich unterscheidet.',
    varianten: true
  },
  {
    id: 'rechtliches',
    titel: 'Rechtliches',
    text: 'Was Creator sagen dürfen und was nicht. Das fließt später direkt ins Briefing.',
    felder: ['inhaltsstoffe', 'erlaubte_claims', 'verbotene_claims', 'rechtliche_hinweise']
  },
  {
    id: 'bilder',
    titel: 'Produktbilder',
    text: 'Bis zu fünf Bilder (PNG, JPG, WebP oder AVIF).',
    bilder: true
  }
];

export const VARIANTEN_SPALTEN = [
  { key: 'name', label: 'Name', platzhalter: 'z.B. Schwarz / 50 ml' },
  { key: 'farbe', label: 'Farbe', platzhalter: '' },
  { key: 'modell_kompatibilitaet', label: 'Modell', platzhalter: '' },
  { key: 'preis', label: 'Preis (€)', platzhalter: '', typ: 'number' },
  { key: 'merkmal', label: 'Merkmal', platzhalter: '' }
];

/** Feldnamen der Produkt-Einladung. */
export const PRODUKT_FELDNAMEN = [
  ...Object.keys(PRODUKT_FELD),
  'einsatzsituationen', 'varianten', 'bilder'
];
