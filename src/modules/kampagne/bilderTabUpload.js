// bilderTabUpload.js
// Upload der gewählten Stills im VideoUploadDrawer (`h` = BilderTabHandler):
// nach SharePoint hochladen und Asset-Zeilen anlegen.

import {
  buildVersionedFileName, buildFinalFileName, withStillIndex, createStillIndexCounter,
} from '../../core/VideoUploadUtils.js';
import { STILL_FINAL_VARIANT, updateStillCurrentFlags } from '../../core/stills/stillAssets.js';
import { ablageZielHolen, hochladenNachSharePoint, sharePointAssetFelder, uploadVerwerfen } from '../../core/ablage/ablageUpload.js';

function stillFileName(metadaten, item, nextStillIndex) {
  const ext = (item.file.name.split('.').pop() || 'jpg');
  const baseFileName = item.isFinal
    ? buildFinalFileName(
        metadaten?.creatorName || '',
        metadaten?.unternehmen || '',
        metadaten?.kampagne || '',
        metadaten?.videoPosition || 1,
        item.variantName || STILL_FINAL_VARIANT,
        ext
      )
    : buildVersionedFileName(
        metadaten?.creatorName || '',
        metadaten?.unternehmen || '',
        metadaten?.kampagne || '',
        metadaten?.videoPosition || 1,
        item.versionNumber || 1,
        ext
      );
  return withStillIndex(baseFileName, nextStillIndex(baseFileName));
}

function stillZielBody(h, item, fileName) {
  return {
    typ: 'still',
    kooperation_id: h.drawer.kooperationId ?? null,
    kooperation_video_id: h.drawer.videoId || null,
    version_number: item.versionNumber || 1,
    is_final: !!item.isFinal,
    variant_name: (item.variantName || '').trim() || null,
    file_name: fileName,
    file_size: item.file.size,
  };
}

export async function handleBilderUpload(h) {
  if (h._selectedImages.length === 0 || h._isUploadingImages) return;
  h._isUploadingImages = true;

  const ui = {
    submitBtn: document.getElementById('bilder-upload-submit-btn'),
    cancelBtn: document.getElementById('bilder-upload-cancel-btn'),
    progressContainer: document.getElementById('bilder-upload-progress'),
    progressFill: document.getElementById('bilder-upload-progress-fill'),
    progressText: document.getElementById('bilder-upload-progress-text'),
  };

  if (ui.submitBtn) ui.submitBtn.disabled = true;
  if (ui.cancelBtn) ui.cancelBtn.disabled = true;
  if (ui.progressContainer) ui.progressContainer.style.display = 'block';
  h._hideBilderError();

  try {
    // Laufende Nummer pro Basis-Dateiname, damit mehrere Stills derselben
    // Feedbackschleife unterscheidbare Namen tragen.
    // Start-Index = bereits belegte Namen aus den existierenden Assets dieses Videos
    // (plus unzugeordnete, die im selben Video-Ordner landen koennen).
    const relevantExisting = (h._existingImages || []).filter(img =>
      !h.drawer.videoId || img.video_id === h.drawer.videoId || img.video_id == null
    );
    const nextStillIndex = createStillIndexCounter(relevantExisting);
    const fileNames = h._selectedImages.map(item => stillFileName(h.drawer.metadaten, item, nextStillIndex));

    const result = await uploadBilderSharePoint(h, fileNames, ui);
    await finishBilderUpload(h, result, ui);
  } catch (err) {
    console.error('Bilder-Upload fehlgeschlagen:', err);
    h._showBilderError(err.message || 'Upload fehlgeschlagen');
    if (ui.submitBtn) ui.submitBtn.disabled = false;
    if (ui.cancelBtn) ui.cancelBtn.disabled = false;
    h._isUploadingImages = false;
  }
}

/**
 * Alle gewählten Bilder nach SharePoint; scheitert eins oder der Eintrag, werden alle verworfen.
 * Bilder liegen dort in der Runde ihres Videos (ohne Video beim ersten), einen Bilder-Ordner
 * der Kooperation gibt es nicht: bilder_folder_url bleibt unberührt.
 */
async function uploadBilderSharePoint(h, fileNames, { progressFill, progressText }) {
  const total = h._selectedImages.length;
  const rows = [];
  const uploadIds = [];

  try {
    for (let i = 0; i < total; i++) {
      const item = h._selectedImages[i];
      const file = item.file;
      if (progressFill) progressFill.style.width = `${Math.round((i / total) * 90)}%`;
      if (progressText) progressText.textContent = `Lade hoch... ${i + 1}/${total}: ${file.name}`;

      const ziel = await ablageZielHolen(stillZielBody(h, item, fileNames[i]));
      const commit = await hochladenNachSharePoint({ ziel, file });
      uploadIds.push(ziel.upload_id);

      const felder = sharePointAssetFelder(commit);
      rows.push({
        kooperation_id: h.drawer.kooperationId,
        video_id: h.drawer.videoId || commit.video_id || null,
        ...felder,
        file_name: felder.file_name || fileNames[i],
        file_size: felder.file_size ?? file.size,
        version_number: item.versionNumber || 1,
        is_current: !item.isFinal,
        is_final: !!item.isFinal,
        variant_name: (item.variantName || '').trim() || null,
        uploaded_by: window.currentUser?.id || null,
        created_at: new Date().toISOString(),
      });
    }

    if (progressFill) progressFill.style.width = '95%';
    if (progressText) progressText.textContent = 'Speichere in Datenbank...';

    const { error: insertErr } = await window.supabase
      .from('kooperation_bilder_asset')
      .insert(rows);
    if (insertErr) throw new Error(`Bilder konnten nicht gespeichert werden: ${insertErr.message}`);
  } catch (err) {
    await Promise.all(uploadIds.map(id => uploadVerwerfen(id)));
    throw err;
  }

  const videoIds = [...new Set(rows.map(r => r.video_id).filter(Boolean))];
  for (const videoId of videoIds) await updateStillCurrentFlags(videoId);
  return { uploaded: rows.length, hasFinal: rows.some(r => r.is_final) };
}

async function finishBilderUpload(h, { uploaded, hasFinal }, { submitBtn, cancelBtn, progressContainer, progressFill, progressText }) {
  if (progressFill) progressFill.style.width = '100%';
  if (progressText) progressText.textContent = `${uploaded} Bild${uploaded !== 1 ? 'er' : ''} hochgeladen!`;

  h._isUploadingImages = false;
  h._selectedImages = [];
  h._renderSelectedImagesList();

  if (typeof h.drawer.onBilderSuccess === 'function') {
    h.drawer.onBilderSuccess(null);
  }
  if (hasFinal) h.drawer.onFinaleChanged?.(h.drawer.videoId);

  await h._loadExistingImages();

  setTimeout(() => {
    if (submitBtn) submitBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = false;
    if (progressContainer) progressContainer.style.display = 'none';
  }, 1500);
}
