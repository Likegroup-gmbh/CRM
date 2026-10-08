// KooperationQuickView.js
// Schnellansicht (Drawer) einer Kooperation: Videos und Feedback-Kommentare.

import {
  createEmptyVideoFeedbackComments,
  getVideoFeedbackBucket,
  isMissingFeedbackTypeError,
  VIDEO_FEEDBACK_LEGACY_SELECT,
  VIDEO_FEEDBACK_FIELDS
} from './VideoFeedbackBuckets.js';

export async function openKooperationQuickView(dropdown, kooperationId) {
  try {
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';

    const header = document.createElement('div');
    header.className = 'drawer-header';
    const headerLeft = document.createElement('div');
    const title = document.createElement('h1');
    title.textContent = 'Kooperation · Schnellansicht';
    const subtitle = document.createElement('p');
    subtitle.style.margin = '0';
    subtitle.style.color = '#6b7280';
    subtitle.textContent = 'Videos & Kommentare';
    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);

    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close';
    closeBtn.id = 'kvq-close';
    closeBtn.textContent = 'Schließen';
    headerRight.appendChild(closeBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    const body = document.createElement('div');
    body.className = 'drawer-body';
    const section = document.createElement('div');
    section.className = 'detail-section';
    const heading = document.createElement('h2');
    heading.textContent = 'Videos';
    const tableContainer = document.createElement('div');
    tableContainer.id = 'kvq-table';
    tableContainer.textContent = 'Lade...';
    section.appendChild(heading);
    section.appendChild(tableContainer);
    body.replaceChildren(section);

    panel.appendChild(header);
    panel.appendChild(body);
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    const close = () => { try { document.removeEventListener('keydown', onEsc); overlay.remove(); panel.remove(); } catch(err) { console.warn('Drawer-Close fehlgeschlagen:', err?.message); } };
    overlay.addEventListener('click', close);
    header.querySelector('#kvq-close')?.addEventListener('click', close);
    function onEsc(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onEsc);
    requestAnimationFrame(() => { panel.classList.add('show'); });

    const { data: videos } = await window.supabase
      .from('kooperation_videos')
      .select('id, position, content_art, titel, asset_url, status, created_at')
      .eq('kooperation_id', kooperationId)
      .order('position', { ascending: true });
    const videoList = videos || [];
    let commentsByVideo = {};
    if (videoList.length) {
      const ids = videoList.map(v => v.id);
      let { data: comments, error: commentsError } = await window.supabase
        .from('kooperation_video_comment')
        .select('id, video_id, runde, feedback_typ, text, author_name, created_at, deleted_at')
        .in('video_id', ids)
        .order('created_at', { ascending: true });
      if (commentsError && isMissingFeedbackTypeError(commentsError)) {
        const legacyResult = await window.supabase
          .from('kooperation_video_comment')
          .select(`${VIDEO_FEEDBACK_LEGACY_SELECT}, deleted_at`)
          .in('video_id', ids)
          .order('created_at', { ascending: true });
        comments = legacyResult.data || [];
        commentsError = legacyResult.error;
      }
      if (commentsError) throw commentsError;
      (comments || []).forEach(c => {
        const key = c.video_id;
        if (!commentsByVideo[key]) commentsByVideo[key] = createEmptyVideoFeedbackComments();
        commentsByVideo[key][getVideoFeedbackBucket(c)].push(c);
      });
    }

    const safe = (s) => window.validatorSystem?.sanitizeHtml?.(s) ?? s;
    const fDate = d => d ? new Date(d).toLocaleDateString('de-DE') : '-';
    const fmtFeedback = (arr) => {
      if (!arr || !arr.length) return '-';
      return arr.map(c => {
        const isDeleted = !!c.deleted_at;
        const textStyle = isDeleted ? 'text-decoration: line-through; color: #999;' : '';
        const t = safe(c.text || '');
        const a = safe(c.author_name || '-');
        const dt = fDate(c.created_at);
        return `<div class="fb-line"><span class="fb-meta">${a} • ${dt}</span><div class="fb-text" style="${textStyle}">${t}</div></div>`;
      }).join('');
    };

    const rows = videoList.map(v => {
      const fb = commentsByVideo[v.id] || createEmptyVideoFeedbackComments();
      const linkBtn = v.asset_url ? `<a class="kvq-link-btn" href="${v.asset_url}" target="_blank" rel="noopener">${dropdown.getHeroIcon('view')}<span>Anzeigen</span></a>` : '-';
      return `
        <tr>
          <td>${v.position || '-'}</td>
          <td>${safe(v.content_art || '-')}</td>
          <td>
            <div class="kvq-cell">
              <span class="kvq-title-text">${safe(v.titel || '-')}</span>
              ${linkBtn}
            </div>
          </td>
          ${VIDEO_FEEDBACK_FIELDS.map(slot => `<td class="feedback-cell">${fmtFeedback(fb[slot.bucket])}</td>`).join('')}
          <td><span class="status-badge status-${(v.status || 'produktion').toLowerCase()}">${v.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Produktion'}</span></td>
        </tr>`;
    }).join('');

    const tableHtml = videoList.length ? `
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr>
            <th>#</th><th>Content Art</th><th>Titel/URL</th>
            ${VIDEO_FEEDBACK_FIELDS.map(slot => `<th>${slot.label}</th>`).join('')}
            <th>Status</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>` : '<p class="empty-state">Keine Videos vorhanden.</p>';

    const tableDiv = body.querySelector('#kvq-table');
    tableDiv.innerHTML = '';
    if (videoList.length) {
      const tc = document.createElement('div');
      tc.className = 'data-table-container';
      tc.innerHTML = tableHtml;
      tableDiv.appendChild(tc);
    } else {
      const emptyState = document.createElement('p');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'Keine Videos vorhanden.';
      tableDiv.appendChild(emptyState);
    }
    dropdown.normalizeIcons(body);
  } catch (err) {
    console.error('Quickview öffnen fehlgeschlagen', err);
    alert('Schnellansicht konnte nicht geöffnet werden.');
  }
}
