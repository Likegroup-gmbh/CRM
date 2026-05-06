import {
  buildVersionedFileName, MAX_VERSIONS,
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
    this._existingAssets = [];
    this._proxyToken = null;
  }

  get isUploading() { return this._isUploading; }

  async init() {
    this._existingVersions = await this._loadExistingVersions();
  }

  reset() {
    this._queue = [];
    this._isUploading = false;
    this._existingAssets = [];
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

  _buildVersionOptions(item) {
    const allVersions = Array.from({ length: MAX_VERSIONS }, (_, i) => i + 1);
    return allVersions.map(v => {
      const exists = this._existingVersions.includes(v);
      const label = exists ? `Feedbackschleife ${v} (hinzufügen)` : `Feedbackschleife ${v}`;
      const selected = v === item.versionNumber ? ' selected' : '';
      return `<option value="${v}"${selected}>${label}</option>`;
    }).join('');
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

          <div class="existing-images-section" id="existing-videos-section">
            <div class="existing-images-header">
              <span class="existing-images-title">Vorhandene Videos</span>
              <span class="existing-images-count" id="existing-videos-count"></span>
            </div>
            <div class="existing-images-list" id="existing-videos-list">
              <div class="existing-images-loading">Lade...</div>
            </div>
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

    cancelBtn?.addEventListener('click', () => this.drawer.close());
    submitBtn?.addEventListener('click', () => {
      if (this._queue.length > 0 && !this._isUploading) this.handleUpload();
    });

    browseBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files?.length) this._addFiles(Array.from(e.target.files));
      fileInput.value = '';
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
    queueEl?.addEventListener('change', (e) => {
      const versionSelect = e.target.closest('.video-version-select');
      if (versionSelect) {
        const idx = parseInt(versionSelect.dataset.idx, 10);
        if (this._queue[idx]) {
          this._queue[idx].versionNumber = parseInt(versionSelect.value, 10);
        }
      }
    });

    const existingList = document.getElementById('existing-videos-list');
    existingList?.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.existing-video-delete');
      if (deleteBtn) {
        const assetId = deleteBtn.dataset.id;
        const filePath = deleteBtn.dataset.path;
        if (assetId) this._deleteExistingAsset(assetId, filePath);
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
        const defaultVersion = this._existingVersions.length > 0
          ? Math.max(...this._existingVersions)
          : 1;
        this._queue.push({ file, variantName: '', versionNumber: defaultVersion });
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

    list.innerHTML = this._queue.map((item, i) => {
      const versionOptions = this._buildVersionOptions(item);
      return `
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
          <div class="video-queue-selects">
            <select class="form-input video-version-select" data-idx="${i}">${versionOptions}</select>
          </div>
          <button type="button" class="file-remove-btn video-file-remove" data-idx="${i}" title="Entfernen">&times;</button>
        </div>
      `;
    }).join('');
  }

  _getVersionedFileName(file, versionNumber) {
    const ext = file.name.split('.').pop() || 'mp4';
    return buildVersionedFileName(
      this.drawer.metadaten?.creatorName || '',
      this.drawer.metadaten?.unternehmen || '',
      this.drawer.metadaten?.kampagne || '',
      versionNumber,
      ext
    );
  }

  _updateSubmitButtonState() {
    const submitBtn = document.getElementById('video-upload-submit-btn');
    if (!submitBtn) return;
    const hasFiles = this._queue.length > 0;
    const allVariantsNamed = this._queue.every(q => q.variantName.trim().length > 0);
    submitBtn.disabled = this._isUploading || !hasFiles || !allVariantsNamed;
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

    const videoName = this.drawer.metadaten?.videoName || null;
    const total = this._queue.length;
    let lastFileUrl = null;
    let folderUrl = null;

    try {
      for (let i = 0; i < this._queue.length; i++) {
        const item = this._queue[i];
        const file = item.file;
        const variantName = item.variantName.trim();
        const versionNumber = String(item.versionNumber || 1);
        const fileName = this._getVersionedFileName(file, item.versionNumber);

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

      const updateData = {};
      if (videoName) updateData.video_name = videoName;
      if (lastFileUrl) updateData.link_content = lastFileUrl;
      if (folderUrl) updateData.folder_url = folderUrl;

      await window.supabase
        .from('kooperation_videos')
        .update(updateData)
        .eq('id', this.drawer.videoId);

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = `${total} Video${total !== 1 ? 's' : ''} hochgeladen!`;
      this._isUploading = false;
      this._queue = [];
      this._renderQueue();

      await this._loadExistingVideoAssets();

      if (typeof this.drawer.onSuccess === 'function') {
        this.drawer.onSuccess(lastFileUrl, null, videoName, folderUrl);
      }

      setTimeout(() => {
        if (submitBtn) submitBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = false;
        if (progressContainer) progressContainer.style.display = 'none';
      }, 1500);

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

  async saveAssetVersion(fileUrl, filePath, videoName, folderUrl, versionNumber = 1) {
    await this._saveAssetVersion(fileUrl, filePath, null, versionNumber);
    await this._updateCurrentFlags();

    const updateData = { link_content: fileUrl, video_name: videoName || null };
    if (folderUrl) updateData.folder_url = folderUrl;

    await window.supabase
      .from('kooperation_videos')
      .update(updateData)
      .eq('id', this.drawer.videoId);
  }

  // ─── Existing Videos ──────────────────────────────────────

  async _loadExistingVideoAssets() {
    const listEl = document.getElementById('existing-videos-list');
    const countEl = document.getElementById('existing-videos-count');
    if (listEl) listEl.innerHTML = '<div class="existing-images-loading">Lade...</div>';

    try {
      if (!this.drawer.videoId) {
        this._existingAssets = [];
        if (countEl) countEl.textContent = '(0)';
        if (listEl) listEl.innerHTML = '<div class="existing-images-empty">Keine Videos vorhanden</div>';
        return;
      }

      const { data, error } = await window.supabase
        .from('kooperation_video_asset')
        .select('id, file_url, file_path, version_number, variant_name, is_current, created_at')
        .eq('video_id', this.drawer.videoId)
        .order('version_number', { ascending: true });

      if (error) throw error;
      this._existingAssets = data || [];
      this._existingVersions = [...new Set(this._existingAssets.map(a => a.version_number).filter(v => typeof v === 'number'))];

      if (countEl) countEl.textContent = `(${this._existingAssets.length})`;
      this._renderExistingVideos();
    } catch (err) {
      console.error('[VideoTabHandler] _loadExistingVideoAssets:', err);
      if (listEl) listEl.innerHTML = '<div class="existing-images-empty">Fehler beim Laden</div>';
    }
  }

  _renderExistingVideos() {
    const listEl = document.getElementById('existing-videos-list');
    if (!listEl) return;

    if (!this._existingAssets || this._existingAssets.length === 0) {
      listEl.innerHTML = '<div class="existing-images-empty">Keine Videos vorhanden</div>';
      return;
    }

    const grouped = {};
    for (const asset of this._existingAssets) {
      const v = asset.version_number || 1;
      if (!grouped[v]) grouped[v] = [];
      grouped[v].push(asset);
    }

    const rounds = Object.keys(grouped).map(Number).sort((a, b) => a - b);
    const maxRound = Math.max(...rounds);

    let html = '';
    for (const round of rounds) {
      const assets = grouped[round];
      const isCurrent = round === maxRound;
      const badge = isCurrent ? ' <span class="version-badge version-badge--current">aktuell</span>' : '';

      html += `<div class="existing-videos-round-header">Feedbackschleife ${round}${badge} <span class="existing-images-count">(${assets.length})</span></div>`;

      for (const asset of assets) {
        const name = asset.variant_name || asset.file_path?.split('/').pop() || '?';
        const date = asset.created_at ? new Date(asset.created_at).toLocaleDateString('de-DE') : '';
        html += `
          <div class="existing-image-item">
            <div class="existing-image-info">
              <span class="existing-image-name">${escapeHtml(name)}${date ? ` · ${date}` : ''}</span>
            </div>
            <button type="button" class="existing-image-delete existing-video-delete" data-id="${asset.id}" data-path="${escapeHtml(asset.file_path || '')}" title="Löschen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
              </svg>
            </button>
          </div>`;
      }
    }

    listEl.innerHTML = html;
  }

  async _deleteExistingAsset(assetId, filePath) {
    if (this._isUploading) return;

    const item = document.querySelector(`.existing-video-delete[data-id="${assetId}"]`)?.closest('.existing-image-item');
    if (item) item.style.opacity = '0.5';

    try {
      if (filePath) {
        await fetch('/.netlify/functions/dropbox-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath }),
        }).catch(err => console.warn('Dropbox-Löschung fehlgeschlagen:', err));
      }

      await window.supabase
        .from('kooperation_video_asset')
        .delete()
        .eq('id', assetId);

      await this._loadExistingVideoAssets();
    } catch (err) {
      console.error('Video-Asset löschen fehlgeschlagen:', err);
      this.showError(err.message || 'Löschen fehlgeschlagen');
      if (item) item.style.opacity = '';
    }
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
