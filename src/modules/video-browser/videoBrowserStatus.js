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
//   freigegeben  Finale Version liegt vor (bei der Schleife: die, aus der sie stammt)
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

export function loopFolderStatus({ current, freigegeben, team }) {
  if (current) return statusOf('wartet', team);
  if (freigegeben) return statusOf('freigegeben', team);
  return statusOf('aenderungen', team);
}

/**
 * Feedbackschleife, aus der die Finale Version stammt: die jüngste Quelle der Finals. Ein Final ohne
 * Quelle (direkt abgelegt) gilt für die Schleifen, deren Dateien vor ihm hochgeladen wurden.
 * @returns {number} 0 = keine Schleife (kein Final oder Final vor jeder Schleife)
 */
export function freigabeVersion(loops = [], finals = []) {
  const versionOf = new Map(loops.map(a => [a.id, a.version_number || 1]));
  let version = 0;
  for (const f of finals) {
    if (f.source_asset_id && versionOf.has(f.source_asset_id)) {
      version = Math.max(version, versionOf.get(f.source_asset_id));
      continue;
    }
    const bis = String(f.created_at || '');
    for (const a of loops) {
      if (!bis || String(a.created_at || '') <= bis) version = Math.max(version, a.version_number || 1);
    }
  }
  return version;
}

/** Liegt in der jüngsten Schleife eine Datei, die nach der letzten Finalen Version kam? Dann ist der Kunde wieder am Zug. */
export function neueSchleifeNachFinal(loops = [], finals = [], version = 0) {
  if (!finals.length || !version) return false;
  const letztesFinal = finals.map(f => String(f.created_at || '')).sort().pop();
  if (!letztesFinal) return false;
  return loops.some(a => (a.version_number || 1) === version && String(a.created_at || '') > letztesFinal);
}
