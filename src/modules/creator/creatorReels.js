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

const safe = (val) => window.validatorSystem?.sanitizeHtml?.(String(val ?? '')) ?? String(val ?? '');
const safeUrl = (url) => window.validatorSystem?.sanitizeUrl?.(url) || '';
const num = (val) => (val != null && !isNaN(val) ? Number(val).toLocaleString('de-DE') : '–');

function renderReelCard(post, profileUrl) {
  const link = safeUrl(post.permalink) || profileUrl;
  const thumb = safeUrl(post.thumbnail_path);
  const date = post.timestamp ? new Date(post.timestamp).toLocaleDateString('de-DE') : '';
  return `
    <a class="ig-post-card" href="${link}" target="_blank" rel="noopener noreferrer" title="${post.caption ? safe(String(post.caption).slice(0, 120)) : ''}">
      <div class="ig-post-thumb">
        ${thumb
          ? `<img src="${thumb}" alt="Instagram Reel" loading="lazy" />`
          : '<div class="ig-post-thumb-placeholder">Kein Bild</div>'}
        <span class="ig-post-type-badge">Reel</span>
      </div>
      <div class="ig-post-meta">
        <span>&#9654; ${num(post.view_count)}</span>
        <span>&hearts; ${num(post.like_count)}</span>
        <span>&#128172; ${num(post.comments_count)}</span>
        ${date ? `<span class="ig-post-date">${date}</span>` : ''}
      </div>
    </a>
  `;
}

// Block „Letzte Reels“ für Detailseite und Schublade. Jede Kachel öffnet das Reel auf Instagram.
export function renderReelsBlock(creator, { className = '' } = {}) {
  const posts = anzeigePosts(creator);
  const gate = creator?.ig_trial_gate;
  const gefiltert = gate?.aktiv && Array.isArray(creator?.ig_recent_posts_clean) && creator.ig_recent_posts_clean.length > 0;
  const ausgeblendet = Number(gate?.cluster_size) || 0;
  const username = creator?.ig_username || '';
  const profileUrl = username ? `https://instagram.com/${encodeURIComponent(username)}` : '';
  return `
    <div class="ig-posts-block${className ? ` ${className}` : ''}">
      <label>Letzte Reels${posts.length ? ` (${posts.length})` : ''}</label>
      ${gefiltert ? `<div class="ig-muted ig-trial-hint">${ausgeblendet} Trial-Reel${ausgeblendet === 1 ? '' : 's'} ausgeblendet (gefilterte Ansicht)</div>` : ''}
      ${posts.length
        ? `<div class="ig-posts-grid">${posts.map((post) => renderReelCard(post, profileUrl)).join('')}</div>`
        : '<span class="ig-muted">Keine Reels ohne Werbe-Kennzeichnung.</span>'}
    </div>
  `;
}

export function durchschnittlicheViews(creator) {
  const values = anzeigePosts(creator)
    .filter((post) => post?.view_count != null)
    .map((post) => Number(post.view_count))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
