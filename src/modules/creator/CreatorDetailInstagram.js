// CreatorDetailInstagram.js
// Instagram-Abschnitt der Creator-Akte (Prototype-Mixin)

import { CreatorDetail } from './CreatorDetailCore.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { anzeigePosts } from './creatorReels.js';

// Instagram-Sektion: Daten aus dem Connect (nur wenn erfolgreich verbunden)
CreatorDetail.prototype.renderInstagramSection = function() {
    const c = this.creator || {};
    if (!c.ig_connected_at) {
      const hasLink = !!c.instagram;
      return renderEmptyState({
        icon: 'instagram',
        title: 'Noch nicht mit Instagram verbunden',
        text: hasLink
          ? 'Ueber die Connect-Aktion im Aktionsmenue der Creator-Liste koennen die Instagram-Daten (Follower, Engagement, letzte Posts) geladen werden.'
          : 'Fuer diesen Creator ist kein Instagram-Link hinterlegt. Ohne Link kann kein Connect ausgefuehrt werden.'
      });
    }

    const safe = (val) => window.validatorSystem?.sanitizeHtml?.(String(val ?? '')) ?? String(val ?? '');
    const safeUrl = (url) => window.validatorSystem?.sanitizeUrl?.(url) || '';
    const num = (val) => (val != null && !isNaN(val)) ? Number(val).toLocaleString('de-DE') : '-';

    const username = c.ig_username || '';
    const profileUrl = username ? `https://instagram.com/${encodeURIComponent(username)}` : '';

    const engagement = (c.ig_engagement_rate != null && !isNaN(c.ig_engagement_rate))
      ? `${Number(c.ig_engagement_rate).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`
      : '-';

    // Trial-Filter: bei aktivem Gate gibt es eine bereinigte ER als Tooltip
    const trialGate = c.ig_trial_gate || null;
    const engagementTitle = (trialGate?.aktiv && c.ig_engagement_rate_clean != null && !isNaN(c.ig_engagement_rate_clean))
      ? ` title="Ohne Trial-Reels: ${Number(c.ig_engagement_rate_clean).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %"`
      : '';

    const brands = Array.isArray(c.ig_brand_mentions) ? c.ig_brand_mentions : [];
    const brandsHtml = brands.length
      ? `<div class="tags">${brands.map(b => `<a class="tag tag--brand" href="https://instagram.com/${encodeURIComponent(b)}" target="_blank" rel="noopener noreferrer">@${safe(b)}</a>`).join('')}</div>`
      : '<span class="ig-muted">Keine Werbe-Kooperationen in den letzten Reels erkannt</span>';

    const cleanPosts = Array.isArray(c.ig_recent_posts_clean) ? c.ig_recent_posts_clean : [];
    const zeigeClean = trialGate?.aktiv && cleanPosts.length > 0;
    const posts = anzeigePosts(c);
    const ausgeblendet = Number(trialGate?.cluster_size) || 0;
    const postsHtml = posts.length
      ? `<div class="ig-posts-grid">${posts.map(p => {
          const link = safeUrl(p.permalink) || profileUrl;
          const thumb = safeUrl(p.thumbnail_path);
          const captionTeaser = p.caption ? safe(String(p.caption).slice(0, 120)) : '';
          const date = p.timestamp ? new Date(p.timestamp).toLocaleDateString('de-DE') : '';
          const views = p.view_count != null ? num(p.view_count) : '–';
          return `
            <a class="ig-post-card" href="${link}" target="_blank" rel="noopener noreferrer" title="${captionTeaser}">
              <div class="ig-post-thumb">
                ${thumb
                  ? `<img src="${thumb}" alt="Instagram Reel" loading="lazy" />`
                  : '<div class="ig-post-thumb-placeholder">Kein Bild</div>'}
                <span class="ig-post-type-badge">Reel</span>
              </div>
              <div class="ig-post-meta">
                <span>&#9654; ${views}</span>
                <span>&hearts; ${num(p.like_count)}</span>
                <span>&#128172; ${num(p.comments_count)}</span>
                ${date ? `<span class="ig-post-date">${date}</span>` : ''}
              </div>
            </a>
          `;
        }).join('')}</div>`
      : '<span class="ig-muted">Keine Reels ohne Werbe-Kennzeichnung.</span>';

    return `
      <div class="detail-card ig-section">
        <div class="ig-section-header">
          <h3 class="section-title">Instagram</h3>
          <span class="ig-connected-info">
            <span class="ig-connected-badge"></span>
            Verbunden – Stand: ${this.formatDate(c.ig_connected_at)}
            ${profileUrl ? `&nbsp;·&nbsp;<a href="${profileUrl}" target="_blank" rel="noopener noreferrer">@${safe(username)}</a>` : ''}
          </span>
        </div>

        <div class="ig-stats-row">
          <div class="ig-stat">
            <span class="ig-stat-value">${num(c.instagram_follower)}</span>
            <span class="ig-stat-label">Follower</span>
          </div>
          <div class="ig-stat">
            <span class="ig-stat-value"${engagementTitle}>${icon('engagement', { className: 'ig-stat-icon' })}${engagement}</span>
            <span class="ig-stat-label">Engagement-Rate</span>
          </div>
          <div class="ig-stat">
            <span class="ig-stat-value">${num(c.ig_media_count)}</span>
            <span class="ig-stat-label">Posts</span>
          </div>
        </div>

        ${c.ig_biography ? `
        <div class="detail-item ig-bio">
          <label>Beschreibung:</label>
          <span>${safe(c.ig_biography)}</span>
        </div>
        ` : ''}

        <div class="detail-item">
          <label>Kooperationen:</label>
          <span>${brandsHtml}</span>
        </div>

        <div class="ig-posts-block">
          <label>Letzte Reels:</label>
          ${zeigeClean ? `<div class="ig-muted ig-trial-hint">${ausgeblendet} Trial-Reel${ausgeblendet === 1 ? '' : 's'} ausgeblendet (gefilterte Ansicht)</div>` : ''}
          ${postsHtml}
        </div>
      </div>
    `;
};
