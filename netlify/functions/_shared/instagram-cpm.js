// instagram-cpm.js
// Reine Rechenlogik fuer die CPM-Ermittlung aus Instagram-Media.
// Bewusst ohne Netzwerk/DB, damit sie direkt unit-testbar ist.
//
// Nur Videos/Reels tragen einen view_count. Bild-Posts und Karussells
// liefern das Feld nicht und werden vollstaendig ignoriert.
//
// Ein Reel mit is_shared_to_feed === false haengt nur im Reels-Tab und ist im
// Feed des Creators nicht zu sehen (typisch fuer Testvideos). Solche Reels
// zaehlen nicht mit. Fehlt das Feld, wird das Reel einbezogen - Meta liefert
// es nicht bei jeder Media-Art und ein fehlendes Feld darf nicht alles kippen.
//
// Das zuletzt hochgeladene Video ist noch nicht "ausgereift": in den ersten
// Tagen laufen die Views weiter hoch. Alles juenger als MIN_AGE_HOURS faellt
// deshalb raus, gezaehlt wird ab dem naechstaelteren Video.

const CPM_RATE = 25;        // EUR pro 1000 Views
const MIN_AGE_HOURS = 96;   // Videos juenger als 4 Tage ignorieren
const WINDOW_SHORT = 8;
const WINDOW_LONG = 30;

// Ausreisser-Erkennung: modifizierter Z-Score (Iglewicz-Hoaglin) ueber Median
// und MAD, gerechnet auf log10. Views sind naeherungsweise log-normal verteilt;
// auf linearer Skala reisst ein einzelner Millionen-Wert Mittelwert und Streuung
// so weit hoch, dass er sich selbst tarnt.
const OUTLIER_Z = 3.5;
// Zusaetzliche Huerde, damit nur echte Ausreisser fallen: bei einem sehr
// gleichmaessigen Account (alle Reels 48k-52k) ist der MAD winzig und ein
// 80k-Reel bekaeme rein rechnerisch einen riesigen Z-Score, obwohl es nur ein
// guter Reel ist.
const OUTLIER_MIN_FACTOR = 2.5;
const OUTLIER_MIN_SAMPLE = 5;

// Version der Rechenlogik. Landet in ig_stats.calc_version; eine aeltere
// Version im Creator-Pool gilt als veraltet und erzwingt einen neuen Abruf.
const CALC_VERSION = 2;

const HOUR_MS = 60 * 60 * 1000;
const MAD_SCALE = 0.6745;

/**
 * Videos klassifizieren: auswertbar vs. aussortiert.
 * Aussortiert wird, was nur im Reels-Tab haengt (not_in_feed) oder juenger als
 * MIN_AGE_HOURS ist (too_recent). Videos ohne view_count und Nicht-Videos
 * werden nicht in skipped gefuehrt.
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
    // true/false wenn Meta das Flag liefert, sonst null - fehlt es, zaehlt das
    // Reel mit, darf aber im Debug sichtbar bleiben
    const sharedToFeed = typeof m.is_shared_to_feed === 'boolean'
      ? m.is_shared_to_feed
      : null;
    const entry = {
      id: m.id || null,
      permalink: m.permalink || null,
      timestamp: m.timestamp || null,
      postedAt,
      views,
      age_hours: ageHours,
      is_shared_to_feed: sharedToFeed
    };

    // Nur explizites false zaehlt als "nicht im Feed" - undefined bedeutet,
    // dass Meta das Feld fuer dieses Medium nicht liefert.
    const reason = sharedToFeed === false
      ? 'not_in_feed'
      : (postedAt > cutoff ? 'too_recent' : null);

    if (reason) {
      skipped.push({
        permalink: entry.permalink,
        views: entry.views,
        timestamp: entry.timestamp,
        postedAt,
        age_hours: entry.age_hours,
        is_shared_to_feed: sharedToFeed,
        reason
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

function median(sortedValues) {
  const n = sortedValues.length;
  if (!n) return null;
  const mid = Math.floor(n / 2);
  return n % 2 ? sortedValues[mid] : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
}

/** Wie viele Werte je Seite maximal fallen duerfen */
function perSideCap(n) {
  return n < 12 ? 1 : Math.floor(n * 0.1);
}

/**
 * Ausreisser in einer Views-Reihe finden.
 *
 * Ein Wert gilt nur als Ausreisser, wenn beides zutrifft:
 *   1. modifizierter Z-Score auf log10 ueber OUTLIER_Z
 *   2. mindestens Faktor OUTLIER_MIN_FACTOR ueber bzw. unter dem Median
 *
 * Sonderfall MAD = 0: sobald mehr als die Haelfte der Reels praktisch gleich
 * viele Views hat, ist die Streuung im Median null und der Z-Score nicht
 * definiert - dann entscheidet allein der Faktor zum Median. Ohne diesen
 * Zweig wuerde ausgerechnet der eindeutigste Fall (24x 50k, dazu ein 1M-Reel)
 * durchrutschen.
 *
 * Pro Seite fallen hoechstens perSideCap(n) Werte, die extremsten zuerst -
 * sonst koennte ein zweigipfliger Account halb leergeraeumt werden.
 *
 * @param {number[]} values Views, Reihenfolge egal
 * @returns {{indices: Set<number>, details: Array<{index:number,views:number,side:'high'|'low',z:number|null}>}}
 */
function detectOutliers(values) {
  const empty = { indices: new Set(), details: [] };
  if (!Array.isArray(values) || values.length < OUTLIER_MIN_SAMPLE) return empty;

  const logs = values.map((v) => Math.log10(v + 1));
  const logMedian = median([...logs].sort((a, b) => a - b));
  const mad = median(logs.map((l) => Math.abs(l - logMedian)).sort((a, b) => a - b));

  const viewsMedian = median([...values].sort((a, b) => a - b));
  const obenAb = viewsMedian * OUTLIER_MIN_FACTOR;
  const untenAb = viewsMedian / OUTLIER_MIN_FACTOR;

  const kandidaten = [];
  for (let i = 0; i < values.length; i += 1) {
    const abstand = logs[i] - logMedian;
    const z = mad ? MAD_SCALE * abstand / mad : null;
    if (z !== null && Math.abs(z) <= OUTLIER_Z) continue;

    const hoch = abstand > 0 && values[i] >= obenAb;
    const niedrig = abstand < 0 && values[i] <= untenAb;
    if (!hoch && !niedrig) continue;

    kandidaten.push({
      index: i,
      views: values[i],
      side: hoch ? 'high' : 'low',
      z,
      staerke: Math.abs(z ?? abstand)
    });
  }
  if (!kandidaten.length) return empty;

  const cap = perSideCap(values.length);
  const indices = new Set();
  const details = [];

  for (const side of ['high', 'low']) {
    kandidaten
      .filter((k) => k.side === side)
      .sort((a, b) => b.staerke - a.staerke)
      .slice(0, cap)
      .forEach(({ staerke, ...k }) => {
        indices.add(k.index);
        details.push(k);
      });
  }

  details.sort((a, b) => b.views - a.views);
  return { indices, details };
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
 * Ein Fenster auswerten: Schnitt mit und ohne Ausreisser.
 * Der Wert kommt nur zustande, wenn das Fenster wirklich voll ist - ein
 * "8er-Schnitt" aus 3 Videos waere irrefuehrend.
 */
function evaluateWindow(videos, size) {
  if (videos.length !== size) {
    return { views: null, viewsClean: null, outliers: [] };
  }

  const values = videos.map((v) => v.views);
  const { indices, details } = detectOutliers(values);
  const bereinigt = values.filter((_, i) => !indices.has(i));

  return {
    views: average(values),
    viewsClean: average(bereinigt.length ? bereinigt : values),
    outliers: details.map((d) => {
      const video = videos[d.index];
      return {
        views: d.views,
        timestamp: video?.timestamp || null,
        permalink: video?.permalink || null,
        side: d.side,
        z: d.z == null ? null : Math.round(d.z * 100) / 100
      };
    })
  };
}

/**
 * Kennzahlen aus einer Media-Liste der Business Discovery API.
 *
 * @param {Array} media   Rohe media.data-Eintraege
 * @param {object} [opts] { now: number } - Zeitbasis fuer die 4-Tage-Regel
 * @returns {{
 *   views_8: number|null, views_8_clean: number|null,
 *   views_30: number|null, views_30_clean: number|null,
 *   cpm_8: number|null, cpm_8_clean: number|null,
 *   cpm_30: number|null, cpm_30_clean: number|null,
 *   sample_8: number, sample_30: number,
 *   outliers_8: Array, outliers_30: Array,
 *   videos_available: number, skipped_too_recent: number,
 *   skipped_not_in_feed: number, non_video_skipped: number,
 *   videos: Array, skipped_videos: Array, calc_version: number
 * }}
 */
function computeInstagramCpm(media, opts = {}) {
  const now = opts.now ?? Date.now();
  const { included: videos, skipped, nonVideoSkipped } = classifyVideos(media, now);

  const window8 = evaluateWindow(videos.slice(0, WINDOW_SHORT), WINDOW_SHORT);
  const window30 = evaluateWindow(videos.slice(0, WINDOW_LONG), WINDOW_LONG);

  return {
    views_8: roundViews(window8.views),
    views_8_clean: roundViews(window8.viewsClean),
    views_30: roundViews(window30.views),
    views_30_clean: roundViews(window30.viewsClean),
    cpm_8: toCpm(window8.views),
    cpm_8_clean: toCpm(window8.viewsClean),
    cpm_30: toCpm(window30.views),
    cpm_30_clean: toCpm(window30.viewsClean),
    sample_8: Math.min(videos.length, WINDOW_SHORT),
    sample_30: Math.min(videos.length, WINDOW_LONG),
    outliers_8: window8.outliers,
    outliers_30: window30.outliers,
    videos_available: videos.length,
    skipped_too_recent: skipped.filter((s) => s.reason === 'too_recent').length,
    skipped_not_in_feed: skipped.filter((s) => s.reason === 'not_in_feed').length,
    non_video_skipped: nonVideoSkipped,
    videos: videos.slice(0, WINDOW_LONG).map((v) => ({
      permalink: v.permalink,
      views: v.views,
      timestamp: v.timestamp,
      is_shared_to_feed: v.is_shared_to_feed
    })),
    skipped_videos: skipped.map((s) => ({
      permalink: s.permalink,
      views: s.views,
      timestamp: s.timestamp,
      age_hours: s.age_hours,
      is_shared_to_feed: s.is_shared_to_feed,
      reason: s.reason
    })),
    calc_version: CALC_VERSION
  };
}

/**
 * Strukturierter Debug-Payload fuer Server-/Browser-Konsole.
 * @param {string} username
 * @param {object} stats  Ergebnis von computeInstagramCpm oder Pool-Spiegel
 * @param {object} [meta] { source, pool_fetched_at, image_error, feed_flag_available }
 */
function formatCpmDebug(username, stats, meta = {}) {
  const included = (stats.videos || []).map((v, i) => ({
    index: i,
    views: v.views,
    is_shared_to_feed: v.is_shared_to_feed ?? null,
    timestamp: v.timestamp,
    permalink: v.permalink
  }));

  const skipped = (stats.skipped_videos || []).map((v) => ({
    views: v.views,
    is_shared_to_feed: v.is_shared_to_feed ?? null,
    age_hours: v.age_hours,
    timestamp: v.timestamp,
    permalink: v.permalink,
    reason: v.reason || 'too_recent'
  }));

  return {
    username: username || null,
    source: meta.source || null,
    pool_fetched_at: meta.pool_fetched_at || null,
    image_error: meta.image_error || null,
    feed_flag_available: meta.feed_flag_available ?? null,
    rules: {
      MIN_AGE_HOURS,
      CPM_RATE,
      WINDOW_SHORT,
      WINDOW_LONG,
      OUTLIER_Z,
      OUTLIER_MIN_FACTOR,
      CALC_VERSION,
      note: 'UI-Preis = views × Listen-TKP; cpm_* hier immer × CPM_RATE'
    },
    skipped,
    included,
    outliers: {
      window_8: stats.outliers_8 || [],
      window_30: stats.outliers_30 || []
    },
    summary: {
      non_video_skipped: stats.non_video_skipped ?? null,
      skipped_too_recent: stats.skipped_too_recent ?? null,
      skipped_not_in_feed: stats.skipped_not_in_feed ?? null,
      videos_available: stats.videos_available ?? null,
      sample_8: stats.sample_8 ?? null,
      sample_30: stats.sample_30 ?? null,
      window_8_full: stats.sample_8 === WINDOW_SHORT,
      window_30_full: stats.sample_30 === WINDOW_LONG,
      views_8: stats.views_8 ?? null,
      views_8_clean: stats.views_8_clean ?? null,
      views_30: stats.views_30 ?? null,
      views_30_clean: stats.views_30_clean ?? null,
      cpm_8: stats.cpm_8 ?? null,
      cpm_8_clean: stats.cpm_8_clean ?? null,
      cpm_30: stats.cpm_30 ?? null,
      cpm_30_clean: stats.cpm_30_clean ?? null,
      formula: `views / 1000 * ${CPM_RATE}`
    }
  };
}

module.exports = {
  CPM_RATE,
  MIN_AGE_HOURS,
  OUTLIER_Z,
  OUTLIER_MIN_FACTOR,
  OUTLIER_MIN_SAMPLE,
  WINDOW_SHORT,
  WINDOW_LONG,
  CALC_VERSION,
  classifyVideos,
  selectVideos,
  average,
  detectOutliers,
  toCpm,
  computeInstagramCpm,
  formatCpmDebug
};
