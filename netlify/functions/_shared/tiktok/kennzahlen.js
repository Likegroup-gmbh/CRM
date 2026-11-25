// _shared/tiktok/kennzahlen.js
// Kennzahlen eines TikTok-Profils aus den Videos eines Profil-Laufs (videoZeile aus ergebnis.js).
// Gerechnet wird mit der Instagram-Logik: dieselben Regeln fuer Werbung, Alter und Ausreisser,
// damit die Preise beider Plattformen vergleichbar sind. Ohne Netzwerk und DB, direkt testbar.
// Nur die Engagement-Rate bezieht sich auf Views statt Follower (siehe computeEngagementRate).
//
// TikTok kennt keine Trial-Reels. Die View-Luecken-Markierung der Instagram-Rechnung ist hier
// normale Streuung, deshalb gibt es keinen Zweitwert "ohne Trials".

const { computeInstagramCpm } = require('../instagram-cpm');
const { computeEngagementRate } = require('../instagram-engagement');

const WERBE_MARKER = 'tiktok:werbung';

// null wuerde die Instagram-Rechnung als 0 Views bzw. 0 Likes zaehlen, undefined faellt raus
const oderUndefined = (wert) => (wert == null ? undefined : wert);

/** videoZeile -> Media-Form, die computeInstagramCpm und computeEngagementRate lesen */
function alsMedia(video) {
  return {
    id: video.id || null,
    media_type: 'VIDEO',
    view_count: oderUndefined(video.aufrufe),
    like_count: oderUndefined(video.likes),
    comments_count: oderUndefined(video.kommentare),
    timestamp: video.datum,
    caption: video.text || '',
    permalink: video.url,
    ad_marker: video.werbung ? WERBE_MARKER : null,
  };
}

/**
 * @param {object[]} videos videoZeile-Objekte eines Profils, neueste zuerst
 * @param {number|null} follower
 * @param {number} [now]
 * @returns {{ views_12: number|null, views_30: number|null, engagement_rate: number|null, stats: object }}
 */
function profilKennzahlen(videos, follower, now = Date.now()) {
  const alle = Array.isArray(videos) ? videos : [];
  const eigene = alle.filter((v) => !v.angepinnt);
  const media = eigene.map(alsMedia);
  const cpm = computeInstagramCpm(media, { now });
  const engagementRate = computeEngagementRate(media, follower, { bezug: 'views', now });

  return {
    views_12: cpm.views_12,
    views_30: cpm.views_30,
    engagement_rate: engagementRate,
    stats: {
      calc_version: cpm.calc_version,
      engagement_rate: engagementRate,
      sample_12: cpm.sample_12,
      sample_30: cpm.sample_30,
      used_12: cpm.used_12,
      used_30: cpm.used_30,
      outliers_12: cpm.outliers_12,
      outliers_30: cpm.outliers_30,
      videos_available: cpm.videos_available,
      skipped_too_recent: cpm.skipped_too_recent,
      skipped_ads: cpm.skipped_ads,
      skipped_trials: cpm.skipped_trials,
      skipped_pinned: alle.length - eigene.length,
      videos: cpm.videos,
      skipped_videos: cpm.skipped_videos.filter((s) => s.reason !== 'trial_views'),
    },
  };
}

module.exports = { WERBE_MARKER, alsMedia, profilKennzahlen };
