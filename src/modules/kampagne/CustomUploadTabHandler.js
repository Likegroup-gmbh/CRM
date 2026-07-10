// CustomUploadTabHandler.js
// Tab-Handler fuer Custom Column Upload im VideoUploadDrawer.
// Ordnername-Eingabe + Dropzone fuer beliebige Dateitypen.

import { backgroundUploadService, UPLOAD_EVENTS } from '../../core/BackgroundUploadService.js';
import { escapeHtml, mdcBtnIcon, ICON_UPLOAD_16, ICON_CHECK_16, ICON_PLUS_16 } from '../../core/VideoUploadUtils.js';
import { deleteSingleDropboxFile } from '../../core/VideoDeleteHelper.js';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

const TRASH_ICON = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>';
const REPLACE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.016 4.36v4.992"/></svg>';

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

  _renderLinkTab(activeTab, defaultFolder) {
    const meta = this.drawer.customMeta || {};
    const currentValue = meta.currentValue || '';
    return `
      <div id="upload-tab-custom" style="${activeTab !== 'custom' ? 'display:none' : ''}">
        <div class="video-upload-drawer-content">
          <div class="custom-upload-link-section">
            <label class="custom-upload-label" for="custom-upload-link-input">Externer Link</label>
            <input type="text" id="custom-upload-link-input" class="custom-upload-folder-input"
              placeholder="https://..." value="${escapeHtml(currentValue)}"/>
          </div>

          <div class="upload-error-msg" id="custom-upload-error" style="display:none;"></div>

          <div class="drawer-footer video-upload-drawer-footer">
            <button type="button" class="mdc-btn mdc-btn--cancel" id="custom-upload-cancel-btn">Abbrechen</button>
            ${currentValue ? `<button type="button" class="mdc-btn mdc-btn--cancel" id="custom-upload-link-remove-btn">Link entfernen</button>` : ''}
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
      const removeBtn = document.getElementById('custom-upload-link-remove-btn');
      removeBtn?.addEventListener('click', () => this._handleLinkRemove());
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

    const existingList = document.getElementById('custom-existing-list');
    existingList?.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.custom-asset-delete');
      if (deleteBtn) {
        if (deleteBtn.dataset.id) this._deleteExistingAsset(deleteBtn.dataset.id, deleteBtn.dataset.path);
        return;
      }
      const replaceBtn = e.target.closest('.custom-asset-replace');
      if (replaceBtn && replaceBtn.dataset.id) {
        this._replaceExistingAsset(replaceBtn.dataset.id, replaceBtn.dataset.path);
      }
    });

    window.addEventListener(UPLOAD_EVENTS.CUSTOM_DONE, this._onCustomDoneBound);

    this._loadExistingAssets();
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

  // ─── Existing Assets ───────────────────────────────────────

  get _assetTable() { return this.drawer.customMeta?.assetTable || 'custom_column_assets'; }
  get _valueTable() { return this.drawer.customMeta?.valueTable || 'custom_column_values'; }

  async _loadExistingAssets() {
    const meta = this.drawer.customMeta || {};
    const listEl = document.getElementById('custom-existing-list');
    const countEl = document.getElementById('custom-existing-count');
    if (!listEl) return;

    if (!meta.columnId || !meta.entityId) {
      this._existingAssets = [];
      if (countEl) countEl.textContent = '(0)';
      listEl.innerHTML = '<div class="existing-images-empty">Keine Dateien vorhanden</div>';
      return;
    }

    try {
      const { data, error } = await window.supabase
        .from(this._assetTable)
        .select('id, file_url, file_path, file_name, file_size, created_at')
        .eq('custom_column_id', meta.columnId)
        .eq('entity_id', meta.entityId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      this._existingAssets = data || [];

      if (countEl) countEl.textContent = `(${this._existingAssets.length})`;
      this._syncFolderInput();
      this._renderExistingAssets();
    } catch (err) {
      console.error('[CustomUploadTabHandler] _loadExistingAssets:', err);
      listEl.innerHTML = '<div class="existing-images-empty">Fehler beim Laden</div>';
    }
  }

  /** Ordnername aus dem Dropbox-Pfad eines Assets (vorletztes Segment). */
  _folderNameFromPath(filePath) {
    if (!filePath) return null;
    const parts = filePath.split('/').filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 2] : null;
  }

  /**
   * Bestehende Uploads bestimmen den Dropbox-Ordner: Input vorbelegen und
   * sperren, damit weitere Dateien im selben Ordner landen.
   */
  _syncFolderInput() {
    const folderInput = document.getElementById('custom-upload-folder-name');
    if (!folderInput) return;
    const existingFolder = this._folderNameFromPath(this._existingAssets[0]?.file_path);
    if (existingFolder) {
      folderInput.value = existingFolder;
      folderInput.disabled = true;
      folderInput.title = 'Ordner ist durch bereits hochgeladene Dateien festgelegt';
    } else {
      folderInput.disabled = false;
      folderInput.title = '';
    }
  }

  _renderExistingAssets() {
    const listEl = document.getElementById('custom-existing-list');
    if (!listEl) return;

    if (!this._existingAssets.length) {
      listEl.innerHTML = '<div class="existing-images-empty">Keine Dateien vorhanden</div>';
      return;
    }

    listEl.innerHTML = this._existingAssets.map(asset => {
      const name = asset.file_name || asset.file_path?.split('/').pop() || '?';
      const date = asset.created_at ? new Date(asset.created_at).toLocaleDateString('de-DE') : '';
      const size = asset.file_size ? this._formatSize(asset.file_size) : '';
      const metaStr = [date, size].filter(Boolean).join(' · ');
      return `
        <div class="existing-image-item">
          <div class="existing-image-info">
            <span class="existing-image-name">${escapeHtml(name)}${metaStr ? ` · ${metaStr}` : ''}</span>
          </div>
          <div class="existing-asset-actions">
            <button type="button" class="existing-video-replace custom-asset-replace" data-id="${asset.id}" data-path="${escapeHtml(asset.file_path || '')}" title="Ersetzen">${REPLACE_ICON}</button>
            <button type="button" class="existing-image-delete custom-asset-delete" data-id="${asset.id}" data-path="${escapeHtml(asset.file_path || '')}" title="Löschen">${TRASH_ICON}</button>
          </div>
        </div>`;
    }).join('');
  }

  async _deleteExistingAsset(assetId, filePath) {
    const meta = this.drawer.customMeta || {};
    const item = document.querySelector(`.custom-asset-delete[data-id="${assetId}"]`)?.closest('.existing-image-item');
    if (item) item.style.opacity = '0.5';

    try {
      if (filePath) {
        await deleteSingleDropboxFile(filePath).catch(err =>
          console.warn('Dropbox-Löschung fehlgeschlagen:', err));
      }

      await window.supabase
        .from(this._assetTable)
        .delete()
        .eq('id', assetId);

      const { count } = await window.supabase
        .from(this._assetTable)
        .select('id', { count: 'exact', head: true })
        .eq('custom_column_id', meta.columnId)
        .eq('entity_id', meta.entityId);

      if ((count ?? 0) === 0) {
        // Letzte Datei: Dropbox-Ordner + Value-Row aufräumen, Zelle zurücksetzen
        if (filePath && filePath.includes('/')) {
          const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
          await deleteSingleDropboxFile(folderPath).catch(() => {});
        }
        await window.supabase
          .from(this._valueTable)
          .delete()
          .eq('custom_column_id', meta.columnId)
          .eq('entity_id', meta.entityId);
        meta.onSuccess?.(null);
      }

      await this._loadExistingAssets();
      window.toastSystem?.show('Datei gelöscht', 'success');
    } catch (err) {
      console.error('Custom-Asset löschen fehlgeschlagen:', err);
      window.toastSystem?.show('Löschen fehlgeschlagen', 'error');
      if (item) item.style.opacity = '';
    }
  }

  _replaceExistingAsset(assetId, oldFilePath) {
    const fileInput = document.getElementById('custom-replace-file-input');
    if (!fileInput) return;

    const meta = this.drawer.customMeta || {};

    const onFileSelected = (e) => {
      fileInput.removeEventListener('change', onFileSelected);
      const file = e.target.files?.[0];
      fileInput.value = '';
      if (!file) return;

      if (file.size > MAX_FILE_SIZE) {
        const errorEl = document.getElementById('custom-upload-error');
        if (errorEl) {
          errorEl.textContent = `${file.name}: zu groß (max. 500 MB)`;
          errorEl.style.display = '';
          setTimeout(() => { errorEl.style.display = 'none'; }, 5000);
        }
        return;
      }

      const itemEl = document.querySelector(`.custom-asset-replace[data-id="${assetId}"]`)?.closest('.existing-image-item');
      if (itemEl) itemEl.style.opacity = '0.5';

      const folderName = this._folderNameFromPath(oldFilePath)
        || document.getElementById('custom-upload-folder-name')?.value.trim()
        || meta.folderName || meta.columnName || 'Upload';

      backgroundUploadService.enqueueCustomReplaceJob({
        columnId: meta.columnId,
        entityId: meta.entityId,
        metadaten: this.drawer.metadaten,
        file,
        assetId,
        oldFilePath,
        folderName,
        assetTable: meta.assetTable,
      });

      window.toastSystem?.show('Datei wird ersetzt…', 'info');
    };

    fileInput.addEventListener('change', onFileSelected);
    fileInput.click();
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

  async _handleLinkRemove() {
    const meta = this.drawer.customMeta || {};
    try {
      await window.supabase
        .from(this._valueTable)
        .delete()
        .eq('custom_column_id', meta.columnId)
        .eq('entity_id', meta.entityId);
      meta.onSuccess?.(null);
      window.toastSystem?.show('Link entfernt', 'success');
      this.drawer.close();
    } catch (err) {
      console.error('Link entfernen fehlgeschlagen:', err);
      window.toastSystem?.show('Fehler beim Entfernen', 'error');
    }
  }

  _onCustomDoneEvent(e) {
    const { result } = e.detail || {};
    const meta = this.drawer.customMeta || {};
    if (result?.columnId === meta.columnId && result?.entityId === meta.entityId) {
      // Replace-Jobs liefern keine folderUrl — Wert dann nicht überschreiben
      if (result.folderUrl) meta.onSuccess?.(result.folderUrl);
      // Drawer noch offen? Datei-Liste refreshen
      if (document.getElementById('custom-existing-list')) {
        this._loadExistingAssets();
      }
    }
  }
}
