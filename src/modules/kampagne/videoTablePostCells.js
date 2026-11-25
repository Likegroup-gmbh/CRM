// videoTablePostCells.js
// Live Link, Views, Likes und Kommentare der Kooperationstabelle. Nur lesen: die Posts kommen
// aus store.livePosts (bestätigte kooperation_post, ADR 0078), gepflegt wird in der Auswertung.
// Ein Video mit Reel und TikTok zeigt beide Links und zählt beide Posts, wie die Kachel
// „Live-Performance“.

import { renderPlatformChip, renderStaticChip } from '../../core/components/chipCell.js';
import { formatCompactNumber, formatExactNumber } from '../../core/format/compactNumber.js';
import { escapeHtml } from '../../core/format.js';

export const POST_ZELLE_TITEL = 'Wird in der Auswertung gepflegt';

export const POST_ZAHL_SPALTEN = {
  'col-stats-views': 'views',
  'col-stats-likes': 'likes',
  'col-stats-comments': 'comments'
};

const zahl = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function postsDesVideos(store, videoId) {
  if (!videoId) return [];
  return (store?.livePosts || []).filter(p => p.video_id === videoId);
}

export function renderLivePostsInner(posts, koop) {
  const fallbackHandle = koop?.creator?.instagram || koop?.creator?.tiktok || '';
  const chips = (posts || [])
    .filter(p => p.link)
    .map(p => renderStaticChip({
      href: p.link,
      chip: renderPlatformChip(p.link, p.account_handle || fallbackHandle),
      title: 'Post öffnen'
    }))
    .filter(Boolean);
  if (!chips.length) return `<span class="stacked-video-empty" title="${POST_ZELLE_TITEL}">-</span>`;
  return `<div class="video-post-links">${chips.join('')}</div>`;
}

/** Summe über die Posts des Videos. Ohne einen einzigen Wert bleibt es bei „—“, nie 0. */
export function summePostZahl(posts, key) {
  let summe = null;
  (posts || []).forEach((p) => {
    const wert = zahl(p.metrics?.[key]);
    if (wert != null) summe = (summe ?? 0) + wert;
  });
  return summe;
}

function letzterMesstag(posts) {
  const tage = (posts || []).map(p => p.measured_at).filter(Boolean).sort();
  return tage.length ? tage[tage.length - 1] : null;
}

export function renderPostZahlInner(posts, key) {
  const summe = summePostZahl(posts, key);
  if (summe == null) return `<div class="video-stats-text" title="${POST_ZELLE_TITEL}">—</div>`;

  const teile = [formatExactNumber(summe)];
  if (posts.length > 1) teile.push(`aus ${posts.length} Posts`);
  const messtag = letzterMesstag(posts);
  if (messtag) teile.push(`Stand ${new Date(`${messtag}T00:00:00`).toLocaleDateString('de-DE')}`);
  teile.push(POST_ZELLE_TITEL);
  return `<div class="video-stats-text" title="${escapeHtml(teile.join(' · '))}">${formatCompactNumber(summe)}</div>`;
}

/** Gerenderte Post-Zellen nachziehen, wenn die Auswertung einen Post bestätigt oder löscht. */
export function patchPostZellen(container, store) {
  if (!container) return;
  const koops = new Map((store?.kooperationen || []).map(k => [k.id, k]));
  container.querySelectorAll('td[data-col-id="col-link-live"] .video-field-wrapper[data-video-id]').forEach((el) => {
    const koop = koops.get(el.closest('tr[data-kooperation-id]')?.dataset.kooperationId);
    el.innerHTML = renderLivePostsInner(postsDesVideos(store, el.dataset.videoId), koop);
  });
  Object.entries(POST_ZAHL_SPALTEN).forEach(([colId, key]) => {
    container.querySelectorAll(`td[data-col-id="${colId}"] .video-field-wrapper[data-video-id]`).forEach((el) => {
      el.innerHTML = renderPostZahlInner(postsDesVideos(store, el.dataset.videoId), key);
    });
  });
}

/** @returns {Function|null} Abmelden vom Store */
export function bindPostZellen(table) {
  return table.store?.on?.('posts-changed', () => {
    patchPostZellen(table.containerId ? document.getElementById(table.containerId) : null, table.store);
    table._rowHeightSync?.schedule();
  }) || null;
}
