// skriptStatusOptions.js
// Status eines Skripts als Select-Optionen (TableSelect): Skripte-Tabelle der
// Produktion und Status-Wahl im Dokumentkopf des Editors.

import { STATUS_LABELS } from './SkripteUtils.js';

const STATUS_FARBEN = {
  fragen: 'var(--warning)',
  entwurf: 'var(--gray-300)',
  feedback_gegeben: 'var(--color-info)',
  final: 'var(--green-500)',
  freigegeben: 'var(--success)',
  archiviert: 'var(--gray-400)'
};

/**
 * "Rückfragen offen" setzt Liky beim Anlegen; von Hand lässt sich der Status
 * nur verlassen, nicht wieder setzen (sonst startet die Fragerunde neu).
 */
export function skriptStatusOptions(aktuell) {
  return Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
    color: STATUS_FARBEN[value],
    disabled: value === 'fragen' && aktuell !== 'fragen'
  }));
}
