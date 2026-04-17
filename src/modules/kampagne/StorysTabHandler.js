import {
  getAvailableVersions, MAX_VERSIONS,
  escapeHtml, readFileAsBase64, proxyPost, uploadLargeFile, createFolderSharedLink,
  VIDEO_EXTENSIONS, VIDEO_MIME_TYPES, MAX_STORY_SIZE
} from '../../core/VideoUploadUtils.js';

export class StorysTabHandler {
  constructor(drawer) {
    this.drawer = drawer;
    this._selectedStorys = [];
    this._existingStorys = [];
    this._isUploadingStorys = false;
    this._storyExistingVersions = [];
    this._storyAvailableVersions = [];
    this._selectedStoryVersion = null;
    this._initialized = false;
  }

  get isUploading() { return this._isUploadingStorys; }

  async init() {
    this._storyExistingVersions = await this._loadExistingStoryVersions();
    this._storyAvailableVersions = getAvailableVersions(this._storyExistingVersions, MAX_VERSIONS);
    this._selectedStoryVersion = this._storyAvailableVersions[0] || 1;
    this._initialized = true;
  }

  async ensureInitialized() {
    if (!this._initialized) await this.init();
  }

  reset() {
    this._selectedStorys = [];
    this._existingStorys = [];
    this._isUploadingStorys = false;
    this._storyExistingVersions = [];
    this._storyAvailableVersions = [];
    this._selectedStoryVersion = null;
    this._initialized = false;
  }

  async _loadExistingStoryVersions() {
    if (!this.drawer.videoId) return [];
    try {
      const { data, error } = await window.supabase
        .from('kooperation_story_asset')
        .select('version_number')
        .eq('video_id', this.drawer.videoId);
      if (error) return [];
      return [...new Set((data || []).map(a => a.version_number).filter(v => typeof v === 'number'))];
    } catch (err) {
      console.error('[StorysTabHandler] _loadExistingStoryVersions:', err);
      return [];
    }
  }

  // ─── Render ────────────────────────────────────────────────

  _renderStoryVersionSection() {
    const allVersions = Array.from({ length: MAX_VERSIONS }, (_, i) => i + 1);
    const options = allVersions
      .map(v => {
        const exists = !this._storyAvailableVersions.includes(v);
        const label = exists ? `Version ${v} (ersetzen)` : `Version ${v}`;
        const selected = v === this._selectedStoryVersion ? ' selected' : '';
        return `<option value="${v}"${selected}>${label}</option>`;
      })
      .join('');

    return `
      <div class="video-settings-section">
        <label class="video-settings-label" for="storys-upload-version">Version (Runde)</label>
        <select id="storys-upload-version" class="form-input">${options}</select>
      </div>
    `;
  }

  renderTab(activeTab) {
    return `
      <div id="upload-tab-storys" style="${activeTab !== 'storys' ? 'display:none' : ''}">
        <div class="storys-upload-drawer-content">
          <div class="upload-dropzone" id="storys-upload-dropzone">
            <div class="dropzone-content">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="40" height="40" class="upload-dropzone-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
              </svg>
              <p class="dropzone-text">Story-Videos hierher ziehen oder <button type="button" class="dropzone-browse-btn" id="storys-browse-btn">Dateien auswählen</button></p>
              <p class="dropzone-hint">MP4, MOV, AVI, MKV, WebM – max. 500 MB pro Video</p>
            </div>
            <input type="file" id="storys-upload-file-input" accept="video/*,.mp4,.mov,.avi,.mkv,.webm" multiple style="display:none"/>
          </div>

          <div class="upload-file-list" id="storys-preview-list"></div>

          <div class="upload-progress-container" id="storys-upload-progress" style="display:none;">
            <div class="upload-progress-bar">
              <div class="upload-progress-fill" id="storys-upload-progress-fill" style="width:0%"></div>
            </div>
            <div class="upload-progress-text" id="storys-upload-progress-text">Wird hochgeladen...</div>
          </div>

          ${this._renderStoryVersionSection()}

          <div class="upload-error-msg" id="storys-upload-error" style="display:none;"></div>

          <div class="drawer-footer storys-upload-drawer-footer">
            <button type="button" class="mdc-btn mdc-btn--cancel" id="storys-upload-cancel-btn">Abbrechen</button>
            <button type="button" class="mdc-btn mdc-btn--primary" id="storys-upload-submit-btn" disabled>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
              </svg>
              Hochladen
            </button>
          </div>

          <div class="existing-storys-section" id="existing-storys-section">
            <div class="existing-images-header">
              <span class="existing-images-title">Vorhandene Storys</span>
              <span class="existing-images-count" id="existing-storys-count"></span>
            </div>
            <div class="existing-images-list" id="existing-storys-list">
              <div class="existing-images-loading">Lade...</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Events ────────────────────────────────────────────────

  bindEvents(_panel) {
    const cancelBtn = document.getElementById('storys-upload-cancel-btn');
    const submitBtn = document.getElementById('storys-upload-submit-btn');
    const dropzone = document.getElementById('storys-upload-dropzone');
    const fileInput = document.getElementById('storys-upload-file-input');
    const browseBtn = document.getElementById('storys-browse-btn');
    const versionSelect = document.getElementById('storys-upload-version');

    cancelBtn?.addEventListener('click', () => this.drawer.close());
    submitBtn?.addEventListener('click', () => {
      if (this._selectedStorys.length > 0 && !this._isUploadingStorys) this._handleStorysUpload();
    });

    browseBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files?.length) this._addStorys(Array.from(e.target.files));
      fileInput.value = '';
    });

    versionSelect?.addEventListener('change', () => {
      this._selectedStoryVersion = parseInt(versionSelect.value, 10);
      this._updateStorysSubmitState();
    });

    dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone?.addEventListener('dragleave', () => { dropzone.classList.remove('dragover'); });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files?.length) this._addStorys(Array.from(files));
    });

    const previewList = document.getElementById('storys-preview-list');
    previewList?.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.storys-file-remove');
      if (removeBtn) {
        const idx = parseInt(removeBtn.dataset.idx, 10);
        this._removeSelectedStory(idx);
      }
    });

    const existingList = document.getElementById('existing-storys-list');
    existingList?.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.existing-story-delete');
      if (deleteBtn) {
        const assetId = deleteBtn.dataset.id;
        const path = deleteBtn.dataset.path;
        if (assetId) this._deleteExistingStory(assetId, path);
      }
    });
  }

  // ─── File Selection ────────────────────────────────────────

  _addStorys(files) {
    this._hideStorysError();
    const rejected = [];

    for (const file of files) {
      if (file.size > MAX_STORY_SIZE) {
        rejected.push(`${file.name}: zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB, max. 500 MB)`);
        continue;
      }

      const isVideo = VIDEO_MIME_TYPES.includes(file.type) || VIDEO_EXTENSIONS.test(file.name);
      if (!isVideo) {
        rejected.push(`${file.name}: kein unterstütztes Videoformat`);
        continue;
      }

      const alreadySelected = this._selectedStorys.some(f => f.name === file.name && f.size === file.size);
      if (!alreadySelected) {
        this._selectedStorys.push(file);
      }
    }

    if (rejected.length) {
      this._showStorysError(rejected.join('\n'));
    }

    this._renderSelectedStorysList();
    this._updateStorysSubmitState();
  }

  _removeSelectedStory(idx) {
    this._selectedStorys.splice(idx, 1);
    this._renderSelectedStorysList();
    this._updateStorysSubmitState();
  }

  _renderSelectedStorysList() {
    const list = document.getElementById('storys-preview-list');
    if (!list) return;

    if (this._selectedStorys.length === 0) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = this._selectedStorys.map((file, i) => `
      <div class="upload-file-item">
        <div class="file-info">
          <span class="file-name">${escapeHtml(file.name)}</span>
          <span class="file-size">${(file.size / 1024 / 1024).toFixed(1)} MB</span>
        </div>
        <button type="button" class="file-remove-btn storys-file-remove" data-idx="${i}" title="Entfernen">&times;</button>
      </div>
    `).join('');
  }

  _updateStorysSubmitState() {
    const btn = document.getElementById('storys-upload-submit-btn');
    if (btn) btn.disabled = this._isUploadingStorys || this._selectedStorys.length === 0;
  }

  // ─── Upload ────────────────────────────────────────────────

  async _handleStorysUpload() {
    if (this._selectedStorys.length === 0 || this._isUploadingStorys) return;
    this._isUploadingStorys = true;

    const submitBtn = document.getElementById('storys-upload-submit-btn');
    const cancelBtn = document.getElementById('storys-upload-cancel-btn');
    const progressContainer = document.getElementById('storys-upload-progress');
    const progressFill = document.getElementById('storys-upload-progress-fill');
    const progressText = document.getElementById('storys-upload-progress-text');

    if (submitBtn) submitBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
    if (progressContainer) progressContainer.style.display = 'block';
    this._hideStorysError();

    const total = this._selectedStorys.length;
    const versionNumber = this._selectedStoryVersion || 1;
    let uploaded = 0;
    let token = null;
    let versionFolderPath = null;
    let baseFolderPath = null;

    try {
      if (this._storyExistingVersions.includes(versionNumber)) {
        if (progressText) progressText.textContent = `Lösche alte Version ${versionNumber}...`;

        await fetch('/.netlify/functions/dropbox-upload-storys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete-version',
            unternehmen: this.drawer.metadaten.unternehmen || '',
            marke: this.drawer.metadaten.marke || '',
            kampagne: this.drawer.metadaten.kampagne || '',
            kooperation: this.drawer.metadaten.kooperationName || '',
            versionNumber,
          })
        });

        await window.supabase
          .from('kooperation_story_asset')
          .delete()
          .eq('video_id', this.drawer.videoId)
          .eq('version_number', versionNumber);
      }

      if (progressText) progressText.textContent = 'Verbinde mit Dropbox...';
      const firstFile = this._selectedStorys[0];
      const prepareResp = await fetch('/.netlify/functions/dropbox-upload-storys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prepare',
          unternehmen: this.drawer.metadaten.unternehmen || '',
          marke: this.drawer.metadaten.marke || '',
          kampagne: this.drawer.metadaten.kampagne || '',
          kooperation: this.drawer.metadaten.kooperationName || '',
          versionNumber,
          fileName: firstFile.name,
        })
      });

      if (!prepareResp.ok) {
        const errData = await prepareResp.json().catch(() => ({}));
        throw new Error(errData.error || `Vorbereitung fehlgeschlagen (${prepareResp.status})`);
      }

      const prepareData = await prepareResp.json();
      token = prepareData.token;
      versionFolderPath = prepareData.folderPath;
      baseFolderPath = prepareData.baseFolderPath;

      const uploadedFiles = [];

      for (let i = 0; i < this._selectedStorys.length; i++) {
        const file = this._selectedStorys[i];
        const pct = Math.round((i / total) * 90);
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (progressText) progressText.textContent = `Lade hoch... ${i + 1}/${total}: ${file.name}`;

        const dropboxPath = `${versionFolderPath}/${file.name}`;
        const CHUNK_SIZE = 2 * 1024 * 1024;

        if (file.size <= CHUNK_SIZE) {
          const chunk = await readFileAsBase64(file);
          await proxyPost({ action: 'upload-small', dropboxPath, chunk, token });
        } else {
          await uploadLargeFile(file, dropboxPath, token);
        }

        uploadedFiles.push({ name: file.name, size: file.size, path: dropboxPath });
        uploaded++;
      }

      if (progressFill) progressFill.style.width = '92%';
      if (progressText) progressText.textContent = 'Erstelle Links...';

      const storysFolderUrl = await createFolderSharedLink(token, baseFolderPath);

      const fileLinks = [];
      for (const uf of uploadedFiles) {
        let fileUrl = null;
        try {
          const linkResp = await fetch('/.netlify/functions/dropbox-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'shared-link', path: uf.path, token }),
          });
          if (linkResp.ok) {
            const linkData = await linkResp.json();
            fileUrl = linkData.url?.replace('?dl=0', '?raw=1') || null;
          }
        } catch (_) {}
        fileLinks.push({ ...uf, fileUrl });
      }

      if (progressFill) progressFill.style.width = '95%';
      if (progressText) progressText.textContent = 'Speichere in Datenbank...';

      await window.supabase
        .from('kooperation_story_asset')
        .update({ is_current: false })
        .eq('video_id', this.drawer.videoId);

      const insertRows = fileLinks.map(fl => ({
        video_id: this.drawer.videoId,
        file_url: fl.fileUrl,
        file_path: fl.path,
        file_name: fl.name,
        file_size: fl.size,
        version_number: versionNumber,
        is_current: true,
        uploaded_by: window.currentUser?.id || null,
        created_at: new Date().toISOString(),
      }));

      const { error: insertErr } = await window.supabase
        .from('kooperation_story_asset')
        .insert(insertRows);
      if (insertErr) throw insertErr;

      if (storysFolderUrl && this.drawer.videoId) {
        await window.supabase
          .from('kooperation_videos')
          .update({ story_folder_url: storysFolderUrl })
          .eq('id', this.drawer.videoId);
      }

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = `${uploaded} Story${uploaded !== 1 ? 's' : ''} als Version ${versionNumber} hochgeladen!`;

      this._isUploadingStorys = false;
      this._selectedStorys = [];
      this._renderSelectedStorysList();

      this._storyExistingVersions = await this._loadExistingStoryVersions();
      this._storyAvailableVersions = getAvailableVersions(this._storyExistingVersions, MAX_VERSIONS);
      this._selectedStoryVersion = this._storyAvailableVersions[0] || 1;
      this._refreshStoryVersionDropdown();

      if (typeof this.drawer.onStorysSuccess === 'function') {
        this.drawer.onStorysSuccess(storysFolderUrl);
      }

      await this._loadExistingStorys();

      setTimeout(() => {
        if (submitBtn) submitBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = false;
        if (progressContainer) progressContainer.style.display = 'none';
      }, 1500);

    } catch (err) {
      console.error('Storys-Upload fehlgeschlagen:', err);
      this._showStorysError(err.message || 'Upload fehlgeschlagen');
      if (submitBtn) submitBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      this._isUploadingStorys = false;
    }
  }

  _refreshStoryVersionDropdown() {
    const select = document.getElementById('storys-upload-version');
    if (!select) return;
    const allVersions = Array.from({ length: MAX_VERSIONS }, (_, i) => i + 1);
    select.innerHTML = allVersions.map(v => {
      const exists = !this._storyAvailableVersions.includes(v);
      const label = exists ? `Version ${v} (ersetzen)` : `Version ${v}`;
      const selected = v === this._selectedStoryVersion ? ' selected' : '';
      return `<option value="${v}"${selected}>${label}</option>`;
    }).join('');
  }

  // ─── Existing Storys ──────────────────────────────────────

  async _loadExistingStorys() {
    const listEl = document.getElementById('existing-storys-list');
    const countEl = document.getElementById('existing-storys-count');
    if (listEl) listEl.innerHTML = '<div class="existing-images-loading">Lade...</div>';

    try {
      if (!this.drawer.videoId) {
        this._existingStorys = [];
        if (countEl) countEl.textContent = '(0)';
        if (listEl) listEl.innerHTML = '<div class="existing-images-empty">Keine Storys vorhanden</div>';
        return;
      }

      const { data, error } = await window.supabase
        .from('kooperation_story_asset')
        .select('id, file_url, file_path, file_name, file_size, version_number, is_current, created_at')
        .eq('video_id', this.drawer.videoId)
        .order('version_number', { ascending: true })
        .order('file_name', { ascending: true });

      if (error) throw error;
      this._existingStorys = data || [];

      const totalCount = this._existingStorys.length;
      if (countEl) countEl.textContent = `(${totalCount})`;

      if (!listEl) return;

      if (totalCount === 0) {
        listEl.innerHTML = '<div class="existing-images-empty">Keine Storys vorhanden</div>';
        return;
      }

      const grouped = {};
      for (const asset of this._existingStorys) {
        const v = asset.version_number || 1;
        if (!grouped[v]) grouped[v] = [];
        grouped[v].push(asset);
      }

      let html = '';
      for (const [version, assets] of Object.entries(grouped)) {
        const isCurrent = assets.some(a => a.is_current);
        const badge = isCurrent ? ' <span class="version-badge version-badge--current">aktuell</span>' : '';
        html += `<div class="existing-storys-version-group">`;
        html += `<div class="existing-storys-version-header">Version ${version}${badge} <span class="existing-storys-version-count">(${assets.length} Datei${assets.length !== 1 ? 'en' : ''})</span></div>`;
        for (const asset of assets) {
          const sizeMB = asset.file_size ? (asset.file_size / 1024 / 1024).toFixed(1) + ' MB' : '';
          html += `
            <div class="existing-image-item">
              <div class="existing-image-info">
                <span class="existing-image-name">${escapeHtml(asset.file_name || asset.file_path?.split('/').pop() || '?')}</span>
                ${sizeMB ? `<span class="existing-image-size">${sizeMB}</span>` : ''}
              </div>
              <button type="button" class="existing-story-delete" data-id="${asset.id}" data-path="${escapeHtml(asset.file_path || '')}" title="Löschen">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
                </svg>
              </button>
            </div>`;
        }
        html += `</div>`;
      }

      listEl.innerHTML = html;

    } catch (err) {
      console.error('Storys laden fehlgeschlagen:', err);
      if (listEl) listEl.innerHTML = '<div class="existing-images-empty">Fehler beim Laden</div>';
    }
  }

  async _deleteExistingStory(assetId, filePath) {
    if (this._isUploadingStorys) return;

    const item = document.querySelector(`.existing-story-delete[data-id="${assetId}"]`)?.closest('.existing-image-item');
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
        .from('kooperation_story_asset')
        .delete()
        .eq('id', assetId);

      const videoId = this.drawer.videoId;
      const { count } = await window.supabase
        .from('kooperation_story_asset')
        .select('id', { count: 'exact', head: true })
        .eq('video_id', videoId);

      if ((count ?? 0) === 0) {
        if (filePath) {
          const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
          fetch('/.netlify/functions/dropbox-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: folderPath }),
          }).catch(() => {});
        }
        await window.supabase
          .from('kooperation_videos')
          .update({ story_folder_url: null })
          .eq('id', videoId);
        this.drawer.onStorysCleared?.();
      }

      this._storyExistingVersions = await this._loadExistingStoryVersions();
      this._storyAvailableVersions = getAvailableVersions(this._storyExistingVersions, MAX_VERSIONS);
      this._selectedStoryVersion = this._storyAvailableVersions[0] || 1;
      this._refreshStoryVersionDropdown();

      await this._loadExistingStorys();

    } catch (err) {
      console.error('Story löschen fehlgeschlagen:', err);
      this._showStorysError(err.message || 'Löschen fehlgeschlagen');
      if (item) item.style.opacity = '';
    }
  }

  // ─── Error Helpers ─────────────────────────────────────────

  _showStorysError(msg) {
    const el = document.getElementById('storys-upload-error');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  _hideStorysError() {
    const el = document.getElementById('storys-upload-error');
    if (el) el.style.display = 'none';
  }
}
