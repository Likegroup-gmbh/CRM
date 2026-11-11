// bilderTabExisting.js
// Vorhandene Stills im Stills-Tab des VideoUploadDrawers (`h` = BilderTabHandler):
// laden, anzeigen, einem Video zuordnen, löschen.

import { authorizedFetch } from '../../core/auth/getAccessToken.js';
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
      const path = deleteBtn.dataset.path;
      if (assetId) deleteExistingImage(h, assetId, path);
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

/** Dropbox-Datei in den Bilder-Ordner des Ziel-Videos verschieben; liefert den neuen Pfad. */
async function dropboxBildVerschieben(h, img, targetVideoId) {
  const targetVideo = targetVideoId ? getKoopVideos(h).find(v => v.id === targetVideoId) : null;

  const folderResp = await authorizedFetch('/.netlify/functions/dropbox-upload-bilder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'ensure-folder',
      unternehmen: h.drawer.metadaten.unternehmen || '',
      marke: h.drawer.metadaten.marke || '',
      kampagne: h.drawer.metadaten.kampagne || '',
      kooperation: h.drawer.metadaten.kooperationName || '',
      ...(targetVideo ? { videoPosition: targetVideo.position || 1, videoThema: targetVideo.thema || '' } : {}),
    }),
  });
  if (!folderResp.ok) throw new Error('Zielordner konnte nicht angelegt werden');
  const folderData = await folderResp.json();

  const fileName = img.file_path.split('/').pop();
  const toPath = `${folderData.folderPath}/${fileName}`;
  if (toPath === img.file_path) return img.file_path;

  const moveResp = await authorizedFetch('/.netlify/functions/dropbox-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'move', fromPath: img.file_path, toPath, token: folderData.token }),
  });
  if (!moveResp.ok) {
    const errData = await moveResp.json().catch(() => ({}));
    throw new Error(errData.error || 'Verschieben in Dropbox fehlgeschlagen');
  }
  const moveData = await moveResp.json();
  return moveData.path || toPath;
}

// Ordnet ein Bild einem Video zu (oder hebt die Zuordnung auf). Dropbox- und
// SharePoint-Dateien werden physisch in den Ziel-Unterordner verschoben; reine Links nur per DB.
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
    } else if (img.file_path) {
      newFilePath = await dropboxBildVerschieben(h, img, targetVideoId);
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

export async function deleteExistingImage(h, assetId, filePath) {
  if (h._isUploadingImages) return;

  const item = document.querySelector(`.existing-image-delete[data-id="${assetId}"]`)?.closest('.existing-image-item');
  if (item) item.style.opacity = '0.5';

  try {
    const sharePoint = istSharePoint((h._existingImages || []).find(i => i.id === assetId));
    if (sharePoint) {
      await ablageDateiLoeschen('still', assetId);
    } else if (filePath) {
      await authorizedFetch('/.netlify/functions/dropbox-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      }).catch(err => console.warn('Dropbox-Löschung fehlgeschlagen:', err));
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
      if (filePath && !sharePoint) {
        // /Bilder-Wurzelordner der Koop loeschen (nicht nur den Video-Unterordner):
        // Pfade sind .../Kooperation/Bilder/... (alt) oder .../Bilder/Video_x_.../... (neu)
        const marker = '/Bilder/';
        const idx = filePath.indexOf(marker);
        const folderPath = idx >= 0
          ? filePath.substring(0, idx + marker.length - 1)
          : filePath.substring(0, filePath.lastIndexOf('/'));
        authorizedFetch('/.netlify/functions/dropbox-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: folderPath }),
        }).catch(() => {});
      }
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
