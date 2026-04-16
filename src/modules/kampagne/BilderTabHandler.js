import {
  escapeHtml, readFileAsBase64, proxyPost, uploadLargeFile, createFolderSharedLink,
  IMAGE_EXTENSIONS, IMAGE_MIME_PREFIX, MAX_IMAGE_SIZE
} from '../../core/VideoUploadUtils.js';

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
    this._isUploadingImages = false;
    this._initialized = false;
  }

  // ─── Render ────────────────────────────────────────────────

  renderTab(activeTab) {
    return `
      <div id="upload-tab-bilder" style="${activeTab !== 'bilder' ? 'display:none' : ''}">
        <div class="bilder-upload-drawer-content">
          <div class="upload-dropzone" id="bilder-upload-dropzone">
            <div class="dropzone-content">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="40" height="40" class="upload-dropzone-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"/>
              </svg>
              <p class="dropzone-text">Bilder hierher ziehen oder <button type="button" class="dropzone-browse-btn" id="bilder-browse-btn">Dateien auswählen</button></p>
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
            <button type="button" class="mdc-btn mdc-btn--primary" id="bilder-upload-submit-btn" disabled>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
              </svg>
              Hochladen
            </button>
          </div>

          <div class="existing-images-section" id="existing-images-section">
            <div class="existing-images-header">
              <span class="existing-images-title">Vorhandene Bilder</span>
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
    const dropzone = document.getElementById('bilder-upload-dropzone');
    const fileInput = document.getElementById('bilder-upload-file-input');
    const browseBtn = document.getElementById('bilder-browse-btn');

    cancelBtn?.addEventListener('click', () => this.drawer.close());
    submitBtn?.addEventListener('click', () => {
      if (this._selectedImages.length > 0 && !this._isUploadingImages) this._handleBilderUpload();
    });

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

    const previewList = document.getElementById('bilder-preview-list');
    previewList?.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.bilder-file-remove');
      if (removeBtn) {
        const idx = parseInt(removeBtn.dataset.idx, 10);
        this._removeSelectedImage(idx);
      }
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

      const alreadySelected = this._selectedImages.some(f => f.name === file.name && f.size === file.size);
      if (!alreadySelected) {
        this._selectedImages.push(file);
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

    if (this._selectedImages.length === 0) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = this._selectedImages.map((file, i) => `
      <div class="upload-file-item">
        <div class="file-info">
          <span class="file-name">${escapeHtml(file.name)}</span>
          <span class="file-size">${(file.size / 1024 / 1024).toFixed(1)} MB</span>
        </div>
        <button type="button" class="file-remove-btn bilder-file-remove" data-idx="${i}" title="Entfernen">&times;</button>
      </div>
    `).join('');
  }

  _updateBilderSubmitState() {
    const btn = document.getElementById('bilder-upload-submit-btn');
    if (btn) btn.disabled = this._isUploadingImages || this._selectedImages.length === 0;
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
      const firstFile = this._selectedImages[0];
      const prepareResp = await fetch('/.netlify/functions/dropbox-upload-bilder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prepare',
          unternehmen: this.drawer.metadaten.unternehmen || '',
          marke: this.drawer.metadaten.marke || '',
          kampagne: this.drawer.metadaten.kampagne || '',
          kooperation: this.drawer.metadaten.kooperationName || '',
          fileName: firstFile.name,
        })
      });

      if (!prepareResp.ok) {
        const errData = await prepareResp.json().catch(() => ({}));
        throw new Error(errData.error || `Vorbereitung fehlgeschlagen (${prepareResp.status})`);
      }

      const prepareData = await prepareResp.json();
      token = prepareData.token;
      folderPath = prepareData.folderPath;

      const uploadedFiles = [];

      for (let i = 0; i < this._selectedImages.length; i++) {
        const file = this._selectedImages[i];
        const pct = Math.round((i / total) * 90);
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (progressText) progressText.textContent = `Lade hoch... ${i + 1}/${total}: ${file.name}`;

        const dropboxPath = `${folderPath}/${file.name}`;
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

      const bilderFolderUrl = await createFolderSharedLink(token, folderPath);

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
          file_url: fl.fileUrl,
          file_path: fl.path,
          file_name: fl.name,
          file_size: fl.size,
          uploaded_by: window.currentUser?.id || null,
          created_at: new Date().toISOString(),
        }));

        const { error: insertErr } = await window.supabase
          .from('kooperation_bilder_asset')
          .insert(insertRows);
        if (insertErr) console.warn('Bilder-Asset DB-Insert fehlgeschlagen:', insertErr);
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
        .select('id, file_url, file_path, file_name, file_size, created_at')
        .eq('kooperation_id', this.drawer.kooperationId)
        .order('file_name', { ascending: true });

      if (error) throw error;
      this._existingImages = data || [];

      if (countEl) countEl.textContent = `(${this._existingImages.length})`;

      if (!listEl) return;

      if (this._existingImages.length === 0) {
        listEl.innerHTML = '<div class="existing-images-empty">Keine Bilder vorhanden</div>';
        return;
      }

      listEl.innerHTML = this._existingImages.map(img => {
        const sizeMB = img.file_size ? (img.file_size / 1024 / 1024).toFixed(1) + ' MB' : '';
        return `
          <div class="existing-image-item">
            <div class="existing-image-info">
              <span class="existing-image-name">${escapeHtml(img.file_name || img.file_path?.split('/').pop() || '?')}</span>
              ${sizeMB ? `<span class="existing-image-size">${sizeMB}</span>` : ''}
            </div>
            <button type="button" class="existing-image-delete" data-id="${img.id}" data-path="${escapeHtml(img.file_path || '')}" title="Löschen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
              </svg>
            </button>
          </div>`;
      }).join('');

    } catch (err) {
      console.error('Bilder laden fehlgeschlagen:', err);
      if (listEl) listEl.innerHTML = '<div class="existing-images-empty">Fehler beim Laden</div>';
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
