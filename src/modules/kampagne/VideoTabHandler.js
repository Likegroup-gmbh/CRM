import {
  buildVersionedFileName, MAX_VERSIONS,
  escapeHtml,
  MAX_VIDEO_SIZE,
  normalizeExternalUrl,
  isValidExternalUrl,
  mdcBtnIcon,
  ICON_PLUS_16,
  ICON_CHECK_16,
  ICON_UPLOAD_16
} from '../../core/VideoUploadUtils.js';
import { deleteSingleDropboxFile } from '../../core/VideoDeleteHelper.js';
import { backgroundUploadService, UPLOAD_EVENTS } from '../../core/BackgroundUploadService.js';

const DEBUG_UPLOAD = false;

export class VideoTabHandler {
  constructor(drawer) {
    this.drawer = drawer;
    this._queue = [];
    this._isUploading = false;
    this._existingVersions = [];
    this._existingAssets = [];
    this._onVideoDoneBound = (e) => this._onVideoDoneEvent(e);
  }

  get isUploading() { return this._isUploading; }

  async init() {
    this._existingVersions = await this._loadExistingVersions();
  }

  reset() {
    this._queue = [];
    this._isUploading = false;
    this._existingAssets = [];
    window.removeEventListener(UPLOAD_EVENTS.VIDEO_DONE, this._onVideoDoneBound);
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
    if (this.drawer.useExternalLinks) {
      return this._renderLinkTab(activeTab);
    }
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
            <button type="button" class="mdc-btn mdc-btn--create" id="video-upload-submit-btn" disabled>
              ${mdcBtnIcon(ICON_UPLOAD_16)}
              <span class="mdc-btn__label">Hochladen</span>
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

  _renderLinkTab(activeTab) {
    return `
      <div id="upload-tab-video" style="${activeTab !== 'video' ? 'display:none' : ''}">
        <div class="video-upload-drawer-content">
          <div class="link-add-section">
            <button type="button" class="mdc-btn upload-drawer-btn--secondary" id="video-link-add-btn">
              ${mdcBtnIcon(ICON_PLUS_16)}
              <span class="mdc-btn__label">Link hinzufügen</span>
            </button>
          </div>

          <div class="upload-file-list" id="video-upload-queue"></div>

          <div class="upload-error-msg" id="video-upload-error" style="display:none;"></div>

          <div class="drawer-footer video-upload-drawer-footer">
            <button type="button" class="mdc-btn mdc-btn--cancel" id="video-upload-cancel-btn">Abbrechen</button>
            <button type="button" class="mdc-btn mdc-btn--create" id="video-upload-submit-btn" disabled>
              ${mdcBtnIcon(ICON_CHECK_16)}
              <span class="mdc-btn__label">Speichern</span>
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

    cancelBtn?.addEventListener('click', () => this.drawer.close());
    submitBtn?.addEventListener('click', () => {
      if (this._queue.length > 0 && !this._isUploading) {
        if (this.drawer.useExternalLinks) {
          this._handleLinkSubmit();
        } else {
          this.handleUpload();
        }
      }
    });

    if (this.drawer.useExternalLinks) {
      const addLinkBtn = document.getElementById('video-link-add-btn');
      addLinkBtn?.addEventListener('click', () => this._addLinkEntry());
    } else {
      const dropzone = document.getElementById('video-upload-dropzone');
      const fileInput = document.getElementById('video-upload-file-input');
      const browseBtn = panel?.querySelector('#upload-tab-video .dropzone-browse-btn');

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
    }

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
      const urlInput = e.target.closest('.video-link-url-input');
      if (urlInput) {
        const idx = parseInt(urlInput.dataset.idx, 10);
        if (this._queue[idx]) {
          this._queue[idx].url = urlInput.value;
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
        return;
      }
      const replaceBtn = e.target.closest('.existing-video-replace');
      if (replaceBtn) {
        const { id, path, version, variant } = replaceBtn.dataset;
        if (id) this._replaceExistingAsset(id, path, parseInt(version, 10) || 1, variant || '');
      }
    });

    this._updateSubmitButtonState();
  }

  // ─── File Selection / Queue ────────────────────────────────

  _addFiles(files) {
    this.hideError();
    const maxSize = MAX_VIDEO_SIZE;
    const maxMB = Math.round(maxSize / (1024 * 1024));
    const allowed = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
    const rejected = [];

    for (const file of files) {
      if (file.size > maxSize) {
        rejected.push(`${file.name}: zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB, max. ${maxMB} MB)`);
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
      return;
    }

    if (this.drawer.useExternalLinks) {
      list.innerHTML = this._queue.map((item, i) => {
        const versionOptions = this._buildVersionOptions(item);
        return `
          <div class="upload-file-item video-queue-item">
            <div class="video-queue-variant" style="flex:1">
              <input type="url" class="form-input video-link-url-input" data-idx="${i}"
                value="${escapeHtml(item.url || '')}"
                placeholder="https://drive.google.com/..." />
            </div>
            <div class="video-queue-variant">
              <input type="text" class="form-input video-variant-name-input" data-idx="${i}"
                value="${escapeHtml(item.variantName)}"
                placeholder="Varianten-Name" maxlength="120"/>
            </div>
            <div class="video-queue-selects">
              <select class="form-input video-version-select" data-idx="${i}">${versionOptions}</select>
            </div>
            <button type="button" class="file-remove-btn video-file-remove" data-idx="${i}" title="Entfernen">&times;</button>
          </div>
        `;
      }).join('');
      return;
    }

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

  // ─── External Link Mode ────────────────────────────────────

  _addLinkEntry() {
    const defaultVersion = this._existingVersions.length > 0
      ? Math.max(...this._existingVersions)
      : 1;
    this._queue.push({ url: '', variantName: '', versionNumber: defaultVersion });
    this._renderQueue();
    this._updateSubmitButtonState();
    const list = document.getElementById('video-upload-queue');
    const lastInput = list?.querySelector(`.video-link-url-input[data-idx="${this._queue.length - 1}"]`);
    lastInput?.focus();
  }

  async _handleLinkSubmit() {
    if (this._queue.length === 0 || this._isUploading) return;
    this.hideError();

    const invalid = this._queue.filter(q => !isValidExternalUrl(normalizeExternalUrl(q.url)));
    if (invalid.length > 0) {
      this.showError('Bitte gültige URLs eingeben (https://...)');
      return;
    }

    this._isUploading = true;
    this._updateSubmitButtonState();

    try {
      let lastFileUrl = null;
      for (const item of this._queue) {
        const fileUrl = normalizeExternalUrl(item.url);
        await this._saveAssetVersion(fileUrl, null, item.variantName, item.versionNumber);
        lastFileUrl = fileUrl;
      }

      await this._updateCurrentFlags();

      const videoName = this.drawer.metadaten?.videoName || null;
      const updateData = { link_content: lastFileUrl };
      if (videoName) updateData.video_name = videoName;

      await window.supabase
        .from('kooperation_videos')
        .update(updateData)
        .eq('id', this.drawer.videoId);

      this._queue = [];
      this._renderQueue();
      this._isUploading = false;
      this._updateSubmitButtonState();

      if (typeof this.drawer.onSuccess === 'function') {
        this.drawer.onSuccess(lastFileUrl, null, videoName, null);
      }

      this._loadExistingVideoAssets();
      window.toastSystem?.success?.('Links gespeichert');
    } catch (err) {
      console.error('[VideoTabHandler] Link-Submit fehlgeschlagen:', err);
      this.showError(err.message || 'Speichern fehlgeschlagen');
      this._isUploading = false;
      this._updateSubmitButtonState();
    }
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
    const hasItems = this._queue.length > 0;
    const allVariantsNamed = this._queue.every(q => q.variantName.trim().length > 0);
    if (this.drawer.useExternalLinks) {
      const allUrlsFilled = this._queue.every(q => (q.url || '').trim().length > 0);
      submitBtn.disabled = this._isUploading || !hasItems || !allVariantsNamed || !allUrlsFilled;
    } else {
      submitBtn.disabled = !hasItems || !allVariantsNamed;
    }
  }

  // ─── Upload (Enqueue Background) ───────────────────────────

  async handleUpload() {
    if (this._queue.length === 0 || this._isUploading) return;

    // Re-Entry-Schutz: bereits laufender Job für diese videoId?
    const active = backgroundUploadService.getActiveJobsForVideo(this.drawer.videoId);
    if (active.length > 0) {
      this.showError('Für dieses Video läuft bereits ein Upload im Hintergrund.');
      return;
    }

    this.hideError();

    const videoName = this.drawer.metadaten?.videoName || null;
    const queueSnapshot = this._queue.map(q => ({
      file: q.file,
      variantName: q.variantName,
      versionNumber: q.versionNumber,
    }));

    // Listener für Abschluss-Event (nur Refresh wenn Drawer noch offen)
    window.removeEventListener(UPLOAD_EVENTS.VIDEO_DONE, this._onVideoDoneBound);
    window.addEventListener(UPLOAD_EVENTS.VIDEO_DONE, this._onVideoDoneBound);

    const jobId = backgroundUploadService.enqueueVideoJob({
      videoId: this.drawer.videoId,
      metadaten: this.drawer.metadaten,
      queue: queueSnapshot,
      videoName,
    });

    // Queue lokal leeren — der Job ist jetzt der "Source of Truth"
    this._queue = [];
    this._renderQueue();
    this._updateSubmitButtonState();

    return jobId;
  }

  _onVideoDoneEvent(e) {
    const { videoId } = e.detail || {};
    if (videoId !== this.drawer.videoId) return;
    // Drawer noch offen? Asset-Liste refreshen
    if (document.getElementById('existing-videos-list')) {
      this._loadExistingVideoAssets();
    }
    if (typeof this.drawer.onSuccess === 'function') {
      this.drawer.onSuccess(e.detail?.result?.lastFileUrl || null, null,
        e.detail?.result?.videoName || null, e.detail?.result?.folderUrl || null);
    }
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
    const TRASH_ICON = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>';
    const REPLACE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.016 4.36v4.992"/></svg>';

    let html = '';
    for (const round of rounds) {
      const assets = grouped[round];
      const isCurrent = round === maxRound;
      const badge = isCurrent ? ' <span class="version-badge version-badge--current">aktuell</span>' : '';

      html += `
        <div class="existing-storys-slot-item">
          <div class="existing-storys-slot-header">
            <span class="existing-storys-slot-title">Feedbackschleife ${round}${badge}</span>
            <span class="existing-storys-slot-meta">${assets.length} Datei${assets.length !== 1 ? 'en' : ''}</span>
          </div>
        </div>`;

      for (const asset of assets) {
        const name = asset.variant_name || asset.file_path?.split('/').pop() || '?';
        const date = asset.created_at ? new Date(asset.created_at).toLocaleDateString('de-DE') : '';
        const currentBadge = asset.is_current ? ' <span class="version-badge version-badge--current">aktuell</span>' : '';
        html += `
          <div class="existing-image-item existing-storys-asset-item">
            <div class="existing-image-info">
              <span class="existing-image-name">${escapeHtml(name)}${date ? ` · ${date}` : ''} · FS${asset.version_number}${currentBadge}</span>
            </div>
            <div class="existing-asset-actions">
              <button type="button" class="existing-video-replace" data-id="${asset.id}" data-path="${escapeHtml(asset.file_path || '')}" data-version="${asset.version_number}" data-variant="${escapeHtml(asset.variant_name || '')}" title="Ersetzen">${REPLACE_ICON}</button>
              <button type="button" class="existing-image-delete existing-video-delete" data-id="${asset.id}" data-path="${escapeHtml(asset.file_path || '')}" title="Löschen">${TRASH_ICON}</button>
            </div>
          </div>`;
      }
    }

    listEl.innerHTML = html;
  }

  async _deleteExistingAsset(assetId, filePath) {
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

  // ─── Replace Existing Asset ────────────────────────────────

  async _replaceExistingAsset(assetId, oldFilePath, versionNumber, variantName) {
    const fileInput = document.getElementById('video-upload-file-input');
    if (!fileInput) return;

    const onFileSelected = (e) => {
      fileInput.removeEventListener('change', onFileSelected);
      const file = e.target.files?.[0];
      fileInput.value = '';
      if (!file) return;

      const maxSize = MAX_VIDEO_SIZE;
      const maxMB = Math.round(maxSize / (1024 * 1024));
      const allowed = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
      if (file.size > maxSize) {
        this.showError(`${file.name}: zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB, max. ${maxMB} MB)`);
        return;
      }
      if (!allowed.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
        this.showError(`${file.name}: kein unterstütztes Videoformat`);
        return;
      }

      const itemEl = document.querySelector(`.existing-video-replace[data-id="${assetId}"]`)?.closest('.existing-image-item');
      if (itemEl) itemEl.style.opacity = '0.5';

      // Listener für Abschluss (Refresh Asset-Liste)
      window.removeEventListener(UPLOAD_EVENTS.VIDEO_DONE, this._onVideoDoneBound);
      window.addEventListener(UPLOAD_EVENTS.VIDEO_DONE, this._onVideoDoneBound);

      backgroundUploadService.enqueueVideoReplaceJob({
        videoId: this.drawer.videoId,
        metadaten: this.drawer.metadaten,
        file,
        assetId,
        oldFilePath,
        versionNumber,
        variantName,
      });
    };

    fileInput.addEventListener('change', onFileSelected);
    fileInput.click();
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
