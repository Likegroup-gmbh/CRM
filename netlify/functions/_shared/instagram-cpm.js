// instagram-cpm.js
// Reine Rechenlogik fuer die CPM-Ermittlung aus Instagram-Media.
// Bewusst ohne Netzwerk/DB, damit sie direkt unit-testbar ist.
//
// Nur Videos/Reels tragen einen view_count. Bild-Posts und Karussells
// liefern das Feld nicht und werden vollstaendig ignoriert.
//
// Das zuletzt hochgeladene Video ist noch nicht "ausgereift": in den ersten
// Tagen laufen die Views weiter hoch. Alles juenger als MIN_AGE_HOURS faellt
// deshalb raus, gezaehlt wird ab dem naechstaelteren Video.

const CPM_RATE = 25;        // EUR pro 1000 Views
const MIN_AGE_HOURS = 96;   // Videos juenger als 4 Tage ignorieren
const TRIM_RATIO = 0.1;     // je 10% oben und unten kappen, min. 1
const TRIM_MIN_SAMPLE = 5;  // darunter lohnt Kappen nicht
const WINDOW_SHORT = 8;
const WINDOW_LONG = 30;

const HOUR_MS = 60 * 60 * 1000;

/** Videos mit belastbarem view_count, neueste zuerst */
function selectVideos(media, now) {
  const cutoff = now - MIN_AGE_HOURS * HOUR_MS;

  return (media || [])
    .filter((m) => m && m.media_type === 'VIDEO')
    .map((m) => ({
      id: m.id || null,
      permalink: m.permalink || null,
      timestamp: m.timestamp || null,
      postedAt: Date.parse(m.timestamp),
      views: Number(m.view_count)
    }))
    .filter((v) => Number.isFinite(v.views) && v.views >= 0)
    .filter((v) => Number.isFinite(v.postedAt) && v.postedAt <= cutoff)
    .sort((a, b) => b.postedAt - a.postedAt);
}

function average(values) {
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

/**
 * Getrimmter Mittelwert: Ausreisser nach oben und unten kappen.
 * Unterhalb von TRIM_MIN_SAMPLE Werten wird nicht gekappt, sonst bleibt
 * zu wenig uebrig um noch aussagekraeftig zu sein.
 */
function trimmedAverage(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length < TRIM_MIN_SAMPLE) return average(sorted);
  const k = Math.max(1, Math.floor(sorted.length * TRIM_RATIO));
  return average(sorted.slice(k, sorted.length - k));
}

/** Views -> Preis in EUR, auf Cent gerundet */
function toCpm(views) {
  if (views == null) return null;
  return Math.round((views / 1000) * CPM_RATE * 100) / 100;
}

function roundViews(views) {
  return views == null ? null : Math.round(views);
}

/**
 * Kennzahlen aus einer Media-Liste der Business Discovery API.
 *
 * @param {Array} media   Rohe media.data-Eintraege
 * @param {object} [opts] { now: number } - Zeitbasis fuer die 4-Tage-Regel
 * @returns {{
 *   views_8: number|null, views_30: number|null, views_trimmed: number|null,
 *   cpm_8: number|null, cpm_30: number|null, cpm_trimmed: number|null,
 *   sample_8: number, sample_30: number, trimmed_count: number,
 *   videos_available: number, skipped_too_recent: number,
 *   videos: Array
 * }}
 */
function computeInstagramCpm(media, opts = {}) {
  const now = opts.now ?? Date.now();
  const videos = selectVideos(media, now);

  const totalVideos = (media || []).filter((m) => m && m.media_type === 'VIDEO').length;
  const skippedTooRecent = Math.max(0, totalVideos - videos.length);

  const window8 = videos.slice(0, WINDOW_SHORT);
  const window30 = videos.slice(0, WINDOW_LONG);

  // Nur ausweisen, wenn das Fenster wirklich voll ist - ein "8er-Schnitt"
  // aus 3 Videos waere irrefuehrend.
  const views8 = window8.length === WINDOW_SHORT ? average(window8.map((v) => v.views)) : null;
  const views30 = window30.length === WINDOW_LONG ? average(window30.map((v) => v.views)) : null;

  // Der getrimmte Wert nutzt alles was da ist (max. 30) und braucht kein
  // volles Fenster - er ist der robuste Fallback.
  const trimmedSource = window30.map((v) => v.views);
  const viewsTrimmed = trimmedAverage(trimmedSource);
  const trimK = trimmedSource.length >= TRIM_MIN_SAMPLE
    ? Math.max(1, Math.floor(trimmedSource.length * TRIM_RATIO))
    : 0;

  return {
    views_8: roundViews(views8),
    views_30: roundViews(views30),
    views_trimmed: roundViews(viewsTrimmed),
    cpm_8: toCpm(views8),
    cpm_30: toCpm(views30),
    cpm_trimmed: toCpm(viewsTrimmed),
    sample_8: window8.length,
    sample_30: window30.length,
    trimmed_count: Math.max(0, trimmedSource.length - trimK * 2),
    videos_available: videos.length,
    skipped_too_recent: skippedTooRecent,
    videos: window30.map((v) => ({
      permalink: v.permalink,
      views: v.views,
      timestamp: v.timestamp
    }))
  };
}

module.exports = {
  CPM_RATE,
  MIN_AGE_HOURS,
  TRIM_RATIO,
  TRIM_MIN_SAMPLE,
  WINDOW_SHORT,
  WINDOW_LONG,
  selectVideos,
  average,
  trimmedAverage,
  toCpm,
  computeInstagramCpm
};
