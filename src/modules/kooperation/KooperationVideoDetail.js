// Kooperation Video Detail – lädt Video, Kommentare (Runde 1/2), Assets und erlaubt Statuswechsel + Kommentare
export const kooperationVideoDetail = {
  videoId: null,
  video: null,
  kooperation: null,
  comments: [],
  assets: [],

  async init(id) {
    try {
      const url = new URL(window.location.href);
      const koopId = url.searchParams.get('kooperation');
      this.videoId = (id && id !== 'new') ? id : null;
      const mode = (!this.videoId) ? 'new' : 'detail';
      if (!this.videoId && mode === 'new') {
        // Seite: Neues Video anlegen
        window.setHeadline('Neues Video');
        const canEdit = window.currentUser?.permissions?.kooperation?.can_edit || window.currentUser?.rolle === 'admin';
        if (!canEdit) {
          window.content.innerHTML = '<p class="empty-state">Keine Berechtigung.</p>';
          return;
        }
        const koopInfo = koopId ? await this.fetchKooperationInfo(koopId) : null;
        const videoLimit = parseInt(koopInfo?.videoanzahl, 10) || 0;
        const { data: existing } = koopId ? await window.supabase
          .from('kooperation_videos')
          .select('id')
          .eq('kooperation_id', koopId) : { data: [] };
        const uploaded = (existing || []).length;
        const limitReached = videoLimit > 0 && uploaded >= videoLimit;
        const koopName = koopInfo?.name || '-';
        const kampName = koopInfo?.kampagne?.kampagnenname || '-';
        const formHtml = `
          <div class="page-header">
            <div class="page-header-left">
              <h1>Neues Video</h1>
              <p>Kooperation: ${window.validatorSystem?.sanitizeHtml?.(koopName) || '-'} · Kampagne: ${window.validatorSystem?.sanitizeHtml?.(kampName) || '-'}</p>
            </div>
            <div class="page-header-right">
              ${koopId ? `<button id="btn-back-to-kooperation" class="secondary-btn">Zur Kooperation</button>` : ''}
            </div>
          </div>
          <div class="form-page">
            ${limitReached ? `<div class=\"alert alert-danger\">Videolimit erreicht (${uploaded}/${videoLimit}). Es können keine weiteren Videos angelegt werden.</div>` : ''}
            <form id="video-create-form" class="entity-form" data-entity="kooperation_videos">
              <div class="form-grid">
                <div class="form-field">
                  <label>Titel</label>
                  <input type="text" name="titel" class="form-input" placeholder="z. B. Hook/Intro" required />
                </div>
                <div class="form-field">
                  <label>Content Art</label>
                  <select name="content_art" class="form-input">
                    <option value="">– bitte wählen –</option>
                    <option value="Paid">Paid</option>
                    <option value="Organisch">Organisch</option>
                    <option value="Influencer">Influencer</option>
                    <option value="Videograph">Videograph</option>
                  </select>
                </div>
                <div class="form-field">
                  <label>Asset URL</label>
                  <input type="url" name="asset_url" class="form-input" placeholder="https://..." />
                </div>
                <input type="hidden" name="kooperation_id" value="${koopId || ''}" />
              </div>
              <div class="form-actions">
                <button type="submit" class="primary-btn mdc-btn" data-default-text="Video anlegen" data-success-text="Video angelegt" ${limitReached ? 'disabled' : ''}>Video anlegen</button>
                ${koopId ? `<button type="button" id="btn-cancel-create" class="secondary-btn">Abbrechen</button>` : ''}
              </div>
            </form>
          </div>`;
        window.setContentSafely(window.content, formHtml);
        this.bindCreateEvents(koopId);
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

  async fetchKooperationInfo(koopId) {
    try {
      const { data } = await window.supabase
        .from('kooperationen')
        .select('id, name, kampagne:kampagne_id(id, kampagnenname)')
        .eq('id', koopId)
        .single();
      return data || null;
    } catch (_) { return null; }
  },

  bindCreateEvents(koopId) {
    document.getElementById('btn-back-to-kooperation')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (koopId) window.navigateTo(`/kooperation/${koopId}`);
    });
    document.getElementById('btn-cancel-create')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (koopId) window.navigateTo(`/kooperation/${koopId}`);
    });
    const form = document.getElementById('video-create-form');
    if (form) {
      // Hidden Koop-ID sicherstellen
      const hiddenKoop = form.querySelector('input[name="kooperation_id"]');
      if (hiddenKoop && !hiddenKoop.value && koopId) hiddenKoop.value = koopId;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('.mdc-btn');
        const fd = new FormData(form);
        const payload = {
          kooperation_id: fd.get('kooperation_id') || koopId || null,
          titel: String(fd.get('titel') || '').trim() || null,
          content_art: String(fd.get('content_art') || '').trim() || null,
          asset_url: String(fd.get('asset_url') || '').trim() || null,
          status: 'produktion'
        };
        if (!payload.kooperation_id || !payload.titel) {
          alert('Bitte Kooperation und Titel angeben.');
          return;
        }
        try {
          // Micro-Animation aktivieren
          if (btn) {
            btn.disabled = true;
            btn.classList.add('is-loading');
          }
          // Nächste Position ermitteln (max(position)+1)
          let nextPos = 1;
          try {
            const { data: last } = await window.supabase
              .from('kooperation_videos')
              .select('position')
              .eq('kooperation_id', koopId)
              .order('position', { ascending: false })
              .limit(1);
            nextPos = ((last && last[0] && parseInt(last[0].position, 10)) || 0) + 1;
          } catch (_) {}
          const { error } = await window.supabase.from('kooperation_videos').insert({ ...payload, position: nextPos });
          if (error) throw error;
          if (btn) {
            btn.classList.remove('is-loading');
            btn.classList.add('is-success');
            btn.textContent = btn.dataset.successText || 'Angelegt';
          }
          setTimeout(() => {
            window.navigateTo(`/kooperation/${koopId}`);
          }, 400);
        } catch (err) {
          console.error('Video anlegen fehlgeschlagen', err);
          if (btn) {
            btn.classList.remove('is-loading');
            btn.disabled = false;
          }
          alert('Video konnte nicht angelegt werden.');
        }
      });
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
              <button id="btn-save-status" class="mdc-btn mdc-btn--create" data-variant="@create-prd.mdc">
                <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${window.formSystem?.formRenderer?.getCheckIcon?.() || '✔'}</span>
                <span class="mdc-btn__spinner" aria-hidden="true">${window.formSystem?.formRenderer?.getSpinnerIcon?.() || ''}</span>
                <span class="mdc-btn__label">Speichern</span>
              </button
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
              <button type="submit" class="mdc-btn mdc-btn--create" data-variant="@create-prd.mdc" data-default-text="Speichern" data-success-text="Gespeichert">
                <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${window.formSystem?.formRenderer?.getCheckIcon?.() || '✔'}</span>
                <span class="mdc-btn__spinner" aria-hidden="true">${window.formSystem?.formRenderer?.getSpinnerIcon?.() || ''}</span>
                <span class="mdc-btn__label">Speichern</span>
              </button>
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
      const btn = form.querySelector('.mdc-btn');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const runde = parseInt(fd.get('runde') || '1', 10) === 2 ? 2 : 1;
        const text = String(fd.get('text') || '').trim();
        if (!text) return;
        try {
          if (btn) {
            btn.disabled = true;
            btn.classList.add('is-loading');
          }
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
          // Direkt lokal ergänzen für Live-Feeling
          this.comments = this.comments || [];
          this.comments.push({ ...payload });
          if (btn) {
            btn.classList.remove('is-loading');
            btn.classList.add('is-success');
            const label = btn.querySelector('.mdc-btn__label');
            if (label) label.textContent = btn.dataset.successText || 'Gespeichert';
            setTimeout(() => {
              btn.classList.remove('is-success');
              btn.disabled = false;
              if (label) label.textContent = btn.dataset.defaultText || 'Speichern';
            }, 600);
          }
          // UI Teilbereich aktualisieren
          const content = document.querySelector('#comments-' + (runde === 2 ? 'r2' : 'r1'));
          if (content) content.innerHTML = this.renderCommentsTable(runde === 2 ? [...(this.comments.filter(c=>c.runde===2))] : [...(this.comments.filter(c=>c.runde!==2))]);
        } catch (err) {
          console.error('Kommentar speichern fehlgeschlagen', err);
          if (btn) {
            btn.classList.remove('is-loading');
            btn.disabled = false;
          }
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
