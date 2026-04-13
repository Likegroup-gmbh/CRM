import { syncVertragCheckbox } from '../../core/VertragSyncHelper.js';

const DEBUG_UPLOAD = true;

export class VertragUploadDrawer {
  constructor() {
    this.drawerId = 'vertrag-upload-drawer';
    this.vertragId = null;
    this.kooperationId = null;
    this.metadaten = null;
    this.onSuccess = null;
    this._selectedFile = null;
    this._isUploading = false;
  }

  /**
   * @param {string} vertragId - ID des Vertrags in der vertraege-Tabelle
   * @param {object} metadaten - { kooperationId, unternehmen, kampagne, creator, vertragstyp }
   * @param {function} onSuccess - Callback (fileUrl, filePath)
   */
  open(vertragId, metadaten, onSuccess) {
    this.vertragId = vertragId;
    this.kooperationId = metadaten?.kooperationId || null;
    this.metadaten = metadaten || {};
    this.onSuccess = onSuccess;
    this._selectedFile = null;
    this._isUploading = false;

    this.createDrawer();
    this.renderForm();
    this.bindEvents();
  }

  createDrawer() {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    const header = document.createElement('div');
    header.className = 'drawer-header';

    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Unterschriebenen Vertrag hochladen';
    headerLeft.appendChild(title);

    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    headerRight.appendChild(closeBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;

    panel.appendChild(header);
    panel.appendChild(body);

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => panel.classList.add('show'));
  }

  renderForm() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    body.innerHTML = `
      <div class="video-upload-drawer-content">
        <div class="upload-dropzone" id="vertrag-upload-dropzone">
          <div class="dropzone-content">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="40" height="40" class="upload-dropzone-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
            </svg>
            <p class="dropzone-text">PDF hierher ziehen oder <button type="button" class="dropzone-browse-btn">Datei auswählen</button></p>
            <p class="dropzone-hint">PDF – max. 25 MB</p>
          </div>
          <input type="file" id="vertrag-upload-file-input" accept=".pdf,application/pdf" style="display:none"/>
        </div>

        <div class="upload-file-preview" id="vertrag-upload-preview" style="display:none;">
          <div class="file-info">
            <span class="file-name" id="vertrag-upload-filename"></span>
            <span class="file-size" id="vertrag-upload-filesize"></span>
          </div>
          <button type="button" class="file-remove-btn" id="vertrag-upload-remove" title="Datei entfernen">&times;</button>
        </div>

        <div class="upload-progress-container" id="vertrag-upload-progress" style="display:none;">
          <div class="upload-progress-bar">
            <div class="upload-progress-fill" id="vertrag-upload-progress-fill" style="width:0%"></div>
          </div>
          <div class="upload-progress-text" id="vertrag-upload-progress-text">Wird hochgeladen... 0%</div>
        </div>

        <div class="upload-error-msg" id="vertrag-upload-error" style="display:none;"></div>

        <div class="drawer-footer video-upload-drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" id="vertrag-upload-cancel-btn">Abbrechen</button>
          <button type="button" class="mdc-btn mdc-btn--primary" id="vertrag-upload-submit-btn" disabled>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
            </svg>
            Hochladen
          </button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    const closeBtn = panel?.querySelector('.drawer-close-btn');
    const cancelBtn = document.getElementById('vertrag-upload-cancel-btn');
    const submitBtn = document.getElementById('vertrag-upload-submit-btn');
    const dropzone = document.getElementById('vertrag-upload-dropzone');
    const fileInput = document.getElementById('vertrag-upload-file-input');
    const browseBtn = panel?.querySelector('.dropzone-browse-btn');
    const removeBtn = document.getElementById('vertrag-upload-remove');

    overlay?.addEventListener('click', () => this.close());
    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());

    submitBtn?.addEventListener('click', () => {
      if (this._selectedFile && !this._isUploading) this.handleUpload();
    });

    browseBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files?.[0]) this.selectFile(e.target.files[0]);
    });
    removeBtn?.addEventListener('click', () => this.clearFile());

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files?.[0];
      if (file) this.selectFile(file);
    });

    this._updateSubmitState();
  }

  selectFile(file) {
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showError(`Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Max. 25 MB.`);
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.match(/\.pdf$/i)) {
      this.showError('Bitte eine PDF-Datei auswählen.');
      return;
    }

    this._selectedFile = file;
    this.hideError();

    const dropzone = document.getElementById('vertrag-upload-dropzone');
    const preview = document.getElementById('vertrag-upload-preview');
    const nameEl = document.getElementById('vertrag-upload-filename');
    const sizeEl = document.getElementById('vertrag-upload-filesize');

    if (dropzone) dropzone.style.display = 'none';
    if (preview) preview.style.display = 'flex';
    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB`;
    this._updateSubmitState();
  }

  clearFile() {
    this._selectedFile = null;
    const dropzone = document.getElementById('vertrag-upload-dropzone');
    const preview = document.getElementById('vertrag-upload-preview');
    const fileInput = document.getElementById('vertrag-upload-file-input');

    if (dropzone) dropzone.style.display = '';
    if (preview) preview.style.display = 'none';
    if (fileInput) fileInput.value = '';
    this._updateSubmitState();
  }

  async handleUpload() {
    if (!this._selectedFile || this._isUploading) return;
    this._isUploading = true;

    const submitBtn = document.getElementById('vertrag-upload-submit-btn');
    const cancelBtn = document.getElementById('vertrag-upload-cancel-btn');
    const progressContainer = document.getElementById('vertrag-upload-progress');
    const progressFill = document.getElementById('vertrag-upload-progress-fill');
    const progressText = document.getElementById('vertrag-upload-progress-text');

    if (submitBtn) submitBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
    if (progressContainer) progressContainer.style.display = 'block';
    this.hideError();

    try {
      if (progressText) progressText.textContent = 'Verbinde mit Dropbox...';
      const tokenResp = await fetch('/.netlify/functions/dropbox-upload-vertrag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unternehmen: this.metadaten.unternehmen || '',
          kampagne: this.metadaten.kampagne || '',
          creator: this.metadaten.creator || '',
          vertragstyp: this.metadaten.vertragstyp || '',
          fileName: this._selectedFile.name
        })
      });

      if (!tokenResp.ok) {
        const errData = await tokenResp.json().catch(() => ({}));
        throw new Error(errData.error || `Token-Abruf fehlgeschlagen (${tokenResp.status})`);
      }

      const { token, dropboxPath } = await tokenResp.json();

      if (progressText) progressText.textContent = 'Lade hoch nach Dropbox...';
      const uploadResult = await this._uploadToDropbox(token, dropboxPath, progressFill, progressText);

      if (progressFill) progressFill.style.width = '95%';
      if (progressText) progressText.textContent = 'Erstelle Link...';
      const sharedLink = await this._createSharedLink(token, uploadResult.path_display || dropboxPath);

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = 'Speichere in Datenbank...';

      const fileUrl = sharedLink || uploadResult.path_display || dropboxPath;
      const filePath = uploadResult.path_display || dropboxPath;

      await this._saveToDb(fileUrl, filePath);

      if (progressText) progressText.textContent = 'Upload abgeschlossen!';
      this._isUploading = false;

      if (typeof this.onSuccess === 'function') {
        this.onSuccess(fileUrl, filePath);
      }

      setTimeout(() => this.close(), 800);

    } catch (err) {
      console.error('Vertrag-Upload fehlgeschlagen:', err);
      this.showError(err.message || 'Upload fehlgeschlagen');
      if (submitBtn) submitBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      this._isUploading = false;
    }
  }

  async _uploadToDropbox(token, dropboxPath, progressFill, progressText) {
    const file = this._selectedFile;
    const CHUNK_SIZE = 2 * 1024 * 1024;
    const totalSize = file.size;

    const readChunkAsBase64 = (start, end) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
        reader.readAsDataURL(file.slice(start, end));
      });
    };

    const proxyPost = async (body) => {
      const payloadSize = JSON.stringify(body).length;
      const hasToken = !!body.token;
      const tokenPrefix = body.token ? body.token.substring(0, 20) : 'N/A';
      if (DEBUG_UPLOAD) console.log(`[VertragUpload] proxyPost action=${body.action} payloadSize=${payloadSize} hasToken=${hasToken} tokenPrefix=${tokenPrefix}...`);

      const resp = await fetch('/.netlify/functions/dropbox-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (DEBUG_UPLOAD) console.log(`[VertragUpload] proxyPost response: status=${resp.status} ok=${resp.ok}`);

      if (!resp.ok) {
        const errText = await resp.text();
        if (DEBUG_UPLOAD) console.error(`[VertragUpload] proxyPost FAILED: status=${resp.status} body=${errText}`);
        let errObj = {};
        try { errObj = JSON.parse(errText); } catch (_) {}
        throw new Error(errObj.error || `Proxy-Fehler (${resp.status})`);
      }
      const json = await resp.json();
      if (DEBUG_UPLOAD) console.log(`[VertragUpload] proxyPost OK: action=${body.action} responseKeys=${Object.keys(json)} hasTokenInResp=${!!json.token}`);
      return json;
    };

    if (totalSize <= CHUNK_SIZE) {
      if (progressFill) progressFill.style.width = '50%';
      if (progressText) progressText.textContent = 'Lade hoch...';
      const chunk = await readChunkAsBase64(0, totalSize);
      const result = await proxyPost({ action: 'upload-small', dropboxPath, chunk });
      if (progressFill) progressFill.style.width = '90%';
      return result;
    }

    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    let offset = 0;

    const firstChunk = await readChunkAsBase64(0, CHUNK_SIZE);
    if (progressText) progressText.textContent = `Lade hoch... 1/${totalChunks}`;
    const startResp = await proxyPost({ action: 'session-start', chunk: firstChunk });
    const { session_id } = startResp;
    this._proxyToken = startResp.token;
    if (DEBUG_UPLOAD) console.log(`[VertragUpload] session-start OK: sessionId=${session_id} tokenLen=${this._proxyToken?.length} tokenPrefix=${this._proxyToken?.substring(0, 20)}...`);
    offset = CHUNK_SIZE;

    let chunkIdx = 2;
    while (offset + CHUNK_SIZE < totalSize) {
      const chunk = await readChunkAsBase64(offset, offset + CHUNK_SIZE);
      const pct = Math.round((offset / totalSize) * 90);
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressText) progressText.textContent = `Lade hoch... ${chunkIdx}/${totalChunks}`;
      await proxyPost({ action: 'session-append', sessionId: session_id, offset, chunk, token: this._proxyToken });
      offset += CHUNK_SIZE;
      chunkIdx++;
    }

    const lastChunk = await readChunkAsBase64(offset, totalSize);
    if (progressFill) progressFill.style.width = '85%';
    if (progressText) progressText.textContent = `Lade hoch... ${totalChunks}/${totalChunks}`;
    if (DEBUG_UPLOAD) {
      const finishTokenPrefix = this._proxyToken?.substring(0, 20) || 'N/A';
      console.log(`[VertragUpload] session-finish SENDING: sessionId=${session_id} offset=${offset} tokenPrefix=${finishTokenPrefix}... path=${dropboxPath}`);
    }
    const result = await proxyPost({ action: 'session-finish', sessionId: session_id, offset, dropboxPath, chunk: lastChunk, token: this._proxyToken });
    if (progressFill) progressFill.style.width = '90%';
    return result;
  }

  async _createSharedLink(token, dropboxPath) {
    const resp = await fetch('/.netlify/functions/dropbox-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'shared-link', path: dropboxPath, token: this._proxyToken || undefined }),
    });
    if (!resp.ok) return null;
    const { url } = await resp.json();
    return url?.replace('?dl=0', '?raw=1') || null;
  }

  async _saveToDb(fileUrl, filePath) {
    const updateData = {
      dropbox_file_url: fileUrl,
      dropbox_file_path: filePath
    };

    if (this.kooperationId) {
      updateData.kooperation_id = this.kooperationId;
    }

    const { error } = await window.supabase
      .from('vertraege')
      .update(updateData)
      .eq('id', this.vertragId);

    if (error) throw error;

    // Vertrag-Checkbox auf Kooperation synchronisieren
    if (this.kooperationId) {
      await syncVertragCheckbox(this.kooperationId, true);
    }
  }

  _updateSubmitState() {
    const submitBtn = document.getElementById('vertrag-upload-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = this._isUploading || !this._selectedFile;
    }
  }

  showError(msg) {
    const el = document.getElementById('vertrag-upload-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  hideError() {
    const el = document.getElementById('vertrag-upload-error');
    if (el) el.style.display = 'none';
  }

  close() {
    if (this._isUploading) return;
    const panel = document.getElementById(this.drawerId);
    panel?.classList.remove('show');
    setTimeout(() => this.removeDrawer(), 300);
  }

  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }
}
