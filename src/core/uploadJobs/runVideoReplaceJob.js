// runVideoReplaceJob.js
// Ersetzt eine bestehende Asset-Datei (gleiche version_number) durch eine neue Datei.

import { uploadFileDirect } from '../DropboxDirectUploader.js';
import { buildVersionedFileName } from '../VideoUploadUtils.js';
import { deleteFileIfUnreferenced } from '../assetDelete.js';
import { ablageZielHolen, hochladenNachSharePoint, sharePointAssetFelder, uploadVerwerfen } from '../ablage/ablageUpload.js';
import { fetchTokenAndPath, createSharedLink, trackUploadProgress, sameDropboxPath } from './videoUploadSteps.js';

const extOf = (path) => (String(path || '').split('/').pop().match(/\.([^.]+)$/)?.[1] || '').toLowerCase();

// Die alte SharePoint-Datei räumt der Server ab (ersetzen im Ziel-Request).
async function replaceInSharePoint({ ziel, file, assetId, oldFilePath, oldAblage, item, signal, updateItem }) {
  const commit = await hochladenNachSharePoint({ ziel, file, signal, onProgress: trackUploadProgress(item, updateItem) });
  if (item.directOk === null) updateItem(item.id, { directOk: true });
  updateItem(item.id, { status: 'saving' });

  const felder = sharePointAssetFelder(commit);
  const { error: updateErr } = await window.supabase
    .from('kooperation_video_asset')
    .update({ ...felder, created_at: new Date().toISOString() })
    .eq('id', assetId);
  if (updateErr) {
    await uploadVerwerfen(ziel.upload_id);
    throw updateErr;
  }

  const { error: finalsErr } = await window.supabase
    .from('kooperation_video_asset')
    .update(felder)
    .eq('source_asset_id', assetId);
  if (finalsErr) console.warn('[VideoReplace] Finale Versionen nicht nachgezogen:', finalsErr.message || finalsErr);

  if (oldFilePath && oldAblage !== 'sharepoint') {
    await deleteFileIfUnreferenced('kooperation_video_asset', oldFilePath);
  }

  updateItem(item.id, { status: 'done', loaded: file.size });
  return { assetId, fileUrl: felder.file_url, filePath: felder.file_path };
}

export async function runVideoReplaceJob(ctx) {
  const { job, signal, updateItem } = ctx;
  const { videoId, metadaten, file, assetId, oldFilePath, oldAblage, versionNumber, variantName } = job.payload;
  const item = job.items[0];

  if (!videoId) throw new Error('videoId fehlt');
  if (!file) throw new Error('file fehlt');
  if (!assetId) throw new Error('assetId fehlt');

  // HINWEIS: Die alte Dropbox-Datei wird bewusst NICHT vor dem Upload geloescht.
  // Schlaegt der Upload fehl oder wird abgebrochen, bleibt alte Datei + DB-Row
  // intakt und das Video "verschwindet" nicht.

  const ext = file.name.split('.').pop() || 'mp4';
  const fileName = buildVersionedFileName(
    metadaten?.creatorName || '',
    metadaten?.unternehmen || '',
    metadaten?.kampagne || '',
    metadaten?.videoPosition || 1,
    versionNumber,
    ext
  );

  updateItem(item.id, { status: 'uploading', loaded: 0, total: file.size, transport: 'direct' });

  const ziel = await ablageZielHolen({
    typ: 'video',
    kooperation_id: metadaten?.kooperationId ?? null,
    kooperation_video_id: videoId,
    version_number: parseInt(versionNumber, 10) || 1,
    is_final: false,
    variant_name: variantName || null,
    file_name: fileName,
    file_size: file.size,
    ersetzen: { typ: 'video', id: assetId },
  });
  if (ziel.ziel === 'sharepoint') {
    return replaceInSharePoint({ ziel, file, assetId, oldFilePath, oldAblage, item, signal, updateItem });
  }
  // Ein Dropbox-Upload auf einen SharePoint-Pfad ließe die Zeile auf ein fremdes Item zeigen
  if (oldAblage === 'sharepoint') throw new Error('Datei liegt in SharePoint und kann gerade nicht ersetzt werden');

  const { token, dropboxPath: freshPath } = await fetchTokenAndPath({
    metadaten, versionNumber, variantName, fileName,
  });

  const getToken = async () => {
    const fresh = await fetchTokenAndPath({ metadaten, versionNumber, variantName, fileName });
    return fresh.token;
  };

  // Gleiche Endung: an Ort und Stelle überschreiben. Sonst neben die alte Datei legen;
  // der Standardpfad kann einer anderen Variante derselben Schleife gehören.
  const inPlace = !!oldFilePath && extOf(oldFilePath) === ext.toLowerCase();
  const uploadResult = await uploadFileDirect({
    file,
    dropboxPath: inPlace ? oldFilePath : freshPath,
    mode: inPlace ? 'overwrite' : 'add',
    token,
    getToken,
    signal,
    onProgress: trackUploadProgress(item, updateItem),
  });

  const actualPath = uploadResult.path_display || (inPlace ? oldFilePath : freshPath);
  if (item.directOk === null) updateItem(item.id, { directOk: true });
  updateItem(item.id, { status: 'saving' });

  const sharedLink = await createSharedLink(token, actualPath);
  // Kein Roh-Pfad als URL-Fallback (toter Play-Button); Wiedergabe ueber file_path.
  const fileUrl = sharedLink || null;

  const { error: updateErr } = await window.supabase
    .from('kooperation_video_asset')
    .update({
      file_url: fileUrl,
      file_path: actualPath,
      created_at: new Date().toISOString(),
    })
    .eq('id', assetId);
  if (updateErr) throw updateErr;

  if (oldFilePath && !sameDropboxPath(oldFilePath, actualPath)) {
    // Finale Versionen dieser Datei teilen ihren Pfad und ziehen mit
    const { error: finalsErr } = await window.supabase
      .from('kooperation_video_asset')
      .update({ file_url: fileUrl, file_path: actualPath })
      .eq('source_asset_id', assetId)
      .eq('file_path', oldFilePath);
    if (finalsErr) console.warn('[VideoReplace] Finale Versionen nicht nachgezogen:', finalsErr.message || finalsErr);
    await deleteFileIfUnreferenced('kooperation_video_asset', oldFilePath);
  }

  updateItem(item.id, { status: 'done', loaded: file.size });

  return { assetId, fileUrl, filePath: actualPath };
}
