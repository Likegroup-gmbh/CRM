import {
  getAvailableVersions, buildVersionedFileName, MAX_VERSIONS,
  escapeHtml, proxyPost, createFolderSharedLink
} from '../../core/VideoUploadUtils.js';
import { deleteSingleDropboxFile } from '../../core/VideoDeleteHelper.js';

const DEBUG_UPLOAD = true;

export class VideoTabHandler {
  constructor(drawer) {
    this.drawer = drawer;
    this._queue = [];
    this._isUploading = false;
    this._existingVersions = [];
    this._availableVersions = [];
    this._selectedVersion = null;
    this._proxyToken = null;
  }

  get isUploading() { return this._isUploading; }

  async init() {
    this._existingVersions = await this._loadExistingVersions();
    this._availableVersions = getAvailableVersions(this._existingVersions, MAX_VERSIONS);
    this._selectedVersion = this._availableVersions[0] || 1;
  }

  reset() {
    this._queue = [];
    this._isUploading = false;
    this._proxyToken = null;
  }

  async _loadExistingVersions() {
    if (!this.drawer.videoId) return [];
    try {
      const { data, error } = await window.supabase
        .from('kooperation_video_asset')
        .select('version_number')
        .eq('video_id', this.drawer.videoId);
      if (error) return [];
      return [...new Set((data || []).map(a => a.version_number).filter(v => typeof v === 'number'))];
    } catch (err) {
      console.error('[VideoTabHandler] _loadExistingVersions:', err);
      return [];
    }
  }

  // ─── Render ────────────────────────────────────────────────

  _renderVersionSection() {
    const allVersions = Array.from({ length: MAX_VERSIONS }, (_, i) => i + 1);
    const options = allVersions
      .map(v => {
        const exists = this._existingVersions.includes(v);
        const label = exists ? `Feedbackschleife ${v} (hinzufügen)` : `Feedbackschleife ${v}`;
        const selected = v === this._selectedVersion ? ' selected' : '';
        return `<option value="${v}"${selected}>${label}</option>`;
      })
      .join('');

    return `
      <div class="video-settings-section">
        <label class="video-settings-label" for="video-upload-version">Feedbackschleife</label>
        <select id="video-upload-version" class="form-input">${options}</select>
      </div>
    `;
  }

  renderTab(activeTab) {
    return `
      <div id="upload-tab-video" style="${activeTab !== 'video' ? 'display:none' : ''}">
        <div class="video-upload-drawer-content">
          <div class="upload-dropzone" id="video-upload-dropzone">
            <div class="dropzone-content">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="40" height="40" class="upload-dropzone-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
              </svg>
              <p class="dropzone-text">Videos hierher ziehen oder <button type="button" class="dropzone-browse-btn">Dateien auswählen</button></p>
              <p class="dropzone-hint">MP4, MOV, AVI, MKV – max. 500 MB pro Datei</p>
            </div>
            <input type="file" id="video-upload-file-input" accept="video/*,.mp4,.mov,.avi,.mkv,.webm" multiple style="display:none"/>
          </div>

          <div class="upload-file-list" id="video-upload-queue"></div>

          <div class="upload-progress-container" id="video-upload-progress" style="display:none;">
            <div class="upload-progress-bar">
              <div class="upload-progress-fill" id="video-upload-progress-fill" style="width:0%"></div>
            </div>
            <div class="upload-progress-text" id="video-upload-progress-text">Wird hochgeladen... 0%</div>
          </div>

          ${this._renderVersionSection()}

          <div class="video-settings-section video-upload-name-field">
            <label class="video-settings-label" for="video-upload-name">Video-Name</label>
            <input type="text" id="video-upload-name" class="form-input video-upload-name-input" value="${escapeHtml(this.drawer.metadaten?.videoName || '')}" placeholder="Video-Name" maxlength="255"/>
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

  // ─── Events ────────────────────────────────────────────────

  bindEvents(panel) {
    const cancelBtn = document.getElementById('video-upload-cancel-btn');
    const submitBtn = document.getElementById('video-upload-submit-btn');
    const dropzone = document.getElementById('video-upload-dropzone');
    const fileInput = document.getElementById('video-upload-file-input');
    const browseBtn = panel?.querySelector('#upload-tab-video .dropzone-browse-btn');
    const nameInput = document.getElementById('video-upload-name');
    const versionSelect = document.getElementById('video-upload-version');

    cancelBtn?.addEventListener('click', () => this.drawer.close());
    submitBtn?.addEventListener('click', () => {
      if (this._queue.length > 0 && !this._isUploading) this.handleUpload();
    });

    browseBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files?.length) this._addFiles(Array.from(e.target.files));
      fileInput.value = '';
    });
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
      const files = e.dataTransfer.files;
      if (files?.length) this._addFiles(Array.from(files));
    });

    const queueEl = document.getElementById('video-upload-queue');
    queueEl?.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.video-file-remove');
      if (removeBtn) {
        const idx = parseInt(removeBtn.dataset.idx, 10);
        this._removeQueueItem(idx);
      }
    });
    queueEl?.addEventListener('input', (e) => {
      const variantInput = e.target.closest('.video-variant-name-input');
      if (variantInput) {
        const idx = parseInt(variantInput.dataset.idx, 10);
        if (this._queue[idx]) {
          this._queue[idx].variantName = variantInput.value;
        }
        this._updateSubmitButtonState();
      }
    });

    this._updateSubmitButtonState();
  }

  // ─── File Selection / Queue ────────────────────────────────

  _addFiles(files) {
    this.hideError();
    const maxSize = 500 * 1024 * 1024;
    const allowed = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
    const rejected = [];

    for (const file of files) {
      if (file.size > maxSize) {
        rejected.push(`${file.name}: zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB, max. 500 MB)`);
        continue;
      }
      if (!allowed.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
        rejected.push(`${file.name}: kein unterstütztes Videoformat`);
        continue;
      }
      const alreadyQueued = this._queue.some(q => q.file.name === file.name && q.file.size === file.size);
      if (!alreadyQueued) {
        this._queue.push({ file, variantName: '' });
      }
    }

    if (rejected.length) this.showError(rejected.join('\n'));
    this._renderQueue();
    this._updateSubmitButtonState();
  }

  _removeQueueItem(idx) {
    this._queue.splice(idx, 1);
    this._renderQueue();
    this._updateSubmitButtonState();
  }

  _renderQueue() {
    const list = document.getElementById('video-upload-queue');
    if (!list) return;

    if (this._queue.length === 0) {
      list.innerHTML = '';
      const dropzone = document.getElementById('video-upload-dropzone');
      if (dropzone) dropzone.style.display = '';
      return;
    }

    const dropzone = document.getElementById('video-upload-dropzone');
    if (dropzone) dropzone.style.display = 'none';

    list.innerHTML = this._queue.map((item, i) => `
      <div class="upload-file-item video-queue-item">
        <div class="file-info">
          <span class="file-name">${escapeHtml(item.file.name)}</span>
          <span class="file-size">${(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
        </div>
        <div class="video-queue-variant">
          <input type="text" class="form-input video-variant-name-input" data-idx="${i}"
            value="${escapeHtml(item.variantName)}"
            placeholder="Varianten-Name (z.B. Voice-Over Berlin)" maxlength="120"/>
        </div>
        <button type="button" class="file-remove-btn video-file-remove" data-idx="${i}" title="Entfernen">&times;</button>
      </div>
    `).join('');
  }

  _getVersionedFileName(file, variantName) {
    const ext = file.name.split('.').pop() || 'mp4';
    return buildVersionedFileName(
      this.drawer.metadaten?.creatorName || '',
      this.drawer.metadaten?.unternehmen || '',
      this.drawer.metadaten?.kampagne || '',
      this._selectedVersion,
      ext
    );
  }

  _updateSubmitButtonState() {
    const submitBtn = document.getElementById('video-upload-submit-btn');
    const nameInput = document.getElementById('video-upload-name');
    if (!submitBtn) return;
    const hasFiles = this._queue.length > 0;
    const hasVideoName = Boolean(nameInput?.value?.trim());
    const allVariantsNamed = this._queue.every(q => q.variantName.trim().length > 0);
    submitBtn.disabled = this._isUploading || !hasFiles || !hasVideoName || !allVariantsNamed;
  }

  // ─── Upload ────────────────────────────────────────────────

  async handleUpload() {
    if (this._queue.length === 0 || this._isUploading) return;
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
    const total = this._queue.length;
    let lastFileUrl = null;
    let folderUrl = null;

    try {
      for (let i = 0; i < this._queue.length; i++) {
        const item = this._queue[i];
        const file = item.file;
        const variantName = item.variantName.trim();
        const fileName = this._getVersionedFileName(file, variantName);

        const pct = Math.round((i / total) * 85);
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (progressText) progressText.textContent = `Lade hoch... ${i + 1}/${total}: ${file.name}`;

        const tokenResp = await fetch('/.netlify/functions/dropbox-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unternehmen: this.drawer.metadaten.unternehmen || '',
            marke: this.drawer.metadaten.marke || '',
            kampagne: this.drawer.metadaten.kampagne || '',
            kooperation: this.drawer.metadaten.kooperationName || '',
            videoPosition: this.drawer.metadaten.videoPosition || 1,
            videoThema: this.drawer.metadaten.videoThema || '',
            videoTitel: this.drawer.metadaten.videoTitel || 'Video',
            versionNumber,
            variantName,
            fileName
          })
        });

        if (!tokenResp.ok) {
          const errData = await tokenResp.json().catch(() => ({}));
          throw new Error(errData.error || `Token-Abruf fehlgeschlagen (${tokenResp.status})`);
        }

        const { token, dropboxPath, kooperationFolderPath } = await tokenResp.json();

        const uploadResult = await this._uploadToDropbox(token, dropboxPath, file, progressFill, progressText, i, total);

        const actualPath = uploadResult.path_display || dropboxPath;
        const sharedLink = await this._createSharedLink(token, actualPath);
        if (!folderUrl) {
          folderUrl = await createFolderSharedLink(this._proxyToken || token, kooperationFolderPath);
        }

        const fileUrl = sharedLink || actualPath;
        lastFileUrl = fileUrl;

        await this._saveAssetVersion(fileUrl, actualPath, variantName, versionNumber);
      }

      if (progressFill) progressFill.style.width = '95%';
      if (progressText) progressText.textContent = 'Speichere in Datenbank...';

      await this._updateCurrentFlags();

      const updateData = { video_name: videoName || null };
      if (lastFileUrl) updateData.link_content = lastFileUrl;
      if (folderUrl) updateData.folder_url = folderUrl;

      await window.supabase
        .from('kooperation_videos')
        .update(updateData)
        .eq('id', this.drawer.videoId);

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = `${total} Video${total !== 1 ? 's' : ''} hochgeladen!`;
      this._isUploading = false;

      if (typeof this.drawer.onSuccess === 'function') {
        this.drawer.onSuccess(lastFileUrl, null, videoName, folderUrl);
      }

      setTimeout(() => this.drawer.close(), 800);

    } catch (err) {
      console.error('Video-Upload fehlgeschlagen:', err);
      this.showError(err.message || 'Upload fehlgeschlagen');
      if (submitBtn) submitBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      this._isUploading = false;
    }
  }

  async _uploadToDropbox(token, dropboxPath, file, progressFill, progressText, fileIdx, totalFiles) {
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

    const proxyPostLocal = async (body) => {
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

    const baseProgress = (fileIdx / totalFiles) * 85;
    const fileWeight = 85 / totalFiles;

    if (totalSize <= CHUNK_SIZE) {
      if (progressFill) progressFill.style.width = `${baseProgress + fileWeight * 0.5}%`;
      const chunk = await readChunkAsBase64(0, totalSize);
      const result = await proxyPostLocal({ action: 'upload-small', dropboxPath, chunk });
      if (progressFill) progressFill.style.width = `${baseProgress + fileWeight}%`;
      return result;
    }

    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    let offset = 0;

    const firstChunk = await readChunkAsBase64(0, CHUNK_SIZE);
    if (progressText) progressText.textContent = `Lade hoch... ${fileIdx + 1}/${totalFiles}: ${file.name} (1/${totalChunks})`;
    const startResp = await proxyPostLocal({ action: 'session-start', chunk: firstChunk });
    const { session_id } = startResp;
    this._proxyToken = startResp.token;
    offset = CHUNK_SIZE;

    let chunkIdx = 2;
    while (offset + CHUNK_SIZE < totalSize) {
      const chunk = await readChunkAsBase64(offset, offset + CHUNK_SIZE);
      const chunkPct = baseProgress + (offset / totalSize) * fileWeight;
      if (progressFill) progressFill.style.width = `${chunkPct}%`;
      if (progressText) progressText.textContent = `Lade hoch... ${fileIdx + 1}/${totalFiles}: ${file.name} (${chunkIdx}/${totalChunks})`;
      await proxyPostLocal({ action: 'session-append', sessionId: session_id, offset, chunk, token: this._proxyToken });
      offset += CHUNK_SIZE;
      chunkIdx++;
    }

    const lastChunk = await readChunkAsBase64(offset, totalSize);
    if (progressFill) progressFill.style.width = `${baseProgress + fileWeight * 0.95}%`;
    if (progressText) progressText.textContent = `Lade hoch... ${fileIdx + 1}/${totalFiles}: ${file.name} (${totalChunks}/${totalChunks})`;
    const result = await proxyPostLocal({ action: 'session-finish', sessionId: session_id, offset, dropboxPath, chunk: lastChunk, token: this._proxyToken });
    if (progressFill) progressFill.style.width = `${baseProgress + fileWeight}%`;
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

  // ─── DB ────────────────────────────────────────────────────

  async _saveAssetVersion(fileUrl, filePath, variantName, versionNumber) {
    const version = parseInt(versionNumber, 10) || 1;

    const { error } = await window.supabase
      .from('kooperation_video_asset')
      .insert({
        video_id: this.drawer.videoId,
        file_url: fileUrl,
        file_path: filePath,
        version_number: version,
        variant_name: variantName || null,
        is_current: true,
        description: null,
        uploaded_by: window.currentUser?.id || null,
        created_at: new Date().toISOString()
      });
    if (error) throw error;
  }

  async _updateCurrentFlags() {
    const { data: allAssets } = await window.supabase
      .from('kooperation_video_asset')
      .select('id, version_number')
      .eq('video_id', this.drawer.videoId);

    if (!allAssets || allAssets.length === 0) return;

    const maxVersion = Math.max(...allAssets.map(a => a.version_number));

    const nonCurrentIds = allAssets.filter(a => a.version_number !== maxVersion).map(a => a.id);
    const currentIds = allAssets.filter(a => a.version_number === maxVersion).map(a => a.id);

    if (nonCurrentIds.length > 0) {
      await window.supabase
        .from('kooperation_video_asset')
        .update({ is_current: false })
        .in('id', nonCurrentIds);
    }
    if (currentIds.length > 0) {
      await window.supabase
        .from('kooperation_video_asset')
        .update({ is_current: true })
        .in('id', currentIds);
    }
  }

  async saveAssetVersion(fileUrl, filePath, videoName, folderUrl) {
    await this._saveAssetVersion(fileUrl, filePath, null, this._selectedVersion);
    await this._updateCurrentFlags();

    const updateData = { link_content: fileUrl, video_name: videoName || null };
    if (folderUrl) updateData.folder_url = folderUrl;

    await window.supabase
      .from('kooperation_videos')
      .update(updateData)
      .eq('id', this.drawer.videoId);
  }

  // ─── Error Helpers ─────────────────────────────────────────

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
}
