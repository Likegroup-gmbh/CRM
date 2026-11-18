// Briefing auf der oeffentlichen Bewerbungsseite: der Inhalt des Creator-Briefing-PDFs
// (ADR 0073) als Text-Abschnitte { label, text }, in Reihenfolge und Wortlaut von
// briefingFelder.json. Keine Altfelder (Voraussetzungen, Freigabeprozess, Ausschluesse):
// die Seite ist extern.

const FELDER = require('../../../src/modules/briefing/briefingFelder.json');
const { videolaengeText, ideenEintraege } = require('./skript-context/briefing-felder');

function alleFelder(fields = []) {
  return fields.flatMap((f) => (f.type === 'fieldGroup' ? alleFelder(f.fields) : [f]));
}

const SPALTEN = new Set(['aktivierung_name']);
for (const schritt of FELDER.schritte) {
  for (const field of alleFelder(schritt.felder)) {
    if (field.persist === false) continue;
    if (field.type === 'videolaenge') {
      SPALTEN.add('videolaenge_von');
      SPALTEN.add('videolaenge_bis');
    } else {
      SPALTEN.add(field.name);
    }
  }
}
/** Spalten fuer den Select (explizit, nie '*': die Seite ist oeffentlich). */
const BEWERBUNG_BRIEFING_SPALTEN = [...SPALTEN].join(', ');

function clean(value) {
  return String(value ?? '').trim();
}

function fmtDatum(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(clean(iso));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : clean(iso);
}

function optionLabels(field, werte) {
  return (Array.isArray(werte) ? werte : [])
    .map((v) => field.options?.find((o) => o.value === v)?.label || v)
    .filter(Boolean);
}

function gruppe(row, group) {
  const felder = group.fields || [];
  const out = [];
  const an = felder.filter((f) => f.type === 'checkbox' && row[f.name] === true).map((f) => f.label);
  if (an.length) out.push({ label: group.label, text: an.join(', ') });

  const liste = felder.find((f) => f.type === 'checkboxes');
  const weitere = liste ? felder.find((f) => f.type === 'text') : null;
  if (liste) {
    const werte = [...optionLabels(liste, row[liste.name]), weitere ? clean(row[weitere.name]) : ''].filter(Boolean);
    if (werte.length) out.push({ label: liste.label, text: werte.join(', ') });
  }

  for (const field of felder) {
    if (field.type === 'checkbox' || field === liste || field === weitere || field.nachDatum) continue;
    if (field.type === 'date') {
      const start = clean(row[field.name]);
      const bisFeld = felder.find((f) => f.nachDatum === field.name);
      const bis = bisFeld ? clean(row[bisFeld.name]) : '';
      if (start) out.push({ label: field.label, text: bis ? `${fmtDatum(start)} bis ${fmtDatum(bis)}` : fmtDatum(start) });
      continue;
    }
    out.push(...feldAbschnitte(row, field, []));
  }
  return out;
}

function produktText(p) {
  const name = clean(p?.name);
  const url = clean(p?.url);
  if (name && url) return `${name} (${url})`;
  return name || url;
}

function feldAbschnitte(row, field, produkte) {
  switch (field.type) {
    case 'fieldGroup':
      return gruppe(row, field);
    case 'produktListe': {
      const text = (produkte || []).map(produktText).filter(Boolean).join('\n');
      return text ? [{ label: field.label, text }] : [];
    }
    case 'ideenListe': {
      const text = ideenEintraege(row)
        .map((e) => `${e.verbindlich ? 'Verbindlich' : 'Inspiration'}: ${e.text}`)
        .join('\n');
      return text ? [{ label: field.label, text }] : [];
    }
    case 'videolaenge': {
      const text = videolaengeText(row);
      return text ? [{ label: field.label, text }] : [];
    }
    default: {
      const text = clean(row[field.name]);
      return text ? [{ label: field.label, text }] : [];
    }
  }
}

/** Abschnitte des Briefings; produkte: [{ name, url }] der Linie (live aus dem Katalog). */
function briefingAbschnitte(row, produkte = []) {
  if (!row) return [];
  return FELDER.schritte.flatMap((schritt) => schritt.felder
    .filter((field) => field.name !== 'aktivierung_name')
    .flatMap((field) => feldAbschnitte(row, field, produkte)));
}

module.exports = { BEWERBUNG_BRIEFING_SPALTEN, briefingAbschnitte };
