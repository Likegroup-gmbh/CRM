// bilderTabExisting.js
// Vorhandene Stills im Stills-Tab des VideoUploadDrawers (`h` = BilderTabHandler):
// laden, anzeigen, einem Video zuordnen, löschen.

import { ablageDateiLoeschen, ablageBildVerschieben } from '../../core/ablage/ablageApi.js';
import { istSharePoint, mitAblage } from '../../core/ablage/ablageLink.js';
import { existingImagesHtml } from './bilderTabRender.js';

export function getKoopVideos(h) {
  const videos = h.drawer.metadaten?.videos || [];
  return videos.slice().sort((a, b) => (a.position || 1) - (b.position || 1));
}

export async function loadExistingImages(h) {
  const listEl = document.getElementById('existing-images-list');
  const countEl = document.getElementById('existing-images-count');
  if (listEl) listEl.innerHTML = '<div class="existing-images-loading">Lade...</div>';

  try {
    if (!h.drawer.kooperationId) {
      h._existingImages = [];
      if (countEl) countEl.textContent = '(0)';
      if (listEl) listEl.innerHTML = '<div class="existing-images-empty">Keine Bilder vorhanden</div>';
      return;
    }

    const { data, error } = await window.supabase
      .from('kooperation_bilder_asset')
      .select(mitAblage('id, video_id, file_url, file_path, file_name, file_size, version_number, is_current, is_final, variant_name, created_at', 'ablage'))
      .eq('kooperation_id', h.drawer.kooperationId)
      .order('file_name', { ascending: true });

    if (error) throw error;
    h._existingImages = data || [];
    h._existingVersions = [...new Set(
      h._existingImages
        .filter(a => !a.is_final && a.video_id === h.drawer.videoId)
        .map(a => a.version_number)
        .filter(v => typeof v === 'number')
    )];

    if (countEl) countEl.textContent = `(${h._existingImages.length})`;

    if (!listEl) return;

    if (h._existingImages.length === 0) {
      listEl.innerHTML = '<div class="existing-images-empty">Keine Bilder vorhanden</div>';
      return;
    }

    listEl.innerHTML = existingImagesHtml(h._existingImages, getKoopVideos(h));
  } catch (err) {
    console.error('Bilder laden fehlgeschlagen:', err);
    if (listEl) listEl.innerHTML = '<div class="existing-images-empty">Fehler beim Laden</div>';
  }
}

export function bindExistingEvents(h) {
  const existingList = document.getElementById('existing-images-list');
  existingList?.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.existing-image-delete');
    if (deleteBtn) {
      const assetId = deleteBtn.dataset.id;
      if (assetId) deleteExistingImage(h, assetId);
    }
  });
  existingList?.addEventListener('change', (e) => {
    const select = e.target.closest('.existing-image-video-select');
    if (select) {
      const assetId = select.dataset.id;
      if (assetId) assignImageToVideo(h, assetId, select.value || null);
    }
  });
}

// Ordnet ein Bild einem Video zu (oder hebt die Zuordnung auf). SharePoint-Dateien werden
// physisch in den Ziel-Unterordner verschoben, Altbestand (nur Link) nur per DB.
export async function assignImageToVideo(h, assetId, newVideoId) {
  const img = h._existingImages.find(i => i.id === assetId);
  if (!img) return;
  const currentVideoId = img.video_id || null;
  const targetVideoId = newVideoId || null;
  if (currentVideoId === targetVideoId) return;

  const selectEl = document.querySelector(`.existing-image-video-select[data-id="${assetId}"]`);
  if (selectEl) selectEl.disabled = true;
  h._hideBilderError();

  try {
    let newFilePath = img.file_path || null;
    let videoId = targetVideoId;

    if (istSharePoint(img)) {
      // Server verschiebt in den Ordner des Ziel-Videos und setzt video_id gleich mit.
      // Ohne Ziel-Video landet das Bild beim ersten Video der Kooperation.
      const moved = await ablageBildVerschieben(assetId, targetVideoId);
      newFilePath = moved.file_path || newFilePath;
      videoId = moved.video_id ?? targetVideoId;
    }

    const { error: updErr } = await window.supabase
      .from('kooperation_bilder_asset')
      .update({ video_id: videoId, file_path: newFilePath })
      .eq('id', assetId);
    if (updErr) throw updErr;

    h.drawer.onBilderChanged?.();
    await loadExistingImages(h);
  } catch (err) {
    console.error('Bild-Zuordnung fehlgeschlagen:', err);
    h._showBilderError(err.message || 'Zuordnung fehlgeschlagen');
    if (selectEl) {
      selectEl.disabled = false;
      selectEl.value = currentVideoId || '';
    }
  }
}

export async function deleteExistingImage(h, assetId) {
  if (h._isUploadingImages) return;

  const item = document.querySelector(`.existing-image-delete[data-id="${assetId}"]`)?.closest('.existing-image-item');
  if (item) item.style.opacity = '0.5';

  try {
    if (istSharePoint((h._existingImages || []).find(i => i.id === assetId))) {
      await ablageDateiLoeschen('still', assetId);
    }

    await window.supabase
      .from('kooperation_bilder_asset')
      .delete()
      .eq('id', assetId);

    const koopId = h.drawer.kooperationId;
    const { count } = await window.supabase
      .from('kooperation_bilder_asset')
      .select('id', { count: 'exact', head: true })
      .eq('kooperation_id', koopId);

    if ((count ?? 0) === 0) {
      await window.supabase
        .from('kooperationen')
        .update({ bilder_folder_url: null })
        .eq('id', koopId);
      h.drawer.onBilderCleared?.();
    } else {
      h.drawer.onBilderChanged?.();
    }

    await loadExistingImages(h);
  } catch (err) {
    console.error('Bild löschen fehlgeschlagen:', err);
    h._showBilderError(err.message || 'Löschen fehlgeschlagen');
    if (item) item.style.opacity = '';
  }
}
