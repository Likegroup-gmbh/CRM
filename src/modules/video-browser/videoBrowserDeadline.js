// videoBrowserDeadline.js
// Verzug eines Ausstehenden Videos gegen seine Content-Deadline (je Kooperationsvideo eigene).
// Nur fürs Team: die Kundenseite lädt das Feld gar nicht. Tag im Tag-System (`tag tag--frist tag--frist-<stufe>`).

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import { parseDateOnly } from '../../core/calendarDates.js';
import { formatDatum, plural } from './videoBrowserFormat.js';

/** Ab so vielen Tagen vor der Deadline erscheint der Hinweis "Bald fällig". */
export const FRIST_VORLAUF_TAGE = 7;

const MS_PRO_TAG = 86400000;

/** Stufen von dringend nach unkritisch; "ok" bekommt keinen Tag. */
export const FRIST_STUFEN = ['ueberfaellig', 'heute', 'bald', 'ok'];

/**
 * Abstand der Content-Deadline zu heute in vollen Kalendertagen (negativ = überzogen).
 * Rechnet über UTC-Mitternacht, damit die Zeitumstellung keinen Tag verschiebt.
 */
export function tageBisDeadline(deadline, heute = new Date()) {
  const ziel = parseDateOnly(deadline);
  const jetzt = parseDateOnly(heute);
  if (!ziel || !jetzt) return null;
  const utc = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(ziel) - utc(jetzt)) / MS_PRO_TAG);
}

/**
 * Stufe und Beschriftung der Frist.
 * @returns {{ stufe: string, tage: number, label: string }|null} `null` ohne Deadline
 */
export function fristStatus(deadline, heute = new Date()) {
  const tage = tageBisDeadline(deadline, heute);
  if (tage === null) return null;
  if (tage < 0) return { stufe: 'ueberfaellig', tage, label: `${plural(-tage, 'Tag', 'Tage')} überfällig` };
  if (tage === 0) return { stufe: 'heute', tage, label: 'Heute fällig' };
  if (tage === 1) return { stufe: 'bald', tage, label: 'Morgen fällig' };
  if (tage <= FRIST_VORLAUF_TAGE) return { stufe: 'bald', tage, label: `Fällig in ${tage} Tagen` };
  return { stufe: 'ok', tage, label: `Fällig in ${tage} Tagen` };
}

const ICON = { ueberfaellig: 'exclamation-triangle', heute: 'clock', bald: 'clock' };

/**
 * Tag zur Frist eines Ausstehenden Videos. Leer ohne Deadline und solange noch mehr als
 * FRIST_VORLAUF_TAGE Tage bleiben (dann steht das Datum nur in der Vollansicht).
 */
export function fristTagHtml(deadline, heute = new Date()) {
  const status = fristStatus(deadline, heute);
  if (!status || status.stufe === 'ok') return '';
  const titel = `Content-Deadline ${formatDatum(deadline)}`;
  return `<span class="tag tag--nowrap tag--frist tag--frist-${status.stufe}" title="${esc(titel)}">${icon(ICON[status.stufe])}<span>${esc(status.label)}</span></span>`;
}

/** Kurzform für das aria-label der Kachel, leer ohne Hinweis. */
export function fristAriaLabel(deadline, heute = new Date()) {
  const status = fristStatus(deadline, heute);
  return status && status.stufe !== 'ok' ? status.label : '';
}
