// CustomUploadTabHandler.js
// Tab-Handler für Upload-Spalten im VideoUploadDrawer: Dropzone für beliebige Dateitypen.
// Die Dateien landen in SharePoint im Spalten-Ordner der Kooperation (bzw. des Videos),
// den Ordner legt der Server an. Vorhandene Dateien: customUploadBestand.js.

import { backgroundUploadService, UPLOAD_EVENTS } from '../../core/BackgroundUploadService.js';
import { escapeHtml, mdcBtnIcon, ICON_UPLOAD_16 } from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';
import { formatGroesse, installCustomUploadBestand } from './customUploadBestand.js';

// Grenze von ablage-upload-ziel (MAX_BYTES.spalte)
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

export class CustomUploadTabHandler {
  constructor(drawer) {
    this.drawer = drawer;
    this._files = [];
    this._isUploading = false;
    this._existingAssets = [];
    this._onCustomDoneBound = (e) => this._onCustomDoneEvent(e);
  }

  get isUploading() { return this._isUploading; }

  async init() {}

  reset() {
    this._files = [];
    this._isUploading = false;
    this._existingAssets = [];
    window.removeEventListener(UPLOAD_EVENTS.CUSTOM_DONE, this._onCustomDoneBound);
  }

  renderTab(activeTab) {
    return `
      <div id="upload-tab-custom" style="${activeTab !== 'custom' ? 'display:none' : ''}">
        <div class="video-upload-drawer-content">
          <div class="upload-dropzone" id="custom-upload-dropzone">
            <div class="dropzone-content">
              ${icon('upload')}
              <p class="dropzone-text">Dateien hierher ziehen oder <button type="button" class="dropzone-browse-btn">Dateien auswählen</button></p>
              <p class="dropzone-hint">Alle Dateitypen – max. 2 GB pro Datei</p>
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

          <input type="file" id="custom-replace-file-input" style="display:none"/>

          <div class="existing-images-section" id="custom-existing-section">
            <div class="existing-images-header">
              <span class="existing-images-title">Vorhandene Dateien</span>
              <span class="existing-images-count" id="custom-existing-count"></span>
            </div>
            <div class="existing-images-list" id="custom-existing-list">
              <div class="existing-images-loading">Lade...</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents(panel) {
    document.getElementById('custom-upload-cancel-btn')?.addEventListener('click', () => this.drawer.close());
    document.getElementById('custom-upload-submit-btn')?.addEventListener('click', () => {
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

    document.getElementById('custom-existing-list')?.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.custom-asset-delete');
      if (deleteBtn?.dataset.id) {
        this._deleteExistingAsset(deleteBtn.dataset.id);
        return;
      }
      const replaceBtn = e.target.closest('.custom-asset-replace');
      if (replaceBtn?.dataset.id) this._replaceExistingAsset(replaceBtn.dataset.id);
    });

    window.addEventListener(UPLOAD_EVENTS.CUSTOM_DONE, this._onCustomDoneBound);
    this._loadExistingAssets();
  }

  // ─── File Management ────────────────────────────────────────

  _dateiFehler(file) {
    if (!file.size) return `${file.name}: Datei ist leer`;
    if (file.size > MAX_FILE_SIZE) return `${file.name}: zu groß (max. 2 GB)`;
    return null;
  }

  _showError(text) {
    const errorEl = document.getElementById('custom-upload-error');
    if (!errorEl) return;
    errorEl.textContent = text;
    errorEl.style.display = '';
    setTimeout(() => { errorEl.style.display = 'none'; }, 5000);
  }

  _addFiles(newFiles) {
    const errors = [];
    for (const file of newFiles) {
      const fehler = this._dateiFehler(file);
      if (fehler) {
        errors.push(fehler);
        continue;
      }
      if (this._files.some(f => f.name === file.name && f.size === file.size)) continue;
      this._files.push(file);
    }
    if (errors.length) this._showError(errors.join(', '));
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

    container.innerHTML = this._files.map((file, idx) => `
        <div class="upload-queue-item">
          <div class="upload-queue-item-info">
            <span class="upload-queue-item-name">${escapeHtml(file.name)}</span>
            <span class="upload-queue-item-size">${formatGroesse(file.size)}</span>
          </div>
          <button type="button" class="upload-queue-item-remove" data-idx="${idx}" title="Entfernen">&times;</button>
        </div>
      `).join('');

    container.querySelectorAll('.upload-queue-item-remove').forEach(btn => {
      btn.addEventListener('click', () => this._removeFile(parseInt(btn.dataset.idx, 10)));
    });
  }

  _updateSubmitBtn() {
    const btn = document.getElementById('custom-upload-submit-btn');
    if (btn) btn.disabled = this._files.length === 0 || this._isUploading;
  }

  // ─── Upload ────────────────────────────────────────────────

  _handleUpload() {
    this._isUploading = true;
    this._updateSubmitBtn();

    const meta = this.drawer.customMeta || {};
    backgroundUploadService.enqueueCustomUploadJob({
      columnId: meta.columnId,
      entityId: meta.entityId,
      files: [...this._files],
    });

    window.toastSystem?.show(`${this._files.length} Datei(en) werden hochgeladen…`, 'info');
    this.drawer.close();
  }

  _onCustomDoneEvent(e) {
    const { result } = e.detail || {};
    const meta = this.drawer.customMeta || {};
    if (result?.columnId === meta.columnId && result?.entityId === meta.entityId) {
      if (result.folderUrl) meta.onSuccess?.(result.folderUrl);
      if (document.getElementById('custom-existing-list')) this._loadExistingAssets();
    }
  }
}

installCustomUploadBestand(CustomUploadTabHandler.prototype);
