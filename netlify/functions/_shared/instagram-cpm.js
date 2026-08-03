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

/**
 * Videos klassifizieren: auswertbar vs. zu frisch (4-Tage-Regel).
 * Videos ohne view_count und Nicht-Videos werden nicht in skipped gefuehrt.
 */
function classifyVideos(media, now) {
  const cutoff = now - MIN_AGE_HOURS * HOUR_MS;
  const included = [];
  const skipped = [];
  let nonVideoSkipped = 0;

  for (const m of media || []) {
    if (!m) continue;
    if (m.media_type !== 'VIDEO') {
      nonVideoSkipped += 1;
      continue;
    }

    const views = Number(m.view_count);
    const postedAt = Date.parse(m.timestamp);
    if (!Number.isFinite(views) || views < 0 || !Number.isFinite(postedAt)) {
      continue;
    }

    const ageHours = Math.round((now - postedAt) / HOUR_MS);
    const entry = {
      id: m.id || null,
      permalink: m.permalink || null,
      timestamp: m.timestamp || null,
      postedAt,
      views,
      age_hours: ageHours
    };

    if (postedAt > cutoff) {
      skipped.push({
        permalink: entry.permalink,
        views: entry.views,
        timestamp: entry.timestamp,
        age_hours: entry.age_hours,
        reason: 'too_recent'
      });
    } else {
      included.push(entry);
    }
  }

  included.sort((a, b) => b.postedAt - a.postedAt);
  skipped.sort((a, b) => b.postedAt - a.postedAt);
  return { included, skipped, nonVideoSkipped };
}

/** Videos mit belastbarem view_count, neueste zuerst */
function selectVideos(media, now) {
  return classifyVideos(media, now).included;
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
 *   non_video_skipped: number,
 *   videos: Array, skipped_videos: Array
 * }}
 */
function computeInstagramCpm(media, opts = {}) {
  const now = opts.now ?? Date.now();
  const { included: videos, skipped, nonVideoSkipped } = classifyVideos(media, now);

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
    skipped_too_recent: skipped.length,
    non_video_skipped: nonVideoSkipped,
    videos: window30.map((v) => ({
      permalink: v.permalink,
      views: v.views,
      timestamp: v.timestamp
    })),
    skipped_videos: skipped
  };
}

/**
 * Strukturierter Debug-Payload fuer Server-/Browser-Konsole.
 * @param {string} username
 * @param {object} stats  Ergebnis von computeInstagramCpm oder Pool-Spiegel
 * @param {object} [meta] { source, pool_fetched_at }
 */
function formatCpmDebug(username, stats, meta = {}) {
  const included = (stats.videos || []).map((v, i) => ({
    index: i,
    views: v.views,
    timestamp: v.timestamp,
    permalink: v.permalink
  }));

  const skipped = (stats.skipped_videos || []).map((v) => ({
    views: v.views,
    age_hours: v.age_hours,
    timestamp: v.timestamp,
    permalink: v.permalink,
    reason: v.reason || 'too_recent'
  }));

  return {
    username: username || null,
    source: meta.source || null,
    pool_fetched_at: meta.pool_fetched_at || null,
    rules: {
      MIN_AGE_HOURS,
      CPM_RATE,
      WINDOW_SHORT,
      WINDOW_LONG,
      note: 'UI-Preis = views × Listen-TKP; cpm_* hier immer × CPM_RATE'
    },
    skipped,
    included,
    summary: {
      non_video_skipped: stats.non_video_skipped ?? null,
      skipped_too_recent: stats.skipped_too_recent ?? skipped.length,
      videos_available: stats.videos_available ?? null,
      sample_8: stats.sample_8 ?? null,
      sample_30: stats.sample_30 ?? null,
      window_8_full: stats.sample_8 === WINDOW_SHORT,
      window_30_full: stats.sample_30 === WINDOW_LONG,
      views_8: stats.views_8 ?? null,
      views_30: stats.views_30 ?? null,
      views_trimmed: stats.views_trimmed ?? null,
      trimmed_count: stats.trimmed_count ?? null,
      cpm_8: stats.cpm_8 ?? null,
      cpm_30: stats.cpm_30 ?? null,
      cpm_trimmed: stats.cpm_trimmed ?? null,
      formula: `views / 1000 * ${CPM_RATE}`
    }
  };
}

module.exports = {
  CPM_RATE,
  MIN_AGE_HOURS,
  TRIM_RATIO,
  TRIM_MIN_SAMPLE,
  WINDOW_SHORT,
  WINDOW_LONG,
  classifyVideos,
  selectVideos,
  average,
  trimmedAverage,
  toCpm,
  computeInstagramCpm,
  formatCpmDebug
};
