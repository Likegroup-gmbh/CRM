// videoideeVorschlag.js
// Zustand eines Videoidee-Vorschlags (ADR 0015): Flag auf strategie_items,
// kein eigener Typ. Erstzeile der Beschreibung ist der Titel (Picker-Label).

export const VIDEOIDEE_VORSCHLAG_ERROR = 'Erst übernehmen, dann als Videoidee nutzen.';

export const VORSCHLAG_EDIT_FIELDS = Object.freeze(['beschreibung', 'beschreibung_quelle']);

export function isVideoideeVorschlag(item) {
  return !!item?.ist_vorschlag;
}

export function beschreibungErstzeile(text) {
  const s = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!s) return '';
  return s.split('\n')[0].trim();
}

const BESCHREIBUNG_LABELS = ['Pain Point:', 'Hook:', 'Kernbotschaft:', 'Ablauf:'];

/** Leerzeile vor den festen Labels, wenn davor nur ein einzelner Umbruch steht. */
export function beschreibungMitAbsaetzen(text) {
  let s = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!s) return '';
  for (const label of BESCHREIBUNG_LABELS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(`([^\\n])\\n(${escaped})`, 'g'), '$1\n\n$2');
  }
  return s;
}

export function countVideoideeVorschlaege(items) {
  return (items || []).filter(isVideoideeVorschlag).length;
}

export function splitVideoideeVorschlaege(items) {
  const vorschlaege = [];
  const rest = [];
  for (const item of items || []) {
    if (isVideoideeVorschlag(item)) vorschlaege.push(item);
    else rest.push(item);
  }
  return { vorschlaege, rest };
}
