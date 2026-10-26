// Engagement-Rate und Kurzbeschreibung fuer den Casting-Abruf.
// Dieselbe Formel wie beim Verbinden in der Creator-Datenbank:
// Durchschnitt (Likes + Kommentare) / Follower ueber die geladenen Posts, in Prozent.
// Die bereinigte Rate laesst Trial-Reels weg, sobald das Trial-Gate aktiv ist.

const { classifyVideos } = require('./instagram-cpm');
const { waehleAnzeigeReels } = require('./instagram-reels');

/** Wie viele Reels als Kacheln gespeichert werden. Mehr Bild-Uploads sprengen das Funktions-Timeout. */
const KARTEN_LIMIT = 6;

function computeEngagementRate(mediaData, followers) {
  if (!followers || followers <= 0 || !mediaData?.length) return null;
  let sum = 0;
  let counted = 0;
  for (const m of mediaData) {
    if (m.like_count === undefined && m.comments_count === undefined) continue;
    sum += (Number(m.like_count) || 0) + (Number(m.comments_count) || 0);
    counted += 1;
  }
  if (counted === 0) return null;
  return Number((((sum / counted) / followers) * 100).toFixed(3));
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
  const engagement_rate = computeEngagementRate(media, followers);
  const engagement_rate_clean = trialGate?.aktiv
    ? computeEngagementRate((media || []).filter((m) => !trialIds.has(m.id)), followers)
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
