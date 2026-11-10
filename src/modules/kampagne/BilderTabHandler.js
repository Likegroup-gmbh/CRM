import { IMAGE_EXTENSIONS, IMAGE_MIME_PREFIX, MAX_IMAGE_SIZE } from '../../core/VideoUploadUtils.js';
import { STILL_FINAL_VARIANT } from '../../core/stills/stillAssets.js';
import { bilderUploadPane, bilderLinkPane, linkQueueHtml, fileQueueHtml } from './bilderTabRender.js';
import { handleBilderUpload, handleBilderLinkSubmit } from './bilderTabUpload.js';
import { bindExistingEvents, loadExistingImages } from './bilderTabExisting.js';

export class BilderTabHandler {
  constructor(drawer) {
    this.drawer = drawer;
    this._selectedImages = [];
    this._existingImages = [];
    this._isUploadingImages = false;
    this._initialized = false;
  }

  get isUploading() { return this._isUploadingImages; }

  async ensureInitialized() {
    if (this._initialized) return;
    this._initialized = true;
    await this._loadExistingImages();
  }

  reset() {
    this._selectedImages = [];
    this._existingImages = [];
    this._existingVersions = [];
    this._linkQueue = [];
    this._isUploadingImages = false;
    this._initialized = false;
  }

  _loadExistingImages() {
    return loadExistingImages(this);
  }

  _defaultVersion() {
    return this._existingVersions.length > 0 ? Math.max(...this._existingVersions) : 1;
  }

  _newQueueItem({ file = null, url = '' } = {}) {
    if (this.drawer.preselectFinal) {
      return { file, url, variantName: STILL_FINAL_VARIANT, versionNumber: 1, isFinal: true };
    }
    return { file, url, variantName: '', versionNumber: this._defaultVersion(), isFinal: false };
  }

  _queueItemAt(idx) {
    if (this.drawer.useExternalLinks) return this._linkQueue?.[idx];
    return this._selectedImages[idx];
  }

  // ─── Render ────────────────────────────────────────────────

  renderTab(activeTab) {
    return this.drawer.useExternalLinks ? bilderLinkPane(activeTab) : bilderUploadPane(activeTab);
  }

  // ─── Events ────────────────────────────────────────────────

  bindEvents(_panel) {
    const cancelBtn = document.getElementById('bilder-upload-cancel-btn');
    const submitBtn = document.getElementById('bilder-upload-submit-btn');

    cancelBtn?.addEventListener('click', () => this.drawer.close());
    submitBtn?.addEventListener('click', () => {
      if (this.drawer.useExternalLinks) {
        if (this._linkQueue && this._linkQueue.length > 0 && !this._isUploadingImages) handleBilderLinkSubmit(this);
      } else {
        if (this._selectedImages.length > 0 && !this._isUploadingImages) handleBilderUpload(this);
      }
    });

    if (this.drawer.useExternalLinks) {
      const addLinkBtn = document.getElementById('bilder-link-add-btn');
      addLinkBtn?.addEventListener('click', () => this._addBilderLinkEntry());
    } else {
      this._bindDropzone();
    }

    this._bindQueueEvents();
    bindExistingEvents(this);
  }

  _bindDropzone() {
    const dropzone = document.getElementById('bilder-upload-dropzone');
    const fileInput = document.getElementById('bilder-upload-file-input');
    const browseBtn = document.getElementById('bilder-browse-btn');

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
  }

  _bindQueueEvents() {
    const previewList = document.getElementById('bilder-preview-list');
    previewList?.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.bilder-file-remove');
      if (removeBtn) {
        const idx = parseInt(removeBtn.dataset.idx, 10);
        if (this.drawer.useExternalLinks) {
          this._removeBilderLink(idx);
        } else {
          this._removeSelectedImage(idx);
        }
      }
    });
    previewList?.addEventListener('input', (e) => {
      const urlInput = e.target.closest('.bilder-link-url-input');
      if (urlInput) {
        const idx = parseInt(urlInput.dataset.idx, 10);
        if (this._linkQueue && this._linkQueue[idx]) {
          this._linkQueue[idx].url = urlInput.value;
        }
        this._updateBilderSubmitState();
      }
      const variantInput = e.target.closest('.bilder-variant-name-input');
      if (variantInput) {
        const idx = parseInt(variantInput.dataset.idx, 10);
        const item = this._queueItemAt(idx);
        if (item) item.variantName = variantInput.value;
      }
    });
    previewList?.addEventListener('change', (e) => {
      const versionSelect = e.target.closest('.bilder-version-select');
      if (!versionSelect) return;
      const idx = parseInt(versionSelect.dataset.idx, 10);
      const item = this._queueItemAt(idx);
      if (!item) return;
      if (versionSelect.value === 'final') {
        item.isFinal = true;
        item.versionNumber = 1;
        item.variantName = STILL_FINAL_VARIANT;
      } else {
        if (item.isFinal) item.variantName = '';
        item.isFinal = false;
        item.versionNumber = parseInt(versionSelect.value, 10);
      }
      this._renderSelectedImagesList();
    });
  }

  // ─── File Selection ────────────────────────────────────────

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

      const alreadySelected = this._selectedImages.some(q => q.file?.name === file.name && q.file?.size === file.size);
      if (!alreadySelected) {
        this._selectedImages.push(this._newQueueItem({ file }));
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

    if (this._selectedImages.length === 0 && !(this.drawer.useExternalLinks && this._linkQueue?.length)) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = this.drawer.useExternalLinks
      ? linkQueueHtml(this._linkQueue || [], this._existingVersions)
      : fileQueueHtml(this._selectedImages, this._existingVersions);
  }

  _updateBilderSubmitState() {
    const btn = document.getElementById('bilder-upload-submit-btn');
    if (!btn) return;
    if (this.drawer.useExternalLinks) {
      const hasLinks = this._linkQueue && this._linkQueue.length > 0;
      const allFilled = hasLinks && this._linkQueue.every(q => (q.url || '').trim().length > 0);
      btn.disabled = this._isUploadingImages || !allFilled;
    } else {
      btn.disabled = this._isUploadingImages || this._selectedImages.length === 0;
    }
  }

  // ─── External Link Mode ─────────────────────────────────────

  _addBilderLinkEntry() {
    if (!this._linkQueue) this._linkQueue = [];
    this._linkQueue.push(this._newQueueItem({ url: '' }));
    this._renderSelectedImagesList();
    this._updateBilderSubmitState();
  }

  _removeBilderLink(idx) {
    if (!this._linkQueue) return;
    this._linkQueue.splice(idx, 1);
    this._renderSelectedImagesList();
    this._updateBilderSubmitState();
  }

  // ─── Error Helpers ─────────────────────────────────────────

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
}
