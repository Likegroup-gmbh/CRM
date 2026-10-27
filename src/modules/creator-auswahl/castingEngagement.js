// Engagement-Rate eines Casting-Eintrags fuer Spalte und Schublade.
// Zuerst der Wert vom Casting-Abruf. Fehlt der, die Rate des verknuepften Creators.

export function formatEngagement(rate) {
  if (rate == null || rate === '' || Number.isNaN(Number(rate))) return null;
  return `${Number(rate).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`;
}

function hatSchluessel(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

/** @returns {{ rate: number|null, clean: number|null, showClean: boolean }} */
export function engagementDesEintrags(item) {
  const stats = item?.ig_stats || null;
  const ausAbruf = hatSchluessel(stats, 'engagement_rate');
  const rate = ausAbruf ? stats.engagement_rate : (item?.creator?.ig_engagement_rate ?? null);
  const clean = ausAbruf ? stats.engagement_rate_clean : (item?.creator?.ig_engagement_rate_clean ?? null);
  const gate = ausAbruf ? stats.trial_gate : item?.creator?.ig_trial_gate;
  const showClean = !!(
    gate?.aktiv
    && clean != null
    && rate != null
    && Number(clean) !== Number(rate)
  );
  return { rate, clean, showClean };
}

/** Bio aus dem Abruf. Aeltere Zeilen haben sie schon in ig_stats. Sonst die Bio des Creators. */
export function bioDesEintrags(item) {
  const stats = item?.ig_stats;
  if (hatSchluessel(stats, 'biography')) return stats.biography || '';
  return item?.creator?.ig_biography || '';
}

/**
 * Form fuer die Reel-Kacheln der Creator-Akte.
 * Nach einem Abruf mit Karten gewinnen die Casting-Daten, sonst die des Creators.
 */
export function reelsQuelle(item) {
  const stats = item?.ig_stats || {};
  if (hatSchluessel(stats, 'recent_posts')) {
    return {
      ig_username: stats.username || '',
      ig_trial_gate: stats.trial_gate || null,
      ig_recent_posts: stats.recent_posts || [],
      ig_recent_posts_clean: stats.recent_posts_clean || null
    };
  }
  const creator = item?.creator;
  if (creator && (creator.ig_recent_posts || creator.ig_recent_posts_clean)) return creator;
  return {
    ig_username: stats.username || '',
    ig_recent_posts: [],
    ig_recent_posts_clean: null,
    ig_trial_gate: stats.trial_gate || null
  };
}

export function mediaCountDesEintrags(item) {
  const stats = item?.ig_stats;
  if (hatSchluessel(stats, 'media_count')) return stats.media_count ?? null;
  return item?.creator?.ig_media_count ?? null;
}
