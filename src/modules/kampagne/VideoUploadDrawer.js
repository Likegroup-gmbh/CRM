import { getAvailableVersions, buildVersionedFileName, MAX_VERSIONS } from '../../core/VideoUploadUtils.js';
import { deleteSingleDropboxFile } from '../../core/VideoDeleteHelper.js';

export class VideoUploadDrawer {
  constructor() {
    this.drawerId = 'video-upload-drawer';
    this.videoId = null;
    this.kooperationId = null;
    this.metadaten = null;
    this.onSuccess = null;
    this._selectedFile = null;
    this._isUploading = false;
    this._existingVersions = [];
    this._availableVersions = [];
    this._selectedVersion = null;
  }

  /**
   * @param {string} videoId - ID des kooperation_videos Eintrags
   * @param {object} metadaten - { kooperationId, kooperationName, videoTitel, videoName, unternehmen, marke, kampagne, creatorName }
   * @param {function} onSuccess - Callback nach erfolgreichem Upload (fileUrl, filePath, videoName, folderUrl)
   */
  async open(videoId, metadaten, onSuccess) {
    this.videoId = videoId;
    this.kooperationId = metadaten.kooperationId;
    this.metadaten = metadaten;
    this.onSuccess = onSuccess;
    this._selectedFile = null;
    this._isUploading = false;

    this._existingVersions = await this._loadExistingVersions();
    console.log('[VideoUploadDrawer] videoId:', this.videoId, 'existingVersions:', this._existingVersions);
    this._availableVersions = getAvailableVersions(this._existingVersions, MAX_VERSIONS);
    console.log('[VideoUploadDrawer] availableVersions:', this._availableVersions);
    this._selectedVersion = this._availableVersions[0] || 1;

    this.createDrawer();
    this.renderForm();
    this.bindEvents();
  }

  async _loadExistingVersions() {
    if (!this.videoId) {
      console.warn('[VideoUploadDrawer] _loadExistingVersions: videoId ist leer, gebe [] zurück');
      return [];
    }
    try {
      const { data, error } = await window.supabase
        .from('kooperation_video_asset')
        .select('version_number')
        .eq('video_id', this.videoId);
      if (error) {
        console.error('[VideoUploadDrawer] _loadExistingVersions Fehler:', error);
        return [];
      }
      const versions = (data || []).map(a => a.version_number).filter(v => typeof v === 'number');
      console.log('[VideoUploadDrawer] _loadExistingVersions result:', { videoId: this.videoId, versions });
      return versions;
    } catch (err) {
      console.error('[VideoUploadDrawer] _loadExistingVersions Exception:', err);
      return [];
    }
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
    title.textContent = 'Video hochladen';

    headerLeft.appendChild(title);

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

  _renderVersionSection() {
    const allVersions = Array.from({ length: MAX_VERSIONS }, (_, i) => i + 1);

    const options = allVersions
      .map(v => {
        const exists = !this._availableVersions.includes(v);
        const label = exists ? `Version ${v} (ersetzen)` : `Version ${v}`;
        const selected = v === this._selectedVersion ? ' selected' : '';
        return `<option value="${v}"${selected}>${label}</option>`;
      })
      .join('');

    return `
      <div class="video-settings-section">
        <label class="video-settings-label" for="video-upload-version">Version (Runde)</label>
        <select id="video-upload-version" class="form-input">${options}</select>
      </div>
    `;
  }

  renderForm() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    body.innerHTML = `
      <div class="video-upload-drawer-content">
        <div class="upload-dropzone" id="video-upload-dropzone">
          <div class="dropzone-content">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="40" height="40" class="upload-dropzone-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
            </svg>
            <p class="dropzone-text">Video hierher ziehen oder <button type="button" class="dropzone-browse-btn">Datei auswählen</button></p>
            <p class="dropzone-hint">MP4, MOV, AVI, MKV – max. 500 MB</p>
          </div>
          <input type="file" id="video-upload-file-input" accept="video/*,.mp4,.mov,.avi,.mkv,.webm" style="display:none"/>
        </div>

        <div class="upload-file-preview" id="video-upload-preview" style="display:none;">
          <div class="file-info">
            <span class="file-name" id="video-upload-filename"></span>
            <span class="file-size" id="video-upload-filesize"></span>
          </div>
          <button type="button" class="file-remove-btn" id="video-upload-remove" title="Datei entfernen">&times;</button>
        </div>

        <div class="upload-progress-container" id="video-upload-progress" style="display:none;">
          <div class="upload-progress-bar">
            <div class="upload-progress-fill" id="video-upload-progress-fill" style="width:0%"></div>
          </div>
          <div class="upload-progress-text" id="video-upload-progress-text">Wird hochgeladen... 0%</div>
        </div>

        ${this._renderVersionSection()}

        <div class="video-settings-section video-upload-name-field">
          <label class="video-settings-label" for="video-upload-name">Video-Name</label>
          <input type="text" id="video-upload-name" class="form-input video-upload-name-input" value="${this.escapeHtml(this.metadaten?.videoName || '')}" placeholder="Video-Name" maxlength="255"/>
        </div>

        <div class="upload-error-msg" id="video-upload-error" style="display:none;"></div>

        <div class="drawer-footer video-upload-drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" id="video-upload-cancel-btn">Abbrechen</button>
          <button type="button" class="mdc-btn mdc-btn--primary" id="video-upload-submit-btn" disabled>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
            </svg>
            Hochladen
          </button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    const closeBtn = panel?.querySelector('.drawer-close-btn');
    const cancelBtn = document.getElementById('video-upload-cancel-btn');
    const submitBtn = document.getElementById('video-upload-submit-btn');
    const dropzone = document.getElementById('video-upload-dropzone');
    const fileInput = document.getElementById('video-upload-file-input');
    const browseBtn = panel?.querySelector('.dropzone-browse-btn');
    const removeBtn = document.getElementById('video-upload-remove');
    const nameInput = document.getElementById('video-upload-name');
    const versionSelect = document.getElementById('video-upload-version');

    overlay?.addEventListener('click', () => this.close());
    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());

    submitBtn?.addEventListener('click', () => {
      if (this._selectedFile && !this._isUploading) this.handleUpload();
    });

    browseBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files?.[0]) this.selectFile(e.target.files[0]);
    });
    removeBtn?.addEventListener('click', () => this.clearFile());
    nameInput?.addEventListener('input', () => this._updateSubmitButtonState());

    versionSelect?.addEventListener('change', () => {
      this._selectedVersion = parseInt(versionSelect.value, 10);
      this._updateSubmitButtonState();
    });

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files?.[0];
      if (file) this.selectFile(file);
    });

    this._updateSubmitButtonState();
  }

  selectFile(file) {
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showError(`Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Max. 500 MB.`);
      return;
    }

    const allowed = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
      this.showError('Bitte eine Videodatei auswählen (MP4, MOV, AVI, MKV, WebM).');
      return;
    }

    this._selectedFile = file;
    this.hideError();

    const dropzone = document.getElementById('video-upload-dropzone');
    const preview = document.getElementById('video-upload-preview');
    const nameEl = document.getElementById('video-upload-filename');
    const sizeEl = document.getElementById('video-upload-filesize');
    if (dropzone) dropzone.style.display = 'none';
    if (preview) preview.style.display = 'flex';
    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB`;
    this._updateSubmitButtonState();
  }

  clearFile() {
    this._selectedFile = null;
    const dropzone = document.getElementById('video-upload-dropzone');
    const preview = document.getElementById('video-upload-preview');
    const fileInput = document.getElementById('video-upload-file-input');

    if (dropzone) dropzone.style.display = '';
    if (preview) preview.style.display = 'none';
    if (fileInput) fileInput.value = '';
    this._updateSubmitButtonState();
  }

  _getVersionedFileName() {
    if (!this._selectedFile) return null;
    const ext = this._selectedFile.name.split('.').pop() || 'mp4';
    return buildVersionedFileName(
      this.metadaten?.creatorName || '',
      this.metadaten?.unternehmen || '',
      this.metadaten?.kampagne || '',
      this._selectedVersion,
      ext
    );
  }

  async handleUpload() {
    if (!this._selectedFile || this._isUploading) return;
    this._isUploading = true;

    const submitBtn = document.getElementById('video-upload-submit-btn');
    const cancelBtn = document.getElementById('video-upload-cancel-btn');
    const progressContainer = document.getElementById('video-upload-progress');
    const progressFill = document.getElementById('video-upload-progress-fill');
    const progressText = document.getElementById('video-upload-progress-text');

    if (submitBtn) submitBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
    if (progressContainer) progressContainer.style.display = 'block';
    this.hideError();

    const videoName = (document.getElementById('video-upload-name')?.value || '').trim();
    if (!videoName) {
      this.showError('Bitte gib einen Video-Namen ein.');
      if (submitBtn) submitBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      if (progressContainer) progressContainer.style.display = 'none';
      this._isUploading = false;
      return;
    }

    const versionNumber = String(this._selectedVersion || 1);
    const fileName = this._getVersionedFileName() || this._selectedFile.name;

    try {
      if (progressText) progressText.textContent = 'Verbinde mit Dropbox...';
      const tokenResp = await fetch('/.netlify/functions/dropbox-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unternehmen: this.metadaten.unternehmen || '',
          marke: this.metadaten.marke || '',
          kampagne: this.metadaten.kampagne || '',
          kooperation: this.metadaten.kooperationName || '',
          videoPosition: this.metadaten.videoPosition || 1,
          videoThema: this.metadaten.videoThema || '',
          videoTitel: this.metadaten.videoTitel || 'Video',
          versionNumber,
          fileName
        })
      });

      if (!tokenResp.ok) {
        const errData = await tokenResp.json().catch(() => ({}));
        throw new Error(errData.error || `Token-Abruf fehlgeschlagen (${tokenResp.status})`);
      }

      const { token, dropboxPath, kooperationFolderPath } = await tokenResp.json();

      if (progressText) progressText.textContent = 'Lade hoch nach Dropbox...';
      const uploadResult = await this._uploadToDropbox(token, dropboxPath, progressFill, progressText);

      if (progressFill) progressFill.style.width = '90%';
      if (progressText) progressText.textContent = 'Erstelle Links...';
      const actualPath = uploadResult.path_display || dropboxPath;
      const sharedLink = await this._createSharedLink(token, actualPath);

      const folderUrl = await this._createFolderSharedLink(token, kooperationFolderPath);

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = 'Speichere in Datenbank...';

      const fileUrl = sharedLink || actualPath;
      await this.saveAssetVersion(fileUrl, actualPath, videoName, folderUrl);

      if (progressText) progressText.textContent = 'Upload abgeschlossen!';
      this._isUploading = false;

      if (typeof this.onSuccess === 'function') {
        this.onSuccess(fileUrl, uploadResult.path_display || dropboxPath, videoName, folderUrl);
      }

      setTimeout(() => this.close(), 800);

    } catch (err) {
      console.error('Video-Upload fehlgeschlagen:', err);
      this.showError(err.message || 'Upload fehlgeschlagen');
      if (submitBtn) submitBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      this._isUploading = false;
    }
  }

  async _uploadToDropbox(token, dropboxPath, progressFill, progressText) {
    const file = this._selectedFile;
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
      const resp = await fetch('/.netlify/functions/dropbox-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Proxy-Fehler (${resp.status})`);
      }
      return resp.json();
    };

    if (totalSize <= CHUNK_SIZE) {
      if (progressFill) progressFill.style.width = '50%';
      if (progressText) progressText.textContent = 'Lade hoch...';
      const chunk = await readChunkAsBase64(0, totalSize);
      const result = await proxyPost({ action: 'upload-small', dropboxPath, chunk });
      if (progressFill) progressFill.style.width = '90%';
      return result;
    }

    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    let offset = 0;

    const firstChunk = await readChunkAsBase64(0, CHUNK_SIZE);
    if (progressText) progressText.textContent = `Lade hoch... 1/${totalChunks}`;
    const startResp = await proxyPost({ action: 'session-start', chunk: firstChunk });
    const { session_id } = startResp;
    this._proxyToken = startResp.token;
    offset = CHUNK_SIZE;

    let chunkIdx = 2;
    while (offset + CHUNK_SIZE < totalSize) {
      const chunk = await readChunkAsBase64(offset, offset + CHUNK_SIZE);
      const pct = Math.round((offset / totalSize) * 90);
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressText) progressText.textContent = `Lade hoch... ${chunkIdx}/${totalChunks} (${Math.round(offset / 1024 / 1024)} MB)`;
      await proxyPost({ action: 'session-append', sessionId: session_id, offset, chunk, token: this._proxyToken });
      offset += CHUNK_SIZE;
      chunkIdx++;
    }

    const lastChunk = await readChunkAsBase64(offset, totalSize);
    if (progressFill) progressFill.style.width = '85%';
    if (progressText) progressText.textContent = `Lade hoch... ${totalChunks}/${totalChunks}`;
    const result = await proxyPost({ action: 'session-finish', sessionId: session_id, offset, dropboxPath, chunk: lastChunk, token: this._proxyToken });
    if (progressFill) progressFill.style.width = '90%';
    return result;
  }

  async _createSharedLink(token, dropboxPath) {
    const resp = await fetch('/.netlify/functions/dropbox-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'shared-link', path: dropboxPath, token: this._proxyToken || undefined }),
    });
    if (!resp.ok) return null;
    const { url } = await resp.json();
    return url?.replace('?dl=0', '?raw=1') || null;
  }

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
  }

  async saveAssetVersion(fileUrl, filePath, videoName, folderUrl) {
    await window.supabase
      .from('kooperation_video_asset')
      .update({ is_current: false })
      .eq('video_id', this.videoId);

    const version = this._selectedVersion || 1;
    if (this._existingVersions?.includes(version)) {
      const { data: oldAsset } = await window.supabase
        .from('kooperation_video_asset')
        .select('file_path')
        .eq('video_id', this.videoId)
        .eq('version_number', version)
        .maybeSingle();

      if (oldAsset?.file_path) {
        await deleteSingleDropboxFile(oldAsset.file_path).catch(err =>
          console.warn('Alte Dropbox-Datei konnte nicht gelöscht werden:', err)
        );
      }

      await window.supabase
        .from('kooperation_video_asset')
        .delete()
        .eq('video_id', this.videoId)
        .eq('version_number', version);
    }

    const { error } = await window.supabase
      .from('kooperation_video_asset')
      .insert({
        video_id: this.videoId,
        file_url: fileUrl,
        file_path: filePath,
        version_number: version,
        is_current: true,
        description: null,
        uploaded_by: window.currentUser?.id || null,
        created_at: new Date().toISOString()
      });
    if (error) throw error;

    const updateData = { link_content: fileUrl, video_name: videoName || null };
    if (folderUrl) {
      updateData.folder_url = folderUrl;
    }

    await window.supabase
      .from('kooperation_videos')
      .update(updateData)
      .eq('id', this.videoId);
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  _updateSubmitButtonState() {
    const submitBtn = document.getElementById('video-upload-submit-btn');
    const nameInput = document.getElementById('video-upload-name');
    if (!submitBtn) return;
    const hasFile = Boolean(this._selectedFile);
    const hasVideoName = Boolean(nameInput?.value?.trim());
    submitBtn.disabled = this._isUploading || !hasFile || !hasVideoName;
  }

  showError(msg) {
    const el = document.getElementById('video-upload-error');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  hideError() {
    const el = document.getElementById('video-upload-error');
    if (el) el.style.display = 'none';
  }

  close() {
    if (this._isUploading) return;

    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);

    panel?.classList.remove('show');

    setTimeout(() => this.removeDrawer(), 300);
  }

  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }
}
