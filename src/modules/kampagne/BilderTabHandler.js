import {
  escapeHtml, readFileAsBase64, proxyPost, uploadLargeFile, createFolderSharedLink,
  IMAGE_EXTENSIONS, IMAGE_MIME_PREFIX, MAX_IMAGE_SIZE, MAX_VERSIONS,
  buildVersionedFileName, buildFinalFileName,
  normalizeExternalUrl, isValidExternalUrl,
  mdcBtnIcon, ICON_PLUS_16, ICON_CHECK_16, ICON_UPLOAD_16
} from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';
import { STILL_FINAL_VARIANT, updateStillCurrentFlags } from '../../core/stills/stillAssets.js';

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

  _buildVersionOptions(item) {
    const allVersions = Array.from({ length: MAX_VERSIONS }, (_, i) => i + 1);
    let html = allVersions.map(v => {
      const exists = this._existingVersions.includes(v);
      const label = exists ? `Feedbackschleife ${v} (hinzufügen)` : `Feedbackschleife ${v}`;
      const selected = !item.isFinal && v === item.versionNumber ? ' selected' : '';
      return `<option value="${v}"${selected}>${label}</option>`;
    }).join('');
    html += `<option value="final"${item.isFinal ? ' selected' : ''}>Finale Version</option>`;
    return html;
  }

  // ─── Render ────────────────────────────────────────────────

  renderTab(activeTab) {
    if (this.drawer.useExternalLinks) {
      return this._renderLinkTab(activeTab);
    }
    return `
      <div id="upload-tab-bilder" style="${activeTab !== 'bilder' ? 'display:none' : ''}">
        <div class="bilder-upload-drawer-content">
          <div class="upload-dropzone" id="bilder-upload-dropzone">
            <div class="dropzone-content">
              ${icon('photo')}
              <p class="dropzone-text">Stills hierher ziehen oder <button type="button" class="dropzone-browse-btn" id="bilder-browse-btn">Dateien auswählen</button></p>
              <p class="dropzone-hint">Alle Bildformate – max. 50 MB pro Bild</p>
            </div>
            <input type="file" id="bilder-upload-file-input" accept="image/*" multiple style="display:none"/>
          </div>

          <div class="upload-file-list" id="bilder-preview-list"></div>

          <div class="upload-progress-container" id="bilder-upload-progress" style="display:none;">
            <div class="upload-progress-bar">
              <div class="upload-progress-fill" id="bilder-upload-progress-fill" style="width:0%"></div>
            </div>
            <div class="upload-progress-text" id="bilder-upload-progress-text">Wird hochgeladen...</div>
          </div>

          <div class="upload-error-msg" id="bilder-upload-error" style="display:none;"></div>

          <div class="drawer-footer bilder-upload-drawer-footer">
            <button type="button" class="mdc-btn mdc-btn--cancel" id="bilder-upload-cancel-btn">Abbrechen</button>
            <button type="button" class="mdc-btn mdc-btn--create" id="bilder-upload-submit-btn" disabled>
              ${mdcBtnIcon(ICON_UPLOAD_16)}
              <span class="mdc-btn__label">Hochladen</span>
            </button>
          </div>

          <div class="existing-images-section" id="existing-images-section">
            <div class="existing-images-header">
              <span class="existing-images-title">Vorhandene Stills</span>
              <span class="existing-images-count" id="existing-images-count"></span>
            </div>
            <div class="existing-images-list" id="existing-images-list">
              <div class="existing-images-loading">Lade...</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderLinkTab(activeTab) {
    return `
      <div id="upload-tab-bilder" style="${activeTab !== 'bilder' ? 'display:none' : ''}">
        <div class="bilder-upload-drawer-content">
          <div class="link-add-section">
            <button type="button" class="mdc-btn upload-drawer-btn--secondary" id="bilder-link-add-btn">
              ${mdcBtnIcon(ICON_PLUS_16)}
              <span class="mdc-btn__label">Still-Link hinzufügen</span>
            </button>
          </div>

          <div class="upload-file-list" id="bilder-preview-list"></div>

          <div class="upload-error-msg" id="bilder-upload-error" style="display:none;"></div>

          <div class="drawer-footer bilder-upload-drawer-footer">
            <button type="button" class="mdc-btn mdc-btn--cancel" id="bilder-upload-cancel-btn">Abbrechen</button>
            <button type="button" class="mdc-btn mdc-btn--create" id="bilder-upload-submit-btn" disabled>
              ${mdcBtnIcon(ICON_CHECK_16)}
              <span class="mdc-btn__label">Speichern</span>
            </button>
          </div>

          <div class="existing-images-section" id="existing-images-section">
            <div class="existing-images-header">
              <span class="existing-images-title">Vorhandene Stills</span>
              <span class="existing-images-count" id="existing-images-count"></span>
            </div>
            <div class="existing-images-list" id="existing-images-list">
              <div class="existing-images-loading">Lade...</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Events ────────────────────────────────────────────────

  bindEvents(_panel) {
    const cancelBtn = document.getElementById('bilder-upload-cancel-btn');
    const submitBtn = document.getElementById('bilder-upload-submit-btn');

    cancelBtn?.addEventListener('click', () => this.drawer.close());
    submitBtn?.addEventListener('click', () => {
      if (this.drawer.useExternalLinks) {
        if (this._linkQueue && this._linkQueue.length > 0 && !this._isUploadingImages) this._handleBilderLinkSubmit();
      } else {
        if (this._selectedImages.length > 0 && !this._isUploadingImages) this._handleBilderUpload();
      }
    });

    if (this.drawer.useExternalLinks) {
      const addLinkBtn = document.getElementById('bilder-link-add-btn');
      addLinkBtn?.addEventListener('click', () => this._addBilderLinkEntry());
    } else {
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

    const existingList = document.getElementById('existing-images-list');
    existingList?.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.existing-image-delete');
      if (deleteBtn) {
        const assetId = deleteBtn.dataset.id;
        const path = deleteBtn.dataset.path;
        if (assetId) this._deleteExistingImage(assetId, path);
      }
    });
    existingList?.addEventListener('change', (e) => {
      const select = e.target.closest('.existing-image-video-select');
      if (select) {
        const assetId = select.dataset.id;
        if (assetId) this._assignImageToVideo(assetId, select.value || null);
      }
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

    if (this.drawer.useExternalLinks) {
      list.innerHTML = (this._linkQueue || []).map((item, i) => `
        <div class="upload-file-item video-queue-item">
          <div class="video-queue-variant flex-1">
            <input type="url" class="form-input bilder-link-url-input" data-idx="${i}"
              value="${escapeHtml(item.url || '')}" placeholder="https://..." />
          </div>
          <div class="video-queue-variant">
            <input type="text" class="form-input bilder-variant-name-input" data-idx="${i}"
              value="${escapeHtml(item.variantName || '')}" placeholder="Varianten-Name" maxlength="120"/>
          </div>
          <div class="video-queue-selects">
            <select class="form-input bilder-version-select" data-idx="${i}">${this._buildVersionOptions(item)}</select>
          </div>
          <button type="button" class="file-remove-btn bilder-file-remove" data-idx="${i}" title="Entfernen">&times;</button>
        </div>
      `).join('');
      return;
    }

    list.innerHTML = this._selectedImages.map((item, i) => `
      <div class="upload-file-item video-queue-item">
        <div class="file-info">
          <span class="file-name">${escapeHtml(item.file.name)}</span>
          <span class="file-size">${(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
        </div>
        <div class="video-queue-variant">
          <input type="text" class="form-input bilder-variant-name-input" data-idx="${i}"
            value="${escapeHtml(item.variantName || '')}" placeholder="Varianten-Name" maxlength="120"/>
        </div>
        <div class="video-queue-selects">
          <select class="form-input bilder-version-select" data-idx="${i}">${this._buildVersionOptions(item)}</select>
        </div>
        <button type="button" class="file-remove-btn bilder-file-remove" data-idx="${i}" title="Entfernen">&times;</button>
      </div>
    `).join('');
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

  // ─── Upload ────────────────────────────────────────────────

  async _handleBilderUpload() {
    if (this._selectedImages.length === 0 || this._isUploadingImages) return;
    this._isUploadingImages = true;

    const submitBtn = document.getElementById('bilder-upload-submit-btn');
    const cancelBtn = document.getElementById('bilder-upload-cancel-btn');
    const progressContainer = document.getElementById('bilder-upload-progress');
    const progressFill = document.getElementById('bilder-upload-progress-fill');
    const progressText = document.getElementById('bilder-upload-progress-text');

    if (submitBtn) submitBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
    if (progressContainer) progressContainer.style.display = 'block';
    this._hideBilderError();

    const total = this._selectedImages.length;
    let uploaded = 0;
    let token = null;
    let folderPath = null;

    try {
      if (progressText) progressText.textContent = 'Verbinde mit Dropbox...';
      const firstItem = this._selectedImages[0];
      const firstFile = firstItem.file;
      const prepareResp = await fetch('/.netlify/functions/dropbox-upload-bilder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prepare',
          unternehmen: this.drawer.metadaten.unternehmen || '',
          marke: this.drawer.metadaten.marke || '',
          kampagne: this.drawer.metadaten.kampagne || '',
          kooperation: this.drawer.metadaten.kooperationName || '',
          videoPosition: this.drawer.metadaten.videoPosition || 1,
          videoThema: this.drawer.metadaten.videoThema || '',
          fileName: firstFile.name,
          versionNumber: firstItem.versionNumber || 1,
          isFinal: !!firstItem.isFinal,
        })
      });

      if (!prepareResp.ok) {
        const errData = await prepareResp.json().catch(() => ({}));
        throw new Error(errData.error || `Vorbereitung fehlgeschlagen (${prepareResp.status})`);
      }

      const prepareData = await prepareResp.json();
      token = prepareData.token;
      folderPath = prepareData.folderPath;
      const rootFolderPath = prepareData.rootFolderPath || folderPath;

      const uploadedFiles = [];

      for (let i = 0; i < this._selectedImages.length; i++) {
        const item = this._selectedImages[i];
        const file = item.file;
        const pct = Math.round((i / total) * 90);
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (progressText) progressText.textContent = `Lade hoch... ${i + 1}/${total}: ${file.name}`;

        const ext = (file.name.split('.').pop() || 'jpg');
        const fileName = item.isFinal
          ? buildFinalFileName(
              this.drawer.metadaten?.creatorName || '',
              this.drawer.metadaten?.unternehmen || '',
              this.drawer.metadaten?.kampagne || '',
              item.variantName || STILL_FINAL_VARIANT,
              ext
            )
          : buildVersionedFileName(
              this.drawer.metadaten?.creatorName || '',
              this.drawer.metadaten?.unternehmen || '',
              this.drawer.metadaten?.kampagne || '',
              item.versionNumber || 1,
              ext
            );

        const itemPrepare = await fetch('/.netlify/functions/dropbox-upload-bilder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'prepare',
            unternehmen: this.drawer.metadaten.unternehmen || '',
            marke: this.drawer.metadaten.marke || '',
            kampagne: this.drawer.metadaten.kampagne || '',
            kooperation: this.drawer.metadaten.kooperationName || '',
            videoPosition: this.drawer.metadaten.videoPosition || 1,
            videoThema: this.drawer.metadaten.videoThema || '',
            fileName,
            versionNumber: item.versionNumber || 1,
            isFinal: !!item.isFinal,
          }),
        });
        if (!itemPrepare.ok) throw new Error('Dropbox-Pfad konnte nicht vorbereitet werden');
        const itemData = await itemPrepare.json();
        token = itemData.token || token;
        const dropboxPath = itemData.dropboxPath;
        if (!folderPath) folderPath = itemData.folderPath;
        const CHUNK_SIZE = 2 * 1024 * 1024;

        if (file.size <= CHUNK_SIZE) {
          const chunk = await readFileAsBase64(file);
          await proxyPost({ action: 'upload-small', dropboxPath, chunk, token });
        } else {
          await uploadLargeFile(file, dropboxPath, token);
        }

        uploadedFiles.push({
          name: fileName,
          size: file.size,
          path: dropboxPath,
          versionNumber: item.versionNumber || 1,
          isFinal: !!item.isFinal,
          variantName: (item.variantName || '').trim() || null,
        });
        uploaded++;
      }

      if (progressFill) progressFill.style.width = '92%';
      if (progressText) progressText.textContent = 'Erstelle Links...';

      // Shared-Link immer auf den Koop-weiten /Bilder-Wurzelordner (Flag + Ordner-Link)
      const bilderFolderUrl = await createFolderSharedLink(token, rootFolderPath);

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

      if (this.drawer.kooperationId && fileLinks.length > 0) {
        const insertRows = fileLinks.map(fl => ({
          kooperation_id: this.drawer.kooperationId,
          video_id: this.drawer.videoId || null,
          file_url: fl.fileUrl,
          file_path: fl.path,
          file_name: fl.name,
          file_size: fl.size,
          version_number: fl.versionNumber || 1,
          is_current: !fl.isFinal,
          is_final: !!fl.isFinal,
          variant_name: fl.variantName || null,
          uploaded_by: window.currentUser?.id || null,
          created_at: new Date().toISOString(),
        }));

        const { error: insertErr } = await window.supabase
          .from('kooperation_bilder_asset')
          .insert(insertRows);
        if (insertErr) console.warn('Bilder-Asset DB-Insert fehlgeschlagen:', insertErr);
        else if (this.drawer.videoId) await updateStillCurrentFlags(this.drawer.videoId);
      }

      if (bilderFolderUrl && this.drawer.kooperationId) {
        await window.supabase
          .from('kooperationen')
          .update({ bilder_folder_url: bilderFolderUrl })
          .eq('id', this.drawer.kooperationId);
      }

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = `${uploaded} Bild${uploaded !== 1 ? 'er' : ''} hochgeladen!`;

      this._isUploadingImages = false;
      this._selectedImages = [];
      this._renderSelectedImagesList();

      if (typeof this.drawer.onBilderSuccess === 'function') {
        this.drawer.onBilderSuccess(bilderFolderUrl);
      }
      if (fileLinks.some(fl => fl.isFinal)) this.drawer.onFinaleChanged?.(this.drawer.videoId);

      await this._loadExistingImages();

      setTimeout(() => {
        if (submitBtn) submitBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = false;
        if (progressContainer) progressContainer.style.display = 'none';
      }, 1500);

    } catch (err) {
      console.error('Bilder-Upload fehlgeschlagen:', err);
      this._showBilderError(err.message || 'Upload fehlgeschlagen');
      if (submitBtn) submitBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      this._isUploadingImages = false;
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

  _renderBilderLinkList() {
    const list = document.getElementById('bilder-preview-list');
    if (!list) return;
    if (!this._linkQueue || this._linkQueue.length === 0) {
      list.innerHTML = '';
      return;
    }
    list.innerHTML = this._linkQueue.map((item, i) => `
      <div class="upload-file-item">
        <div class="file-info">
          <input type="url" class="form-input bilder-link-url-input" data-idx="${i}"
            value="${escapeHtml(item.url || '')}"
            placeholder="https://..." />
        </div>
        <button type="button" class="file-remove-btn bilder-file-remove" data-idx="${i}" title="Entfernen">&times;</button>
      </div>
    `).join('');
  }

  async _handleBilderLinkSubmit() {
    if (!this._linkQueue || this._linkQueue.length === 0 || this._isUploadingImages) return;
    this._hideBilderError();

    const invalid = this._linkQueue.filter(q => !isValidExternalUrl(normalizeExternalUrl(q.url)));
    if (invalid.length > 0) {
      this._showBilderError('Bitte gültige URLs eingeben (https://...)');
      return;
    }

    this._isUploadingImages = true;
    this._updateBilderSubmitState();

    try {
      const insertRows = this._linkQueue.map(item => ({
        kooperation_id: this.drawer.kooperationId,
        video_id: this.drawer.videoId || null,
        file_url: normalizeExternalUrl(item.url),
        file_path: null,
        file_name: item.url.split('/').pop() || 'Link',
        file_size: 0,
        version_number: item.versionNumber || 1,
        is_current: !item.isFinal,
        is_final: !!item.isFinal,
        variant_name: (item.variantName || '').trim() || null,
        uploaded_by: window.currentUser?.id || null,
        created_at: new Date().toISOString(),
      }));

      const { error: insertErr } = await window.supabase
        .from('kooperation_bilder_asset')
        .insert(insertRows);
      if (insertErr) throw insertErr;
      if (this.drawer.videoId) await updateStillCurrentFlags(this.drawer.videoId);

      this._linkQueue = [];
      this._renderSelectedImagesList();
      this._isUploadingImages = false;
      this._updateBilderSubmitState();
      this.drawer.onBilderChanged?.();
      if (insertRows.some(r => r.is_final)) this.drawer.onFinaleChanged?.(this.drawer.videoId);
      await this._loadExistingImages();
      window.toastSystem?.success?.('Bilder-Links gespeichert');
    } catch (err) {
      console.error('[BilderTabHandler] Link-Submit fehlgeschlagen:', err);
      this._showBilderError(err.message || 'Speichern fehlgeschlagen');
      this._isUploadingImages = false;
      this._updateBilderSubmitState();
    }
  }

  // ─── Existing Images ──────────────────────────────────────

  async _loadExistingImages() {
    const listEl = document.getElementById('existing-images-list');
    const countEl = document.getElementById('existing-images-count');
    if (listEl) listEl.innerHTML = '<div class="existing-images-loading">Lade...</div>';

    try {
      if (!this.drawer.kooperationId) {
        this._existingImages = [];
        if (countEl) countEl.textContent = '(0)';
        if (listEl) listEl.innerHTML = '<div class="existing-images-empty">Keine Bilder vorhanden</div>';
        return;
      }

      const { data, error } = await window.supabase
        .from('kooperation_bilder_asset')
        .select('id, video_id, file_url, file_path, file_name, file_size, version_number, is_current, is_final, variant_name, created_at')
        .eq('kooperation_id', this.drawer.kooperationId)
        .order('file_name', { ascending: true });

      if (error) throw error;
      this._existingImages = data || [];
      this._existingVersions = [...new Set(
        this._existingImages
          .filter(a => !a.is_final && a.video_id === this.drawer.videoId)
          .map(a => a.version_number)
          .filter(v => typeof v === 'number')
      )];

      if (countEl) countEl.textContent = `(${this._existingImages.length})`;

      if (!listEl) return;

      if (this._existingImages.length === 0) {
        listEl.innerHTML = '<div class="existing-images-empty">Keine Bilder vorhanden</div>';
        return;
      }

      const TRASH_ICON = icon('trash-alt');

      const videos = this._getKoopVideos();
      const videoLabel = v => `Video ${v.position || 1}${v.thema ? ` – ${v.thema}` : ''}`;

      const renderItem = (img) => {
        const sizeMB = img.file_size ? (img.file_size / 1024 / 1024).toFixed(1) + ' MB' : '';
        const name = img.file_name || img.file_path?.split('/').pop() || '?';
        const versionLabel = img.is_final ? 'Finale' : `FS${img.version_number || 1}`;
        const currentBadge = img.is_current && !img.is_final ? ' <span class="version-badge version-badge--current">aktuell</span>' : '';
        const videoSelect = videos.length > 0 ? `
              <select class="existing-image-video-select" data-id="${img.id}" title="Video zuordnen">
                <option value="">Nicht zugeordnet</option>
                ${videos.map(v => `<option value="${v.id}" ${img.video_id === v.id ? 'selected' : ''}>${escapeHtml(videoLabel(v))}</option>`).join('')}
              </select>` : '';
        return `
          <div class="existing-image-item existing-storys-asset-item">
            <div class="existing-image-info">
              <span class="existing-image-name">${escapeHtml(name)}${img.variant_name ? ` · ${escapeHtml(img.variant_name)}` : ''} · ${versionLabel}${currentBadge}${sizeMB ? ` · ${sizeMB}` : ''}</span>
            </div>
            <div class="existing-asset-actions">
              ${videoSelect}
              <button type="button" class="existing-image-delete" data-id="${img.id}" data-path="${escapeHtml(img.file_path || '')}" title="Löschen">${TRASH_ICON}</button>
            </div>
          </div>`;
      };

      if (videos.length === 0) {
        listEl.innerHTML = this._existingImages.map(renderItem).join('');
      } else {
        const groups = [];
        for (const v of videos) {
          const imgs = this._existingImages.filter(i => i.video_id === v.id);
          if (imgs.length) groups.push({ label: videoLabel(v), imgs });
        }
        const unassigned = this._existingImages.filter(i => !i.video_id || !videos.some(v => v.id === i.video_id));
        if (unassigned.length) groups.push({ label: 'Nicht zugeordnet', imgs: unassigned });

        listEl.innerHTML = groups.map(g => `
          <div class="existing-images-group">
            <div class="existing-images-group-title">${escapeHtml(g.label)}</div>
            ${g.imgs.map(renderItem).join('')}
          </div>`).join('');
      }

    } catch (err) {
      console.error('Bilder laden fehlgeschlagen:', err);
      if (listEl) listEl.innerHTML = '<div class="existing-images-empty">Fehler beim Laden</div>';
    }
  }

  _getKoopVideos() {
    const videos = this.drawer.metadaten?.videos || [];
    return videos.slice().sort((a, b) => (a.position || 1) - (b.position || 1));
  }

  // Ordnet ein Bild einem Video zu (oder hebt die Zuordnung auf). Dropbox-Dateien
  // werden physisch in den Ziel-Unterordner verschoben; reine Links nur per DB.
  async _assignImageToVideo(assetId, newVideoId) {
    const img = this._existingImages.find(i => i.id === assetId);
    if (!img) return;
    const currentVideoId = img.video_id || null;
    const targetVideoId = newVideoId || null;
    if (currentVideoId === targetVideoId) return;

    const selectEl = document.querySelector(`.existing-image-video-select[data-id="${assetId}"]`);
    if (selectEl) selectEl.disabled = true;
    this._hideBilderError();

    try {
      let newFilePath = img.file_path || null;

      if (img.file_path) {
        const targetVideo = targetVideoId ? this._getKoopVideos().find(v => v.id === targetVideoId) : null;

        const folderResp = await fetch('/.netlify/functions/dropbox-upload-bilder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ensure-folder',
            unternehmen: this.drawer.metadaten.unternehmen || '',
            marke: this.drawer.metadaten.marke || '',
            kampagne: this.drawer.metadaten.kampagne || '',
            kooperation: this.drawer.metadaten.kooperationName || '',
            ...(targetVideo ? { videoPosition: targetVideo.position || 1, videoThema: targetVideo.thema || '' } : {}),
          }),
        });
        if (!folderResp.ok) throw new Error('Zielordner konnte nicht angelegt werden');
        const folderData = await folderResp.json();

        const fileName = img.file_path.split('/').pop();
        const toPath = `${folderData.folderPath}/${fileName}`;
        if (toPath !== img.file_path) {
          const moveResp = await fetch('/.netlify/functions/dropbox-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'move', fromPath: img.file_path, toPath, token: folderData.token }),
          });
          if (!moveResp.ok) {
            const errData = await moveResp.json().catch(() => ({}));
            throw new Error(errData.error || 'Verschieben in Dropbox fehlgeschlagen');
          }
          const moveData = await moveResp.json();
          newFilePath = moveData.path || toPath;
        }
      }

      const { error: updErr } = await window.supabase
        .from('kooperation_bilder_asset')
        .update({ video_id: targetVideoId, file_path: newFilePath })
        .eq('id', assetId);
      if (updErr) throw updErr;

      this.drawer.onBilderChanged?.();
      await this._loadExistingImages();
    } catch (err) {
      console.error('Bild-Zuordnung fehlgeschlagen:', err);
      this._showBilderError(err.message || 'Zuordnung fehlgeschlagen');
      if (selectEl) {
        selectEl.disabled = false;
        selectEl.value = currentVideoId || '';
      }
    }
  }

  async _deleteExistingImage(assetId, filePath) {
    if (this._isUploadingImages) return;

    const item = document.querySelector(`.existing-image-delete[data-id="${assetId}"]`)?.closest('.existing-image-item');
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
        .from('kooperation_bilder_asset')
        .delete()
        .eq('id', assetId);

      const koopId = this.drawer.kooperationId;
      const { count } = await window.supabase
        .from('kooperation_bilder_asset')
        .select('id', { count: 'exact', head: true })
        .eq('kooperation_id', koopId);

      if ((count ?? 0) === 0) {
        if (filePath) {
          // /Bilder-Wurzelordner der Koop loeschen (nicht nur den Video-Unterordner):
          // Pfade sind .../Kooperation/Bilder/... (alt) oder .../Bilder/Video_x_.../... (neu)
          const marker = '/Bilder/';
          const idx = filePath.indexOf(marker);
          const folderPath = idx >= 0
            ? filePath.substring(0, idx + marker.length - 1)
            : filePath.substring(0, filePath.lastIndexOf('/'));
          fetch('/.netlify/functions/dropbox-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: folderPath }),
          }).catch(() => {});
        }
        await window.supabase
          .from('kooperationen')
          .update({ bilder_folder_url: null })
          .eq('id', koopId);
        this.drawer.onBilderCleared?.();
      } else {
        this.drawer.onBilderChanged?.();
      }

      await this._loadExistingImages();

    } catch (err) {
      console.error('Bild löschen fehlgeschlagen:', err);
      this._showBilderError(err.message || 'Löschen fehlgeschlagen');
      if (item) item.style.opacity = '';
    }
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
