// videoBrowserStatus.js
// Ablaufschritt und Statusmodell des Videos-Tabs, abgeleitet aus den Daten (nichts wird gespeichert).

/** Intern = Rohmaterial der Kooperation vorhanden, sonst extern. */
export function deriveBearbeitungsart(rohmaterialCount) {
  return rohmaterialCount > 0 ? 'intern' : 'extern';
}

/**
 * Ablaufschritt aus den Daten: 5 = Finale Version, 4 = Feedbackschleife, 2 = nur Rohmaterial,
 * null = noch kein Upload.
 */
export function deriveAblaufschritt({ rohmaterialCount = 0, schleifenCount = 0, hatFinal = false } = {}) {
  if (hatFinal) return 5;
  if (schleifenCount > 0) return 4;
  if (rohmaterialCount > 0) return 2;
  return null;
}

// Statusmodell: sagt, wer am Zug ist bzw. wie die Runde ausging.
//   wartet       aktuelle Feedbackschleife mit Dateien, der Kunde ist am Zug
//   aenderungen  Schleife mit Nachfolger: der Kunde hat Änderungen angefordert
//   freigegeben  Finale Version liegt vor (bei der Schleife: die letzte davor)
const STATUS_TONE = { wartet: 'warning', aenderungen: 'info', freigegeben: 'success' };

export function statusOf(key, team = true) {
  const labels = {
    wartet: team ? 'Wartet auf Kunde' : 'Zu prüfen',
    aenderungen: 'Änderungen angefordert',
    freigegeben: 'Freigegeben'
  };
  return { key, label: labels[key], tone: STATUS_TONE[key] };
}

/** "Wartet seit 3 Tagen auf den Kunden." – `since` ist das Datum der jüngsten Datei der Schleife. */
export function wartetText(since, now = new Date()) {
  const start = since ? new Date(since) : null;
  if (!start || Number.isNaN(start.getTime())) return 'Wartet auf den Kunden.';
  const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
  if (days === 0) return 'Wartet seit heute auf den Kunden.';
  return `Wartet seit ${days === 1 ? '1 Tag' : `${days} Tagen`} auf den Kunden.`;
}

export function loopFolderStatus({ current, istLetzte, hatFinal, team }) {
  if (current) return statusOf('wartet', team);
  if (hatFinal && istLetzte) return statusOf('freigegeben', team);
  return statusOf('aenderungen', team);
}
