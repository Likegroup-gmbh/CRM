// _shared/instagram-cpm-nachrechnen.js
// Kurzes Fenster aus einer gespeicherten Statistik (ig_stats / tt_stats) neu rechnen, ohne
// Meta oder Apify zu fragen. stats.videos ist die bereinigte Liste aus computeInstagramCpm
// (neueste zuerst), darauf laeuft dieselbe Fensterlogik wie beim Abruf (ADR 0084).
//
// Grenze: stats.videos endet hinter dem letzten Reel, den ein Fenster damals gebraucht hat
// (mindestens 30). Braeuchte das neue Fenster mehr Nachruecker, rechnet es mit weniger
// Reels; der naechste Abruf rechnet wieder exakt.

const { WINDOW_SHORT, evaluateWindow, toCpm } = require('./instagram-cpm');

const runden = (views) => (views == null ? null : Math.round(views));
const schluessel = (video) => video.permalink || video.timestamp;

function auswerten(videos, size) {
  const w = evaluateWindow(videos, size);
  return { views: runden(w.views), cpm: toCpm(w.views), sample: w.sample, used: w.used, outliers: w.outliers };
}

/**
 * Fenster der Groesse `size` aus stats.videos. Variante B (ohne Trials) nur, wenn die
 * Statistik schon eine hat: dann war das Trial-Gate aktiv, und die markierten Reels stehen
 * mit reason 'trial_views' in skipped_videos.
 *
 * @returns {{ views, cpm, sample, used, outliers, ohne_trials }|null} null ohne gespeicherte Videos
 */
function fensterAusStats(stats, size) {
  const videos = Array.isArray(stats?.videos) ? stats.videos : null;
  if (!videos) return null;
  const ergebnis = { ...auswerten(videos, size), ohne_trials: null };
  if (!stats.ohne_trials) return ergebnis;

  const trials = new Set((stats.skipped_videos || [])
    .filter((s) => s.reason === 'trial_views')
    .map(schluessel));
  const indexImOriginal = [];
  const gefiltert = [];
  videos.forEach((video, i) => {
    if (trials.has(schluessel(video))) return;
    indexImOriginal.push(i);
    gefiltert.push(video);
  });
  const b = auswerten(gefiltert, size);
  // used zeigt wie bei computeInstagramCpm auf stats.videos, nicht auf die gefilterte Liste
  ergebnis.ohne_trials = { ...b, used: b.used.map((i) => indexImOriginal[i]) };
  return ergebnis;
}

/**
 * Statistik um das kurze Fenster ergaenzen: die 12er-Schluessel kommen dazu. Die 8er bleiben
 * stehen, weil der alte Client sie bis zum Deploy liest; weg fallen sie mit der Migration
 * 20270101_preisfenster_8_entfernen.sql. 30er-Werte und calc_version bleiben, wie sie sind.
 *
 * @returns {{ views: number|null, cpm: number|null, stats: object }|null}
 */
function aufKurzesFenster(stats) {
  const f = fensterAusStats(stats, WINDOW_SHORT);
  if (!f) return null;
  const neu = {
    ...stats,
    sample_12: f.sample,
    used_12: f.used,
    outliers_12: f.outliers
  };
  if (f.ohne_trials) {
    const b = f.ohne_trials;
    neu.ohne_trials = {
      ...stats.ohne_trials,
      views_12: b.views,
      cpm_12: b.cpm,
      sample_12: b.sample,
      used_12: b.used,
      outliers_12: b.outliers
    };
  }
  return { views: f.views, cpm: f.cpm, stats: neu };
}

module.exports = { fensterAusStats, aufKurzesFenster };
