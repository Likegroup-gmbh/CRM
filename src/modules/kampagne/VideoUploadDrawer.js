// VideoUploadDrawer.js
// Drawer zum Upload von Videos nach Dropbox (Netlify Function)
// Nutzt bestehendes Drawer-Pattern (overlay + panel + header + body)

export class VideoUploadDrawer {
  constructor() {
    this.drawerId = 'video-upload-drawer';
    this.videoId = null;
    this.kooperationId = null;
    this.metadaten = null;
    this.onSuccess = null;
    this._selectedFile = null;
    this._isUploading = false;
  }

  /**
   * @param {string} videoId - ID des kooperation_videos Eintrags
   * @param {object} metadaten - { kooperationId, kooperationName, videoTitel, unternehmen, marke, kampagne }
   * @param {function} onSuccess - Callback nach erfolgreichem Upload (fileUrl, filePath)
   */
  open(videoId, metadaten, onSuccess) {
    this.videoId = videoId;
    this.kooperationId = metadaten.kooperationId;
    this.metadaten = metadaten;
    this.onSuccess = onSuccess;
    this._selectedFile = null;
    this._isUploading = false;

    this.createDrawer();
    this.renderForm();
    this.bindEvents();
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

    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = this.metadaten.videoTitel || 'Datei nach Dropbox hochladen';

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

  renderForm() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const pfadSegmente = [
      this.metadaten.unternehmen,
      this.metadaten.marke,
      this.metadaten.kampagne,
      this.metadaten.kooperationName
    ].filter(Boolean);

    body.innerHTML = `
      <div class="video-upload-drawer-content">
        <div class="dropbox-path-info">
          <span class="label">Dropbox-Pfad:</span>
          <span class="path">Videos/${pfadSegmente.join('/')}/</span>
        </div>

        <div class="upload-dropzone" id="video-upload-dropzone">
          <div class="dropzone-content">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="40" height="40" style="color:#6b7280;">
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

        <div class="upload-description-field">
          <label for="video-upload-description">Beschreibung (optional)</label>
          <input type="text" id="video-upload-description" class="grid-input" placeholder="z.B. Version 2, mit Musik"/>
        </div>

        <div class="upload-progress-container" id="video-upload-progress" style="display:none;">
          <div class="upload-progress-bar">
            <div class="upload-progress-fill" id="video-upload-progress-fill" style="width:0%"></div>
          </div>
          <div class="upload-progress-text" id="video-upload-progress-text">Wird hochgeladen... 0%</div>
        </div>

        <div class="upload-error-msg" id="video-upload-error" style="display:none;"></div>

        <div class="drawer-footer" style="padding:16px 0 0;">
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
    const submitBtn = document.getElementById('video-upload-submit-btn');

    if (dropzone) dropzone.style.display = 'none';
    if (preview) preview.style.display = 'flex';
    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB`;
    if (submitBtn) submitBtn.disabled = false;
  }

  clearFile() {
    this._selectedFile = null;
    const dropzone = document.getElementById('video-upload-dropzone');
    const preview = document.getElementById('video-upload-preview');
    const submitBtn = document.getElementById('video-upload-submit-btn');
    const fileInput = document.getElementById('video-upload-file-input');

    if (dropzone) dropzone.style.display = '';
    if (preview) preview.style.display = 'none';
    if (submitBtn) submitBtn.disabled = true;
    if (fileInput) fileInput.value = '';
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

    const formData = new FormData();
    formData.append('file', this._selectedFile);
    formData.append('unternehmen', this.metadaten.unternehmen || '');
    formData.append('marke', this.metadaten.marke || '');
    formData.append('kampagne', this.metadaten.kampagne || '');
    formData.append('kooperation', this.metadaten.kooperationName || '');
    formData.append('videoTitel', this.metadaten.videoTitel || 'Video');
    formData.append('versionNumber', '1');

    const description = document.getElementById('video-upload-description')?.value || '';

    try {
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/.netlify/functions/dropbox-upload');

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            if (progressFill) progressFill.style.width = `${pct}%`;
            if (progressText) progressText.textContent = `Wird hochgeladen... ${pct}%`;
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch { reject(new Error('Ungültige Server-Antwort')); }
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error || `Upload fehlgeschlagen (${xhr.status})`));
            } catch { reject(new Error(`Upload fehlgeschlagen (${xhr.status})`)); }
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Netzwerkfehler beim Upload')));
        xhr.addEventListener('timeout', () => reject(new Error('Upload Timeout')));
        xhr.timeout = 300000;
        xhr.send(formData);
      });

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = 'Speichere in Datenbank...';

      await this.saveAssetVersion(result.shared_link || result.path, result.path, description);

      if (progressText) progressText.textContent = 'Upload abgeschlossen!';

      const fileUrl = result.shared_link || result.path;
      if (typeof this.onSuccess === 'function') {
        this.onSuccess(fileUrl, result.path);
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

  async saveAssetVersion(fileUrl, filePath, description) {
    // Alte Versionen als nicht-aktuell markieren
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
        version_number: 1,
        is_current: true,
        description: description || null,
        uploaded_by: window.currentUser?.id || null,
        created_at: new Date().toISOString()
      });
    if (error) throw error;

    // Auch file_url im Video selbst setzen
    await window.supabase
      .from('kooperation_videos')
      .update({ file_url: fileUrl, link_content: fileUrl })
      .eq('id', this.videoId);
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
