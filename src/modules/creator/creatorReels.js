// Letzte Reels in der Creator-Akte.
// Posts und Werbe-Kennzeichnungen bleiben draußen. Dieselbe Erkennung wie der CPM-Rechner.
// Die Regeln stehen hier noch einmal, weil der Browser das CommonJS-Modul nicht als
// benannten Export laden kann. Der Test vergleicht sie mit istWerbePost.

const AD_HASHTAGS = [
  'werbung', 'anzeige', 'ad', 'ads', 'sponsored', 'sponsoredpost',
  'paidpartnership', 'bezahltepartnerschaft', 'werbepartner', 'werbevideo',
  'kooperation', 'collab', 'collabpost', 'affiliate'
];
const AD_HASHTAG_RE = new RegExp(`#(${AD_HASHTAGS.join('|')})\\b`, 'i');
const AD_PHRASE_RE = /paid partnership|bezahlte partnerschaft|in kooperation mit|anzeige\s*\||werbung\s*\|/i;

export const REEL_ANZEIGE_LIMIT = 15;

export function kennzeichnetWerbung(caption) {
  const text = typeof caption === 'string' ? caption : '';
  if (!text) return null;
  const hashtagMatch = text.match(AD_HASHTAG_RE);
  if (hashtagMatch) return hashtagMatch[0].toLowerCase();
  const phraseMatch = text.match(AD_PHRASE_RE);
  if (phraseMatch) return phraseMatch[0].toLowerCase();
  return null;
}

export function waehleAnzeigeReels(posts) {
  const reels = [];
  for (const post of posts || []) {
    if (post?.media_type !== 'VIDEO') continue;
    if (kennzeichnetWerbung(post.caption)) continue;
    reels.push(post);
    if (reels.length >= REEL_ANZEIGE_LIMIT) break;
  }
  return reels;
}

export function anzeigePosts(creator) {
  const clean = Array.isArray(creator?.ig_recent_posts_clean) ? creator.ig_recent_posts_clean : [];
  const raw = Array.isArray(creator?.ig_recent_posts) ? creator.ig_recent_posts : [];
  const zeigeClean = creator?.ig_trial_gate?.aktiv && clean.length > 0;
  return waehleAnzeigeReels(zeigeClean ? clean : raw);
}

export function durchschnittlicheViews(creator) {
  const values = anzeigePosts(creator)
    .filter((post) => post?.view_count != null)
    .map((post) => Number(post.view_count))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
