// bilderTabUpload.js
// Upload der gewählten Stills im VideoUploadDrawer (`h` = BilderTabHandler):
// Ziel holen, dann nach SharePoint oder Dropbox hochladen, Asset-Zeilen anlegen,
// Koop-Ordnerlink setzen (nur Dropbox). Externe Still-Links werden direkt gespeichert.

import {
  readFileAsBase64, proxyPost, uploadLargeFile, createFolderSharedLink,
  buildVersionedFileName, buildFinalFileName, withStillIndex, createStillIndexCounter,
  normalizeExternalUrl, isValidExternalUrl,
} from '../../core/VideoUploadUtils.js';
import { STILL_FINAL_VARIANT, updateStillCurrentFlags } from '../../core/stills/stillAssets.js';
import { authorizedFetch } from '../../core/auth/getAccessToken.js';
import { ablageZielHolen, hochladenNachSharePoint, sharePointAssetFelder, uploadVerwerfen } from '../../core/ablage/ablageUpload.js';

const CHUNK_SIZE = 2 * 1024 * 1024;

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
    // Laufende Nummer pro Basis-Dateiname, damit sich mehrere Stills derselben
    // Feedbackschleife nicht gegenseitig in Dropbox ueberschreiben (mode: overwrite).
    // Start-Index = bereits belegte Namen aus den existierenden Assets dieses Videos
    // (plus unzugeordnete, die im selben Video-Ordner landen koennen).
    const relevantExisting = (h._existingImages || []).filter(img =>
      !h.drawer.videoId || img.video_id === h.drawer.videoId || img.video_id == null
    );
    const nextStillIndex = createStillIndexCounter(relevantExisting);
    const fileNames = h._selectedImages.map(item => stillFileName(h.drawer.metadaten, item, nextStillIndex));

    const ziel = await ablageZielHolen(stillZielBody(h, h._selectedImages[0], fileNames[0]));
    const result = ziel.ziel === 'sharepoint'
      ? await uploadBilderSharePoint(h, fileNames, ziel, ui)
      : await uploadBilderDropbox(h, fileNames, ui);
    await finishBilderUpload(h, result, ui);
  } catch (err) {
    console.error('Bilder-Upload fehlgeschlagen:', err);
    h._showBilderError(err.message || 'Upload fehlgeschlagen');
    if (ui.submitBtn) ui.submitBtn.disabled = false;
    if (ui.cancelBtn) ui.cancelBtn.disabled = false;
    h._isUploadingImages = false;
  }
}

function dropboxPrepareBody(metadaten, { fileName, versionNumber, isFinal }) {
  return JSON.stringify({
    action: 'prepare',
    unternehmen: metadaten.unternehmen || '',
    marke: metadaten.marke || '',
    kampagne: metadaten.kampagne || '',
    kooperation: metadaten.kooperationName || '',
    videoPosition: metadaten.videoPosition || 1,
    videoThema: metadaten.videoThema || '',
    fileName,
    versionNumber: versionNumber || 1,
    isFinal: !!isFinal,
  });
}

async function uploadBilderDropbox(h, fileNames, { progressFill, progressText }) {
  const total = h._selectedImages.length;
  const metadaten = h.drawer.metadaten;
  let uploaded = 0;

  if (progressText) progressText.textContent = 'Verbinde mit Dropbox...';
  const firstItem = h._selectedImages[0];
  const prepareResp = await authorizedFetch('/.netlify/functions/dropbox-upload-bilder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: dropboxPrepareBody(metadaten, { ...firstItem, fileName: firstItem.file.name }),
  });

  if (!prepareResp.ok) {
    const errData = await prepareResp.json().catch(() => ({}));
    throw new Error(errData.error || `Vorbereitung fehlgeschlagen (${prepareResp.status})`);
  }

  const prepareData = await prepareResp.json();
  let token = prepareData.token;
  let folderPath = prepareData.folderPath;
  const rootFolderPath = prepareData.rootFolderPath || folderPath;

  const uploadedFiles = [];

  for (let i = 0; i < total; i++) {
    const item = h._selectedImages[i];
    const file = item.file;
    const pct = Math.round((i / total) * 90);
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `Lade hoch... ${i + 1}/${total}: ${file.name}`;

    const fileName = fileNames[i];

    const itemPrepare = await authorizedFetch('/.netlify/functions/dropbox-upload-bilder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: dropboxPrepareBody(metadaten, { ...item, fileName }),
    });
    if (!itemPrepare.ok) throw new Error('Dropbox-Pfad konnte nicht vorbereitet werden');
    const itemData = await itemPrepare.json();
    token = itemData.token || token;
    const dropboxPath = itemData.dropboxPath;
    if (!folderPath) folderPath = itemData.folderPath;

    if (file.size <= CHUNK_SIZE) {
      const chunk = await readFileAsBase64(file);
      await proxyPost({ action: 'upload-small', dropboxPath, chunk, token });
    } else {
      await uploadLargeFile(file, dropboxPath, token);
    }

    uploadedFiles.push({
      name: fileName,
      size: file.size,
      path: dropboxPath,
      versionNumber: item.versionNumber || 1,
      isFinal: !!item.isFinal,
      variantName: (item.variantName || '').trim() || null,
    });
    uploaded++;
  }

  if (progressFill) progressFill.style.width = '92%';
  if (progressText) progressText.textContent = 'Erstelle Links...';

  // Shared-Link immer auf den Koop-weiten /Bilder-Wurzelordner (Flag + Ordner-Link)
  const bilderFolderUrl = await createFolderSharedLink(token, rootFolderPath);

  const fileLinks = [];
  for (const uf of uploadedFiles) {
    let fileUrl = null;
    try {
      const linkResp = await authorizedFetch('/.netlify/functions/dropbox-proxy', {
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

  if (h.drawer.kooperationId && fileLinks.length > 0) {
    const insertRows = fileLinks.map(fl => ({
      kooperation_id: h.drawer.kooperationId,
      video_id: h.drawer.videoId || null,
      file_url: fl.fileUrl,
      file_path: fl.path,
      file_name: fl.name,
      file_size: fl.size,
      version_number: fl.versionNumber || 1,
      is_current: !fl.isFinal,
      is_final: !!fl.isFinal,
      variant_name: fl.variantName || null,
      uploaded_by: window.currentUser?.id || null,
      created_at: new Date().toISOString(),
    }));

    const { error: insertErr } = await window.supabase
      .from('kooperation_bilder_asset')
      .insert(insertRows);
    // Fehler werfen statt still zu loggen: Sonst wirkt der Upload erfolgreich,
    // obwohl keine DB-Zeilen existieren. Ein Retry ist sicher, weil die
    // Index-Zaehlung aus _existingImages kommt und dieselben Dateinamen
    // vergibt (ueberschreibt die verwaisten Dropbox-Dateien).
    if (insertErr) throw new Error(`Bilder konnten nicht gespeichert werden: ${insertErr.message}`);
    if (h.drawer.videoId) await updateStillCurrentFlags(h.drawer.videoId);
  }

  return { uploaded, bilderFolderUrl, hasFinal: fileLinks.some(fl => fl.isFinal) };
}

/**
 * Alle gewählten Bilder nach SharePoint; scheitert eins oder der Eintrag, werden alle verworfen.
 * Bilder liegen dort in der Runde ihres Videos (ohne Video beim ersten), einen Bilder-Ordner
 * der Kooperation gibt es nicht: bilder_folder_url bleibt unberührt.
 */
async function uploadBilderSharePoint(h, fileNames, firstZiel, { progressFill, progressText }) {
  const total = h._selectedImages.length;
  const rows = [];
  const uploadIds = [];

  try {
    for (let i = 0; i < total; i++) {
      const item = h._selectedImages[i];
      const file = item.file;
      if (progressFill) progressFill.style.width = `${Math.round((i / total) * 90)}%`;
      if (progressText) progressText.textContent = `Lade hoch... ${i + 1}/${total}: ${file.name}`;

      const ziel = i === 0 ? firstZiel : await ablageZielHolen(stillZielBody(h, item, fileNames[i]));
      if (ziel.ziel !== 'sharepoint') throw new Error('Die Ablage hat während des Uploads gewechselt. Bitte erneut hochladen.');
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
  return { uploaded: rows.length, bilderFolderUrl: null, hasFinal: rows.some(r => r.is_final) };
}

async function finishBilderUpload(h, { uploaded, bilderFolderUrl, hasFinal }, { submitBtn, cancelBtn, progressContainer, progressFill, progressText }) {
  if (bilderFolderUrl && h.drawer.kooperationId) {
    await window.supabase
      .from('kooperationen')
      .update({ bilder_folder_url: bilderFolderUrl })
      .eq('id', h.drawer.kooperationId);
  }

  if (progressFill) progressFill.style.width = '100%';
  if (progressText) progressText.textContent = `${uploaded} Bild${uploaded !== 1 ? 'er' : ''} hochgeladen!`;

  h._isUploadingImages = false;
  h._selectedImages = [];
  h._renderSelectedImagesList();

  if (typeof h.drawer.onBilderSuccess === 'function') {
    h.drawer.onBilderSuccess(bilderFolderUrl);
  }
  if (hasFinal) h.drawer.onFinaleChanged?.(h.drawer.videoId);

  await h._loadExistingImages();

  setTimeout(() => {
    if (submitBtn) submitBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = false;
    if (progressContainer) progressContainer.style.display = 'none';
  }, 1500);
}

export async function handleBilderLinkSubmit(h) {
  if (!h._linkQueue || h._linkQueue.length === 0 || h._isUploadingImages) return;
  h._hideBilderError();

  const invalid = h._linkQueue.filter(q => !isValidExternalUrl(normalizeExternalUrl(q.url)));
  if (invalid.length > 0) {
    h._showBilderError('Bitte gültige URLs eingeben (https://...)');
    return;
  }

  h._isUploadingImages = true;
  h._updateBilderSubmitState();

  try {
    const insertRows = h._linkQueue.map(item => ({
      kooperation_id: h.drawer.kooperationId,
      video_id: h.drawer.videoId || null,
      file_url: normalizeExternalUrl(item.url),
      file_path: null,
      file_name: item.url.split('/').pop() || 'Link',
      file_size: 0,
      version_number: item.versionNumber || 1,
      is_current: !item.isFinal,
      is_final: !!item.isFinal,
      variant_name: (item.variantName || '').trim() || null,
      uploaded_by: window.currentUser?.id || null,
      created_at: new Date().toISOString(),
    }));

    const { error: insertErr } = await window.supabase
      .from('kooperation_bilder_asset')
      .insert(insertRows);
    if (insertErr) throw insertErr;
    if (h.drawer.videoId) await updateStillCurrentFlags(h.drawer.videoId);

    h._linkQueue = [];
    h._renderSelectedImagesList();
    h._isUploadingImages = false;
    h._updateBilderSubmitState();
    h.drawer.onBilderChanged?.();
    if (insertRows.some(r => r.is_final)) h.drawer.onFinaleChanged?.(h.drawer.videoId);
    await h._loadExistingImages();
    window.toastSystem?.success?.('Bilder-Links gespeichert');
  } catch (err) {
    console.error('[BilderTabHandler] Link-Submit fehlgeschlagen:', err);
    h._showBilderError(err.message || 'Speichern fehlgeschlagen');
    h._isUploadingImages = false;
    h._updateBilderSubmitState();
  }
}
