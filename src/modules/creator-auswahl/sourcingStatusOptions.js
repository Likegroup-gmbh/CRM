// sourcingStatusOptions.js
// Die Status-Checkbox-Spalten der Tabelle sind inzwischen zwei Selects:
//   1. Status          - der interne Prozess (Offen -> Angefragt -> ... -> Gebucht)
//   2. Kundenfeedback  - die Bewertung durch den Kunden (Prio 1 / Prio 2 / Abgelehnt)
// In der DB bleiben es weiterhin einzelne Booleans auf creator_auswahl_items -
// dieses Modul uebersetzt zwischen beiden Welten. Die beiden Selects schreiben
// disjunkt: ein Statuswechsel laesst das Feedback stehen und umgekehrt.

export const SOURCING_STATUS_OFFEN = 'offen';

/** Interner Prozessstatus - exklusiv, genau ein Flag pro Item */
export const SOURCING_STATUS_OPTIONS = Object.freeze([
  { value: 'offen', label: 'Offen', color: 'var(--gray-300)' },
  { value: 'angefragt', label: 'Angefragt', color: 'var(--color-info)' },
  { value: 'in_verhandlung', label: 'In Verhandlung', color: 'var(--color-info-dark)' },
  { value: 'preis_zugesagt', label: 'Preis zugesagt', color: 'var(--green-600)' },
  { value: 'on_hold', label: 'On Hold', color: 'var(--warning)' },
  { value: 'zusage', label: 'Zusage', color: 'var(--green-500)' },
  { value: 'gebucht', label: 'Gebucht', color: 'var(--success)' },
  { value: 'absage', label: 'Abgesagt', color: 'var(--danger)' }
]);

/** Kundenfeedback - eigene Spalte, unabhaengig vom Prozessstatus */
export const KUNDEN_FEEDBACK_OPTIONS = Object.freeze([
  { value: '', label: '–' },
  { value: 'prio_1', label: 'Prio 1', color: 'var(--color-info-dark)' },
  { value: 'prio_2', label: 'Prio 2', color: 'var(--color-info)' },
  { value: 'abgelehnt', label: 'Abgelehnt', color: 'var(--danger)' }
]);

/**
 * Rangfolge fuer Altdaten, in denen mehrere Prozess-Flags gleichzeitig gesetzt
 * sein koennen: der weiter fortgeschrittene Status gewinnt.
 */
const STATUS_PRIORITY = Object.freeze([
  'absage', 'gebucht', 'on_hold', 'zusage', 'preis_zugesagt', 'in_verhandlung', 'angefragt'
]);

export function getSourcingStatus(item) {
  if (!item) return SOURCING_STATUS_OFFEN;
  return STATUS_PRIORITY.find(flag => item[flag]) || SOURCING_STATUS_OFFEN;
}

/** Rangfolge bei Altdaten mit mehreren Feedback-Flags: die haertere Bewertung gewinnt */
const FEEDBACK_PRIORITY = Object.freeze(['abgelehnt', 'prio_1', 'prio_2']);

export function getKundenFeedback(item) {
  if (!item) return '';
  return FEEDBACK_PRIORITY.find(flag => item[flag]) || '';
}

export function getSourcingStatusOption(value) {
  return SOURCING_STATUS_OPTIONS.find(o => o.value === value) || null;
}

export function getKundenFeedbackOption(value) {
  return KUNDEN_FEEDBACK_OPTIONS.find(o => o.value === value) || null;
}

export function isSourcingStatus(value) {
  return SOURCING_STATUS_OPTIONS.some(o => o.value === value);
}

export function isKundenFeedback(value) {
  return KUNDEN_FEEDBACK_OPTIONS.some(o => o.value === value);
}

/**
 * Vollstaendiges Update-Objekt fuer einen gewaehlten Prozess-Status: genau ein
 * Prozess-Flag wird gesetzt, alle anderen zurueckgenommen. Die Feedback-Flags
 * prio_1 / prio_2 / abgelehnt bleiben bewusst unberuehrt - sie gehoeren zur
 * anderen Spalte.
 *
 * angefragt_am und in_verhandlung_am bleiben stehen, wenn ein Creator
 * weiterzieht: dass er am 5. August angefragt wurde, bleibt wahr, auch wenn er
 * inzwischen gebucht ist. Nur der Weg zurueck auf "Offen" raeumt sie mit auf.
 */
export function buildSourcingStatusUpdates(value, now = new Date()) {
  const timestamp = now instanceof Date ? now.toISOString() : now;

  const updates = {
    angefragt: false,
    in_verhandlung: false,
    preis_zugesagt: false,
    zusage: false,
    on_hold: false,
    on_hold_am: null,
    gebucht: false,
    absage: false,
    absage_am: null
  };

  switch (value) {
    case 'angefragt':
      updates.angefragt = true;
      updates.angefragt_am = timestamp;
      break;
    case 'in_verhandlung':
      updates.in_verhandlung = true;
      updates.in_verhandlung_am = timestamp;
      break;
    case 'preis_zugesagt':
      updates.preis_zugesagt = true;
      updates.preis_zugesagt_am = timestamp;
      break;
    case 'zusage':
      updates.zusage = true;
      updates.zusage_am = timestamp;
      break;
    case 'on_hold':
      updates.on_hold = true;
      updates.on_hold_am = timestamp;
      break;
    case 'gebucht':
      updates.gebucht = true;
      break;
    case 'absage':
      updates.absage = true;
      updates.absage_am = timestamp;
      break;
    case 'offen':
      updates.angefragt_am = null;
      updates.in_verhandlung_am = null;
      updates.preis_zugesagt_am = null;
      updates.zusage_am = null;
      break;
    default:
      break;
  }

  return updates;
}

/**
 * Update-Objekt fuer das Kundenfeedback: genau ein Feedback-Flag wird gesetzt,
 * die anderen zurueckgenommen. Die Prozess-Flags bleiben unberuehrt.
 * Die leere Option ('') raeumt das Feedback komplett ab.
 */
export function buildKundenFeedbackUpdates(value, now = new Date()) {
  const timestamp = now instanceof Date ? now.toISOString() : now;

  const updates = {
    prio_1: false,
    prio_2: false,
    abgelehnt: false,
    abgelehnt_am: null
  };

  switch (value) {
    case 'prio_1':
      updates.prio_1 = true;
      break;
    case 'prio_2':
      updates.prio_2 = true;
      break;
    case 'abgelehnt':
      updates.abgelehnt = true;
      updates.abgelehnt_am = timestamp;
      break;
    default:
      break;
  }

  return updates;
}

/**
 * Statusfilter der Tabellen-Toolbar. Er liest die Booleans direkt statt ueber
 * getSourcingStatus zu gehen: ein gebuchter Creator behaelt sein prio_1 und
 * bleibt so ueber den Filter auffindbar.
 *
 * Die Tags sind die Beschriftungen beider Selects - erst die Prozess-Stufen,
 * dann das Kundenfeedback.
 */
const STATUS_FILTER_FELDER = Object.freeze([
  'angefragt', 'in_verhandlung', 'preis_zugesagt', 'zusage', 'on_hold', 'gebucht', 'absage'
]);

const FEEDBACK_FILTER_FELDER = Object.freeze(['prio_1', 'prio_2', 'abgelehnt']);

export const SOURCING_STATUS_FILTER_TAGS = Object.freeze([
  ...STATUS_FILTER_FELDER.map(feld => getSourcingStatusOption(feld).label),
  ...FEEDBACK_FILTER_FELDER.map(feld => getKundenFeedbackOption(feld).label)
]);

const STATUS_TAG_ZU_FELD = Object.freeze(
  Object.fromEntries([
    ...STATUS_FILTER_FELDER.map(feld => [getSourcingStatusOption(feld).label, feld]),
    ...FEEDBACK_FILTER_FELDER.map(feld => [getKundenFeedbackOption(feld).label, feld])
  ])
);

/** Leere Auswahl heisst kein Filter. Mehrere Tags werden oder-verknuepft. */
export function matchesStatusFilter(item, selectedTags) {
  if (!selectedTags?.length) return true;
  return selectedTags.some(tag => item?.[STATUS_TAG_ZU_FELD[tag]]);
}

/** Zeitstempel-Feld je Status. Gebucht hat keinen. */
const STATUS_DATUM_FELD = Object.freeze({
  angefragt: 'angefragt_am',
  in_verhandlung: 'in_verhandlung_am',
  preis_zugesagt: 'preis_zugesagt_am',
  zusage: 'zusage_am',
  on_hold: 'on_hold_am',
  absage: 'absage_am'
});

/** Datum, das unter dem Status-Select angezeigt wird. */
export function getSourcingStatusMeta(item, status = getSourcingStatus(item)) {
  const feld = STATUS_DATUM_FELD[status];
  const raw = feld ? item?.[feld] : null;
  if (!raw) return '';

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('de-DE');
}

/** Datum unter dem Feedback-Select - nur Abgelehnt fuehrt einen Zeitstempel. */
export function getKundenFeedbackMeta(item, feedback = getKundenFeedback(item)) {
  const raw = feedback === 'abgelehnt' ? item?.abgelehnt_am : null;
  if (!raw) return '';

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('de-DE');
}
