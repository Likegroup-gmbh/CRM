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
