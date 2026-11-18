// einladungFelder.js
// Was der Kunde auf dem Einladungsformular sieht (ADR 0055).
// Briefing: dieselbe Feld-Config wie intern (fieldConfig.js, Creator-Briefing-PDF), ohne die Zuordnung.
// Produkt: Felder aus ProduktFormConfig, ohne Zuordnung, Personas und Liky.
// Die serverseitige Allowlist (supabase/functions/einladung/felder.ts) muss dazu passen;
// src/__tests__/EinladungAllowlist.test.js gleicht beide ab.

import { FLOW_STEPS, flattenFields } from '../briefing/create/fieldConfig.js';

/** Briefing-Felder, die nur das Team sieht: die Zuordnung kommt aus der Einladung. */
export const BRIEFING_INTERN = new Set([
  'unternehmen_id',
  'marke_id',
  'kampagne_id',
  'produktion_id'
]);

/** Hilfetexte für Kunden. Gehen vor den internen Hilfetexten aus briefingFelder.json. */
export const BRIEFING_HILFE = {
  aktivierung_name: 'Ein kurzer Name für die Kampagne, zum Beispiel „Sommer-Launch“.',
  nutzungsrechte: 'Wo und wie lange darf der Content genutzt werden? Zum Beispiel 12 Monate Paid Ads auf Meta.',
  produkte: 'Name oder Link zum Shop genügt. Bei mehreren Produkten eins pro Zeile.',
  beschreibung: 'Worum geht es in der Kampagne, und wen wollen Sie erreichen?',
  kernbotschaft: 'Was soll beim Zuschauer hängen bleiben? Ein Satz genügt.',
  aufgabe: 'Was sollen die Creator im Video tun? Je konkreter, desto besser passt das Ergebnis.',
  setting: 'Wo und in welcher Stimmung soll gedreht werden?',
  umsetzungsideen_eintraege: 'Textideen oder Links zu Referenzvideos. Markieren Sie je Eintrag, ob er verbindlich umgesetzt werden soll oder nur als Inspiration dient.'
};

export const BRIEFING_SCHRITT_INFO = {
  rahmen: 'Eckdaten zur Kampagne: Nutzung, Plattformen, Format und Termine.',
  produkt: 'Welche Produkte stehen im Mittelpunkt, und was ist die Idee dahinter?',
  umsetzung: 'Was sollen die Creator umsetzen, und was ist Pflicht?'
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
    const helper = BRIEFING_HILFE[field.name] || field.helper;
    let feld = helper !== field.helper ? { ...field, helper } : field;
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
      sections.push({ ...section, fields });
    }
    if (sections.length === 0) continue;
    steps.push({
      ...step,
      info: BRIEFING_SCHRITT_INFO[step.id] || '',
      sections
    });
  }
  return steps;
}

/** Namen aller Felder, die das Kundenformular erhebt (auch die Produktliste ohne eigene Spalte). */
export function kundenFeldNamen() {
  const names = new Set();
  for (const step of kundenSteps()) {
    for (const section of step.sections) {
      for (const field of flattenFields(section.fields)) {
        if (field.name) names.add(field.name);
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
