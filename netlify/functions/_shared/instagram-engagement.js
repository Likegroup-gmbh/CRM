// Engagement-Rate und Kurzbeschreibung fuer den Profilabruf. Eine Formel fuer Casting
// (Instagram und TikTok) und Creator-Datenbank (instagram-connect.js).
// Die bereinigte Rate laesst Trial-Reels weg, sobald das Trial-Gate aktiv ist.

const { MIN_AGE_HOURS, classifyVideos, detectOutliers, istWerbePost } = require('./instagram-cpm');
const { waehleAnzeigeReels } = require('./instagram-reels');

/** Wie viele Reels als Kacheln gespeichert werden. Mehr Bild-Uploads sprengen das Funktions-Timeout. */
const KARTEN_LIMIT = 6;

const interaktionen = (m) => (Number(m.like_count) || 0) + (Number(m.comments_count) || 0);
const summe = (posts, wert) => posts.reduce((acc, m) => acc + wert(m), 0);

/**
 * Posts, ueber die die Rate laeuft: dieselbe Bereinigung wie beim Preis. Werbung faellt raus
 * (geboostet, Likes von Nicht-Followern), Posts juenger als 4 Tage auch (die Likes laufen noch
 * auf), dazu hoechstens ein Ausreisser oben und einer unten nach der Regel aus detectOutliers.
 */
function bereinigtePosts(media, now) {
  const cutoff = now - MIN_AGE_HOURS * 60 * 60 * 1000;
  const posts = (media || []).filter((m) => m
    && (m.like_count !== undefined || m.comments_count !== undefined)
    && !(m.ad_marker || istWerbePost(m.caption))
    && !(Date.parse(m.timestamp) > cutoff));
  const { indices } = detectOutliers(posts.map(interaktionen));
  return posts.filter((_, i) => !indices.has(i));
}

/**
 * Engagement-Rate in Prozent ueber die bereinigten Posts.
 * - bezug 'follower' (Instagram): Schnitt (Likes + Kommentare) / Follower, der Instagram-Standard.
 * - bezug 'views' (TikTok): Summe (Likes + Kommentare) / Summe Views. Der For-You-Feed spielt Videos
 *   weit ueber die Follower hinaus aus, auf Follower gerechnet kaemen 30 bis 100 % heraus.
 */
function computeEngagementRate(media, followers, { bezug = 'follower', now = Date.now() } = {}) {
  const posts = bereinigtePosts(media, now);
  if (!posts.length) return null;
  const nenner = bezug === 'views'
    ? summe(posts, (m) => Number(m.view_count) || 0)
    : (followers > 0 ? followers * posts.length : 0);
  if (!nenner) return null;
  return Number(((summe(posts, interaktionen) / nenner) * 100).toFixed(3));
}

/**
 * Hauptrate und, bei aktivem Gate, die Rate ohne Trial-Reels.
 * @returns {{ engagement_rate: number|null, engagement_rate_clean: number|null, trialIds: Set<string> }}
 */
function engagementFuerProfil(media, followers, now = Date.now()) {
  const { included, trialGate } = classifyVideos(media, now);
  const trialIds = new Set(
    included.filter((v) => v.trial_views).map((v) => v.id).filter(Boolean)
  );
  const engagement_rate = computeEngagementRate(media, followers, { now });
  const engagement_rate_clean = trialGate?.aktiv
    ? computeEngagementRate((media || []).filter((m) => !trialIds.has(m.id)), followers, { now })
    : null;
  return { engagement_rate, engagement_rate_clean, trialIds, trialGate };
}

/** Die Kacheln, die die Schublade zeigt. `anzeige` ist die Liste mit Vorschaubild. */
function kartenPosts(media, trialIds, trialAktiv) {
  const raw = waehleAnzeigeReels(media).slice(0, KARTEN_LIMIT);
  const clean = trialAktiv
    ? waehleAnzeigeReels((media || []).filter((m) => !trialIds.has(m.id))).slice(0, KARTEN_LIMIT)
    : null;
  const anzeige = trialAktiv && clean?.length ? clean : raw;
  return { raw, clean, anzeige };
}

/**
 * Bio nur in eine leere Kurzbeschreibung. Ein vorhandener Text (Vorschlagsgrund,
 * Handnotiz) bleibt. Rueckgabe null heisst: Feld nicht anfassen.
 */
function notizNachAbruf(notiz, bio) {
  if (String(notiz ?? '').trim()) return null;
  const text = String(bio ?? '').trim();
  return text || null;
}

module.exports = {
  KARTEN_LIMIT,
  computeEngagementRate,
  engagementFuerProfil,
  kartenPosts,
  notizNachAbruf
};
