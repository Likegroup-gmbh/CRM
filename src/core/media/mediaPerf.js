// mediaPerf
// Leichtgewichtiges Performance-Logging fuer den Medien-Player. Standardmaessig
// AUS – aktivieren in der Konsole via `window.__mediaPerf = true`. Im
// Normalbetrieb kostet es nur einen Boolean-Check.
//
// Genutzte Events:
//   resolve            { hit: 'blob'|'miss', key }      – Quelle beim Oeffnen
//   resolveStreamUrl   { ms, key }                      – Dauer Temp-Link-Aufloesung
//   blob-upgrade       { key }                          – aktives Video auf Blob umgestellt
//   pool-hit           { key }                          – geparktes Element wiederverwendet
//   blob-download      { key, bytes, ms, kbps }         – Voll-Download in den Cache

function _on() {
  return typeof window !== 'undefined' && !!window.__mediaPerf;
}

/** True, wenn das Debug-Flag gesetzt ist. */
export function perfEnabled() {
  return _on();
}

/** Loggt ein Player-Performance-Event, wenn das Flag aktiv ist. */
export function perfLog(event, data = {}) {
  if (!_on()) return;
  // eslint-disable-next-line no-console
  console.log(`[mediaPerf] ${event}`, data);
}

/** Hochaufloesende Zeitmarke (faellt auf Date.now zurueck). */
export function perfNow() {
  return typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();
}

// Immer sichtbarer Klartext-Status (UNABHAENGIG vom Debug-Flag), damit man beim
// normalen Durchklicken in der Konsole bestaetigt sieht, ob ein Video aus dem
// Cache/Speicher kam (sofort) oder neu vom Netz geladen wird.
export function mediaLog(msg) {
  // eslint-disable-next-line no-console
  console.log(`[Video-Cache] ${msg}`);
}
