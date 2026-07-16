import {
  getAvailableVersions, MAX_VERSIONS, FINAL_VARIANTS,
  escapeHtml,
  VIDEO_EXTENSIONS, VIDEO_MIME_TYPES, MAX_STORY_SIZE,
  normalizeExternalUrl, isValidExternalUrl,
  mdcBtnIcon, ICON_PLUS_16, ICON_CHECK_16, ICON_UPLOAD_16
} from '../../core/VideoUploadUtils.js';
import { backgroundUploadService, UPLOAD_EVENTS } from '../../core/BackgroundUploadService.js';

export class StorysTabHandler {
  constructor(drawer) {
    this.drawer = drawer;
    this._queue = [];
    this._storySlots = [];
    this._isUploadingStorys = false;
    this._initialized = false;
    this._onStorysDoneBound = (e) => this._onStorysDoneEvent(e);
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
    window.removeEventListener(UPLOAD_EVENTS.STORYS_DONE, this._onStorysDoneBound);
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
          .select('id, story_id, file_url, file_path, file_name, file_size, version_number, is_current, is_final, variant_name')
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
        const loopAssets = slotAssets.filter(a => !a.is_final);
        const currentAsset = loopAssets.find(a => a.is_current) || loopAssets[0] || null;
        const existingVersions = [...new Set(loopAssets.map(a => a.version_number))].sort((a, b) => a - b);
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
    if (this.drawer.useExternalLinks) {
      return this._renderLinkTab(activeTab);
    }
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
            <button type="button" class="mdc-btn mdc-btn--create" id="storys-upload-submit-btn" disabled>
              ${mdcBtnIcon(ICON_UPLOAD_16)}
              <span class="mdc-btn__label">Hochladen</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderLinkTab(activeTab) {
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

          <div class="link-add-section">
            <button type="button" class="mdc-btn upload-drawer-btn--secondary" id="storys-link-add-btn">
              ${mdcBtnIcon(ICON_PLUS_16)}
              <span class="mdc-btn__label">Story-Link hinzufügen</span>
            </button>
          </div>

          <div class="upload-file-list" id="storys-preview-list"></div>

          <div class="upload-error-msg" id="storys-upload-error" style="display:none;"></div>

          <div class="drawer-footer storys-upload-drawer-footer">
            <button type="button" class="mdc-btn mdc-btn--cancel" id="storys-upload-cancel-btn">Abbrechen</button>
            <button type="button" class="mdc-btn mdc-btn--create" id="storys-upload-submit-btn" disabled>
              ${mdcBtnIcon(ICON_CHECK_16)}
              <span class="mdc-btn__label">Speichern</span>
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

    cancelBtn?.addEventListener('click', () => this.drawer.close());
    submitBtn?.addEventListener('click', () => {
      if (this._queue.length > 0 && !this._isUploadingStorys) {
        if (this.drawer.useExternalLinks) {
          this._handleStorysLinkSubmit();
        } else {
          this._handleStorysUpload();
        }
      }
    });

    if (this.drawer.useExternalLinks) {
      const addLinkBtn = document.getElementById('storys-link-add-btn');
      addLinkBtn?.addEventListener('click', () => this._addLinkEntry());
    } else {
      const dropzone = document.getElementById('storys-upload-dropzone');
      const fileInput = document.getElementById('storys-upload-file-input');
      const browseBtn = document.getElementById('storys-browse-btn');

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
    }

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
      const finalVariantSelect = e.target.closest('.storys-final-variant-select');
      if (slotSelect) {
        const idx = parseInt(slotSelect.dataset.idx, 10);
        this._onSlotChange(idx, slotSelect.value);
      }
      if (versionSelect) {
        const idx = parseInt(versionSelect.dataset.idx, 10);
        this._onVersionChange(idx, versionSelect.value);
      }
      if (finalVariantSelect) {
        const idx = parseInt(finalVariantSelect.dataset.idx, 10);
        if (this._queue[idx]) this._queue[idx].variantName = finalVariantSelect.value;
      }
    });
    previewList?.addEventListener('input', (e) => {
      const variantInput = e.target.closest('.storys-variant-name-input');
      if (variantInput) {
        const idx = parseInt(variantInput.dataset.idx, 10);
        if (this._queue[idx]) {
          this._queue[idx].variantName = variantInput.value;
        }
        this._updateSubmitState();
      }
      const urlInput = e.target.closest('.storys-link-url-input');
      if (urlInput) {
        const idx = parseInt(urlInput.dataset.idx, 10);
        if (this._queue[idx]) {
          this._queue[idx].url = urlInput.value;
        }
        this._updateSubmitState();
      }
    });

    const existingList = document.getElementById('existing-storys-list');
    existingList?.addEventListener('click', (e) => {
      const deleteSlotBtn = e.target.closest('.existing-story-slot-delete');
      if (deleteSlotBtn) {
        const slotId = deleteSlotBtn.dataset.slotId;
        if (slotId) this._deleteSlot(slotId);
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
          variantName: '',
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
    if (item.isFinal) {
      // Finale-Auswahl bleibt beim Slot-Wechsel erhalten
      this._renderQueue();
      return;
    }
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
    if (value === 'final') {
      item.isFinal = true;
      item.versionNumber = 1;
      item.variantName = FINAL_VARIANTS[0];
    } else {
      if (item.isFinal) item.variantName = '';
      item.isFinal = false;
      item.versionNumber = parseInt(value, 10) || 1;
    }
    this._renderQueue();
    this._updateSubmitState();
  }

  _getNextVersionForSlot(slot) {
    if (!slot) return 1;
    const available = getAvailableVersions(slot.existingVersions || [], MAX_VERSIONS);
    return available[0] || 1;
  }

  // ─── Render Queue ─────────────────────────────────────────

  _renderQueue() {
    const list = document.getElementById('storys-preview-list');
    if (!list) return;

    if (this._queue.length === 0) {
      list.innerHTML = '';
      return;
    }

    if (this.drawer.useExternalLinks) {
      list.innerHTML = this._queue.map((item, i) => {
        const slotOptions = this._buildSlotOptions(item.slotId);
        const versionOptions = this._buildVersionOptions(item);
        return `
          <div class="upload-file-item storys-queue-item">
            <div class="storys-queue-variant" style="flex:1">
              <input type="url" class="form-input storys-link-url-input" data-idx="${i}"
                value="${escapeHtml(item.url || '')}"
                placeholder="https://..." />
            </div>
            <div class="storys-queue-variant">
              ${this._buildVariantField(item, i)}
            </div>
            <div class="storys-queue-selects">
              <select class="form-input storys-slot-select" data-idx="${i}">${slotOptions}</select>
              <select class="form-input storys-version-select" data-idx="${i}">${versionOptions}</select>
            </div>
            <button type="button" class="file-remove-btn storys-file-remove" data-idx="${i}" title="Entfernen">&times;</button>
          </div>
        `;
      }).join('');
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
          <div class="storys-queue-variant">
            ${this._buildVariantField(item, i)}
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
      const label = `Story ${slot.slot_index}${slot.currentVersion ? ` (FS${slot.currentVersion})` : ''}`;
      html += `<option value="${slot.id}" ${selectedSlotId === slot.id ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }
    return html;
  }

  _buildVersionOptions(item) {
    const slot = item.slotId !== '__new__' ? this._storySlots.find(s => s.id === item.slotId) : null;
    const allVersions = Array.from({ length: MAX_VERSIONS }, (_, i) => i + 1);
    let html = allVersions.map(v => {
      const exists = slot?.existingVersions?.includes(v);
      const label = exists ? `Feedbackschleife ${v} (hinzufügen)` : `Feedbackschleife ${v}`;
      const selected = !item.isFinal && v === item.versionNumber ? ' selected' : '';
      return `<option value="${v}"${selected}>${label}</option>`;
    }).join('');
    html += `<option value="final"${item.isFinal ? ' selected' : ''}>Finale Version</option>`;
    return html;
  }

  // Freitext-Varianten-Name (Feedbackschleifen) bzw. Preset-Select 9:16/4:5 (Finale)
  _buildVariantField(item, idx) {
    if (item.isFinal) {
      const options = FINAL_VARIANTS.map(v =>
        `<option value="${v}"${v === item.variantName ? ' selected' : ''}>${v}</option>`
      ).join('');
      return `<select class="form-input storys-final-variant-select" data-idx="${idx}">${options}</select>`;
    }
    return `<input type="text" class="form-input storys-variant-name-input" data-idx="${idx}"
      value="${escapeHtml(item.variantName || '')}"
      placeholder="Varianten-Name (optional)" maxlength="120"/>`;
  }

  _updateSubmitState() {
    const btn = document.getElementById('storys-upload-submit-btn');
    if (!btn) return;
    if (this.drawer.useExternalLinks) {
      const allUrlsFilled = this._queue.every(q => (q.url || '').trim().length > 0);
      btn.disabled = this._isUploadingStorys || this._queue.length === 0 || !allUrlsFilled;
    } else {
      btn.disabled = this._queue.length === 0;
    }
  }

  // ─── Upload ────────────────────────────────────────────────

  async _handleStorysUpload() {
    if (this._queue.length === 0 || this._isUploadingStorys) return;

    // Re-Entry-Schutz: läuft schon ein Job für dieses Video?
    const active = backgroundUploadService.getActiveJobsForVideo(this.drawer.videoId)
      .filter(j => j.kind === 'storys');
    if (active.length > 0) {
      this._showStorysError('Für dieses Video läuft bereits ein Storys-Upload im Hintergrund.');
      return;
    }

    this._hideStorysError();

    const queueSnapshot = this._queue.map(q => ({
      file: q.file,
      slotId: q.slotId,
      versionNumber: q.versionNumber,
      variantName: q.variantName,
      isFinal: !!q.isFinal,
    }));

    window.removeEventListener(UPLOAD_EVENTS.STORYS_DONE, this._onStorysDoneBound);
    window.addEventListener(UPLOAD_EVENTS.STORYS_DONE, this._onStorysDoneBound);

    const jobId = backgroundUploadService.enqueueStorysJob({
      videoId: this.drawer.videoId,
      metadaten: this.drawer.metadaten,
      queue: queueSnapshot,
      storySlots: this._storySlots,
    });

    this._queue = [];
    this._renderQueue();
    this._updateSubmitState();
    return jobId;
  }

  _onStorysDoneEvent(e) {
    const { videoId } = e.detail || {};
    if (videoId !== this.drawer.videoId) return;
    if (document.getElementById('existing-storys-list')) {
      this._loadExistingStorys();
    }
    if (typeof this.drawer.onStorysSuccess === 'function') {
      this.drawer.onStorysSuccess(e.detail?.result?.storysFolderUrl || null);
    }
  }

  // ─── External Link Mode ────────────────────────────────────

  _addLinkEntry() {
    this._queue.push({ url: '', slotId: '__new__', versionNumber: 1, variantName: '' });
    this._renderQueue();
    this._updateSubmitState();
  }

  async _handleStorysLinkSubmit() {
    if (this._queue.length === 0 || this._isUploadingStorys) return;
    this._hideStorysError();

    const invalid = this._queue.filter(q => !isValidExternalUrl(normalizeExternalUrl(q.url)));
    if (invalid.length > 0) {
      this._showStorysError('Bitte gültige URLs eingeben (https://...)');
      return;
    }

    this._isUploadingStorys = true;
    this._updateSubmitState();

    try {
      for (const item of this._queue) {
        const fileUrl = normalizeExternalUrl(item.url);
        let slotId = item.slotId;

        if (slotId === '__new__') {
          const nextIndex = (this._storySlots.length > 0
            ? Math.max(...this._storySlots.map(s => s.slot_index)) + 1
            : 1);
          const { data: newSlot, error: slotErr } = await window.supabase
            .from('kooperation_story')
            .insert({
              video_id: this.drawer.videoId,
              slot_index: nextIndex,
              slot_name: `Story ${nextIndex}`,
            })
            .select('id')
            .single();
          if (slotErr) throw slotErr;
          slotId = newSlot.id;
          this._storySlots.push({ id: slotId, slot_index: nextIndex, slot_name: `Story ${nextIndex}`, assets: [], existingVersions: [] });
        }

        await window.supabase
          .from('kooperation_story_asset')
          .insert({
            story_id: slotId,
            video_id: this.drawer.videoId,
            file_url: fileUrl,
            file_path: null,
            file_name: item.variantName || fileUrl.split('/').pop() || 'Link',
            file_size: 0,
            version_number: item.isFinal ? 1 : item.versionNumber,
            variant_name: item.variantName || null,
            is_current: !item.isFinal,
            is_final: !!item.isFinal,
            uploaded_by: window.currentUser?.id || null,
            created_at: new Date().toISOString(),
          });
      }

      this._queue = [];
      this._renderQueue();
      this._isUploadingStorys = false;
      this._updateSubmitState();
      this._loadExistingStorys();
      window.toastSystem?.success?.('Story-Links gespeichert');
    } catch (err) {
      console.error('[StorysTabHandler] Link-Submit fehlgeschlagen:', err);
      this._showStorysError(err.message || 'Speichern fehlgeschlagen');
      this._isUploadingStorys = false;
      this._updateSubmitState();
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
      const versionLabel = slot.currentVersion ? `FS${slot.currentVersion}` : '—';
      const fileName = currentAsset?.file_name || '—';
      const versionsStr = (slot.existingVersions || []).map(v => `FS${v}`).join(', ');

      html += `
        <div class="existing-storys-slot-item">
          <div class="existing-storys-slot-header">
            <span class="existing-storys-slot-title">Story ${slot.slot_index}</span>
            <span class="existing-storys-slot-meta">${escapeHtml(fileName)} · ${versionLabel} ${versionsStr ? `(Feedbackschleifen: ${versionsStr})` : ''}</span>
          </div>
          <div class="existing-storys-slot-actions">
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
        const currentBadge = asset.is_current && !asset.is_final ? ' <span class="version-badge version-badge--current">aktuell</span>' : '';
        const versionLabel = asset.is_final ? 'Finale' : `FS${asset.version_number}`;
        html += `
          <div class="existing-image-item existing-storys-asset-item">
            <div class="existing-image-info">
              <span class="existing-image-name">${escapeHtml(asset.file_name || '?')}${asset.variant_name ? ` · ${escapeHtml(asset.variant_name)}` : ''} · ${versionLabel}${currentBadge}</span>
              ${sizeMB ? `<span class="existing-image-size">${sizeMB}</span>` : ''}
            </div>
          </div>
        `;
      }
    }

    listEl.innerHTML = html;
  }

  async _deleteSlot(slotId) {
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

  async _updateCurrentFlags() {
    for (const slot of this._storySlots) {
      // is_current nur innerhalb der Feedbackschleifen verwalten
      const allAssets = (slot.assets || []).filter(a => !a.is_final);
      if (allAssets.length === 0) continue;

      const maxVersion = Math.max(...allAssets.map(a => a.version_number));
      const nonCurrentIds = allAssets.filter(a => a.version_number !== maxVersion).map(a => a.id);
      const currentIds = allAssets.filter(a => a.version_number === maxVersion).map(a => a.id);

      if (nonCurrentIds.length > 0) {
        await window.supabase
          .from('kooperation_story_asset')
          .update({ is_current: false })
          .in('id', nonCurrentIds);
      }
      if (currentIds.length > 0) {
        await window.supabase
          .from('kooperation_story_asset')
          .update({ is_current: true })
          .in('id', currentIds);
      }
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
