// instagram-cpm-report.js
// Debug-Payload und menschenlesbarer Report zur CPM-Rechnung aus instagram-cpm.js.
// Dieselben Funktionen schreiben das Netlify-Log (emitCpmDebug) und das lokale
// Verifikations-Script (scripts/instagram-media-debug.mjs).

const {
  CPM_RATE,
  MIN_AGE_HOURS,
  WINDOW_SHORT,
  WINDOW_LONG,
  OUTLIER_RATIO,
  OUTLIER_MIN_SAMPLE,
  AD_HASHTAGS,
  TRIAL_EXACT_MIN_LEN,
  TRIAL_EXACT_MAX_GAP_DAYS,
  TRIAL_FUZZY_MIN_LEN,
  TRIAL_FUZZY_MAX_GAP_DAYS,
  TRIAL_FUZZY_JACCARD,
  TRIAL_GAP_RATIO,
  TRIAL_MIN_CLUSTER,
  TRIAL_MIN_REGULAR,
  TRIAL_MIN_REGULAR_MEDIAN,
  TRIAL_MAX_PCT,
  CALC_VERSION,
  median
} = require('./instagram-cpm');

/**
 * Strukturierter Debug-Payload fuer Server-/Browser-Konsole.
 * @param {string} username
 * @param {object} stats  Ergebnis von computeInstagramCpm oder Pool-Spiegel
 * @param {object} [meta] { source, pool_fetched_at, image_error }
 */
function formatCpmDebug(username, stats, meta = {}) {
  // Zwei getrennte Bloecke: exakt die Reels, die in den 12er- bzw. 30er-Schnitt
  // eingeflossen sind. used_12 / used_30 sind Indizes in stats.videos, damit sind
  // auch Nachruecker jenseits des Fensters korrekt aufgeloest.
  const alle = stats.videos || [];
  const mapVideo = (v, i) => ({
    index: i,
    views: v.views,
    timestamp: v.timestamp,
    permalink: v.permalink
  });

  // Fallback nur fuer Pool-Eintraege aus einer Zeit ohne used_*: Fenster ueber
  // den permalink der Ausreisser rekonstruieren. Nachruecker fehlen dort, das
  // ist hinnehmbar - CALC_VERSION erzwingt sowieso einen frischen Abruf.
  // Ein leeres used_* ist dagegen eine echte Aussage ("Fenster nicht voll"),
  // darf also nicht in den Fallback laufen.
  const fensterAus = (used, size, outliers) => {
    if (Array.isArray(used)) {
      return used
        .map((i) => alle[i])
        .filter(Boolean)
        .map(mapVideo);
    }
    const raus = new Set((outliers || []).map((o) => o.permalink));
    return alle
      .slice(0, size)
      .filter((v) => !raus.has(v.permalink))
      .map(mapVideo);
  };

  const included_12 = fensterAus(stats.used_12, WINDOW_SHORT, stats.outliers_12);
  const included_30 = fensterAus(stats.used_30, WINDOW_LONG, stats.outliers_30);

  const skipped = (stats.skipped_videos || []).map((v) => ({
    views: v.views,
    age_hours: v.age_hours,
    timestamp: v.timestamp,
    permalink: v.permalink,
    reason: v.reason || 'too_recent',
    ad_marker: v.ad_marker || null,
    ...(v.trial_detail ? { trial_detail: v.trial_detail } : {})
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
      TRIAL_EXACT_MIN_LEN,
      TRIAL_EXACT_MAX_GAP_DAYS,
      TRIAL_FUZZY_MIN_LEN,
      TRIAL_FUZZY_MAX_GAP_DAYS,
      TRIAL_FUZZY_JACCARD,
      TRIAL_GAP_RATIO,
      TRIAL_MIN_CLUSTER,
      TRIAL_MIN_REGULAR,
      TRIAL_MIN_REGULAR_MEDIAN,
      TRIAL_MAX_PCT,
      CALC_VERSION,
      note: 'UI-Preis = views × Listen-TKP; cpm_* hier immer × CPM_RATE'
    },
    trial_gate: stats.trial_gate || null,
    ohne_trials: stats.ohne_trials
      ? {
          views_12: stats.ohne_trials.views_12 ?? null,
          views_30: stats.ohne_trials.views_30 ?? null,
          cpm_12: stats.ohne_trials.cpm_12 ?? null,
          cpm_30: stats.ohne_trials.cpm_30 ?? null,
          sample_12: stats.ohne_trials.sample_12 ?? null,
          sample_30: stats.ohne_trials.sample_30 ?? null
        }
      : null,
    skipped,
    included_12,
    included_30,
    outliers: {
      window_12: stats.outliers_12 || [],
      window_30: stats.outliers_30 || []
    },
    summary: {
      non_video_skipped: stats.non_video_skipped ?? null,
      skipped_too_recent: stats.skipped_too_recent ?? null,
      skipped_ads: stats.skipped_ads ?? null,
      skipped_trials: stats.skipped_trials ?? null,
      skipped_trial_views: stats.skipped_trial_views ?? null,
      videos_available: stats.videos_available ?? null,
      sample_12: stats.sample_12 ?? null,
      sample_30: stats.sample_30 ?? null,
      window_12_full: stats.sample_12 === WINDOW_SHORT,
      window_30_full: stats.sample_30 === WINDOW_LONG,
      views_12: stats.views_12 ?? null,
      views_30: stats.views_30 ?? null,
      cpm_12: stats.cpm_12 ?? null,
      cpm_30: stats.cpm_30 ?? null,
      formula: `views / 1000 * ${CPM_RATE}`
    }
  };
}

/** 850 -> "850", 3600 -> "3,6K", 1200000 -> "1,2M" (Report-Kurzform) */
function kurzZahl(n) {
  if (n == null || !Number.isFinite(n)) return '-';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')}K`;
  return String(Math.round(n));
}

/** 50000 -> "50.000" (de-DE Tausenderpunkt) */
function deZahl(n) {
  if (n == null || !Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('de-DE');
}

/** 14.7 -> "14,70 €" */
function eur(n) {
  if (n == null || !Number.isFinite(n)) return '-';
  return `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Shortcode aus einem Instagram-Permalink ziehen */
function shortcode(permalink) {
  const m = String(permalink || '').match(/\/(?:reel|reels|p)\/([^/?#]+)/i);
  return m ? m[1] : String(permalink || '?');
}

/** Alter eines Posts kompakt: "29h" unter 48h, sonst "4d" */
function alterVon(timestamp, now) {
  const h = (now - Date.parse(timestamp)) / 3600000;
  if (!Number.isFinite(h)) return '?';
  if (h < 48) return `${Math.max(0, Math.round(h))}h`;
  return `${Math.round(h / 24)}d`;
}

/**
 * Menschenlesbarer Report ueber die komplette CPM-Rechnung: Regeln, Datenlage,
 * Luecken-Gate, Verdict je Reel und duale SUMMARY (A mit / B ohne Trials).
 * Identischer Output in Netlify-Log und Verifikations-Script, damit Zeilen
 * stichprobenartig gegen das eingeloggte Grid pruefbar sind.
 *
 * @param {string} username
 * @param {object} stats   Rueckgabe von computeInstagramCpm (oder Pool-Spiegel)
 * @param {object} [meta]  { source, pool_fetched_at, follower, media_total, now }
 * @returns {string}
 */
function formatCpmReport(username, stats, meta = {}) {
  const now = meta.now ?? Date.now();
  const videos = stats.videos || [];
  const skipped = stats.skipped_videos || [];
  const gate = stats.trial_gate || null;
  const ohne = stats.ohne_trials || null;
  const z = [];

  const follower = meta.follower != null ? deZahl(meta.follower) : '-';
  z.push(`[IG-CPM] @${username || '?'}  source=${meta.source || '?'}  fetched=${meta.pool_fetched_at || '-'}  follower=${follower}`);

  z.push(`RULES  age>=${MIN_AGE_HOURS}h  gap>=${TRIAL_GAP_RATIO}x  cluster>=${TRIAL_MIN_CLUSTER}  regular>=${TRIAL_MIN_REGULAR}  reg_median>=${deZahl(TRIAL_MIN_REGULAR_MEDIAN)}  boden<${TRIAL_MAX_PCT * 100}% reg_median  flag<${TRIAL_MAX_PCT * 100}% reg_median  outlier>=${OUTLIER_RATIO}x  calc_v${CALC_VERSION}`);

  const mediaTotal = meta.media_total
    ?? (videos.length + skipped.length + (stats.non_video_skipped ?? 0));
  z.push(`FETCH  media=${mediaTotal}  usable=${stats.videos_available ?? videos.length}  (ads=${stats.skipped_ads ?? 0}, dup=${stats.skipped_trials ?? 0}, recent=${stats.skipped_too_recent ?? 0}, trial_views=${stats.skipped_trial_views ?? 0}, non_video=${stats.non_video_skipped ?? 0})`);

  const viewsSort = videos.map((v) => v.views).filter(Number.isFinite).sort((a, b) => a - b);
  if (viewsSort.length) {
    const q = (p) => viewsSort[Math.min(viewsSort.length - 1, Math.floor(p * viewsSort.length))];
    z.push(`DIST   min=${kurzZahl(viewsSort[0])}  p25=${kurzZahl(q(0.25))}  median=${kurzZahl(median(viewsSort))}  p75=${kurzZahl(q(0.75))}  max=${kurzZahl(viewsSort[viewsSort.length - 1])}`);
  }

  if (gate?.aktiv) {
    const lows = viewsSort.filter((v) => v < gate.schwelle);
    const highs = viewsSort.filter((v) => v >= gate.schwelle);
    const lowsTxt = lows.slice(0, 12).map(kurzZahl).join('  ')
      + (lows.length > 12 ? `  …+${lows.length - 12}` : '');
    const highsTxt = highs.slice(0, 5).map(kurzZahl).join('  ')
      + (highs.length > 5 ? `  …  ${kurzZahl(highs[highs.length - 1])}` : '');
    z.push(`LADDER ${lowsTxt} | ${highsTxt}`);
    const splitUnten = lows.length ? kurzZahl(lows[lows.length - 1]) : '?';
    const splitOben = highs.length ? kurzZahl(highs[0]) : '?';
    z.push(`        └─ low cluster n=${lows.length} ─┘  ↑ SPLIT ${splitUnten} -> ${splitOben} (ratio ${String(gate.gap_ratio ?? '?').replace('.', ',')}x)`);
    z.push(`GATE   reg_median=${kurzZahl(gate.reg_median)} >= ${deZahl(TRIAL_MIN_REGULAR_MEDIAN)}  boden_median=${kurzZahl(gate.boden_median)} < ${TRIAL_MAX_PCT * 100}% reg_median  cluster=${gate.cluster_size} >= ${TRIAL_MIN_CLUSTER}  => AKTIV, Schwelle=${kurzZahl(gate.schwelle)}`);
  } else {
    z.push(`GATE   INAKTIV (${gate?.grund || 'keine Daten'}) => B = A`);
  }

  // --- Verdict je Reel ---
  const idxA12 = new Set(stats.used_12 || []);
  const idxA30 = new Set(stats.used_30 || []);
  const idxB12 = new Set(ohne?.used_12 || []);
  const idxB30 = new Set(ohne?.used_30 || []);
  const outlierTags = new Map();
  const addOutlier = (o, tag) => {
    if (!o?.permalink) return;
    const ratio = o.ratio == null ? '∞' : String(o.ratio).replace('.', ',');
    const list = outlierTags.get(o.permalink) || [];
    list.push(`${tag}_${o.side === 'high' ? 'HIGH' : 'LOW'} ${ratio}x`);
    outlierTags.set(o.permalink, list);
  };
  (stats.outliers_12 || []).forEach((o) => addOutlier(o, 'A12'));
  (stats.outliers_30 || []).forEach((o) => addOutlier(o, 'A30'));
  (ohne?.outliers_12 || []).forEach((o) => addOutlier(o, 'B12'));
  (ohne?.outliers_30 || []).forEach((o) => addOutlier(o, 'B30'));
  const trialByLink = new Map(
    skipped.filter((s) => s.reason === 'trial_views').map((s) => [s.permalink, s])
  );

  const zeilen = [];
  videos.forEach((v, i) => {
    const tags = [];
    if (idxA12.has(i)) tags.push('A12');
    if (idxA30.has(i)) tags.push('A30');
    if (idxB12.has(i)) tags.push('B12');
    if (idxB30.has(i)) tags.push('B30');
    const trial = trialByLink.get(v.permalink);
    const out = outlierTags.get(v.permalink);
    let verdict;
    if (trial) {
      const d = trial.trial_detail || {};
      const fenster = tags.length ? `  [${tags.join(' ')}]` : '  [A-Pool, B exkludiert]';
      verdict = `TRIAL_VIEWS (${kurzZahl(v.views)} < ${kurzZahl(d.schwelle)} = ${TRIAL_MAX_PCT * 100}% von ${kurzZahl(d.reg_median)})${fenster}`;
    } else if (out) {
      verdict = `OUTLIER ${out.join(', ')} -> ersetzt`;
    } else {
      verdict = tags.length ? `USED ${tags.join(' ')}` : 'im Pool (ausserhalb der Fenster)';
    }
    zeilen.push({
      ts: v.timestamp,
      txt: `  ${String(v.timestamp || '').slice(0, 10)}  ${kurzZahl(v.views).padStart(6)}  ${alterVon(v.timestamp, now).padStart(4)}  ${shortcode(v.permalink)}  ${verdict}`
    });
  });
  skipped.filter((s) => s.reason !== 'trial_views').forEach((s) => {
    let verdict;
    if (s.reason === 'ad_post') verdict = `AD (${s.ad_marker || 'Caption'})`;
    else if (s.reason === 'trial_duplicate') verdict = 'TRIAL_DUP (Caption-Paar)';
    else if (s.reason === 'too_recent') verdict = `TOO_RECENT (${Math.round(s.age_hours ?? 0)}h < ${MIN_AGE_HOURS}h)`;
    else verdict = String(s.reason || '?').toUpperCase();
    zeilen.push({
      ts: s.timestamp,
      txt: `  ${String(s.timestamp || '').slice(0, 10)}  ${kurzZahl(s.views).padStart(6)}  ${alterVon(s.timestamp, now).padStart(4)}  ${shortcode(s.permalink)}  ${verdict}`
    });
  });
  zeilen.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
  z.push(`VERDICTS (neueste zuerst, ${zeilen.length}):`);
  const MAX_VERDICTS = 80;
  zeilen.slice(0, MAX_VERDICTS).forEach((zl) => z.push(zl.txt));
  if (zeilen.length > MAX_VERDICTS) z.push(`  … +${zeilen.length - MAX_VERDICTS} weitere`);

  // --- Duale Summary ---
  z.push(`SUMMARY  A mit Trials:   views_12=${kurzZahl(stats.views_12)}  views_30=${kurzZahl(stats.views_30)}  (cpm ${eur(stats.cpm_12)} / ${eur(stats.cpm_30)})  sample=${stats.sample_12 ?? 0}/${stats.sample_30 ?? 0}`);
  if (ohne) {
    z.push(`         B ohne Trials:  views_12=${kurzZahl(ohne.views_12)}  views_30=${kurzZahl(ohne.views_30)}  (cpm ${eur(ohne.cpm_12)} / ${eur(ohne.cpm_30)})  sample=${ohne.sample_12 ?? 0}/${ohne.sample_30 ?? 0}`);
  }
  return z.join('\n');
}

module.exports = {
  formatCpmDebug,
  formatCpmReport
};
