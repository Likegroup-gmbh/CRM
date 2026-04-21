// Kooperation Video Detail – lädt Video, Kommentare (Runde 1/2), Assets und erlaubt Statuswechsel + Kommentare
import { KampagneUtils } from '../kampagne/KampagneUtils.js';

const DEBUG_UPLOAD = true;

export const kooperationVideoDetail = {
  videoId: null,
  video: null,
  kooperation: null,
  comments: [],
  assets: [],
  _eventsBound: false,
  _selectedFile: null,

  async init(id) {
    try {
      this.videoId = (id && id !== 'new') ? id : null;
      if (!this.videoId) {
        window.setHeadline('Video');
        window.content.innerHTML = '<p class="empty-state">Videos werden automatisch über die Kooperation erstellt.</p>';
        return;
      }

      await this.loadData();
      
      // Breadcrumb aktualisieren
      if (window.breadcrumbSystem && this.video && this.kooperation) {
        window.breadcrumbSystem.updateDetailLabel(this.video.titel || 'Video');
      }
      
      this.render();
      this.bindEvents();
    } catch (error) {
      console.error('KooperationVideoDetail init error:', error);
    }
  },

  async loadData() {
    // Video + Basisdaten
    const { data: video, error } = await window.supabase
      .from('kooperation_videos')
      .select('id, kooperation_id, titel, content_art, asset_url, link_content, folder_url, kommentar, status, position, created_at')
      .eq('id', this.videoId)
      .single();
    if (error) throw error;
    this.video = video;

    // Kooperation + Kampagne + Unternehmen + Marke (für Breadcrumb und Dropbox-Pfad)
    try {
      const { data: koop } = await window.supabase
        .from('kooperationen')
        .select(`id, name, kampagne:kampagne_id(id, kampagnenname, eigener_name, unternehmen:unternehmen_id(id, firmenname), marke:marke_id(id, markenname))`)
        .eq('id', video.kooperation_id)
        .single();
      this.kooperation = koop || null;
    } catch (_) {
      this.kooperation = null;
    }

    // Kommentare (Runde 1/2) - inklusive soft-deleted für Anzeige
    try {
      const { data: comments } = await window.supabase
        .from('kooperation_video_comment')
        .select('id, video_id, runde, text, author_name, author_benutzer_id, created_at, deleted_at, deleted_by_benutzer_id')
        .eq('video_id', this.videoId)
        .order('created_at', { ascending: true });
      this.comments = comments || [];
    } catch (_) {
      this.comments = [];
    }

    // Assets (optional) - mit Versionsinformationen laden
    try {
      const { data: assets } = await window.supabase
        .from('kooperation_video_asset')
        .select('id, file_url, file_path, version_number, is_current, description, uploaded_by, created_at')
        .eq('video_id', this.videoId)
        .order('version_number', { ascending: false });
      this.assets = assets || [];
    } catch (_) {
      this.assets = [];
    }
  },

  render() {
    const v = this.video || {};
    const title = v.titel || `Video #${v.id}`;
    const koopName = this.kooperation?.name || '-';
    const kampName = KampagneUtils.getDisplayName(this.kooperation?.kampagne);
    const safe = (s) => window.validatorSystem?.sanitizeHtml?.(s) ?? s;
    const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('de-DE') : '-');

    if (typeof window.setHeadline === 'function') {
      window.setHeadline(`Video: ${safe(title)}`);
    }

    const canEdit = window.currentUser?.permissions?.kooperation?.can_edit || window.currentUser?.rolle === 'admin';
    const canUpload = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle === 'mitarbeiter';

    // Ordner-Link anzeigen statt Video-Player
    const folderUrl = v.folder_url || '';
    const mediaHtml = folderUrl
      ? `<a href="${folderUrl}" target="_blank" rel="noopener" class="primary-btn">Ordner öffnen</a>`
      : '<p class="empty-state">Kein Ordner hinterlegt.</p>';

    const grouped = { r1: [], r2: [] };
    (this.comments || []).forEach(c => {
      const r = (c.runde === 2 || c.runde === '2') ? 'r2' : 'r1';
      grouped[r].push(c);
    });

    // Asset-Versionen rendern
    const assetsHtml = this.renderAssetVersions(this.assets, safe, fmtDateTime, canEdit);

    const html = `
      <!-- Tab-Navigation -->
      <div class="tab-navigation">
        <button class="tab-button active" data-tab="info">
          Informationen
        </button>
        <button class="tab-button" data-tab="videos">
          Videos & Feedback
        </button>
      </div>

      <div class="tab-content">
        <!-- Tab: Informationen -->
        <div class="tab-pane active" id="tab-info">
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
            <div class="form-inline" style="margin-top:var(--space-sm);gap:var(--space-xs);display:flex;align-items:center;">
              <label>Status ändern:</label>
              <select id="video-status" class="form-input" style="max-width:220px;">
                <option value="produktion" ${v.status !== 'abgeschlossen' ? 'selected' : ''}>Produktion</option>
                <option value="abgeschlossen" ${v.status === 'abgeschlossen' ? 'selected' : ''}>Abgeschlossen</option>
              </select>
              <button id="btn-save-status" class="mdc-btn mdc-btn--create" data-variant="@create-prd.mdc">
                <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${window.formSystem?.formRenderer?.getCheckIcon?.() || '✔'}</span>
                <span class="mdc-btn__spinner" aria-hidden="true">${window.formSystem?.formRenderer?.getSpinnerIcon?.() || ''}</span>
                <span class="mdc-btn__label">Speichern</span>
              </button>
            </div>` : ''}
          </div>
        </div>

        <!-- Tab: Videos & Feedback -->
        <div class="tab-pane" id="tab-videos">
          <div class="detail-card">
            <h3>Video-Versionen</h3>
            ${assetsHtml}
            ${canUpload ? `
            <div class="asset-upload-section" style="margin-top:var(--space-md);padding-top:var(--space-md);border-top:var(--border-xs) solid var(--border-primary);">
              <h4 style="margin:0 0 var(--space-sm) 0;">Neue Video-Version hochladen</h4>
              <div style="margin-bottom:var(--space-xs);">
                <label style="display:inline-flex;align-items:center;gap:var(--space-xxs);cursor:pointer;font-size:var(--font-size-sm);color:var(--text-secondary);">
                  <input type="checkbox" id="toggle-upload-mode" />
                  Stattdessen URL eingeben
                </label>
              </div>
              <form id="asset-upload-form">
                <!-- Datei-Upload (Standard) -->
                <div id="file-upload-section">
                  <div class="dropzone" id="video-dropzone" style="border:2px dashed var(--border-primary);border-radius:var(--radius-md);padding:var(--space-lg);text-align:center;cursor:pointer;transition:all 0.2s ease;background:var(--bg-secondary);">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="40" height="40" style="margin:0 auto var(--space-xs);display:block;color:var(--text-tertiary);">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    <p style="margin:0;color:var(--text-secondary);font-size:var(--font-size-sm);">Video hierher ziehen oder <strong>klicken</strong> zum Auswählen</p>
                    <p style="margin:var(--space-xxs) 0 0;color:var(--text-tertiary);font-size:var(--font-size-xs);">MP4, WebM, MOV – max. 500 MB</p>
                    <input type="file" id="video-file-input" accept="video/*,.mov,.mp4,.webm,.avi" style="display:none;" />
                  </div>
                  <div id="file-preview" style="display:none;margin-top:var(--space-xs);padding:var(--space-xs) var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-sm);font-size:var(--font-size-sm);display:none;align-items:center;gap:var(--space-xs);">
                    <span id="file-name" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
                    <span id="file-size" style="color:var(--text-tertiary);flex-shrink:0;"></span>
                    <button type="button" id="file-remove" style="background:none;border:none;cursor:pointer;color:var(--text-tertiary);padding:2px;" title="Entfernen">✕</button>
                  </div>
                </div>
                <!-- URL-Fallback (hidden by default) -->
                <div id="url-upload-section" style="display:none;">
                  <div class="form-field">
                    <label>Asset URL</label>
                    <input type="url" name="file_url" class="form-input" placeholder="https://..." />
                  </div>
                </div>
                <div class="form-field" style="margin-top:var(--space-xs);">
                  <label>Beschreibung (optional)</label>
                  <textarea name="description" class="form-input" rows="2" placeholder="z.B. Feedback aus Runde 1 eingearbeitet"></textarea>
                </div>
                <!-- Progress Bar -->
                <div id="upload-progress-container" style="display:none;margin-top:var(--space-xs);">
                  <div style="display:flex;justify-content:space-between;font-size:var(--font-size-xs);color:var(--text-secondary);margin-bottom:var(--space-xxs);">
                    <span id="upload-progress-label">Wird hochgeladen...</span>
                    <span id="upload-progress-percent">0%</span>
                  </div>
                  <div style="width:100%;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
                    <div id="upload-progress-bar" style="width:0%;height:100%;background:var(--color-primary);border-radius:3px;transition:width 0.3s ease;"></div>
                  </div>
                </div>
                <button type="submit" id="asset-upload-btn" class="primary-btn" style="margin-top:var(--space-sm);" disabled>Version hochladen</button>
              </form>
            </div>` : ''}
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
              <div style="margin-top:var(--space-xs);">
                <button type="submit" class="mdc-btn mdc-btn--create" data-variant="@create-prd.mdc" data-default-text="Speichern" data-success-text="Gespeichert">
                  <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${window.formSystem?.formRenderer?.getCheckIcon?.() || '✔'}</span>
                  <span class="mdc-btn__spinner" aria-hidden="true">${window.formSystem?.formRenderer?.getSpinnerIcon?.() || ''}</span>
                  <span class="mdc-btn__label">Speichern</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  },

  renderAssetVersions(assets, safe, fmtDateTime, canEdit) {
    if (!assets || assets.length === 0) {
      return '<p class="empty-state">Keine Assets vorhanden.</p>';
    }

    const sortedAssets = [...assets].sort((a, b) => 
      (b.version_number || 0) - (a.version_number || 0)
    );
    
    const rows = sortedAssets.map(asset => `
      <tr>
        <td>
          <span style="font-weight:600;color:var(--color-primary);">V${asset.version_number || 1}</span>
        </td>
        <td>${asset.description ? safe(asset.description) : '—'}</td>
        <td>${fmtDateTime(asset.created_at)}</td>
        <td>
          ${asset.is_current 
            ? '<span class="status-badge status-abgeschlossen">Aktuell</span>' 
            : '<span class="status-badge status-produktion">Archiv</span>'}
        </td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="kooperation_video_asset">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="${asset.file_url}" target="_blank" rel="noopener" class="action-item">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                Öffnen
              </a>
              ${!asset.is_current && canEdit ? `
              <a href="#" class="action-item set-current-version" data-asset-id="${asset.id}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Als aktuell markieren
              </a>
              ` : ''}
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
              <th>Version</th>
              <th>Beschreibung</th>
              <th>Hochgeladen am</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  renderCommentsTable(list) {
    const safe = (s) => window.validatorSystem?.sanitizeHtml?.(s) ?? s;
    const fDateTime = (d) => (d ? new Date(d).toLocaleString('de-DE') : '-');
    const currentUserId = window.currentUser?.id;
    
    if (!list || list.length === 0) {
      return '<p class="empty-state">Keine Kommentare vorhanden.</p>';
    }
    
    const rows = list.map(c => {
      const isDeleted = !!c.deleted_at;
      const isOwnComment = c.author_benutzer_id === currentUserId;
      const canDelete = isOwnComment && !isDeleted;
      
      // Styling für gelöschte Kommentare
      const rowStyle = isDeleted ? ' style="opacity: 0.5; background-color: #f9f9f9;"' : '';
      const textStyle = isDeleted ? ' style="text-decoration: line-through; color: #999;"' : '';
      
      return `
      <tr${rowStyle}>
        <td>${safe(c.author_name || '-')}</td>
        <td>${fDateTime(c.created_at)}</td>
        <td${textStyle}>
          ${safe(c.text || '')}
          ${isDeleted ? `<br><small style="color: #999;">Gelöscht am: ${fDateTime(c.deleted_at)}</small>` : ''}
        </td>
        <td>
          ${canDelete ? `
          <div class="actions-dropdown-container" data-entity-type="kooperation_video_comment">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item action-danger comment-delete" data-action="comment-delete" data-id="${c.id}">
                ${window.ActionsDropdown?.getHeroIcon ? window.ActionsDropdown.getHeroIcon('delete') : ''}
                Entfernen
              </a>
            </div>
          </div>
          ` : '—'}
        </td>
      </tr>
      `;
    }).join('');
    
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
    // Globale Event-Listener nur einmal binden
    if (!this._eventsBound) {
      // Tab-Switching
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-button')) {
          e.preventDefault();
          const tabName = e.target.dataset.tab;
          if (tabName) this.switchTab(tabName);
        }
      });

      // Kommentar löschen (Soft-Delete - Delegation mit Event-Bubbling)
      document.addEventListener('click', async (e) => {
        const del = e.target.closest('.comment-delete');
        if (!del) return;
        e.preventDefault();
        const id = del.dataset.id;
        if (!id) return;
        if (!confirm('Kommentar wirklich entfernen?')) return;
        try {
          // Soft-Delete: Setze deleted_at und deleted_by
          const { error } = await window.supabase
            .from('kooperation_video_comment')
            .update({
              deleted_at: new Date().toISOString(),
              deleted_by_benutzer_id: window.currentUser?.id || null
            })
            .eq('id', id);
          if (error) throw error;
          await this.loadData();
          this.render();
          this.bindLocalEvents(); // Nur lokale Events neu binden
          // ActionsDropdown neu initialisieren
          if (window.ActionsDropdown) {
            window.ActionsDropdown.init();
          }
        } catch (err) {
          console.error('Kommentar löschen fehlgeschlagen', err);
          alert('Kommentar konnte nicht gelöscht werden.');
        }
      });
      
      this._eventsBound = true;
    }
    
    // Lokale Event-Listener die bei jedem Render neu gebunden werden müssen
    this.bindLocalEvents();

    // ActionsDropdown für Asset-Versionen initialisieren
    if (window.ActionsDropdown) {
      window.ActionsDropdown.init();
    }
  },

  bindLocalEvents() {

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
          this.bindLocalEvents();
          if (window.ActionsDropdown) {
            window.ActionsDropdown.init();
          }
          // Notify parent views
          window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kooperation_videos', action: 'updated', id: this.videoId, field: 'status', value } }));
        } catch (err) {
          console.error('Status speichern fehlgeschlagen', err);
          alert('Status konnte nicht gespeichert werden.');
        }
      });
    }

    // Asset-Upload-Event-Handler
    this.bindAssetUploadEvents();

    // "Als aktuell markieren" Event-Handler
    document.querySelectorAll('.set-current-version').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const assetId = btn.dataset.assetId;
        if (!assetId || !confirm('Diese Version als aktuelle Version markieren?')) return;
        
        try {
          // Alle bisherigen als nicht-aktuell markieren
          await window.supabase
            .from('kooperation_video_asset')
            .update({ is_current: false })
            .eq('video_id', this.videoId);
          
          // Ausgewählte als aktuell markieren
          const { error } = await window.supabase
            .from('kooperation_video_asset')
            .update({ is_current: true })
            .eq('id', assetId);
          
          if (error) throw error;
          
          await this.loadData();
          this.render();
          this.bindLocalEvents();
          if (window.ActionsDropdown) {
            window.ActionsDropdown.init();
          }
        } catch (err) {
          console.error('Version aktualisieren fehlgeschlagen', err);
          alert('Version konnte nicht als aktuell markiert werden.');
        }
      });
    });

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
          
          window.toastSystem?.success?.('Feedback gespeichert!');
          
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
          if (content) {
            content.innerHTML = this.renderCommentsTable(runde === 2 ? [...(this.comments.filter(c=>c.runde===2))] : [...(this.comments.filter(c=>c.runde!==2))]);
            // ActionsDropdown neu initialisieren nach UI-Update
            if (window.ActionsDropdown) {
              window.ActionsDropdown.init();
            }
          }
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
  },

  bindAssetUploadEvents() {
    const form = document.getElementById('asset-upload-form');
    if (!form) return;

    const dropzone = document.getElementById('video-dropzone');
    const fileInput = document.getElementById('video-file-input');
    const filePreview = document.getElementById('file-preview');
    const fileNameEl = document.getElementById('file-name');
    const fileSizeEl = document.getElementById('file-size');
    const fileRemoveBtn = document.getElementById('file-remove');
    const submitBtn = document.getElementById('asset-upload-btn');
    const toggleMode = document.getElementById('toggle-upload-mode');
    const fileSection = document.getElementById('file-upload-section');
    const urlSection = document.getElementById('url-upload-section');

    const formatSize = (bytes) => {
      if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
      return (bytes / 1024).toFixed(0) + ' KB';
    };

    const setFile = (file) => {
      if (!file) return;
      if (file.size > 500 * 1024 * 1024) {
        alert('Datei zu groß (max. 500 MB)');
        return;
      }
      this._selectedFile = file;
      if (fileNameEl) fileNameEl.textContent = file.name;
      if (fileSizeEl) fileSizeEl.textContent = formatSize(file.size);
      if (filePreview) filePreview.style.display = 'flex';
      if (dropzone) dropzone.style.display = 'none';
      if (submitBtn) submitBtn.disabled = false;
    };

    const clearFile = () => {
      this._selectedFile = null;
      if (fileInput) fileInput.value = '';
      if (filePreview) filePreview.style.display = 'none';
      if (dropzone) dropzone.style.display = 'block';
      if (submitBtn && !toggleMode?.checked) submitBtn.disabled = true;
    };

    // Toggle between file upload and URL input
    if (toggleMode) {
      toggleMode.addEventListener('change', () => {
        const urlMode = toggleMode.checked;
        if (fileSection) fileSection.style.display = urlMode ? 'none' : 'block';
        if (urlSection) urlSection.style.display = urlMode ? 'block' : 'none';
        if (urlMode) {
          clearFile();
          if (submitBtn) submitBtn.disabled = false;
        } else {
          if (submitBtn) submitBtn.disabled = !this._selectedFile;
        }
      });
    }

    // Dropzone click → open file picker
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        if (fileInput.files?.[0]) setFile(fileInput.files[0]);
      });
    }

    // Drag & Drop
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.style.borderColor = 'var(--color-primary)';
          dropzone.style.background = 'var(--bg-primary)';
        });
      });
      ['dragleave', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.style.borderColor = 'var(--border-primary)';
          dropzone.style.background = 'var(--bg-secondary)';
        });
      });
      dropzone.addEventListener('drop', (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file) setFile(file);
      });
    }

    // Remove file
    if (fileRemoveBtn) {
      fileRemoveBtn.addEventListener('click', clearFile);
    }

    // Form submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const isUrlMode = toggleMode?.checked;
      const fd = new FormData(form);

      if (isUrlMode) {
        const fileUrl = String(fd.get('file_url') || '').trim();
        if (!fileUrl) { alert('Bitte Asset-URL angeben.'); return; }
        await this._saveAssetVersion({ fileUrl, filePath: fileUrl, description: fd.get('description') || null });
      } else {
        if (!this._selectedFile) { alert('Bitte Videodatei auswählen.'); return; }
        await this._uploadToDropbox(this._selectedFile, fd.get('description') || null);
      }
    });
  },

  async _uploadToDropbox(file, description) {
    const submitBtn = document.getElementById('asset-upload-btn');
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressPercent = document.getElementById('upload-progress-percent');
    const progressLabel = document.getElementById('upload-progress-label');

    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Wird hochgeladen...'; }
      if (progressContainer) progressContainer.style.display = 'block';

      const maxVersion = this.assets.length > 0
        ? Math.max(...this.assets.map(a => a.version_number || 0))
        : 0;
      const nextVersion = maxVersion + 1;

      const kampagne = this.kooperation?.kampagne;
      const unternehmen = kampagne?.unternehmen?.firmenname || '';
      const marke = kampagne?.marke?.markenname || '';
      const kampagneName = KampagneUtils.getDisplayName(kampagne) || kampagne?.kampagnenname || '';
      const kooperationName = this.kooperation?.name || '';
      const videoTitel = this.video?.titel || `Video_${this.videoId}`;

      if (progressLabel) progressLabel.textContent = 'Verbinde mit Dropbox...';
      const tokenResp = await fetch('/.netlify/functions/dropbox-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unternehmen, marke, kampagne: kampagneName,
          kooperation: kooperationName, videoTitel,
          versionNumber: String(nextVersion), fileName: file.name
        })
      });
      if (!tokenResp.ok) {
        const errData = await tokenResp.json().catch(() => ({}));
        throw new Error(errData.error || `Token-Abruf fehlgeschlagen (${tokenResp.status})`);
      }
      const { token, dropboxPath } = await tokenResp.json();

      if (progressLabel) progressLabel.textContent = 'Lade hoch nach Dropbox...';
      const uploadResult = await this._uploadFileViaProxy(file, dropboxPath, progressBar, progressPercent, progressLabel);

      const actualPath = uploadResult.path_display || dropboxPath;
      if (progressLabel) progressLabel.textContent = 'Erstelle Links...';
      const sharedLink = await this._createSharedLink(token, actualPath);

      const folderPath = actualPath.substring(0, actualPath.lastIndexOf('/'));
      const folderUrl = await this._createFolderSharedLink(token, folderPath);

      const fileUrl = sharedLink || actualPath;
      await this._saveAssetVersion({ fileUrl, filePath: actualPath, description, folderUrl });
    } catch (err) {
      console.error('Dropbox-Upload fehlgeschlagen', err);
      alert('Upload fehlgeschlagen: ' + (err.message || ''));
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Version hochladen'; }
      if (progressContainer) progressContainer.style.display = 'none';
    }
  },

  async _uploadFileViaProxy(file, dropboxPath, progressBar, progressPercent, progressLabel) {
    const CHUNK_SIZE = 2 * 1024 * 1024;
    const totalSize = file.size;

    const readChunkAsBase64 = (start, end) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
        reader.readAsDataURL(file.slice(start, end));
      });
    };

    const proxyPost = async (body) => {
      const payloadSize = JSON.stringify(body).length;
      const hasToken = !!body.token;
      const tokenPrefix = body.token ? body.token.substring(0, 20) : 'N/A';
      if (DEBUG_UPLOAD) console.log(`[KoopVideoUpload] proxyPost action=${body.action} payloadSize=${payloadSize} hasToken=${hasToken} tokenPrefix=${tokenPrefix}...`);

      const resp = await fetch('/.netlify/functions/dropbox-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (DEBUG_UPLOAD) console.log(`[KoopVideoUpload] proxyPost response: status=${resp.status} ok=${resp.ok}`);

      if (!resp.ok) {
        const errText = await resp.text();
        if (DEBUG_UPLOAD) console.error(`[KoopVideoUpload] proxyPost FAILED: status=${resp.status} body=${errText}`);
        let errObj = {};
        try { errObj = JSON.parse(errText); } catch (_) {}
        throw new Error(errObj.error || `Proxy-Fehler (${resp.status})`);
      }
      const json = await resp.json();
      if (DEBUG_UPLOAD) console.log(`[KoopVideoUpload] proxyPost OK: action=${body.action} responseKeys=${Object.keys(json)} hasTokenInResp=${!!json.token}`);
      return json;
    };

    if (totalSize <= CHUNK_SIZE) {
      if (progressBar) progressBar.style.width = '50%';
      if (progressPercent) progressPercent.textContent = '50%';
      if (progressLabel) progressLabel.textContent = 'Lade hoch...';
      const chunk = await readChunkAsBase64(0, totalSize);
      const result = await proxyPost({ action: 'upload-small', dropboxPath, chunk });
      if (progressBar) progressBar.style.width = '90%';
      if (progressPercent) progressPercent.textContent = '90%';
      return result;
    }

    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    let offset = 0;

    const firstChunk = await readChunkAsBase64(0, CHUNK_SIZE);
    if (progressLabel) progressLabel.textContent = `Wird hochgeladen... 1/${totalChunks}`;
    const startResp = await proxyPost({ action: 'session-start', chunk: firstChunk });
    const { session_id } = startResp;
    this._proxyToken = startResp.token;
    if (DEBUG_UPLOAD) console.log(`[KoopVideoUpload] session-start OK: sessionId=${session_id} tokenLen=${this._proxyToken?.length} tokenPrefix=${this._proxyToken?.substring(0, 20)}...`);
    offset = CHUNK_SIZE;

    let chunkIdx = 2;
    while (offset + CHUNK_SIZE < totalSize) {
      const chunk = await readChunkAsBase64(offset, offset + CHUNK_SIZE);
      const pct = Math.round((offset / totalSize) * 100);
      if (progressBar) progressBar.style.width = pct + '%';
      if (progressPercent) progressPercent.textContent = pct + '%';
      if (progressLabel) progressLabel.textContent = `Wird hochgeladen... ${chunkIdx}/${totalChunks} (${Math.round(offset / 1024 / 1024)} MB)`;
      await proxyPost({ action: 'session-append', sessionId: session_id, offset, chunk, token: this._proxyToken });
      offset += CHUNK_SIZE;
      chunkIdx++;
    }

    const lastChunk = await readChunkAsBase64(offset, totalSize);
    if (progressBar) progressBar.style.width = '90%';
    if (progressPercent) progressPercent.textContent = '90%';
    if (progressLabel) progressLabel.textContent = `Wird hochgeladen... ${totalChunks}/${totalChunks}`;
    if (DEBUG_UPLOAD) {
      const finishTokenPrefix = this._proxyToken?.substring(0, 20) || 'N/A';
      console.log(`[KoopVideoUpload] session-finish SENDING: sessionId=${session_id} offset=${offset} tokenPrefix=${finishTokenPrefix}... path=${dropboxPath}`);
    }
    const result = await proxyPost({ action: 'session-finish', sessionId: session_id, offset, dropboxPath, chunk: lastChunk, token: this._proxyToken });
    return result;
  },

  async _createSharedLink(token, dropboxPath) {
    const resp = await fetch('/.netlify/functions/dropbox-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'shared-link', path: dropboxPath, token: this._proxyToken || undefined }),
    });
    if (!resp.ok) return null;
    const { url } = await resp.json();
    return url?.replace('?dl=0', '?raw=1') || null;
  },

  async _createFolderSharedLink(token, folderPath) {
    try {
      const resp = await fetch('/.netlify/functions/dropbox-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'shared-link', path: folderPath, token: this._proxyToken || undefined }),
      });
      if (!resp.ok) return null;
      const { url } = await resp.json();
      return url || null;
    } catch (err) {
      console.warn('Ordner-Link konnte nicht erstellt werden:', err);
      return null;
    }
  },

  async _saveAssetVersion({ fileUrl, filePath, description, folderUrl }) {
    try {
      const maxVersion = this.assets.length > 0
        ? Math.max(...this.assets.map(a => a.version_number || 0))
        : 0;
      const nextVersion = maxVersion + 1;

      await window.supabase
        .from('kooperation_video_asset')
        .update({ is_current: false })
        .eq('video_id', this.videoId);

      const { error } = await window.supabase
        .from('kooperation_video_asset')
        .insert({
          video_id: this.videoId,
          file_url: fileUrl,
          file_path: filePath,
          version_number: nextVersion,
          is_current: true,
          description: description || null,
          uploaded_by: window.currentUser?.id || null,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      if (folderUrl) {
        const { data: existing } = await window.supabase
          .from('kooperation_videos')
          .select('folder_url')
          .eq('id', this.videoId)
          .single();
        if (!existing?.folder_url) {
          await window.supabase
            .from('kooperation_videos')
            .update({ folder_url: folderUrl })
            .eq('id', this.videoId);
        }
      }

      this._selectedFile = null;
      await this.loadData();
      this.render();
      this.bindLocalEvents();
      if (window.ActionsDropdown) window.ActionsDropdown.init();

    } catch (err) {
      console.error('Asset-Version speichern fehlgeschlagen', err);
      alert('Asset konnte nicht gespeichert werden: ' + (err.message || ''));
      const submitBtn = document.getElementById('asset-upload-btn');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Version hochladen'; }
    }
  },

  // Tab wechseln
  switchTab(tabName) {
    console.log('🔄 VIDEO-DETAIL: Wechsle zu Tab:', tabName);
    
    // Alle Tab-Buttons deaktivieren
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Alle Tab-Panes ausblenden
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    
    // Gewählten Tab aktivieren
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activePane = document.getElementById(`tab-${tabName}`);
    
    if (activeButton && activePane) {
      activeButton.classList.add('active');
      activePane.classList.add('active');
    }
  },

  destroy() {
    // Setze das Flag zurück, damit beim nächsten init() die Events neu gebunden werden
    this._eventsBound = false;
  }
};
