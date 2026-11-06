// runVideoReplaceJob.js
// Ersetzt eine bestehende Asset-Datei (gleiche version_number) durch eine neue Datei.

import { uploadFileDirect } from '../DropboxDirectUploader.js';
import { buildVersionedFileName } from '../VideoUploadUtils.js';
import { deleteFileIfUnreferenced } from '../assetDelete.js';
import { fetchTokenAndPath, createSharedLink, trackUploadProgress, sameDropboxPath } from './videoUploadSteps.js';

const extOf = (path) => (String(path || '').split('/').pop().match(/\.([^.]+)$/)?.[1] || '').toLowerCase();

export async function runVideoReplaceJob(ctx) {
  const { job, signal, updateItem } = ctx;
  const { videoId, metadaten, file, assetId, oldFilePath, versionNumber, variantName } = job.payload;
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
