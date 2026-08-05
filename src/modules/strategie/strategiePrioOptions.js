// strategiePrioOptions.js
// Die frueheren Checkbox-Spalten Prio 1 / Prio 2 / Nicht umsetzen sind in der
// Tabelle zu einem Prio-Select zusammengefasst (gleiches Muster wie der
// Sourcing-Status). In der DB bleiben es weiterhin drei Booleans auf
// strategie_items - dieses Modul uebersetzt zwischen beiden Welten.

export const STRATEGIE_PRIO_OFFEN = 'offen';

export const STRATEGIE_PRIO_OPTIONS = Object.freeze([
  { value: 'offen', label: 'Offen', color: 'var(--gray-300)' },
  { value: 'prio_1', label: 'Prio 1', color: 'var(--color-info-dark)' },
  { value: 'prio_2', label: 'Prio 2', color: 'var(--color-info)' },
  { value: 'nicht_umsetzen', label: 'Nicht umsetzen', color: 'var(--danger)' }
]);

/**
 * Rangfolge fuer Altdaten, in denen mehrere Flags gleichzeitig gesetzt sind:
 * "Nicht umsetzen" ist die staerkste Aussage und gewinnt, danach Prio 1.
 */
const PRIO_PRIORITY = Object.freeze(['nicht_umsetzen', 'prio_1', 'prio_2']);

export function getStrategiePrio(item) {
  if (!item) return STRATEGIE_PRIO_OFFEN;
  return PRIO_PRIORITY.find(flag => item[flag]) || STRATEGIE_PRIO_OFFEN;
}

export function getStrategiePrioOption(value) {
  return STRATEGIE_PRIO_OPTIONS.find(o => o.value === value) || null;
}

export function isStrategiePrio(value) {
  return STRATEGIE_PRIO_OPTIONS.some(o => o.value === value);
}

/**
 * Vollstaendiges Update-Objekt fuer einen gewaehlten Wert: genau ein Flag wird
 * gesetzt, alle anderen zurueckgenommen. So koennen keine widerspruechlichen
 * Kombinationen mehr entstehen.
 */
export function buildStrategiePrioUpdates(value) {
  return {
    prio_1: value === 'prio_1',
    prio_2: value === 'prio_2',
    nicht_umsetzen: value === 'nicht_umsetzen'
  };
}
