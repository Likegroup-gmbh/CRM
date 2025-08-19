// Kooperation Video Detail – lädt Video, Kommentare (Runde 1/2), Assets und erlaubt Statuswechsel + Kommentare
export const kooperationVideoDetail = {
  videoId: null,
  video: null,
  kooperation: null,
  comments: [],
  assets: [],

  async init(id) {
    try {
      this.videoId = id === 'new' ? null : id;
      if (!this.videoId) {
        window.setHeadline('Neues Video');
        window.content.innerHTML = '<p class="empty-state">Neuanlage für Videos ist noch nicht implementiert.</p>';
        return;
      }

      await this.loadData();
      this.render();
      this.bindEvents();
    } catch (error) {
      console.error('KooperationVideoDetail init error:', error);
      window.notificationSystem?.error?.('Video-Detail konnte nicht geladen werden.');
    }
  },

  async loadData() {
    // Video + Basisdaten
    const { data: video, error } = await window.supabase
      .from('kooperation_videos')
      .select('id, kooperation_id, titel, content_art, asset_url, kommentar, status, position, created_at')
      .eq('id', this.videoId)
      .single();
    if (error) throw error;
    this.video = video;

    // Kooperation für Zurück-Link / Titel
    try {
      const { data: koop } = await window.supabase
        .from('kooperationen')
        .select('id, name, kampagne:kampagne_id(id, kampagnenname)')
        .eq('id', video.kooperation_id)
        .single();
      this.kooperation = koop || null;
    } catch (_) {
      this.kooperation = null;
    }

    // Kommentare (Runde 1/2)
    try {
      const { data: comments } = await window.supabase
        .from('kooperation_video_comment')
        .select('id, video_id, runde, text, author_name, author_benutzer_id, created_at')
        .eq('video_id', this.videoId)
        .order('created_at', { ascending: true });
      this.comments = comments || [];
    } catch (_) {
      this.comments = [];
    }

    // Assets (optional)
    try {
      const { data: assets } = await window.supabase
        .from('kooperation_video_asset')
        .select('id, file_url, file_path, created_at')
        .eq('video_id', this.videoId)
        .order('created_at', { ascending: true });
      this.assets = assets || [];
    } catch (_) {
      this.assets = [];
    }
  },

  render() {
    const v = this.video || {};
    const title = v.titel || `Video #${v.id}`;
    const koopName = this.kooperation?.name || '-';
    const kampName = this.kooperation?.kampagne?.kampagnenname || '-';
    const safe = (s) => window.validatorSystem?.sanitizeHtml?.(s) ?? s;
    const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('de-DE') : '-');

    if (typeof window.setHeadline === 'function') {
      window.setHeadline(`Video: ${safe(title)}`);
    }

    const canEdit = window.currentUser?.permissions?.kooperation?.can_edit || window.currentUser?.rolle === 'admin';

    // Player/Preview
    const url = v.asset_url || '';
    const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(url);
    const mediaHtml = url
      ? (isVideo
          ? `<video src="${url}" controls style="width:100%;max-height:60vh;border-radius:8px;"></video>`
          : `<a href="${url}" target="_blank" rel="noopener" class="primary-btn">Asset öffnen</a>`)
      : '<p class="empty-state">Kein Asset hinterlegt.</p>';

    const grouped = { r1: [], r2: [] };
    (this.comments || []).forEach(c => {
      const r = (c.runde === 2 || c.runde === '2') ? 'r2' : 'r1';
      grouped[r].push(c);
    });
    const renderComments = (list) => list.length
      ? list.map(c => `<div class="comment-item"><div class="meta">${safe(c.author_name || '-')}
          <span class="dot">•</span> ${fmtDateTime(c.created_at)}</div><div class="text">${safe(c.text || '')}</div></div>`).join('')
      : '<p class="empty-state">Keine Kommentare.</p>';

    const assetsHtml = this.assets.length
      ? this.assets.map(a => `<li><a href="${a.file_url || '#'}" target="_blank" rel="noopener">${a.file_path || a.file_url}</a></li>`).join('')
      : '<li>Keine weiteren Assets.</li>';

    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>${safe(title)}</h1>
          <p>Kooperation: ${safe(koopName)} · Kampagne: ${safe(kampName)}</p>
        </div>
        <div class="page-header-right">
          ${v.kooperation_id ? `<button id="btn-back-kooperation" class="secondary-btn">Zur Kooperation</button>` : ''}
        </div>
      </div>

      <div class="content-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Asset</h3>
            ${mediaHtml}
            ${this.assets.length ? `<div class="asset-list"><h4>Zusätzliche Assets</h4><ul>${assetsHtml}</ul></div>` : ''}
          </div>

          <div class="detail-card">
            <h3>Informationen</h3>
            <div class="detail-grid-2">
              <div class="detail-item"><label>Content-Art</label><span>${safe(v.content_art || '-')}</span></div>
              <div class="detail-item"><label>Position</label><span>${v.position || '-'}</span></div>
              <div class="detail-item"><label>Status</label>
                <span class="status-badge status-${(v.status || 'produktion').toLowerCase()}">${v.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Produktion'}</span>
              </div>
              <div class="detail-item"><label>Erstellt</label><span>${fmtDateTime(v.created_at)}</span></div>
            </div>
            ${canEdit ? `
            <div class="form-inline" style="margin-top:12px;gap:8px;display:flex;align-items:center;">
              <label>Status ändern:</label>
              <select id="video-status" class="form-input" style="max-width:220px;">
                <option value="produktion" ${v.status !== 'abgeschlossen' ? 'selected' : ''}>Produktion</option>
                <option value="abgeschlossen" ${v.status === 'abgeschlossen' ? 'selected' : ''}>Abgeschlossen</option>
              </select>
              <button id="btn-save-status" class="primary-btn">Speichern</button>
            </div>` : ''}
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-card">
            <h3>Feedback Runde 1</h3>
            <div id="comments-r1">${this.renderCommentsTable(grouped.r1)}</div>
          </div>
          <div class="detail-card">
            <h3>Feedback Runde 2</h3>
            <div id="comments-r2">${this.renderCommentsTable(grouped.r2)}</div>
          </div>
        </div>

        <div class="detail-card">
          <h3>Kommentar hinzufügen</h3>
          <form id="comment-form">
            <div class="detail-grid-2">
              <div class="form-field">
                <label>Runde</label>
                <select name="runde" class="form-input">
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </div>
              <div class="form-field" style="grid-column: span 2;">
                <label>Text</label>
                <textarea name="text" class="form-input" rows="3" placeholder="Kommentar eingeben..."></textarea>
              </div>
            </div>
            <div style="margin-top:8px;">
              <button type="submit" class="primary-btn">Speichern</button>
            </div>
          </form>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  },

  renderCommentsTable(list) {
    const safe = (s) => window.validatorSystem?.sanitizeHtml?.(s) ?? s;
    const fDateTime = (d) => (d ? new Date(d).toLocaleString('de-DE') : '-');
    if (!list || list.length === 0) {
      return '<p class="empty-state">Keine Kommentare vorhanden.</p>';
    }
    const rows = list.map(c => `
      <tr>
        <td>${safe(c.author_name || '-')}</td>
        <td>${fDateTime(c.created_at)}</td>
        <td>${safe(c.text || '')}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="kooperation_video_comment">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item action-danger comment-delete" data-id="${c.id}">
                ${window.ActionsDropdown?.getHeroIcon ? window.ActionsDropdown.getHeroIcon('delete') : ''}
                Entfernen
              </a>
            </div>
          </div>
        </td>
      </tr>
    `).join('');
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Datum</th>
              <th>Kommentar</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  bindEvents() {
    // Zur Kooperation zurück
    document.getElementById('btn-back-kooperation')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.video?.kooperation_id) window.navigateTo(`/kooperation/${this.video.kooperation_id}`);
    });

    // Status speichern
    const saveBtn = document.getElementById('btn-save-status');
    if (saveBtn) {
      saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const select = document.getElementById('video-status');
          const value = select?.value || 'produktion';
          const { error } = await window.supabase
            .from('kooperation_videos')
            .update({ status: value, updated_at: new Date().toISOString() })
            .eq('id', this.videoId);
          if (error) throw error;
          // Refresh lokal + Info
          await this.loadData();
          this.render();
          this.bindEvents();
          // Notify parent views
          window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kooperation_videos', action: 'updated', id: this.videoId, field: 'status', value } }));
        } catch (err) {
          console.error('Status speichern fehlgeschlagen', err);
          alert('Status konnte nicht gespeichert werden.');
        }
      });
    }

    // Kommentar-Submit
    const form = document.getElementById('comment-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const runde = parseInt(fd.get('runde') || '1', 10) === 2 ? 2 : 1;
        const text = String(fd.get('text') || '').trim();
        if (!text) return;
        try {
          const payload = {
            video_id: this.videoId,
            runde,
            text,
            author_benutzer_id: window.currentUser?.id || null,
            author_name: window.currentUser?.name || null,
            created_at: new Date().toISOString()
          };
          const { error } = await window.supabase.from('kooperation_video_comment').insert(payload);
          if (error) throw error;
          form.reset();
          await this.loadData();
          this.render();
          this.bindEvents();
        } catch (err) {
          console.error('Kommentar speichern fehlgeschlagen', err);
          alert('Kommentar konnte nicht gespeichert werden.');
        }
      });
    }

    // Kommentar löschen (Delegation innerhalb des Content-Bereichs)
    const contentSection = document.querySelector('.content-section');
    if (contentSection) {
      contentSection.addEventListener('click', async (e) => {
        const del = e.target.closest('.comment-delete');
        if (!del) return;
        e.preventDefault();
        const id = del.dataset.id;
        if (!id) return;
        if (!confirm('Kommentar wirklich entfernen?')) return;
        try {
          const { error } = await window.supabase
            .from('kooperation_video_comment')
            .delete()
            .eq('id', id);
          if (error) throw error;
          await this.loadData();
          this.render();
          this.bindEvents();
        } catch (err) {
          console.error('Kommentar löschen fehlgeschlagen', err);
          alert('Kommentar konnte nicht gelöscht werden.');
        }
      });
    }
  },

  destroy() {
    // No-op; Event-Delegation global
  }
};
