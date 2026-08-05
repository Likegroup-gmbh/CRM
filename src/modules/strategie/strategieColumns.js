// strategieColumns.js
// Sichtbarkeit der festen Spalten in der Strategie-Detail-Tabelle.
//
// strategie.hidden_columns speicherte bisher nur "custom:{uuid}". Dazu kommen
// jetzt zwei Formen fuer die festen Spalten:
//   "fixed:{key}"       -> Spalte ist ausgeblendet
//   "show:fixed:{key}"  -> Spalte ist eingeblendet (nur fuer Spalten noetig, die
//                          standardmaessig aus sind)
// Ohne Eintrag gilt der Default. Transkript und Caption sind lange Texte und
// starten deshalb ausgeblendet, ohne dass bestehende Strategien migriert werden
// muessen.

export const STRATEGIE_FIXED_COLUMNS = Object.freeze([
  { key: 'creator', label: 'Creator' },
  { key: 'beschreibung', label: 'Beschreibung' },
  { key: 'transkript', label: 'Transkript' },
  { key: 'caption', label: 'Caption' },
  { key: 'anmerkung', label: 'Anmerkung Kunde' },
  { key: 'prio', label: 'Prio' },
  { key: 'umgesetzt', label: 'Umgesetzt' }
]);

const DEFAULT_HIDDEN = new Set(['transkript', 'caption']);

export function fixedColumnHiddenKey(key) {
  return `fixed:${key}`;
}

export function fixedColumnShownKey(key) {
  return `show:fixed:${key}`;
}

export function isFixedColumnVisible(hiddenColumns, key) {
  const list = hiddenColumns || [];
  if (list.includes(fixedColumnHiddenKey(key))) return false;
  if (DEFAULT_HIDDEN.has(key)) return list.includes(fixedColumnShownKey(key));
  return true;
}

/**
 * Neue hidden_columns-Liste nach einem Toggle. Es bleibt immer nur ein Eintrag
 * pro Spalte uebrig, damit sich "hidden" und "show" nicht widersprechen.
 */
export function setFixedColumnVisibility(hiddenColumns, key, visible) {
  const next = (hiddenColumns || []).filter(
    entry => entry !== fixedColumnHiddenKey(key) && entry !== fixedColumnShownKey(key)
  );

  if (visible && DEFAULT_HIDDEN.has(key)) next.push(fixedColumnShownKey(key));
  if (!visible && !DEFAULT_HIDDEN.has(key)) next.push(fixedColumnHiddenKey(key));

  return next;
}
