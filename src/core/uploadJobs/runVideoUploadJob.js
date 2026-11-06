// runVideoUploadJob.js
// Pure Job-Runner für Video-Upload (Kampagne-VideoUploadDrawer).
// Keine DOM-Zugriffe — alle Status-Updates über ctx.updateItem.

import { uploadFileDirect } from '../DropboxDirectUploader.js';
import { createFolderSharedLink, buildVersionedFileName, buildFinalFileName, nextFreeIndexedFileName } from '../VideoUploadUtils.js';
import { deleteFileIfUnreferenced } from '../assetDelete.js';
import { fetchTokenAndPath, createSharedLink, trackUploadProgress } from './videoUploadSteps.js';

function buildVersionedFileName_(file, versionNumber, metadaten) {
  const ext = (file.name.split('.').pop() || 'mp4');
  return buildVersionedFileName(
    metadaten?.creatorName || '',
    metadaten?.unternehmen || '',
    metadaten?.kampagne || '',
    metadaten?.videoPosition || 1,
    versionNumber,
    ext
  );
}

function buildFinalFileName_(file, variantName, metadaten) {
  const ext = (file.name.split('.').pop() || 'mp4');
  return buildFinalFileName(
    metadaten?.creatorName || '',
    metadaten?.unternehmen || '',
    metadaten?.kampagne || '',
    metadaten?.videoPosition || 1,
    variantName,
    ext
  );
}

/** Anzeigetitel aus dem Namen der hochgeladenen Datei (ohne Endung). */
export function titelAusDateiname(name) {
  const titel = String(name || '').replace(/\.[a-z0-9]{2,5}$/i, '').trim();
  return titel ? titel.slice(0, 120) : null;
}

// is_current und link_content leitet der Trigger auf kooperation_video_asset ab.
async function saveAssetVersion({ videoId, fileUrl, filePath, variantName, versionNumber, isFinal, titel }) {
  const version = parseInt(versionNumber, 10) || 1;
  const { error } = await window.supabase
    .from('kooperation_video_asset')
    .insert({
      video_id: videoId,
      file_url: fileUrl,
      file_path: filePath,
      version_number: version,
      variant_name: variantName || null,
      titel: titel || null,
      is_final: !!isFinal,
      description: null,
      uploaded_by: window.currentUser?.id || null,
      created_at: new Date().toISOString(),
    });
  if (error) throw error;
}

async function loadFinalFileNames(videoId) {
  const { data, error } = await window.supabase
    .from('kooperation_video_asset')
    .select('file_path, file_url')
    .eq('video_id', videoId)
    .eq('is_final', true);
  if (error) throw error;
  return (data || []).map(a => a.file_path || a.file_url || '').filter(Boolean);
}

async function readLinkContent(videoId) {
  const { data } = await window.supabase
    .from('kooperation_videos')
    .select('link_content')
    .eq('id', videoId)
    .maybeSingle();
  return data?.link_content ?? null;
}

/**
 * @param {object} ctx
 * @param {object} ctx.job - job.payload = { videoId, metadaten, queue, videoName }
 * @param {AbortSignal} ctx.signal
 * @param {(itemId, patch) => void} ctx.updateItem
 */
export async function runVideoUploadJob(ctx) {
  const { job, signal, updateItem } = ctx;
  const { videoId, metadaten, queue, videoName } = job.payload;

  if (!videoId) throw new Error('videoId fehlt');
  if (!Array.isArray(queue) || queue.length === 0) throw new Error('queue leer');

  let hasLoopUpload = false;
  let folderUrl = null;
  let hasFinalUpload = false;
  const takenFinalNames = await loadFinalFileNames(videoId);

  for (let i = 0; i < queue.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const queueItem = queue[i];
    const file = queueItem.file;
    const variantName = (queueItem.variantName || '').trim();
    const versionNumber = String(queueItem.versionNumber || 1);
    const isFinal = !!queueItem.isFinal;
    let fileName = isFinal
      ? buildFinalFileName_(file, variantName, metadaten)
      : buildVersionedFileName_(file, versionNumber, metadaten);
    if (isFinal) {
      fileName = nextFreeIndexedFileName(fileName, takenFinalNames);
      takenFinalNames.push(fileName);
    }
    const item = job.items[i];

    updateItem(item.id, { status: 'uploading', loaded: 0, total: file.size, transport: 'direct' });

    const { token, dropboxPath, kooperationFolderPath } = await fetchTokenAndPath({
      metadaten, versionNumber, variantName, fileName, isFinal,
    });

    const getToken = async () => {
      const fresh = await fetchTokenAndPath({ metadaten, versionNumber, variantName, fileName, isFinal });
      return fresh.token;
    };

    // 'add': zwei Dateien derselben Schleife und Variante landen sonst auf demselben
    // Pfad, und die zweite überschreibt die Datei der ersten Zeile
    const uploadResult = await uploadFileDirect({
      file,
      dropboxPath,
      mode: 'add',
      token,
      getToken,
      signal,
      onProgress: trackUploadProgress(item, updateItem),
    });

    const actualPath = uploadResult.path_display || dropboxPath;

    // Wenn nichts auf 'proxy' geschwenkt hat, lief Direct durch
    if (job.items[i].directOk === null) updateItem(item.id, { directOk: true });

    updateItem(item.id, { status: 'saving' });

    const sharedLink = await createSharedLink(token, actualPath);
    if (!folderUrl) {
      folderUrl = await createFolderSharedLink(token, kooperationFolderPath);
    }

    // Kein Roh-Pfad als URL-Fallback: Ein Dropbox-Pfad in file_url/link_content
    // erzeugt einen toten Play-Button (Video wirkt "verschwunden"). Wiedergabe
    // laeuft dann ueber file_path + Temporary-Link.
    const fileUrl = sharedLink || null;
    if (isFinal) hasFinalUpload = true;
    else hasLoopUpload = true;

    try {
      await saveAssetVersion({ videoId, fileUrl, filePath: actualPath, variantName, versionNumber, isFinal, titel: titelAusDateiname(file.name) });
    } catch (err) {
      // Rollback ohne verwaiste Datei. Bei gleichem Inhalt liefert Dropbox den
      // bestehenden Pfad zurück, der einer anderen Zeile gehören kann.
      await deleteFileIfUnreferenced('kooperation_video_asset', actualPath);
      throw err;
    }

    updateItem(item.id, { status: 'done', loaded: file.size });
  }

  // video_name gehoert der Kooperationsliste. Der beim Start gemerkte Name
  // ist oft schon veraltet: wer waehrend des Uploads einen Namen setzt,
  // wuerde ihn hier sonst ueberschreiben oder leeren.
  if (folderUrl) {
    const { error: videoUpdateErr } = await window.supabase
      .from('kooperation_videos')
      .update({ folder_url: folderUrl })
      .eq('id', videoId);
    // Nicht still schlucken: Der Job muss als fehlgeschlagen sichtbar werden,
    // sonst liegt die Datei in Dropbox, aber das CRM zeigt wieder "Upload".
    if (videoUpdateErr) {
      throw new Error(`Video-Metadaten konnten nicht gespeichert werden: ${videoUpdateErr.message}`);
    }
  }

  const linkContent = hasLoopUpload ? await readLinkContent(videoId) : null;
  return { linkContent, folderUrl, videoName, hasFinalUpload };
}
