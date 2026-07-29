// sourcingStatusOptions.js
// Die frueheren Checkbox-Spalten On Hold / Buchen / Prio 1 / Prio 2 / Absage sind
// in der Tabelle zu einem Status-Select zusammengefasst. In der DB bleiben es
// weiterhin einzelne Booleans auf creator_auswahl_items - dieses Modul uebersetzt
// zwischen beiden Welten.

export const SOURCING_STATUS_OFFEN = 'offen';

export const SOURCING_STATUS_OPTIONS = Object.freeze([
  { value: 'offen', label: 'Offen', color: 'var(--gray-300)' },
  { value: 'on_hold', label: 'On Hold', color: 'var(--warning)' },
  { value: 'gebucht', label: 'Buchen', color: 'var(--success)' },
  { value: 'prio_1', label: 'Prio 1', color: 'var(--color-info-dark)' },
  { value: 'prio_2', label: 'Prio 2', color: 'var(--color-info)' },
  { value: 'absage', label: 'Absage', color: 'var(--danger)' }
]);

/**
 * Rangfolge fuer Altdaten, in denen mehrere Flags gleichzeitig gesetzt sein
 * koennen: der weiter fortgeschrittene Status gewinnt. Ein Creator, der Prio 1
 * und gleichzeitig On Hold ist, zeigt On Hold.
 */
const STATUS_PRIORITY = Object.freeze(['absage', 'gebucht', 'on_hold', 'prio_1', 'prio_2']);

export function getSourcingStatus(item) {
  if (!item) return SOURCING_STATUS_OFFEN;
  return STATUS_PRIORITY.find(flag => item[flag]) || SOURCING_STATUS_OFFEN;
}

export function getSourcingStatusOption(value) {
  return SOURCING_STATUS_OPTIONS.find(o => o.value === value) || null;
}

export function isSourcingStatus(value) {
  return SOURCING_STATUS_OPTIONS.some(o => o.value === value);
}

/**
 * Vollstaendiges Update-Objekt fuer einen gewaehlten Status: genau ein Flag wird
 * gesetzt, alle anderen inklusive der Zeitstempel zurueckgenommen.
 */
export function buildSourcingStatusUpdates(value, now = new Date()) {
  const timestamp = now instanceof Date ? now.toISOString() : now;

  const updates = {
    on_hold: false,
    on_hold_am: null,
    gebucht: false,
    prio_1: false,
    prio_2: false,
    absage: false,
    absage_am: null
  };

  switch (value) {
    case 'on_hold':
      updates.on_hold = true;
      updates.on_hold_am = timestamp;
      break;
    case 'gebucht':
      updates.gebucht = true;
      break;
    case 'prio_1':
      updates.prio_1 = true;
      break;
    case 'prio_2':
      updates.prio_2 = true;
      break;
    case 'absage':
      updates.absage = true;
      updates.absage_am = timestamp;
      break;
    default:
      break;
  }

  return updates;
}

/**
 * Statusfilter der Tabellen-Toolbar. Er liest die Booleans direkt statt ueber
 * getSourcingStatus zu gehen: ein gebuchter Creator behaelt sein prio_1, das
 * Select kann es nur nicht anzeigen. So bleibt er ueber den Filter auffindbar.
 *
 * Die Spalten heissen wie die Status-Werte, deshalb sind Tags und Feld-Mapping
 * aus SOURCING_STATUS_OPTIONS abgeleitet und bleiben mit dem Select synchron.
 */
const STATUS_FILTER_FELDER = Object.freeze(['on_hold', 'gebucht', 'prio_1', 'prio_2', 'absage']);

export const SOURCING_STATUS_FILTER_TAGS = Object.freeze(
  STATUS_FILTER_FELDER.map(feld => getSourcingStatusOption(feld).label)
);

const STATUS_TAG_ZU_FELD = Object.freeze(
  Object.fromEntries(STATUS_FILTER_FELDER.map(feld => [getSourcingStatusOption(feld).label, feld]))
);

/** Leere Auswahl heisst kein Filter. Mehrere Tags werden oder-verknuepft. */
export function matchesStatusFilter(item, selectedTags) {
  if (!selectedTags?.length) return true;
  return selectedTags.some(tag => item?.[STATUS_TAG_ZU_FELD[tag]]);
}

/** Datum, das unter dem Select angezeigt wird (nur On Hold und Absage haben eins). */
export function getSourcingStatusMeta(item, status = getSourcingStatus(item)) {
  const raw = status === 'on_hold' ? item?.on_hold_am
    : status === 'absage' ? item?.absage_am
      : null;
  if (!raw) return '';

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('de-DE');
}
