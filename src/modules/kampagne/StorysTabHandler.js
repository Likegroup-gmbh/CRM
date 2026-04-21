import {
  getAvailableVersions, MAX_VERSIONS,
  escapeHtml, readFileAsBase64, proxyPost, uploadLargeFile, createFolderSharedLink,
  VIDEO_EXTENSIONS, VIDEO_MIME_TYPES, MAX_STORY_SIZE
} from '../../core/VideoUploadUtils.js';

export class StorysTabHandler {
  constructor(drawer) {
    this.drawer = drawer;
    this._queue = [];
    this._storySlots = [];
    this._isUploadingStorys = false;
    this._initialized = false;
  }

  get isUploading() { return this._isUploadingStorys; }

  async init() {
    this._storySlots = await this._loadStorySlots();
    this._initialized = true;
  }

  async ensureInitialized() {
    if (!this._initialized) await this.init();
  }

  reset() {
    this._queue = [];
    this._storySlots = [];
    this._isUploadingStorys = false;
    this._initialized = false;
  }

  async _loadStorySlots() {
    if (!this.drawer.videoId) return [];
    try {
      const { data: slots, error } = await window.supabase
        .from('kooperation_story')
        .select('id, video_id, slot_index, slot_name, created_at')
        .eq('video_id', this.drawer.videoId)
        .order('slot_index', { ascending: true });
      if (error) return [];

      const slotIds = (slots || []).map(s => s.id);
      let assets = [];
      if (slotIds.length > 0) {
        const { data: assetData } = await window.supabase
          .from('kooperation_story_asset')
          .select('id, story_id, file_url, file_path, file_name, file_size, version_number, is_current')
          .in('story_id', slotIds);
        assets = assetData || [];
      }

      const assetsBySlot = {};
      for (const a of assets) {
        if (!assetsBySlot[a.story_id]) assetsBySlot[a.story_id] = [];
        assetsBySlot[a.story_id].push(a);
      }

      return (slots || []).map(slot => {
        const slotAssets = assetsBySlot[slot.id] || [];
        const currentAsset = slotAssets.find(a => a.is_current) || slotAssets[0] || null;
        const existingVersions = [...new Set(slotAssets.map(a => a.version_number))].sort((a, b) => a - b);
        return { ...slot, assets: slotAssets, currentAsset, currentVersion: currentAsset?.version_number || 0, existingVersions };
      });
    } catch (err) {
      console.error('[StorysTabHandler] _loadStorySlots:', err);
      return [];
    }
  }

  async _loadExistingStoryVersions() {
    const slots = this._storySlots || [];
    const allVersions = new Set();
    for (const s of slots) {
      for (const v of (s.existingVersions || [])) allVersions.add(v);
    }
    return [...allVersions];
  }

  // ─── Render ────────────────────────────────────────────────

  renderTab(activeTab) {
    return `
      <div id="upload-tab-storys" style="${activeTab !== 'storys' ? 'display:none' : ''}">
        <div class="storys-upload-drawer-content">
          <div class="existing-storys-section" id="existing-storys-section">
            <div class="existing-images-header">
              <span class="existing-images-title">Story-Slots</span>
              <span class="existing-images-count" id="existing-storys-count"></span>
            </div>
            <div class="existing-images-list" id="existing-storys-list">
              <div class="existing-images-loading">Lade...</div>
            </div>
          </div>

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

    cancelBtn?.addEventListener('click', () => this.drawer.close());
    submitBtn?.addEventListener('click', () => {
      if (this._queue.length > 0 && !this._isUploadingStorys) this._handleStorysUpload();
    });

    browseBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files?.length) this._addStorys(Array.from(e.target.files));
      fileInput.value = '';
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
        this._removeQueueItem(idx);
      }
    });
    previewList?.addEventListener('change', (e) => {
      const slotSelect = e.target.closest('.storys-slot-select');
      const versionSelect = e.target.closest('.storys-version-select');
      if (slotSelect) {
        const idx = parseInt(slotSelect.dataset.idx, 10);
        this._onSlotChange(idx, slotSelect.value);
      }
      if (versionSelect) {
        const idx = parseInt(versionSelect.dataset.idx, 10);
        this._onVersionChange(idx, parseInt(versionSelect.value, 10));
      }
    });

    const existingList = document.getElementById('existing-storys-list');
    existingList?.addEventListener('click', (e) => {
      const deleteSlotBtn = e.target.closest('.existing-story-slot-delete');
      if (deleteSlotBtn) {
        const slotId = deleteSlotBtn.dataset.slotId;
        if (slotId) this._deleteSlot(slotId);
        return;
      }
      const newVersionBtn = e.target.closest('.existing-story-new-version');
      if (newVersionBtn) {
        const slotId = newVersionBtn.dataset.slotId;
        if (slotId) this._triggerNewVersionUpload(slotId);
      }
    });
  }

  // ─── File Selection / Queue ────────────────────────────────

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

      const alreadyQueued = this._queue.some(q => q.file.name === file.name && q.file.size === file.size);
      if (!alreadyQueued) {
        this._queue.push({
          file,
          slotId: '__new__',
          versionNumber: 1,
        });
      }
    }

    if (rejected.length) this._showStorysError(rejected.join('\n'));
    this._renderQueue();
    this._updateSubmitState();
  }

  _removeQueueItem(idx) {
    this._queue.splice(idx, 1);
    this._renderQueue();
    this._updateSubmitState();
  }

  _onSlotChange(idx, value) {
    const item = this._queue[idx];
    if (!item) return;
    item.slotId = value;
    if (value === '__new__') {
      item.versionNumber = 1;
    } else {
      const slot = this._storySlots.find(s => s.id === value);
      const nextVersion = this._getNextVersionForSlot(slot);
      item.versionNumber = nextVersion;
    }
    this._renderQueue();
  }

  _onVersionChange(idx, value) {
    const item = this._queue[idx];
    if (!item) return;
    item.versionNumber = value;
  }

  _getNextVersionForSlot(slot) {
    if (!slot) return 1;
    const available = getAvailableVersions(slot.existingVersions || [], MAX_VERSIONS);
    return available[0] || 1;
  }

  _triggerNewVersionUpload(slotId) {
    const fileInput = document.getElementById('storys-upload-file-input');
    if (!fileInput) return;

    const handler = (e) => {
      fileInput.removeEventListener('change', handler);
      const files = Array.from(e.target.files || []);
      fileInput.value = '';
      if (files.length === 0) return;

      this._hideStorysError();
      const file = files[0];
      if (file.size > MAX_STORY_SIZE) {
        this._showStorysError(`${file.name}: zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB, max. 500 MB)`);
        return;
      }
      const isVideo = VIDEO_MIME_TYPES.includes(file.type) || VIDEO_EXTENSIONS.test(file.name);
      if (!isVideo) {
        this._showStorysError(`${file.name}: kein unterstütztes Videoformat`);
        return;
      }

      const slot = this._storySlots.find(s => s.id === slotId);
      const nextVersion = this._getNextVersionForSlot(slot);
      this._queue.push({ file, slotId, versionNumber: nextVersion });
      this._renderQueue();
      this._updateSubmitState();
    };

    fileInput.addEventListener('change', handler);
    fileInput.click();
  }

  // ─── Render Queue ─────────────────────────────────────────

  _renderQueue() {
    const list = document.getElementById('storys-preview-list');
    if (!list) return;

    if (this._queue.length === 0) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = this._queue.map((item, i) => {
      const slotOptions = this._buildSlotOptions(item.slotId);
      const versionOptions = this._buildVersionOptions(item);
      return `
        <div class="upload-file-item storys-queue-item">
          <div class="file-info">
            <span class="file-name">${escapeHtml(item.file.name)}</span>
            <span class="file-size">${(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
          </div>
          <div class="storys-queue-selects">
            <select class="form-input storys-slot-select" data-idx="${i}">${slotOptions}</select>
            <select class="form-input storys-version-select" data-idx="${i}">${versionOptions}</select>
          </div>
          <button type="button" class="file-remove-btn storys-file-remove" data-idx="${i}" title="Entfernen">&times;</button>
        </div>
      `;
    }).join('');
  }

  _buildSlotOptions(selectedSlotId) {
    let html = `<option value="__new__" ${selectedSlotId === '__new__' ? 'selected' : ''}>Neue Story</option>`;
    for (const slot of this._storySlots) {
      const label = `Story ${slot.slot_index}${slot.currentVersion ? ` (V${slot.currentVersion})` : ''}`;
      html += `<option value="${slot.id}" ${selectedSlotId === slot.id ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }
    return html;
  }

  _buildVersionOptions(item) {
    if (item.slotId === '__new__') {
      return '<option value="1" selected>Version 1</option>';
    }
    const slot = this._storySlots.find(s => s.id === item.slotId);
    const allVersions = Array.from({ length: MAX_VERSIONS }, (_, i) => i + 1);
    return allVersions.map(v => {
      const exists = slot?.existingVersions?.includes(v);
      const label = exists ? `Version ${v} (ersetzen)` : `Version ${v}`;
      const selected = v === item.versionNumber ? ' selected' : '';
      return `<option value="${v}"${selected}>${label}</option>`;
    }).join('');
  }

  _updateSubmitState() {
    const btn = document.getElementById('storys-upload-submit-btn');
    if (btn) btn.disabled = this._isUploadingStorys || this._queue.length === 0;
  }

  // ─── Upload ────────────────────────────────────────────────

  async _handleStorysUpload() {
    if (this._queue.length === 0 || this._isUploadingStorys) return;
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

    const total = this._queue.length;
    let uploaded = 0;
    let videoFolderUrl = null;

    try {
      const meta = this.drawer.metadaten;
      const basePayload = {
        unternehmen: meta.unternehmen || '',
        marke: meta.marke || '',
        kampagne: meta.kampagne || '',
        kooperation: meta.kooperationName || '',
        videoPosition: meta.videoPosition || 1,
        videoThema: meta.videoThema || '',
      };

      for (let i = 0; i < this._queue.length; i++) {
        const item = this._queue[i];
        const file = item.file;
        const versionNumber = item.versionNumber;
        let slotId = item.slotId;
        let slotIndex;

        const pct = Math.round((i / total) * 90);
        if (progressFill) progressFill.style.width = `${pct}%`;

        // Create new slot if needed
        if (slotId === '__new__') {
          if (progressText) progressText.textContent = `Erstelle Story-Slot ${i + 1}...`;
          const maxIdx = this._storySlots.reduce((m, s) => Math.max(m, s.slot_index), 0);
          slotIndex = maxIdx + 1;

          const { data: newSlot, error: slotErr } = await window.supabase
            .from('kooperation_story')
            .insert({
              video_id: this.drawer.videoId,
              slot_index: slotIndex,
              created_by: window.currentUser?.id || null,
            })
            .select('id, video_id, slot_index, slot_name, created_at')
            .single();
          if (slotErr) throw slotErr;

          slotId = newSlot.id;
          const enrichedSlot = { ...newSlot, assets: [], currentAsset: null, currentVersion: 0, existingVersions: [] };
          this._storySlots.push(enrichedSlot);
        } else {
          const slot = this._storySlots.find(s => s.id === slotId);
          slotIndex = slot?.slot_index || 1;
        }

        const payload = { ...basePayload, slotIndex, versionNumber, fileName: file.name };

        // Delete existing version in this slot if replacing
        const slot = this._storySlots.find(s => s.id === slotId);
        if (slot?.existingVersions?.includes(versionNumber)) {
          if (progressText) progressText.textContent = `Lösche alte Version ${versionNumber} für Story ${slotIndex}...`;

          await fetch('/.netlify/functions/dropbox-upload-storys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, action: 'delete-version' }),
          });

          await window.supabase
            .from('kooperation_story_asset')
            .delete()
            .eq('story_id', slotId)
            .eq('version_number', versionNumber);
        }

        // Prepare & upload
        if (progressText) progressText.textContent = `Lade hoch... ${i + 1}/${total}: ${file.name}`;

        const prepareResp = await fetch('/.netlify/functions/dropbox-upload-storys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, action: 'prepare' }),
        });
        if (!prepareResp.ok) {
          const errData = await prepareResp.json().catch(() => ({}));
          throw new Error(errData.error || `Vorbereitung fehlgeschlagen (${prepareResp.status})`);
        }

        const prepareData = await prepareResp.json();
        const token = prepareData.token;
        const dropboxPath = prepareData.dropboxPath;
        if (prepareData.videoFolderPath) videoFolderUrl = prepareData.videoFolderPath;

        const CHUNK_SIZE = 2 * 1024 * 1024;
        if (file.size <= CHUNK_SIZE) {
          const chunk = await readFileAsBase64(file);
          await proxyPost({ action: 'upload-small', dropboxPath, chunk, token });
        } else {
          await uploadLargeFile(file, dropboxPath, token);
        }

        // Create shared link for file
        let fileUrl = null;
        try {
          const linkResp = await fetch('/.netlify/functions/dropbox-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'shared-link', path: dropboxPath, token }),
          });
          if (linkResp.ok) {
            const linkData = await linkResp.json();
            fileUrl = linkData.url?.replace('?dl=0', '?raw=1') || null;
          }
        } catch (_) {}

        // Mark old assets in this slot as not current
        await window.supabase
          .from('kooperation_story_asset')
          .update({ is_current: false })
          .eq('story_id', slotId);

        // Insert new asset
        const { error: insertErr } = await window.supabase
          .from('kooperation_story_asset')
          .insert({
            story_id: slotId,
            video_id: this.drawer.videoId,
            file_url: fileUrl,
            file_path: dropboxPath,
            file_name: file.name,
            file_size: file.size,
            version_number: versionNumber,
            is_current: true,
            uploaded_by: window.currentUser?.id || null,
            created_at: new Date().toISOString(),
          });
        if (insertErr) throw insertErr;

        uploaded++;
      }

      // Create shared link for video-level storys folder
      if (progressFill) progressFill.style.width = '92%';
      if (progressText) progressText.textContent = 'Erstelle Ordner-Links...';

      let storysFolderUrl = null;
      if (videoFolderUrl) {
        const tokenResp = await fetch('/.netlify/functions/dropbox-upload-storys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...{
            unternehmen: meta.unternehmen || '',
            marke: meta.marke || '',
            kampagne: meta.kampagne || '',
            kooperation: meta.kooperationName || '',
            videoPosition: meta.videoPosition || 1,
            videoThema: meta.videoThema || '',
            slotIndex: 1,
            versionNumber: 1,
          }, action: 'prepare' }),
        });
        if (tokenResp.ok) {
          const tokenData = await tokenResp.json();
          storysFolderUrl = await createFolderSharedLink(tokenData.token, tokenData.videoFolderPath);
        }
      }

      if (storysFolderUrl && this.drawer.videoId) {
        await window.supabase
          .from('kooperation_videos')
          .update({ story_folder_url: storysFolderUrl })
          .eq('id', this.drawer.videoId);
      }

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = `${uploaded} Story${uploaded !== 1 ? 's' : ''} hochgeladen!`;

      this._isUploadingStorys = false;
      this._queue = [];
      this._renderQueue();

      this._storySlots = await this._loadStorySlots();
      this._renderExistingSlots();

      if (typeof this.drawer.onStorysSuccess === 'function') {
        this.drawer.onStorysSuccess(storysFolderUrl);
      }

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
    // Kept for backward compat; now re-render existing slots instead
    this._renderExistingSlots();
  }

  // ─── Existing Slots ──────────────────────────────────────

  async _loadExistingStorys() {
    this._storySlots = await this._loadStorySlots();
    this._renderExistingSlots();
  }

  _renderExistingSlots() {
    const listEl = document.getElementById('existing-storys-list');
    const countEl = document.getElementById('existing-storys-count');

    if (countEl) countEl.textContent = `(${this._storySlots.length})`;
    if (!listEl) return;

    if (this._storySlots.length === 0) {
      listEl.innerHTML = '<div class="existing-images-empty">Keine Storys vorhanden</div>';
      return;
    }

    let html = '';
    for (const slot of this._storySlots) {
      const currentAsset = slot.currentAsset;
      const versionLabel = slot.currentVersion ? `V${slot.currentVersion}` : '—';
      const fileName = currentAsset?.file_name || '—';
      const versionsStr = (slot.existingVersions || []).join(', ');
      const canAddVersion = (slot.existingVersions || []).length < MAX_VERSIONS;

      html += `
        <div class="existing-storys-slot-item">
          <div class="existing-storys-slot-header">
            <span class="existing-storys-slot-title">Story ${slot.slot_index}</span>
            <span class="existing-storys-slot-meta">${escapeHtml(fileName)} · ${versionLabel} ${versionsStr ? `(Versionen: ${versionsStr})` : ''}</span>
          </div>
          <div class="existing-storys-slot-actions">
            ${canAddVersion ? `<button type="button" class="mdc-btn mdc-btn--small existing-story-new-version" data-slot-id="${slot.id}" title="Neue Version hochladen">+ Version</button>` : ''}
            <button type="button" class="existing-story-slot-delete" data-slot-id="${slot.id}" title="Slot löschen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
              </svg>
            </button>
          </div>
        </div>
      `;

      for (const asset of slot.assets) {
        const sizeMB = asset.file_size ? (asset.file_size / 1024 / 1024).toFixed(1) + ' MB' : '';
        const currentBadge = asset.is_current ? ' <span class="version-badge version-badge--current">aktuell</span>' : '';
        html += `
          <div class="existing-image-item existing-storys-asset-item">
            <div class="existing-image-info">
              <span class="existing-image-name">${escapeHtml(asset.file_name || '?')} · V${asset.version_number}${currentBadge}</span>
              ${sizeMB ? `<span class="existing-image-size">${sizeMB}</span>` : ''}
            </div>
          </div>
        `;
      }
    }

    listEl.innerHTML = html;
  }

  async _deleteSlot(slotId) {
    if (this._isUploadingStorys) return;

    const slotEl = document.querySelector(`.existing-story-slot-delete[data-slot-id="${slotId}"]`)?.closest('.existing-storys-slot-item');
    if (slotEl) slotEl.style.opacity = '0.5';

    try {
      const slot = this._storySlots.find(s => s.id === slotId);

      // Delete all assets from Dropbox
      for (const asset of (slot?.assets || [])) {
        if (asset.file_path) {
          await fetch('/.netlify/functions/dropbox-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: asset.file_path }),
          }).catch(() => {});
        }
      }

      // DB cascade: deleting kooperation_story cascades to kooperation_story_asset
      await window.supabase
        .from('kooperation_story')
        .delete()
        .eq('id', slotId);

      // Check if any slots remain
      const { count } = await window.supabase
        .from('kooperation_story')
        .select('id', { count: 'exact', head: true })
        .eq('video_id', this.drawer.videoId);

      if ((count ?? 0) === 0) {
        await window.supabase
          .from('kooperation_videos')
          .update({ story_folder_url: null })
          .eq('id', this.drawer.videoId);
        this.drawer.onStorysCleared?.();
      }

      this._storySlots = await this._loadStorySlots();
      this._renderExistingSlots();

    } catch (err) {
      console.error('Story-Slot löschen fehlgeschlagen:', err);
      this._showStorysError(err.message || 'Löschen fehlgeschlagen');
      if (slotEl) slotEl.style.opacity = '';
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
