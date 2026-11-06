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
//   wiedergabe         { quelle, ttffMs, startMs, stalls, stallMs } – Messung je Wiedergabe

import { navMark } from '../dev/navTrace.js';

/** Stalls zählen nur in den ersten 60 s Wiedergabe (SLO). */
const STALL_FENSTER_SEK = 60;

function _on() {
  return typeof window !== 'undefined' && !!window.__mediaPerf;
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

/** Endung einer Datei (`mp4`, `mov`, …) oder null. */
export function formatOf(path) {
  const m = /\.([a-z0-9]{2,4})(?:[?#]|$)/i.exec(path || '');
  return m ? m[1].toLowerCase() : null;
}

/**
 * Messung einer Wiedergabe: erstes Bild (Laden bis `loadeddata`), Start (Play bis
 * `playing`) und Stalls in den ersten 60 s. Ein `waiting` während eines Seeks ist
 * Puffern nach dem Sprung, kein Stall. `finish()` liefert die Zeile für die
 * Auswertung (p50/p95/p99) oder null, wenn nichts gemessen wurde.
 *
 * @param {{ quelle: 'original'|'blob', format?: string|null,
 *           assetId?: string|null, t0?: number, now?: () => number }} info
 *        t0: Beginn des Ladens (vor dem Auflösen des Links), sonst jetzt
 */
export function createWiedergabeMessung({ quelle, format = null, assetId = null, t0 = null, now = perfNow }) {
  const start = t0 ?? now();
  let video = null;
  let ttffMs = null;
  let playAt = null;
  let startMs = null;
  let stalls = 0;
  let stallMs = 0;
  let stallSeit = null;
  let fehler = false;
  let fertig = false;
  const listeners = [];

  const stallEnde = () => {
    if (stallSeit === null) return;
    stallMs += now() - stallSeit;
    stallSeit = null;
  };

  const handlers = {
    loadeddata: () => {
      if (ttffMs !== null) return;
      ttffMs = now() - start;
      navMark('video:erstes-bild');
    },
    play: () => { if (playAt === null) playAt = now(); },
    playing: () => {
      if (startMs === null && playAt !== null) startMs = now() - playAt;
      stallEnde();
    },
    waiting: () => {
      if (startMs === null || video.seeking || video.currentTime > STALL_FENSTER_SEK) return;
      if (stallSeit === null) {
        stalls += 1;
        stallSeit = now();
      }
    },
    pause: stallEnde,
    seeking: stallEnde,
    error: () => { fehler = true; }
  };

  const abgespielt = () => {
    const ranges = video?.played;
    if (!ranges) return null;
    let sum = 0;
    for (let i = 0; i < ranges.length; i += 1) sum += ranges.end(i) - ranges.start(i);
    return Math.round(sum * 100) / 100;
  };

  return {
    /** Quelle nicht abspielbar (z. B. Link nicht auflösbar), ohne Video-Element. */
    markFehler() { fehler = true; },
    attach(el) {
      video = el;
      for (const [type, fn] of Object.entries(handlers)) {
        el.addEventListener(type, fn);
        listeners.push([type, fn]);
      }
    },
    finish() {
      if (fertig) return null;
      fertig = true;
      stallEnde();
      const row = {
        asset_id: assetId,
        quelle,
        format,
        ttff_ms: ttffMs === null ? null : Math.round(ttffMs),
        start_ms: startMs === null ? null : Math.round(startMs),
        stalls,
        stall_ms: Math.round(stallMs),
        abgespielt_sek: abgespielt(),
        fehler
      };
      listeners.forEach(([type, fn]) => video?.removeEventListener(type, fn));
      listeners.length = 0;
      if (row.ttff_ms === null && !fehler) return null;
      perfLog('wiedergabe', row);
      mediaLog(`Wiedergabe (${quelle}${format ? `, ${format}` : ''}): erstes Bild ${row.ttff_ms ?? '–'} ms, Start ${row.start_ms ?? '–'} ms, ${stalls} Stall(s) / ${row.stall_ms} ms`);
      return row;
    }
  };
}
