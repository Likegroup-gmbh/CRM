// CustomUploadTabHandler.js
// Tab-Handler fuer Custom Column Upload im VideoUploadDrawer.
// Ordnername-Eingabe + Dropzone fuer beliebige Dateitypen.

import { backgroundUploadService, UPLOAD_EVENTS } from '../../core/BackgroundUploadService.js';
import { escapeHtml, mdcBtnIcon, ICON_UPLOAD_16, ICON_CHECK_16, ICON_PLUS_16 } from '../../core/VideoUploadUtils.js';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

export class CustomUploadTabHandler {
  constructor(drawer) {
    this.drawer = drawer;
    this._files = [];
    this._isUploading = false;
    this._onCustomDoneBound = (e) => this._onCustomDoneEvent(e);
  }

  get isUploading() { return this._isUploading; }

  async init() {}

  reset() {
    this._files = [];
    this._isUploading = false;
    window.removeEventListener(UPLOAD_EVENTS.CUSTOM_DONE, this._onCustomDoneBound);
  }

  renderTab(activeTab) {
    const meta = this.drawer.customMeta || {};
    const defaultFolder = meta.folderName || meta.columnName || '';

    if (this.drawer.useExternalLinks) {
      return this._renderLinkTab(activeTab, defaultFolder);
    }

    return `
      <div id="upload-tab-custom" style="${activeTab !== 'custom' ? 'display:none' : ''}">
        <div class="video-upload-drawer-content">
          <div class="custom-upload-folder-row">
            <label class="custom-upload-label" for="custom-upload-folder-name">Ordnername in Dropbox</label>
            <input type="text" id="custom-upload-folder-name" class="custom-upload-folder-input"
              value="${escapeHtml(defaultFolder)}" placeholder="z.B. Extra Bilder, Dokumente …"/>
          </div>

          <div class="upload-dropzone" id="custom-upload-dropzone">
            <div class="dropzone-content">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="40" height="40" class="upload-dropzone-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
              </svg>
              <p class="dropzone-text">Dateien hierher ziehen oder <button type="button" class="dropzone-browse-btn">Dateien auswählen</button></p>
              <p class="dropzone-hint">Alle Dateitypen – max. 500 MB pro Datei</p>
            </div>
            <input type="file" id="custom-upload-file-input" multiple style="display:none"/>
          </div>

          <div class="upload-file-list" id="custom-upload-queue"></div>

          <div class="upload-error-msg" id="custom-upload-error" style="display:none;"></div>

          <div class="drawer-footer video-upload-drawer-footer">
            <button type="button" class="mdc-btn mdc-btn--cancel" id="custom-upload-cancel-btn">Abbrechen</button>
            <button type="button" class="mdc-btn mdc-btn--create" id="custom-upload-submit-btn" disabled>
              ${mdcBtnIcon(ICON_UPLOAD_16)}
              <span class="mdc-btn__label">Hochladen</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderLinkTab(activeTab, defaultFolder) {
    return `
      <div id="upload-tab-custom" style="${activeTab !== 'custom' ? 'display:none' : ''}">
        <div class="video-upload-drawer-content">
          <div class="custom-upload-link-section">
            <label class="custom-upload-label" for="custom-upload-link-input">Externer Link</label>
            <input type="text" id="custom-upload-link-input" class="custom-upload-folder-input"
              placeholder="https://..." value=""/>
          </div>

          <div class="upload-error-msg" id="custom-upload-error" style="display:none;"></div>

          <div class="drawer-footer video-upload-drawer-footer">
            <button type="button" class="mdc-btn mdc-btn--cancel" id="custom-upload-cancel-btn">Abbrechen</button>
            <button type="button" class="mdc-btn mdc-btn--create" id="custom-upload-link-save-btn">
              ${mdcBtnIcon(ICON_CHECK_16)}
              <span class="mdc-btn__label">Speichern</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents(panel) {
    const cancelBtn = document.getElementById('custom-upload-cancel-btn');
    cancelBtn?.addEventListener('click', () => this.drawer.close());

    if (this.drawer.useExternalLinks) {
      const saveBtn = document.getElementById('custom-upload-link-save-btn');
      saveBtn?.addEventListener('click', () => this._handleLinkSave());
      return;
    }

    const submitBtn = document.getElementById('custom-upload-submit-btn');
    submitBtn?.addEventListener('click', () => {
      if (this._files.length > 0 && !this._isUploading) this._handleUpload();
    });

    const dropzone = document.getElementById('custom-upload-dropzone');
    const fileInput = document.getElementById('custom-upload-file-input');
    const browseBtn = panel?.querySelector('#upload-tab-custom .dropzone-browse-btn');

    browseBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files?.length) this._addFiles(Array.from(e.target.files));
      fileInput.value = '';
    });

    dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer?.files?.length) this._addFiles(Array.from(e.dataTransfer.files));
    });

    window.addEventListener(UPLOAD_EVENTS.CUSTOM_DONE, this._onCustomDoneBound);
  }

  // ─── File Management ────────────────────────────────────────

  _addFiles(newFiles) {
    const errorEl = document.getElementById('custom-upload-error');
    const errors = [];

    for (const file of newFiles) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: zu groß (max. 500 MB)`);
        continue;
      }
      if (this._files.some(f => f.name === file.name && f.size === file.size)) continue;
      this._files.push(file);
    }

    if (errors.length && errorEl) {
      errorEl.textContent = errors.join(', ');
      errorEl.style.display = '';
      setTimeout(() => { errorEl.style.display = 'none'; }, 5000);
    }

    this._renderQueue();
    this._updateSubmitBtn();
  }

  _removeFile(idx) {
    this._files.splice(idx, 1);
    this._renderQueue();
    this._updateSubmitBtn();
  }

  _renderQueue() {
    const container = document.getElementById('custom-upload-queue');
    if (!container) return;

    if (this._files.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = this._files.map((file, idx) => {
      const sizeStr = this._formatSize(file.size);
      return `
        <div class="upload-queue-item">
          <div class="upload-queue-item-info">
            <span class="upload-queue-item-name">${escapeHtml(file.name)}</span>
            <span class="upload-queue-item-size">${sizeStr}</span>
          </div>
          <button type="button" class="upload-queue-item-remove" data-idx="${idx}" title="Entfernen">&times;</button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.upload-queue-item-remove').forEach(btn => {
      btn.addEventListener('click', () => this._removeFile(parseInt(btn.dataset.idx, 10)));
    });
  }

  _updateSubmitBtn() {
    const btn = document.getElementById('custom-upload-submit-btn');
    if (btn) btn.disabled = this._files.length === 0 || this._isUploading;
  }

  _formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ─── Upload ────────────────────────────────────────────

  async _handleUpload() {
    const folderInput = document.getElementById('custom-upload-folder-name');
    const folderName = folderInput?.value.trim();

    if (!folderName) {
      window.toastSystem?.show('Bitte einen Ordnernamen eingeben', 'warning');
      folderInput?.focus();
      return;
    }

    this._isUploading = true;
    this._updateSubmitBtn();

    const meta = this.drawer.customMeta || {};

    backgroundUploadService.enqueueCustomUploadJob({
      columnId: meta.columnId,
      entityId: meta.entityId,
      metadaten: this.drawer.metadaten,
      files: [...this._files],
      folderName,
      valueTable: meta.valueTable,
      assetTable: meta.assetTable,
    });

    window.toastSystem?.show(`${this._files.length} Datei(en) werden hochgeladen…`, 'info');
    this.drawer.close();
  }

  async _handleLinkSave() {
    const linkInput = document.getElementById('custom-upload-link-input');
    const url = linkInput?.value.trim();
    if (!url) {
      window.toastSystem?.show('Bitte einen Link eingeben', 'warning');
      return;
    }

    const meta = this.drawer.customMeta || {};
    try {
      await window.supabase.from(meta.valueTable || 'custom_column_values').upsert(
        {
          custom_column_id: meta.columnId,
          entity_id: meta.entityId,
          value: url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'custom_column_id,entity_id' }
      );
      meta.onSuccess?.(url);
      window.toastSystem?.show('Link gespeichert', 'success');
      this.drawer.close();
    } catch (err) {
      console.error('Link speichern fehlgeschlagen:', err);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
    }
  }

  _onCustomDoneEvent(e) {
    const { result } = e.detail || {};
    const meta = this.drawer.customMeta || {};
    if (result?.columnId === meta.columnId && result?.entityId === meta.entityId) {
      meta.onSuccess?.(result.folderUrl);
    }
  }
}
