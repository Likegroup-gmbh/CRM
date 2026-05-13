// ContractDokumentDrawer.js
// Drawer zum Hochladen neuer Dokumente (Auftragsbestaetigungen) fuer einen Contract.
// Nutzt das bestehende AuftragsbestaetigungUploader-System (Dropbox via Netlify-Functions).

import { UploaderField } from '../../core/form/fields/UploaderField.js';
import { uploadAuftragsbestaetigungen } from '../../core/AuftragsbestaetigungUploader.js';
import { getCurrentBenutzerId } from '../auth/CurrentUser.js';

const DOK_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const DOK_MAX_SIZE = 25 * 1024 * 1024;

export class ContractDokumentDrawer {
  constructor() {
    this.drawerId = 'contract-dokument-drawer';
    this.contract = null;
    this.onSuccess = null;
    this.uploader = null;
    this._isUploading = false;
  }

  /**
   * @param {object} contract - vollstaendiges Contract-Objekt (id, unternehmen, marke, titel/auftragsname)
   * @param {function} onSuccess - Callback nach erfolgreichem Upload
   */
  open(contract, onSuccess) {
    this.contract = contract;
    this.onSuccess = onSuccess;
    this._isUploading = false;

    this.createDrawer();
    this.bindEvents();
    this.mountUploader();
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
    title.textContent = 'Neues Dokument hochladen';
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
    body.innerHTML = `
      <div class="form-field">
        <label>Datei(en) auswählen</label>
        <div id="${this.drawerId}-uploader" class="uploader uploader--auftragsbestaetigung" data-name="dokumente"></div>
        <small class="form-hint">PDF, JPG oder PNG (max. 25 MB pro Datei). Mehrfach-Upload möglich.</small>
      </div>

      <div class="upload-error-msg" id="${this.drawerId}-error" style="display:none;"></div>

      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--cancel" id="${this.drawerId}-cancel-btn">Abbrechen</button>
        <button type="button" class="mdc-btn mdc-btn--primary" id="${this.drawerId}-submit-btn" disabled>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
          </svg>
          Speichern
        </button>
      </div>
    `;

    panel.appendChild(header);
    panel.appendChild(body);

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => panel.classList.add('show'));
  }

  mountUploader() {
    const root = document.getElementById(`${this.drawerId}-uploader`);
    if (!root) return;

    this.uploader = new UploaderField({
      multiple: true,
      accept: DOK_ACCEPT,
      maxFileSize: DOK_MAX_SIZE,
      onFilesChanged: (files) => {
        this._updateSubmitState(files);
      }
    });
    this.uploader.mount(root);
  }

  bindEvents() {
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    const closeBtn = panel?.querySelector('.drawer-close-btn');
    const cancelBtn = document.getElementById(`${this.drawerId}-cancel-btn`);
    const submitBtn = document.getElementById(`${this.drawerId}-submit-btn`);

    overlay?.addEventListener('click', () => this.close());
    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());

    submitBtn?.addEventListener('click', () => {
      if (!this._isUploading) this.handleUpload();
    });
  }

  _updateSubmitState(files) {
    const submitBtn = document.getElementById(`${this.drawerId}-submit-btn`);
    if (submitBtn) {
      const hasFiles = Array.isArray(files) ? files.length > 0 : (this.uploader?.files?.length || 0) > 0;
      submitBtn.disabled = this._isUploading || !hasFiles;
    }
  }

  async handleUpload() {
    if (!this.uploader || !this.uploader.files?.length || this._isUploading) return;
    this._isUploading = true;

    const submitBtn = document.getElementById(`${this.drawerId}-submit-btn`);
    const cancelBtn = document.getElementById(`${this.drawerId}-cancel-btn`);

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Wird hochgeladen...';
    }
    if (cancelBtn) cancelBtn.disabled = true;
    this.hideError();

    try {
      const benutzerId = await getCurrentBenutzerId();
      const files = [...this.uploader.files];

      const { successes, errors } = await uploadAuftragsbestaetigungen(files, {
        auftragId: this.contract.id,
        unternehmen: this.contract.unternehmen?.firmenname || '',
        marke: this.contract.marke?.markenname || '',
        auftragstitel: this.contract.titel || this.contract.auftragsname || '',
        uploadedById: benutzerId
      });

      if (successes.length > 0) {
        window.toastSystem?.show(`${successes.length} Datei(en) hochgeladen`, 'success');
      }
      if (errors.length > 0) {
        const failedNames = errors.map(e => e.fileName).join(', ');
        window.toastSystem?.show(
          `${errors.length} Datei(en) fehlgeschlagen: ${failedNames}`,
          'error'
        );
      }

      if (typeof this.onSuccess === 'function') {
        await this.onSuccess({ successes, errors });
      }

      this._isUploading = false;
      this.close();
    } catch (err) {
      console.error('[ContractDokumentDrawer] Upload fehlgeschlagen:', err);
      this.showError(err.message || 'Upload fehlgeschlagen');
      this._isUploading = false;

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Speichern';
      }
      if (cancelBtn) cancelBtn.disabled = false;
    }
  }

  showError(msg) {
    const el = document.getElementById(`${this.drawerId}-error`);
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  hideError() {
    const el = document.getElementById(`${this.drawerId}-error`);
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
    this.uploader = null;
  }
}
