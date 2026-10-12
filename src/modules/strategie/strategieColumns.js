// strategieColumns.js
// Sichtbarkeit der festen Spalten in der Strategie-Detail-Tabelle.
//
// strategie.hidden_columns speicherte bisher nur "custom:{uuid}". Dazu kommen
// jetzt zwei Formen fuer die festen Spalten:
//   "fixed:{key}"       -> Spalte ist ausgeblendet
//   "show:fixed:{key}"  -> Spalte ist eingeblendet (nur fuer Spalten noetig, die
//                          standardmaessig aus sind)
// Ohne Eintrag gilt der Default: alle festen Spalten sind sichtbar, ausser die
// Funnel-Stufe (nur in Paid-Linien oder mit gesetzten Werten, siehe
// funnelSpalteStandardSichtbar).

import { funnelSpalteStandardSichtbar } from './strategieFunnelOptions.js';

export const STRATEGIE_FIXED_COLUMNS = Object.freeze([
  { key: 'creator', label: 'Creator' },
  { key: 'produkt', label: 'Produkt' },
  { key: 'funnel', label: 'Funnel-Stufe' },
  { key: 'beschreibung', label: 'Beschreibung' },
  { key: 'umsetzungsvorgabe', label: 'Umsetzungsvorgabe' },
  { key: 'kundenadaption', label: 'Kundenadaption' },
  { key: 'transkript', label: 'Transkript' },
  { key: 'caption', label: 'Caption' },
  { key: 'anmerkung', label: 'Anmerkung Kunde' },
  { key: 'prio', label: 'Prio' },
  { key: 'status', label: 'Status' },
  { key: 'umgesetzt', label: 'Umsetzen' }
]);

// Keys hier eintragen, wenn eine feste Spalte standardmaessig aus sein soll.
const DEFAULT_HIDDEN = new Set();

/**
 * Kontext fuer Spalten, deren Default vom Konzept abhaengt.
 * @returns {{ funnelStandardSichtbar: boolean }}
 */
export function buildColumnContext(strategie, items = []) {
  return { funnelStandardSichtbar: funnelSpalteStandardSichtbar(strategie, items) };
}

function isDefaultHidden(key, context) {
  if (key === 'funnel') return !context?.funnelStandardSichtbar;
  return DEFAULT_HIDDEN.has(key);
}

export function fixedColumnHiddenKey(key) {
  return `fixed:${key}`;
}

export function fixedColumnShownKey(key) {
  return `show:fixed:${key}`;
}

export function isFixedColumnVisible(hiddenColumns, key, context = null) {
  const list = hiddenColumns || [];
  if (list.includes(fixedColumnHiddenKey(key))) return false;
  if (isDefaultHidden(key, context)) return list.includes(fixedColumnShownKey(key));
  return true;
}

/**
 * Neue hidden_columns-Liste nach einem Toggle. Es bleibt immer nur ein Eintrag
 * pro Spalte uebrig, damit sich "hidden" und "show" nicht widersprechen.
 */
export function setFixedColumnVisibility(hiddenColumns, key, visible, context = null) {
  const next = (hiddenColumns || []).filter(
    entry => entry !== fixedColumnHiddenKey(key) && entry !== fixedColumnShownKey(key)
  );

  const defaultHidden = isDefaultHidden(key, context);
  if (visible && defaultHidden) next.push(fixedColumnShownKey(key));
  if (!visible && !defaultHidden) next.push(fixedColumnHiddenKey(key));

  return next;
}
