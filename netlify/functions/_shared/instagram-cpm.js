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
//
// Reels mit Werbe-Kennzeichnung in der Caption fallen ebenfalls raus: bezahlte
// Kooperationen laufen ueber Anzeigenbudget und Collab-Reichweite und sagen
// nichts ueber die organische Reichweite des Creators aus. Ein offizielles
// Flag gibt Meta fuer fremde Profile nicht her (collaborators und
// is_paid_partnership brauchen einen Owner-Token, is_shared_to_feed und
// media_product_type lehnt Business Discovery mit Fehlercode 100 ab), deshalb
// bleibt nur die Caption.

const CPM_RATE = 25;        // EUR pro 1000 Views
const MIN_AGE_HOURS = 96;   // Videos juenger als 4 Tage ignorieren
const WINDOW_SHORT = 8;
const WINDOW_LONG = 30;

// Ausreisser-Erkennung als Prozessregel statt als Statistik: die Reihe wird
// sortiert, dann werden nur die beiden Randwerte gegen ihren direkten Nachbarn
// geprueft. Hat der hoechste Wert mindestens doppelt so viele Views wie der
// zweithoechste, faellt er; hat der zweitniedrigste mindestens doppelt so viele
// wie der niedrigste, faellt der niedrigste. Mehr als ein Reel je Seite faellt
// nie.
//
// Der Vorgaenger (modifizierter Z-Score ueber Median/MAD auf log10) war
// mathematisch saubere Ausreisser-Erkennung, hat aber bei realen Accounts
// praktisch nie ausgeloest: bei breit gestreuten Views liegt selbst ein
// Millionen-Reel noch unter Z = 2,5. Die Nachbarschaftsregel greift dafuer
// nachvollziehbar und laesst sich Kunden in zwei Saetzen erklaeren.
const OUTLIER_RATIO = 2.0;
const OUTLIER_MIN_SAMPLE = 5;

// Werbe-Kennzeichnungen in der Caption. \b haelt #ad von #adidas und
// #adventskalender fern.
const AD_HASHTAGS = [
  'werbung', 'anzeige', 'ad', 'ads', 'sponsored', 'sponsoredpost',
  'paidpartnership', 'bezahltepartnerschaft', 'werbepartner', 'werbevideo',
  'kooperation', 'collab', 'collabpost', 'affiliate'
];
const AD_HASHTAG_RE = new RegExp(`#(${AD_HASHTAGS.join('|')})\\b`, 'i');
const AD_PHRASE_RE = /paid partnership|bezahlte partnerschaft|in kooperation mit|anzeige\s*\||werbung\s*\|/i;

// Geschenkte Produkte ohne Bezahlung. Bewusst nicht aktiv: die Reichweite so
// eines Reels ist organisch. Zum Zuschalten in istWerbePost aufnehmen.
const GESCHENK_HASHTAGS = ['gifted', 'geschenkt', 'prsample', 'pr'];

// Version der Rechenlogik. Landet in ig_stats.calc_version; eine aeltere
// Version im Creator-Pool gilt als veraltet und erzwingt einen neuen Abruf.
const CALC_VERSION = 3;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Werbe-Kennzeichnung in einer Caption erkennen.
 * @param {string|null|undefined} caption
 */
function istWerbePost(caption) {
  const text = typeof caption === 'string' ? caption : '';
  if (!text) return false;
  return AD_HASHTAG_RE.test(text) || AD_PHRASE_RE.test(text);
}

/**
 * Videos klassifizieren: auswertbar vs. aussortiert.
 * Aussortiert werden Videos, die juenger als MIN_AGE_HOURS sind (too_recent)
 * und Videos mit Werbe-Kennzeichnung in der Caption (ad_post). Videos ohne
 * view_count und Nicht-Videos werden nicht in skipped gefuehrt.
 *
 * Die Werbe-Pruefung laeuft vor der Altersregel: ein zu frischer Werbe-Reel
 * soll als Werbung auftauchen, nicht als "kommt spaeter noch dazu".
 *
 * @param {Array} media
 * @param {number} now
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

    const reason = istWerbePost(m.caption) ? 'ad_post'
      : postedAt > cutoff ? 'too_recent'
        : null;

    if (reason) {
      skipped.push({ ...entry, reason });
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
 * Ausreisser in einer Views-Reihe finden.
 *
 * Die Reihe wird aufsteigend sortiert, danach werden nur die beiden Randwerte
 * gegen ihren direkten Nachbarn geprueft:
 *   - hoechster Wert / zweithoechster Wert >= OUTLIER_RATIO -> hoechster faellt
 *   - zweitniedrigster Wert / niedrigster Wert >= OUTLIER_RATIO -> niedrigster faellt
 *
 * Es faellt hoechstens ein Wert oben und einer unten. Normale Schwankungen
 * gehoeren zur Performance eines Creators und bleiben Teil der Rechnung -
 * ausgeschlossen wird nur der offensichtliche Einzelfall.
 *
 * Bewusste Eigenschaft: zwei aehnlich hohe Spitzen decken sich gegenseitig
 * (900k und 1M haben Verhaeltnis 1,11), dann faellt nichts. Das ist der Preis
 * fuer eine Regel, die sich ohne Statistikkenntnisse nachrechnen laesst.
 *
 * @param {number[]} values Views, Reihenfolge egal
 * @returns {{indices: Set<number>, details: Array<{index:number,views:number,side:'high'|'low',ratio:number}>}}
 */
function detectOutliers(values) {
  const empty = { indices: new Set(), details: [] };
  if (!Array.isArray(values) || values.length < OUTLIER_MIN_SAMPLE) return empty;

  // Auf den sortierten Kopien rechnen, aber die Original-Indizes zurueckgeben:
  // evaluateWindow braucht sie, um den Reel zum Wert zu finden.
  const sortiert = values
    .map((views, index) => ({ views, index }))
    .sort((a, b) => a.views - b.views);

  const n = sortiert.length;
  const niedrigster = sortiert[0];
  const zweitniedrigster = sortiert[1];
  const hoechster = sortiert[n - 1];
  const zweithoechster = sortiert[n - 2];

  const indices = new Set();
  const details = [];

  // Division durch 0 abfangen: ein Reel mit 0 Views ist gegenueber jedem
  // Nachbarn mit Views ein Ausreisser nach unten.
  const verhaeltnis = (oben, unten) => {
    if (unten > 0) return oben / unten;
    return oben > 0 ? Infinity : 1;
  };

  const ratioHigh = verhaeltnis(hoechster.views, zweithoechster.views);
  if (ratioHigh >= OUTLIER_RATIO) {
    indices.add(hoechster.index);
    details.push({
      index: hoechster.index,
      views: hoechster.views,
      side: 'high',
      ratio: ratioHigh
    });
  }

  const ratioLow = verhaeltnis(zweitniedrigster.views, niedrigster.views);
  if (ratioLow >= OUTLIER_RATIO) {
    indices.add(niedrigster.index);
    details.push({
      index: niedrigster.index,
      views: niedrigster.views,
      side: 'low',
      ratio: ratioLow
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
 * Ein Fenster auswerten: arithmetischer Schnitt der Reels ohne Ausreisser.
 * Der Wert kommt nur zustande, wenn das Fenster wirklich voll ist - ein
 * "8er-Schnitt" aus 3 Videos waere irrefuehrend.
 */
function evaluateWindow(videos, size) {
  if (videos.length !== size) {
    return { views: null, outliers: [] };
  }

  const values = videos.map((v) => v.views);
  const { indices, details } = detectOutliers(values);
  const bereinigt = values.filter((_, i) => !indices.has(i));

  return {
    views: average(bereinigt.length ? bereinigt : values),
    outliers: details.map((d) => {
      const video = videos[d.index];
      return {
        views: d.views,
        timestamp: video?.timestamp || null,
        permalink: video?.permalink || null,
        side: d.side,
        // Infinity entsteht bei einem Nachbarn mit 0 Views und wuerde in JSON
        // zu null werden - dann lieber gleich null speichern
        ratio: Number.isFinite(d.ratio) ? Math.round(d.ratio * 100) / 100 : null
      };
    })
  };
}

/**
 * Kennzahlen aus einer Media-Liste der Business Discovery API.
 *
 * views_8 und views_30 sind bereits um die Ausreisser bereinigt - eine
 * ungefilterte Variante gibt es nicht mehr. Was ausgeschlossen wurde, steht in
 * outliers_8 / outliers_30 und in skipped_videos.
 *
 * @param {Array} media   Rohe media.data-Eintraege
 * @param {object} [opts] { now: number } - Zeitbasis fuer die 4-Tage-Regel
 * @returns {{
 *   views_8: number|null, views_30: number|null,
 *   cpm_8: number|null, cpm_30: number|null,
 *   sample_8: number, sample_30: number,
 *   outliers_8: Array, outliers_30: Array,
 *   videos_available: number, skipped_too_recent: number,
 *   skipped_ads: number, non_video_skipped: number,
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
    views_30: roundViews(window30.views),
    cpm_8: toCpm(window8.views),
    cpm_30: toCpm(window30.views),
    sample_8: Math.min(videos.length, WINDOW_SHORT),
    sample_30: Math.min(videos.length, WINDOW_LONG),
    outliers_8: window8.outliers,
    outliers_30: window30.outliers,
    videos_available: videos.length,
    skipped_too_recent: skipped.filter((s) => s.reason === 'too_recent').length,
    skipped_ads: skipped.filter((s) => s.reason === 'ad_post').length,
    non_video_skipped: nonVideoSkipped,
    videos: videos.slice(0, WINDOW_LONG).map((v) => ({
      permalink: v.permalink,
      views: v.views,
      timestamp: v.timestamp
    })),
    skipped_videos: skipped.map((s) => ({
      permalink: s.permalink,
      views: s.views,
      timestamp: s.timestamp,
      age_hours: s.age_hours,
      reason: s.reason
    })),
    calc_version: CALC_VERSION
  };
}

/**
 * Strukturierter Debug-Payload fuer Server-/Browser-Konsole.
 * @param {string} username
 * @param {object} stats  Ergebnis von computeInstagramCpm oder Pool-Spiegel
 * @param {object} [meta] { source, pool_fetched_at, image_error }
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
    image_error: meta.image_error || null,
    rules: {
      MIN_AGE_HOURS,
      CPM_RATE,
      WINDOW_SHORT,
      WINDOW_LONG,
      OUTLIER_RATIO,
      OUTLIER_MIN_SAMPLE,
      AD_HASHTAGS,
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
      skipped_ads: stats.skipped_ads ?? null,
      videos_available: stats.videos_available ?? null,
      sample_8: stats.sample_8 ?? null,
      sample_30: stats.sample_30 ?? null,
      window_8_full: stats.sample_8 === WINDOW_SHORT,
      window_30_full: stats.sample_30 === WINDOW_LONG,
      views_8: stats.views_8 ?? null,
      views_30: stats.views_30 ?? null,
      cpm_8: stats.cpm_8 ?? null,
      cpm_30: stats.cpm_30 ?? null,
      formula: `views / 1000 * ${CPM_RATE}`
    }
  };
}

module.exports = {
  CPM_RATE,
  MIN_AGE_HOURS,
  OUTLIER_RATIO,
  OUTLIER_MIN_SAMPLE,
  AD_HASHTAGS,
  GESCHENK_HASHTAGS,
  WINDOW_SHORT,
  WINDOW_LONG,
  CALC_VERSION,
  classifyVideos,
  selectVideos,
  average,
  detectOutliers,
  istWerbePost,
  toCpm,
  computeInstagramCpm,
  formatCpmDebug
};
