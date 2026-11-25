// customUploadBestand.js
// Vorhandene Dateien einer Upload-Spalten-Zelle im CustomUploadTabHandler: laden, anzeigen,
// löschen, ersetzen. Mixin über installCustomUploadBestand(proto).

import { backgroundUploadService } from '../../core/BackgroundUploadService.js';
import { escapeHtml } from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';
import { ablageDateiLoeschen } from '../../core/ablage/ablageApi.js';
import { istSharePoint, mitAblage } from '../../core/ablage/ablageLink.js';

const TRASH_ICON = icon('trash-alt');
const REPLACE_ICON = icon('arrow-path');

export function formatGroesse(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function installCustomUploadBestand(proto) {
  proto._loadExistingAssets = async function () {
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
        .from('custom_column_assets')
        .select(mitAblage('id, file_url, file_path, file_name, file_size, created_at'))
        .eq('custom_column_id', meta.columnId)
        .eq('entity_id', meta.entityId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      this._existingAssets = data || [];
      if (countEl) countEl.textContent = `(${this._existingAssets.length})`;
      this._renderExistingAssets();
    } catch (err) {
      console.error('[CustomUploadTabHandler] _loadExistingAssets:', err);
      listEl.innerHTML = '<div class="existing-images-empty">Fehler beim Laden</div>';
    }
  };

  proto._renderExistingAssets = function () {
    const listEl = document.getElementById('custom-existing-list');
    if (!listEl) return;

    if (!this._existingAssets.length) {
      listEl.innerHTML = '<div class="existing-images-empty">Keine Dateien vorhanden</div>';
      return;
    }

    listEl.innerHTML = this._existingAssets.map(asset => {
      const name = asset.file_name || asset.file_path?.split('/').pop() || '?';
      const date = asset.created_at ? new Date(asset.created_at).toLocaleDateString('de-DE') : '';
      const size = asset.file_size ? formatGroesse(asset.file_size) : '';
      const metaStr = [date, size].filter(Boolean).join(' · ');
      const alt = istSharePoint(asset)
        ? ''
        : ' <span class="existing-image-size" title="Liegt nicht in SharePoint, nur als Link gespeichert">Altbestand</span>';
      return `
        <div class="existing-image-item">
          <div class="existing-image-info">
            <span class="existing-image-name">${escapeHtml(name)}${metaStr ? ` · ${metaStr}` : ''}</span>${alt}
          </div>
          <div class="existing-asset-actions">
            <button type="button" class="existing-video-replace custom-asset-replace" data-id="${asset.id}" title="Ersetzen">${REPLACE_ICON}</button>
            <button type="button" class="existing-image-delete custom-asset-delete" data-id="${asset.id}" title="Löschen">${TRASH_ICON}</button>
          </div>
        </div>`;
    }).join('');
  };

  /** SharePoint-Datei in den Papierkorb (Server), dann die Zeile. Altbestand: nur die Zeile. */
  proto._deleteExistingAsset = async function (assetId) {
    const meta = this.drawer.customMeta || {};
    const asset = this._existingAssets.find(a => a.id === assetId);
    const item = document.querySelector(`.custom-asset-delete[data-id="${assetId}"]`)?.closest('.existing-image-item');
    if (item) item.style.opacity = '0.5';

    try {
      if (istSharePoint(asset)) await ablageDateiLoeschen('spalte', assetId);
      const { error } = await window.supabase.from('custom_column_assets').delete().eq('id', assetId);
      if (error) throw error;

      const { count } = await window.supabase
        .from('custom_column_assets')
        .select('id', { count: 'exact', head: true })
        .eq('custom_column_id', meta.columnId)
        .eq('entity_id', meta.entityId);

      if ((count ?? 0) === 0) {
        // Letzte Datei: Ordner-Link der Zelle entfernen, Zelle zurücksetzen
        await window.supabase
          .from('custom_column_values')
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
  };

  proto._replaceExistingAsset = function (assetId) {
    const fileInput = document.getElementById('custom-replace-file-input');
    if (!fileInput) return;
    const meta = this.drawer.customMeta || {};

    const onFileSelected = (e) => {
      fileInput.removeEventListener('change', onFileSelected);
      const file = e.target.files?.[0];
      fileInput.value = '';
      if (!file) return;

      const fehler = this._dateiFehler(file);
      if (fehler) {
        this._showError(fehler);
        return;
      }

      const itemEl = document.querySelector(`.custom-asset-replace[data-id="${assetId}"]`)?.closest('.existing-image-item');
      if (itemEl) itemEl.style.opacity = '0.5';

      backgroundUploadService.enqueueCustomReplaceJob({
        columnId: meta.columnId,
        entityId: meta.entityId,
        file,
        assetId,
      });
      window.toastSystem?.show('Datei wird ersetzt…', 'info');
    };

    fileInput.addEventListener('change', onFileSelected);
    fileInput.click();
  };
}
