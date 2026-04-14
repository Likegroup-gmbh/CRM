import { getAvailableVersions, buildVersionedFileName, MAX_VERSIONS } from '../../core/VideoUploadUtils.js';
import { deleteSingleDropboxFile } from '../../core/VideoDeleteHelper.js';

const DEBUG_UPLOAD = true;

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|heic|heif|bmp|tiff|tif|avif|ico)$/i;
const IMAGE_MIME_PREFIX = 'image/';
const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50 MB

export class VideoUploadDrawer {
  constructor() {
    this.drawerId = 'video-upload-drawer';
    this.videoId = null;
    this.kooperationId = null;
    this.metadaten = null;
    this.onSuccess = null;
    this.onBilderSuccess = null;
    this._selectedFile = null;
    this._isUploading = false;
    this._existingVersions = [];
    this._availableVersions = [];
    this._selectedVersion = null;

    // Bilder-Tab state
    this._activeTab = 'video';
    this._selectedImages = [];
    this._existingImages = [];
    this._isUploadingImages = false;
  }

  /**
   * @param {string} videoId
   * @param {object} metadaten - { kooperationId, kooperationName, videoTitel, videoName, unternehmen, marke, kampagne, creatorName, bilderFolderUrl }
   * @param {function} onSuccess - Callback nach Video-Upload
   * @param {function} [onBilderSuccess] - Callback nach Bilder-Upload (bilderFolderUrl)
   */
  async open(videoId, metadaten, onSuccess, onBilderSuccess) {
    this.videoId = videoId;
    this.kooperationId = metadaten.kooperationId;
    this.metadaten = metadaten;
    this.onSuccess = onSuccess;
    this.onBilderSuccess = onBilderSuccess || null;
    this._selectedFile = null;
    this._isUploading = false;
    this._selectedImages = [];
    this._existingImages = [];
    this._isUploadingImages = false;
    this._activeTab = 'video';

    this._existingVersions = await this._loadExistingVersions();
    this._availableVersions = getAvailableVersions(this._existingVersions, MAX_VERSIONS);
    this._selectedVersion = this._availableVersions[0] || 1;

    this.createDrawer();
    this.renderForm();
    this.bindEvents();
  }

  async _loadExistingVersions() {
    if (!this.videoId) return [];
    try {
      const { data, error } = await window.supabase
        .from('kooperation_video_asset')
        .select('version_number')
        .eq('video_id', this.videoId);
      if (error) return [];
      return (data || []).map(a => a.version_number).filter(v => typeof v === 'number');
    } catch (err) {
      console.error('[VideoUploadDrawer] _loadExistingVersions:', err);
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
    title.textContent = 'Datei hochladen';
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

  // ─── Tab Navigation ─────────────────────────────────────────

  _renderTabNav() {
    return `
      <div class="drawer-tab-nav">
        <button type="button" class="drawer-tab-btn ${this._activeTab === 'video' ? 'active' : ''}" data-drawer-tab="video">Video</button>
        <button type="button" class="drawer-tab-btn ${this._activeTab === 'bilder' ? 'active' : ''}" data-drawer-tab="bilder">Bilder</button>
      </div>
    `;
  }

  _switchTab(tabName) {
    if (this._isUploading || this._isUploadingImages) return;
    this._activeTab = tabName;

    const panel = document.getElementById(this.drawerId);
    panel?.querySelectorAll('.drawer-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.drawerTab === tabName);
    });

    const videoPane = document.getElementById('upload-tab-video');
    const bilderPane = document.getElementById('upload-tab-bilder');
    if (videoPane) videoPane.style.display = tabName === 'video' ? '' : 'none';
    if (bilderPane) bilderPane.style.display = tabName === 'bilder' ? '' : 'none';

    if (tabName === 'bilder' && this._existingImages.length === 0) {
      this._loadExistingImages();
    }
  }

  // ─── Video Tab (bestehendes Formular) ───────────────────────

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

  _renderVideoTab() {
    return `
      <div id="upload-tab-video" style="${this._activeTab !== 'video' ? 'display:none' : ''}">
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
      </div>
    `;
  }

  // ─── Bilder Tab ─────────────────────────────────────────────

  _renderBilderTab() {
    return `
      <div id="upload-tab-bilder" style="${this._activeTab !== 'bilder' ? 'display:none' : ''}">
        <div class="bilder-upload-drawer-content">
          <div class="upload-dropzone" id="bilder-upload-dropzone">
            <div class="dropzone-content">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="40" height="40" class="upload-dropzone-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"/>
              </svg>
              <p class="dropzone-text">Bilder hierher ziehen oder <button type="button" class="dropzone-browse-btn" id="bilder-browse-btn">Dateien auswählen</button></p>
              <p class="dropzone-hint">Alle Bildformate – max. 50 MB pro Bild</p>
            </div>
            <input type="file" id="bilder-upload-file-input" accept="image/*" multiple style="display:none"/>
          </div>

          <div class="upload-file-list" id="bilder-preview-list"></div>

          <div class="upload-progress-container" id="bilder-upload-progress" style="display:none;">
            <div class="upload-progress-bar">
              <div class="upload-progress-fill" id="bilder-upload-progress-fill" style="width:0%"></div>
            </div>
            <div class="upload-progress-text" id="bilder-upload-progress-text">Wird hochgeladen...</div>
          </div>

          <div class="upload-error-msg" id="bilder-upload-error" style="display:none;"></div>

          <div class="drawer-footer bilder-upload-drawer-footer">
            <button type="button" class="mdc-btn mdc-btn--cancel" id="bilder-upload-cancel-btn">Abbrechen</button>
            <button type="button" class="mdc-btn mdc-btn--primary" id="bilder-upload-submit-btn" disabled>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
              </svg>
              Hochladen
            </button>
          </div>

          <div class="existing-images-section" id="existing-images-section">
            <div class="existing-images-header">
              <span class="existing-images-title">Vorhandene Bilder</span>
              <span class="existing-images-count" id="existing-images-count"></span>
            </div>
            <div class="existing-images-list" id="existing-images-list">
              <div class="existing-images-loading">Lade...</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Main Render ────────────────────────────────────────────

  renderForm() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    body.innerHTML = `
      ${this._renderTabNav()}
      ${this._renderVideoTab()}
      ${this._renderBilderTab()}
    `;
  }

  // ─── Event Binding ──────────────────────────────────────────

  bindEvents() {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const closeBtn = panel?.querySelector('.drawer-close-btn');

    overlay?.addEventListener('click', () => this.close());
    closeBtn?.addEventListener('click', () => this.close());

    // Tab switching
    panel?.querySelectorAll('.drawer-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.drawerTab));
    });

    this._bindVideoTabEvents(panel);
    this._bindBilderTabEvents(panel);
  }

  _bindVideoTabEvents(panel) {
    const cancelBtn = document.getElementById('video-upload-cancel-btn');
    const submitBtn = document.getElementById('video-upload-submit-btn');
    const dropzone = document.getElementById('video-upload-dropzone');
    const fileInput = document.getElementById('video-upload-file-input');
    const browseBtn = panel?.querySelector('#upload-tab-video .dropzone-browse-btn');
    const removeBtn = document.getElementById('video-upload-remove');
    const nameInput = document.getElementById('video-upload-name');
    const versionSelect = document.getElementById('video-upload-version');

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

    dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone?.addEventListener('dragleave', () => { dropzone.classList.remove('dragover'); });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files?.[0];
      if (file) this.selectFile(file);
    });

    this._updateSubmitButtonState();
  }

  _bindBilderTabEvents(panel) {
    const cancelBtn = document.getElementById('bilder-upload-cancel-btn');
    const submitBtn = document.getElementById('bilder-upload-submit-btn');
    const dropzone = document.getElementById('bilder-upload-dropzone');
    const fileInput = document.getElementById('bilder-upload-file-input');
    const browseBtn = document.getElementById('bilder-browse-btn');

    cancelBtn?.addEventListener('click', () => this.close());
    submitBtn?.addEventListener('click', () => {
      if (this._selectedImages.length > 0 && !this._isUploadingImages) this._handleBilderUpload();
    });

    browseBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files?.length) this._addImages(Array.from(e.target.files));
      fileInput.value = '';
    });

    dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone?.addEventListener('dragleave', () => { dropzone.classList.remove('dragover'); });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files?.length) this._addImages(Array.from(files));
    });

    // Delegated click for remove + delete buttons
    const previewList = document.getElementById('bilder-preview-list');
    previewList?.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.bilder-file-remove');
      if (removeBtn) {
        const idx = parseInt(removeBtn.dataset.idx, 10);
        this._removeSelectedImage(idx);
      }
    });

    const existingList = document.getElementById('existing-images-list');
    existingList?.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.existing-image-delete');
      if (deleteBtn) {
        const path = deleteBtn.dataset.path;
        if (path) this._deleteExistingImage(path);
      }
    });
  }

  // ─── Video Tab Logic (unchanged) ───────────────────────────

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
      const payloadSize = JSON.stringify(body).length;
      const hasToken = !!body.token;
      const tokenPrefix = body.token ? body.token.substring(0, 20) : 'N/A';
      if (DEBUG_UPLOAD) console.log(`[VideoUpload] proxyPost action=${body.action} payloadSize=${payloadSize} hasToken=${hasToken} tokenPrefix=${tokenPrefix}...`);

      const resp = await fetch('/.netlify/functions/dropbox-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (DEBUG_UPLOAD) console.log(`[VideoUpload] proxyPost response: status=${resp.status} ok=${resp.ok}`);

      if (!resp.ok) {
        const errText = await resp.text();
        if (DEBUG_UPLOAD) console.error(`[VideoUpload] proxyPost FAILED: status=${resp.status} body=${errText}`);
        let errObj = {};
        try { errObj = JSON.parse(errText); } catch (_) {}
        throw new Error(errObj.error || `Proxy-Fehler (${resp.status})`);
      }
      const json = await resp.json();
      if (DEBUG_UPLOAD) console.log(`[VideoUpload] proxyPost OK: action=${body.action} responseKeys=${Object.keys(json)} hasTokenInResp=${!!json.token}`);
      return json;
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
    if (DEBUG_UPLOAD) console.log(`[VideoUpload] session-start OK: sessionId=${session_id} tokenLen=${this._proxyToken?.length} tokenPrefix=${this._proxyToken?.substring(0, 20)}...`);
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
    if (DEBUG_UPLOAD) {
      const finishTokenPrefix = this._proxyToken?.substring(0, 20) || 'N/A';
      console.log(`[VideoUpload] session-finish SENDING: sessionId=${session_id} offset=${offset} tokenPrefix=${finishTokenPrefix}... path=${dropboxPath}`);
    }
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

  // ─── Bilder Tab Logic ──────────────────────────────────────

  _addImages(files) {
    this._hideBilderError();
    const rejected = [];

    for (const file of files) {
      if (file.size > MAX_IMAGE_SIZE) {
        rejected.push(`${file.name}: zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB, max. 50 MB)`);
        continue;
      }

      const isImage = file.type.startsWith(IMAGE_MIME_PREFIX) || IMAGE_EXTENSIONS.test(file.name);
      if (!isImage) {
        rejected.push(`${file.name}: kein unterstütztes Bildformat`);
        continue;
      }

      const alreadySelected = this._selectedImages.some(f => f.name === file.name && f.size === file.size);
      if (!alreadySelected) {
        this._selectedImages.push(file);
      }
    }

    if (rejected.length) {
      this._showBilderError(rejected.join('\n'));
    }

    this._renderSelectedImagesList();
    this._updateBilderSubmitState();
  }

  _removeSelectedImage(idx) {
    this._selectedImages.splice(idx, 1);
    this._renderSelectedImagesList();
    this._updateBilderSubmitState();
  }

  _renderSelectedImagesList() {
    const list = document.getElementById('bilder-preview-list');
    if (!list) return;

    if (this._selectedImages.length === 0) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = this._selectedImages.map((file, i) => `
      <div class="upload-file-item">
        <div class="file-info">
          <span class="file-name">${this.escapeHtml(file.name)}</span>
          <span class="file-size">${(file.size / 1024 / 1024).toFixed(1)} MB</span>
        </div>
        <button type="button" class="file-remove-btn bilder-file-remove" data-idx="${i}" title="Entfernen">&times;</button>
      </div>
    `).join('');
  }

  _updateBilderSubmitState() {
    const btn = document.getElementById('bilder-upload-submit-btn');
    if (btn) btn.disabled = this._isUploadingImages || this._selectedImages.length === 0;
  }

  _readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error(`Datei konnte nicht gelesen werden: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  async _handleBilderUpload() {
    if (this._selectedImages.length === 0 || this._isUploadingImages) return;
    this._isUploadingImages = true;

    const submitBtn = document.getElementById('bilder-upload-submit-btn');
    const cancelBtn = document.getElementById('bilder-upload-cancel-btn');
    const progressContainer = document.getElementById('bilder-upload-progress');
    const progressFill = document.getElementById('bilder-upload-progress-fill');
    const progressText = document.getElementById('bilder-upload-progress-text');

    if (submitBtn) submitBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
    if (progressContainer) progressContainer.style.display = 'block';
    this._hideBilderError();

    const total = this._selectedImages.length;
    let uploaded = 0;
    let token = null;
    let folderPath = null;

    try {
      // Step 1: Get token + create folder via first file
      if (progressText) progressText.textContent = 'Verbinde mit Dropbox...';
      const firstFile = this._selectedImages[0];
      const prepareResp = await fetch('/.netlify/functions/dropbox-upload-bilder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prepare',
          unternehmen: this.metadaten.unternehmen || '',
          marke: this.metadaten.marke || '',
          kampagne: this.metadaten.kampagne || '',
          kooperation: this.metadaten.kooperationName || '',
          fileName: firstFile.name,
        })
      });

      if (!prepareResp.ok) {
        const errData = await prepareResp.json().catch(() => ({}));
        throw new Error(errData.error || `Vorbereitung fehlgeschlagen (${prepareResp.status})`);
      }

      const prepareData = await prepareResp.json();
      token = prepareData.token;
      folderPath = prepareData.folderPath;

      // Step 2: Upload each image sequentially
      for (let i = 0; i < this._selectedImages.length; i++) {
        const file = this._selectedImages[i];
        const pct = Math.round((i / total) * 90);
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (progressText) progressText.textContent = `Lade hoch... ${i + 1}/${total}: ${file.name}`;

        const dropboxPath = `${folderPath}/${file.name}`;
        const CHUNK_SIZE = 2 * 1024 * 1024;

        if (file.size <= CHUNK_SIZE) {
          const chunk = await this._readFileAsBase64(file);
          await this._proxyPost({ action: 'upload-small', dropboxPath, chunk, token });
        } else {
          await this._uploadLargeImage(file, dropboxPath, token);
        }

        uploaded++;
      }

      // Step 3: Create shared link for folder
      if (progressFill) progressFill.style.width = '95%';
      if (progressText) progressText.textContent = 'Erstelle Ordner-Link...';

      const bilderFolderUrl = await this._createFolderSharedLink(token, folderPath);

      // Step 4: Save bilder_folder_url
      if (bilderFolderUrl && this.kooperationId) {
        await window.supabase
          .from('kooperationen')
          .update({ bilder_folder_url: bilderFolderUrl })
          .eq('id', this.kooperationId);
      }

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = `${uploaded} Bild${uploaded !== 1 ? 'er' : ''} hochgeladen!`;

      this._isUploadingImages = false;
      this._selectedImages = [];
      this._renderSelectedImagesList();

      if (typeof this.onBilderSuccess === 'function') {
        this.onBilderSuccess(bilderFolderUrl);
      }

      await this._loadExistingImages();

      setTimeout(() => {
        if (submitBtn) submitBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = false;
        if (progressContainer) progressContainer.style.display = 'none';
      }, 1500);

    } catch (err) {
      console.error('Bilder-Upload fehlgeschlagen:', err);
      this._showBilderError(err.message || 'Upload fehlgeschlagen');
      if (submitBtn) submitBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      this._isUploadingImages = false;
    }
  }

  async _uploadLargeImage(file, dropboxPath, token) {
    const CHUNK_SIZE = 2 * 1024 * 1024;
    const totalSize = file.size;

    const readChunk = (start, end) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Chunk konnte nicht gelesen werden'));
        reader.readAsDataURL(file.slice(start, end));
      });
    };

    const firstChunk = await readChunk(0, CHUNK_SIZE);
    const startResp = await this._proxyPost({ action: 'session-start', chunk: firstChunk, token });
    const sessionId = startResp.session_id;
    const sessionToken = startResp.token || token;
    let offset = CHUNK_SIZE;

    while (offset + CHUNK_SIZE < totalSize) {
      const chunk = await readChunk(offset, offset + CHUNK_SIZE);
      await this._proxyPost({ action: 'session-append', sessionId, offset, chunk, token: sessionToken });
      offset += CHUNK_SIZE;
    }

    const lastChunk = await readChunk(offset, totalSize);
    await this._proxyPost({ action: 'session-finish', sessionId, offset, dropboxPath, chunk: lastChunk, token: sessionToken });
  }

  async _proxyPost(body) {
    const resp = await fetch('/.netlify/functions/dropbox-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      let errObj = {};
      try { errObj = JSON.parse(errText); } catch (_) {}
      throw new Error(errObj.error || `Proxy-Fehler (${resp.status})`);
    }
    return resp.json();
  }

  async _loadExistingImages() {
    const listEl = document.getElementById('existing-images-list');
    const countEl = document.getElementById('existing-images-count');
    if (listEl) listEl.innerHTML = '<div class="existing-images-loading">Lade...</div>';

    try {
      const resp = await fetch('/.netlify/functions/dropbox-upload-bilder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list',
          unternehmen: this.metadaten.unternehmen || '',
          marke: this.metadaten.marke || '',
          kampagne: this.metadaten.kampagne || '',
          kooperation: this.metadaten.kooperationName || '',
        })
      });

      const data = await resp.json();
      this._existingImages = data.entries || [];

      if (countEl) countEl.textContent = `(${this._existingImages.length})`;

      if (!listEl) return;

      if (this._existingImages.length === 0) {
        listEl.innerHTML = '<div class="existing-images-empty">Keine Bilder vorhanden</div>';
        return;
      }

      listEl.innerHTML = this._existingImages.map(img => `
        <div class="existing-image-item">
          <div class="existing-image-info">
            <span class="existing-image-name">${this.escapeHtml(img.name)}</span>
            <span class="existing-image-size">${(img.size / 1024 / 1024).toFixed(1)} MB</span>
          </div>
          <button type="button" class="existing-image-delete" data-path="${this.escapeHtml(img.path)}" title="Löschen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
            </svg>
          </button>
        </div>
      `).join('');

    } catch (err) {
      console.error('Bilder laden fehlgeschlagen:', err);
      if (listEl) listEl.innerHTML = '<div class="existing-images-empty">Fehler beim Laden</div>';
    }
  }

  async _deleteExistingImage(filePath) {
    if (this._isUploadingImages) return;

    const item = document.querySelector(`.existing-image-delete[data-path="${CSS.escape(filePath)}"]`)?.closest('.existing-image-item');
    if (item) item.style.opacity = '0.5';

    try {
      const resp = await fetch('/.netlify/functions/dropbox-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Löschen fehlgeschlagen');
      }

      this._existingImages = this._existingImages.filter(img => img.path !== filePath);
      await this._loadExistingImages();

    } catch (err) {
      console.error('Bild löschen fehlgeschlagen:', err);
      this._showBilderError(err.message || 'Löschen fehlgeschlagen');
      if (item) item.style.opacity = '';
    }
  }

  _showBilderError(msg) {
    const el = document.getElementById('bilder-upload-error');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  _hideBilderError() {
    const el = document.getElementById('bilder-upload-error');
    if (el) el.style.display = 'none';
  }

  // ─── Shared Helpers ─────────────────────────────────────────

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
    if (this._isUploading || this._isUploadingImages) return;

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
