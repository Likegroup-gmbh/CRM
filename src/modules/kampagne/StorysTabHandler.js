// StorysTabHandler.js
// Storys-Tab im VideoUploadDrawer: Story-Videos auswählen, Slot und Feedbackschleife je Datei
// wählen, im Hintergrund nach SharePoint hochladen. Slots: storysTabSlots.js, HTML: storysTabRender.js.

import {
  getAvailableVersions, MAX_VERSIONS, FINAL_VARIANTS,
  VIDEO_EXTENSIONS, VIDEO_MIME_TYPES, MAX_STORY_SIZE,
} from '../../core/VideoUploadUtils.js';
import { backgroundUploadService, UPLOAD_EVENTS } from '../../core/BackgroundUploadService.js';
import { storysQueueHtml, storysTabHtml } from './storysTabRender.js';
import { installStorysTabSlots } from './storysTabSlots.js';

const MAX_STORY_MB = Math.round(MAX_STORY_SIZE / (1024 * 1024));
const MAX_STORY_LABEL = MAX_STORY_MB >= 1024 ? `${MAX_STORY_MB / 1024} GB` : `${MAX_STORY_MB} MB`;

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

  // ─── Render ────────────────────────────────────────────────

  renderTab(activeTab) {
    return storysTabHtml(activeTab, MAX_STORY_LABEL);
  }

  // ─── Events ────────────────────────────────────────────────

  bindEvents(_panel) {
    const cancelBtn = document.getElementById('storys-upload-cancel-btn');
    const submitBtn = document.getElementById('storys-upload-submit-btn');

    cancelBtn?.addEventListener('click', () => this.drawer.close());
    submitBtn?.addEventListener('click', () => {
      if (this._queue.length > 0 && !this._isUploadingStorys) this._handleStorysUpload();
    });

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

    const previewList = document.getElementById('storys-preview-list');
    previewList?.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.storys-file-remove');
      if (removeBtn) this._removeQueueItem(parseInt(removeBtn.dataset.idx, 10));
    });
    previewList?.addEventListener('change', (e) => {
      const slotSelect = e.target.closest('.storys-slot-select');
      const versionSelect = e.target.closest('.storys-version-select');
      const finalVariantSelect = e.target.closest('.storys-final-variant-select');
      if (slotSelect) this._onSlotChange(parseInt(slotSelect.dataset.idx, 10), slotSelect.value);
      if (versionSelect) this._onVersionChange(parseInt(versionSelect.dataset.idx, 10), versionSelect.value);
      if (finalVariantSelect) {
        const idx = parseInt(finalVariantSelect.dataset.idx, 10);
        if (this._queue[idx]) this._queue[idx].variantName = finalVariantSelect.value;
      }
    });
    previewList?.addEventListener('input', (e) => {
      const variantInput = e.target.closest('.storys-variant-name-input');
      if (!variantInput) return;
      const idx = parseInt(variantInput.dataset.idx, 10);
      if (this._queue[idx]) this._queue[idx].variantName = variantInput.value;
      this._updateSubmitState();
    });

    const existingList = document.getElementById('existing-storys-list');
    existingList?.addEventListener('click', (e) => {
      const deleteSlotBtn = e.target.closest('.existing-story-slot-delete');
      if (deleteSlotBtn?.dataset.slotId) this._deleteSlot(deleteSlotBtn.dataset.slotId);
    });
  }

  // ─── File Selection / Queue ────────────────────────────────

  _addStorys(files) {
    this._hideStorysError();
    const rejected = [];

    for (const file of files) {
      if (file.size > MAX_STORY_SIZE) {
        rejected.push(`${file.name}: zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB, max. ${MAX_STORY_LABEL})`);
        continue;
      }

      const isVideo = VIDEO_MIME_TYPES.includes(file.type) || VIDEO_EXTENSIONS.test(file.name);
      if (!isVideo) {
        rejected.push(`${file.name}: kein unterstütztes Videoformat`);
        continue;
      }

      const alreadyQueued = this._queue.some(q => q.file.name === file.name && q.file.size === file.size);
      if (!alreadyQueued) {
        this._queue.push({ file, slotId: '__new__', versionNumber: 1, variantName: '' });
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
    if (!item.isFinal) {
      // Finale-Auswahl bleibt beim Slot-Wechsel erhalten
      const slot = value === '__new__' ? null : this._storySlots.find(s => s.id === value);
      item.versionNumber = this._getNextVersionForSlot(slot);
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

  _renderQueue() {
    const list = document.getElementById('storys-preview-list');
    if (!list) return;
    list.innerHTML = this._queue.length ? storysQueueHtml(this._queue, this._storySlots) : '';
  }

  _updateSubmitState() {
    const btn = document.getElementById('storys-upload-submit-btn');
    if (btn) btn.disabled = this._queue.length === 0;
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

installStorysTabSlots(StorysTabHandler.prototype);
