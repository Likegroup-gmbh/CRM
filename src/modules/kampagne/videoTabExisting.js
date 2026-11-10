// videoTabExisting.js
// Vorhandene Videos im Video-Tab des VideoUploadDrawers (`h` = VideoTabHandler):
// laden, anzeigen, löschen, ersetzen.

import { deleteAssetWithFile } from '../../core/assetDelete.js';
import { syncVideoAssetsAfterDelete } from '../../core/VideoDeleteHelper.js';
import { backgroundUploadService } from '../../core/BackgroundUploadService.js';
import { mitAblage } from '../../core/ablage/ablageLink.js';
import { existingVideosHtml } from './videoTabRender.js';
import { validateVideoFile } from './videoTabQueue.js';

export async function loadExistingVideoAssets(h) {
  const listEl = document.getElementById('existing-videos-list');
  const countEl = document.getElementById('existing-videos-count');
  if (listEl) listEl.innerHTML = '<div class="existing-images-loading">Lade...</div>';

  try {
    if (!h.drawer.videoId) {
      h._existingAssets = [];
      if (countEl) countEl.textContent = '(0)';
      if (listEl) listEl.innerHTML = '<div class="existing-images-empty">Keine Videos vorhanden</div>';
      return;
    }

    const { data, error } = await window.supabase
      .from('kooperation_video_asset')
      .select(mitAblage('id, file_url, file_path, version_number, variant_name, is_current, is_final, created_at', 'ablage'))
      .eq('video_id', h.drawer.videoId)
      .order('version_number', { ascending: true });

    if (error) throw error;
    h._existingAssets = data || [];
    h._existingVersions = [...new Set(
      h._existingAssets.filter(a => !a.is_final).map(a => a.version_number).filter(v => typeof v === 'number')
    )];

    if (countEl) countEl.textContent = `(${h._existingAssets.length})`;
    const list = document.getElementById('existing-videos-list');
    if (list) list.innerHTML = existingVideosHtml(h._existingAssets);
  } catch (err) {
    console.error('[VideoTabHandler] _loadExistingVideoAssets:', err);
    if (listEl) listEl.innerHTML = '<div class="existing-images-empty">Fehler beim Laden</div>';
  }
}

async function deleteExistingAsset(h, asset) {
  const item = document.querySelector(`.existing-video-delete[data-id="${asset.id}"]`)?.closest('.existing-image-item');
  if (item) item.style.opacity = '0.5';

  try {
    const videoId = h.drawer.videoId;
    await deleteAssetWithFile({ type: 'video', id: asset.id, asset });
    if (typeof h.drawer.onVideoAssetDeleted === 'function') await h.drawer.onVideoAssetDeleted(asset);
    else await syncVideoAssetsAfterDelete(videoId);

    await loadExistingVideoAssets(h);
    if (asset.is_final) h.drawer.onFinaleChanged?.(videoId);
  } catch (err) {
    console.error('Video-Asset löschen fehlgeschlagen:', err);
    h.showError(err.message || 'Löschen fehlgeschlagen');
    if (item) item.style.opacity = '';
  }
}

/** Datei wählen lassen und als Ersatz im Hintergrund hochladen. */
function replaceExistingAsset(h, assetId, oldFilePath, versionNumber, variantName) {
  const fileInput = document.getElementById('video-upload-file-input');
  if (!fileInput) return;

  const onFileSelected = (e) => {
    fileInput.removeEventListener('change', onFileSelected);
    const file = e.target.files?.[0];
    fileInput.value = '';
    if (!file) return;

    const invalid = validateVideoFile(file);
    if (invalid) {
      h.showError(invalid);
      return;
    }

    const itemEl = document.querySelector(`.existing-video-replace[data-id="${assetId}"]`)?.closest('.existing-image-item');
    if (itemEl) itemEl.style.opacity = '0.5';

    h._listenForVideoDone();
    backgroundUploadService.enqueueVideoReplaceJob({
      videoId: h.drawer.videoId,
      metadaten: h.drawer.metadaten,
      file,
      assetId,
      oldFilePath,
      oldAblage: h._existingAssets?.find(a => a.id === assetId)?.ablage,
      versionNumber,
      variantName,
    });
  };

  fileInput.addEventListener('change', onFileSelected);
  fileInput.click();
}

export function bindExistingEvents(h) {
  const existingList = document.getElementById('existing-videos-list');
  existingList?.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.existing-video-delete');
    if (deleteBtn) {
      const asset = h._existingAssets.find(a => a.id === deleteBtn.dataset.id);
      if (asset) deleteExistingAsset(h, asset);
      return;
    }
    const replaceBtn = e.target.closest('.existing-video-replace');
    if (replaceBtn) {
      const { id, path, version, variant } = replaceBtn.dataset;
      if (id) replaceExistingAsset(h, id, path, parseInt(version, 10) || 1, variant || '');
    }
  });
}
