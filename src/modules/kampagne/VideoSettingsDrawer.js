// VideoSettingsDrawer.js
// Drawer zum Verwalten von Videos (Anschauen, Neu hochladen, Löschen)
// Nutzt bestehendes Drawer-Pattern (overlay + panel + header + body)

import { deleteSingleDropboxFile } from '../../core/VideoDeleteHelper.js';

export class VideoSettingsDrawer {
  constructor() {
    this.drawerId = 'video-settings-drawer';
    this.videoId = null;
    this.kooperationId = null;
    this.videoUrl = null;
    this.filePath = null;
    this.videoTitel = null;
    this.videoName = '';
    this.onReupload = null;
    this.onDelete = null;
    this.onNameUpdated = null;
    this._isSavingName = false;
  }

  /**
   * @param {object} params
   * @param {string} params.videoId
   * @param {string} params.kooperationId
   * @param {string} params.videoUrl - Aktuelle Video-URL
   * @param {string} params.filePath - Dropbox-Dateipfad
   * @param {string} params.videoTitel - Titel/Thema des Videos
   * @param {string} params.videoName - Anzeigename des Videos
   * @param {function} params.onReupload - Callback: wird aufgerufen wenn "Neu hochladen" geklickt wird
   * @param {function} params.onDelete - Callback: wird aufgerufen wenn "Löschen" bestätigt wird
   * @param {function} params.onNameUpdated - Callback: wird nach erfolgreichem Namensupdate aufgerufen
   */
  async open({ videoId, kooperationId, videoUrl, filePath, videoTitel, videoName, onReupload, onDelete, onNameUpdated }) {
    this.videoId = videoId;
    this.kooperationId = kooperationId;
    this.videoUrl = videoUrl;
    this.filePath = filePath;
    this.videoTitel = videoTitel || 'Video';
    this.videoName = videoName || '';
    this.onReupload = onReupload;
    this.onDelete = onDelete;
    this.onNameUpdated = onNameUpdated;
    this._isSavingName = false;
    this.assets = [];

    this.createDrawer();
    this._renderLoading();

    try {
      const { data } = await window.supabase
        .from('kooperation_video_asset')
        .select('id, file_url, file_path, version_number, is_current, created_at')
        .eq('video_id', this.videoId)
        .order('version_number', { ascending: true });
      this.assets = data || [];
    } catch (err) {
      console.warn('Assets konnten nicht geladen werden:', err);
    }

    this.renderContent();
    this.bindEvents();
  }

  _renderLoading() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    body.innerHTML = `
      <div class="video-settings-drawer-content">
        <div class="video-settings-section">
          <div class="skeleton skeleton-text" style="max-width:80px;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-text" style="max-width:100%;height:36px;"></div>
        </div>
        <div class="video-settings-section">
          <div class="skeleton skeleton-text" style="max-width:60px;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-text" style="max-width:100%;height:20px;margin-bottom:6px;"></div>
          <div class="skeleton skeleton-text" style="max-width:100%;height:20px;"></div>
        </div>
      </div>
    `;
  }

  createDrawer() {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    const header = document.createElement('div');
    header.className = 'drawer-header';

    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Video verwalten';

    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = this.videoTitel;

    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);

    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    headerRight.appendChild(closeBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;

    panel.appendChild(header);
    panel.appendChild(body);

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
  }

  renderContent() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const hasAssets = this.assets.length > 0;
    const uploadBtnText = hasAssets ? 'Weiteres Video hochladen' : 'Neues Video hochladen';

    let versionsHtml;
    if (hasAssets) {
      const rows = this.assets.map(asset => {
        const url = asset.file_url || '';
        const vLabel = `Version ${asset.version_number || '?'}`;
        const currentBadge = asset.is_current
          ? ' <span class="video-version-current">Aktuell</span>'
          : '';
        const linkIcon = url
          ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="video-version-link-icon" title="Video öffnen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>`
          : '<span class="video-version-nofile">–</span>';
        const uploadDate = asset.created_at
          ? new Date(asset.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : '–';
        return `<tr>
          <td>${vLabel}${currentBadge}</td>
          <td style="text-align:center;">${linkIcon}</td>
          <td>${uploadDate}</td>
          <td style="text-align:center;">
            <button type="button" class="video-version-delete-btn" data-asset-id="${asset.id}" data-file-path="${this._escapeHtml(asset.file_path || '')}" title="Version löschen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="15" height="15">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </td>
        </tr>`;
      }).join('');
      versionsHtml = `
        <table class="data-table video-versions-table">
          <thead><tr><th>Video</th><th>Link</th><th>Upload</th><th>Aktion</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    } else {
      versionsHtml = '<p class="video-settings-no-file">Noch kein Video hochgeladen</p>';
    }

    body.innerHTML = `
      <div class="video-settings-drawer-content">
        <div class="video-settings-section">
          <label class="video-settings-label" for="video-settings-name-input">Video-Name</label>
          <input type="text" id="video-settings-name-input" class="form-input video-settings-name-input" value="${this._escapeHtml(this.videoName)}" placeholder="Video-Name"/>
        </div>

        <div class="video-settings-section">
          <label class="video-settings-label">Videos</label>
          ${versionsHtml}
        </div>

        <div class="video-settings-actions">
          <button type="button" class="mdc-btn mdc-btn--primary" id="video-settings-reupload-btn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
            </svg>
            ${uploadBtnText}
          </button>
        </div>

        <div class="drawer-footer" style="padding:16px 0 0;">
          <button type="button" class="mdc-btn mdc-btn--cancel" id="video-settings-close-btn">Schließen</button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    const closeBtn = panel?.querySelector('.drawer-close-btn');
    const closeBtnFooter = document.getElementById('video-settings-close-btn');
    const reuploadBtn = document.getElementById('video-settings-reupload-btn');
    const nameInput = document.getElementById('video-settings-name-input');

    overlay?.addEventListener('click', () => this.close());
    closeBtn?.addEventListener('click', () => this.close());
    closeBtnFooter?.addEventListener('click', () => this.close());

    nameInput?.addEventListener('blur', async () => {
      if (this._isSavingName) return;
      const currentName = this.videoName || '';
      const nextName = (nameInput.value || '').trim();
      if (nextName === currentName) return;

      this._isSavingName = true;
      nameInput.disabled = true;
      try {
        const { error } = await window.supabase
          .from('kooperation_videos')
          .update({ video_name: nextName || null })
          .eq('id', this.videoId);
        if (error) throw error;

        this.videoName = nextName;
        if (typeof this.onNameUpdated === 'function') {
          this.onNameUpdated(nextName);
        }
      } catch (err) {
        alert('Video-Name konnte nicht gespeichert werden: ' + (err.message || 'Unbekannter Fehler'));
        nameInput.value = currentName;
      } finally {
        this._isSavingName = false;
        nameInput.disabled = false;
      }
    });

    reuploadBtn?.addEventListener('click', () => {
      this.close();
      if (typeof this.onReupload === 'function') {
        setTimeout(() => this.onReupload(), 350);
      }
    });

    document.querySelectorAll('.video-version-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const assetId = btn.dataset.assetId;
        const filePath = btn.dataset.filePath || '';
        if (!confirm('Diese Version wirklich löschen?')) return;

        btn.disabled = true;
        const row = btn.closest('tr');
        try {
          if (filePath) {
            await deleteSingleDropboxFile(filePath).catch(err =>
              console.warn('Dropbox-Löschung fehlgeschlagen:', err)
            );
          }

          const { error } = await window.supabase
            .from('kooperation_video_asset')
            .delete()
            .eq('id', assetId);
          if (error) throw error;

          this.assets = this.assets.filter(a => a.id !== assetId);

          if (row) row.remove();

          if (this.assets.length === 0) {
            if (typeof this.onDelete === 'function') {
              await this.onDelete();
            }
            this.renderContent();
            this.bindEvents();
          } else {
            if (typeof this.onDelete === 'function') {
              await this.onDelete();
            }
          }
        } catch (err) {
          alert('Löschen fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler'));
          btn.disabled = false;
        }
      });
    });
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    panel?.classList.remove('show');
    setTimeout(() => this.removeDrawer(), 300);
  }

  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }
}
