import { syncVertragFlags } from './deckung/vertragDeckung.js';
import { backfillRechnungVertragId } from '../rechnung/RechnungVertragZuordnung.js';
import { icon } from '../../core/icons/IconSystem.js';
import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
import { uploadVertragPdf } from '../../core/DropboxDocumentUploader.js';
import { altesDokumentEntfernen, dokumentHochladen, dokumentZeileLaden } from '../../core/ablage/dokumentAblage.js';

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
            ${icon('document-text')}
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
            ${icon('upload')}
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

    const fortschritt = (pct, text) => {
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressText) progressText.textContent = text;
    };

    try {
      const file = this._selectedFile;
      fortschritt(5, 'Bereite Upload vor...');
      const alt = await dokumentZeileLaden('vertrag_unterschrieben', this.vertragId).catch(() => null);
      const r = await dokumentHochladen({
        typ: 'vertrag_unterschrieben',
        bezugId: this.vertragId,
        file,
        onProgress: ({ loaded, total }) => fortschritt(Math.round((loaded / total) * 90), `Lade hoch... ${Math.round((loaded / total) * 100)}%`),
        dropbox: () => {
          fortschritt(30, 'Lade hoch nach Dropbox...');
          return uploadVertragPdf({
            metadata: {
              unternehmen: this.metadaten.unternehmen || '',
              marke: this.metadaten.marke || '',
              kampagne: this.metadaten.kampagne || '',
              kooperation: this.metadaten.kooperation || '',
              creator: this.metadaten.creator || '',
              vertragstyp: this.metadaten.vertragstyp || '',
            },
            file,
          });
        },
        speichern: (spalten) => {
          fortschritt(95, 'Speichere in Datenbank...');
          return this._saveToDb(spalten);
        },
      });
      if (alt) await altesDokumentEntfernen('vertrag_unterschrieben', alt, r.spalten);

      fortschritt(100, 'Upload abgeschlossen!');
      this._isUploading = false;

      if (typeof this.onSuccess === 'function') {
        this.onSuccess(r.fileUrl, r.filePath);
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

  async _saveToDb(spalten) {
    const updateData = {
      ...spalten,
      status: 'unterschrieben'
    };

    if (this.kooperationId) {
      updateData.kooperation_id = this.kooperationId;
    }

    const { error } = await window.supabase
      .from('vertraege')
      .update(updateData)
      .eq('id', this.vertragId);

    if (error) throw error;

    // Vertrag-Checkbox auf allen gedeckten Kooperationen synchronisieren
    await syncVertragFlags(this.vertragId, true, {
      extraKooperationIds: this.kooperationId ? [this.kooperationId] : []
    });

    // Retroaktiver Sync: Rechnungen der gedeckten Kooperationen mit vertrag_id=NULL nachtraeglich verknuepfen
    try {
      const result = await backfillRechnungVertragId(this.vertragId);
      if (result.updatedCount > 0) {
        console.log(`[VertragUpload] ${result.updatedCount} Rechnung(en) nachtraeglich verknuepft.`);
      }
    } catch (backfillErr) {
      console.warn('[VertragUpload] Backfill der Rechnungen fehlgeschlagen (nicht kritisch):', backfillErr);
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
    setTimeout(() => this.removeDrawer(), DRAWER_EXIT_MS);
  }

  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }
}
