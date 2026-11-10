import { ICON_UPLOAD_16 } from '../../core/VideoUploadUtils.js';
import { backgroundUploadService, UPLOAD_EVENTS } from '../../core/BackgroundUploadService.js';
import { icon } from '../../core/icons/IconSystem.js';
import { videoTabShell } from './videoTabRender.js';
import { MAX_VIDEO_MB, addFiles, bindQueueEvents, renderQueue } from './videoTabQueue.js';
import { bindLinkEvents, handleFolderSubmit, handleLinkSubmit, renderLinkPane } from './videoTabLinks.js';
import { bindExistingEvents, loadExistingVideoAssets } from './videoTabExisting.js';

export class VideoTabHandler {
  constructor(drawer) {
    this.drawer = drawer;
    this._queue = [];
    this._isUploading = false;
    this._existingVersions = [];
    this._existingAssets = [];
    this._linkMode = 'video';
    this._folderUrl = '';
    this._onVideoDoneBound = (e) => this._onVideoDoneEvent(e);
  }

  get isUploading() { return this._isUploading; }

  reset() {
    this._queue = [];
    this._isUploading = false;
    this._existingAssets = [];
    this._folderUrl = this.drawer.metadaten?.folderUrl || '';
    this._linkMode = this._folderUrl ? 'folder' : 'video';
    window.removeEventListener(UPLOAD_EVENTS.VIDEO_DONE, this._onVideoDoneBound);
  }

  async _loadExistingVersions() {
    if (!this.drawer.videoId) return [];
    try {
      const { data, error } = await window.supabase
        .from('kooperation_video_asset')
        .select('version_number')
        .eq('video_id', this.drawer.videoId)
        .eq('is_final', false);
      if (error) return [];
      return [...new Set((data || []).map(a => a.version_number).filter(v => typeof v === 'number'))];
    } catch (err) {
      console.error('[VideoTabHandler] _loadExistingVersions:', err);
      return [];
    }
  }

  _loadExistingVideoAssets() {
    return loadExistingVideoAssets(this);
  }

  _addFiles(files) {
    addFiles(this, files);
  }

  // ─── Render ────────────────────────────────────────────────

  renderTab(activeTab) {
    if (this.drawer.useExternalLinks) return renderLinkPane(this, activeTab);
    const maxSize = MAX_VIDEO_MB >= 1024 ? `${MAX_VIDEO_MB / 1024} GB` : `${MAX_VIDEO_MB} MB`;
    return videoTabShell(activeTab, `
      <div class="upload-dropzone" id="video-upload-dropzone">
        <div class="dropzone-content">
          ${icon('upload')}
          <p class="dropzone-text">Videos hierher ziehen oder <button type="button" class="dropzone-browse-btn">Dateien auswählen</button></p>
          <p class="dropzone-hint">MP4, MOV, AVI, MKV – max. ${maxSize} pro Datei</p>
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
    `, { submitIcon: ICON_UPLOAD_16, submitLabel: 'Hochladen' });
  }

  // ─── Events ────────────────────────────────────────────────

  bindEvents(panel) {
    document.getElementById('video-upload-cancel-btn')?.addEventListener('click', () => this.drawer.close());
    document.getElementById('video-upload-submit-btn')?.addEventListener('click', () => this._submit());

    if (this.drawer.useExternalLinks) bindLinkEvents(this, panel);
    else this._bindDropzone(panel);

    bindQueueEvents(this);
    bindExistingEvents(this);
    this._updateSubmitButtonState();
  }

  _submit() {
    if (this._isUploading) return;
    if (this.drawer.useExternalLinks && this._linkMode === 'folder') {
      handleFolderSubmit(this);
      return;
    }
    if (this._queue.length === 0) return;
    if (this.drawer.useExternalLinks) handleLinkSubmit(this);
    else this.handleUpload();
  }

  _bindDropzone(panel) {
    const dropzone = document.getElementById('video-upload-dropzone');
    const fileInput = document.getElementById('video-upload-file-input');
    const browseBtn = panel?.querySelector('#upload-tab-video .dropzone-browse-btn');

    browseBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files?.length) addFiles(this, Array.from(e.target.files));
      fileInput.value = '';
    });

    dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone?.addEventListener('dragleave', () => { dropzone.classList.remove('dragover'); });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files?.length) addFiles(this, Array.from(files));
    });
  }

  _updateSubmitButtonState() {
    const submitBtn = document.getElementById('video-upload-submit-btn');
    if (!submitBtn) return;
    if (this.drawer.useExternalLinks && this._linkMode === 'folder') {
      submitBtn.disabled = this._isUploading || !(this._folderUrl || '').trim();
      return;
    }
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

  /** Abschluss-Event abonnieren (nur Refresh, wenn der Drawer noch offen ist). */
  _listenForVideoDone() {
    window.removeEventListener(UPLOAD_EVENTS.VIDEO_DONE, this._onVideoDoneBound);
    window.addEventListener(UPLOAD_EVENTS.VIDEO_DONE, this._onVideoDoneBound);
  }

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
      isFinal: !!q.isFinal,
    }));

    this._listenForVideoDone();

    const jobId = backgroundUploadService.enqueueVideoJob({
      videoId: this.drawer.videoId,
      metadaten: this.drawer.metadaten,
      queue: queueSnapshot,
      videoName,
    });

    // Queue lokal leeren — der Job ist jetzt der "Source of Truth"
    this._queue = [];
    renderQueue(this);
    this._updateSubmitButtonState();

    return jobId;
  }

  _onVideoDoneEvent(e) {
    const { videoId } = e.detail || {};
    if (videoId !== this.drawer.videoId) return;
    // Drawer noch offen? Asset-Liste refreshen
    if (document.getElementById('existing-videos-list')) {
      loadExistingVideoAssets(this);
    }
    if (typeof this.drawer.onSuccess === 'function') {
      this.drawer.onSuccess(e.detail?.result?.linkContent || null, null,
        e.detail?.result?.videoName || null, e.detail?.result?.folderUrl || null);
    }
    if (e.detail?.result?.hasFinalUpload) {
      this.drawer.onFinaleChanged?.(videoId);
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
