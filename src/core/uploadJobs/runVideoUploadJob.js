// runVideoUploadJob.js
// Pure Job-Runner für Video-Upload (Kampagne-VideoUploadDrawer).
// Keine DOM-Zugriffe — alle Status-Updates über ctx.updateItem.

import { uploadFileDirect } from '../DropboxDirectUploader.js';
import { createFolderSharedLink, buildVersionedFileName } from '../VideoUploadUtils.js';

function buildVersionedFileName_(file, versionNumber, metadaten) {
  const ext = (file.name.split('.').pop() || 'mp4');
  return buildVersionedFileName(
    metadaten?.creatorName || '',
    metadaten?.unternehmen || '',
    metadaten?.kampagne || '',
    versionNumber,
    ext
  );
}

async function fetchTokenAndPath({ metadaten, versionNumber, variantName, fileName }) {
  const resp = await fetch('/.netlify/functions/dropbox-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      unternehmen: metadaten.unternehmen || '',
      marke: metadaten.marke || '',
      kampagne: metadaten.kampagne || '',
      kooperation: metadaten.kooperationName || '',
      videoPosition: metadaten.videoPosition || 1,
      videoThema: metadaten.videoThema || '',
      videoTitel: metadaten.videoTitel || 'Video',
      versionNumber: String(versionNumber),
      variantName,
      fileName,
    }),
  });
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.error || `Token-Abruf fehlgeschlagen (${resp.status})`);
  }
  return resp.json();
}

async function createSharedLink(token, dropboxPath) {
  try {
    const resp = await fetch('/.netlify/functions/dropbox-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'shared-link', path: dropboxPath, token }),
    });
    if (!resp.ok) return null;
    const { url } = await resp.json();
    return url?.replace('?dl=0', '?raw=1') || null;
  } catch {
    return null;
  }
}

async function saveAssetVersion({ videoId, fileUrl, filePath, variantName, versionNumber }) {
  const version = parseInt(versionNumber, 10) || 1;
  const { error } = await window.supabase
    .from('kooperation_video_asset')
    .insert({
      video_id: videoId,
      file_url: fileUrl,
      file_path: filePath,
      version_number: version,
      variant_name: variantName || null,
      is_current: true,
      description: null,
      uploaded_by: window.currentUser?.id || null,
      created_at: new Date().toISOString(),
    });
  if (error) throw error;
}

async function updateCurrentFlags(videoId) {
  const { data: allAssets } = await window.supabase
    .from('kooperation_video_asset')
    .select('id, version_number')
    .eq('video_id', videoId);

  if (!allAssets || allAssets.length === 0) return;
  const maxVersion = Math.max(...allAssets.map(a => a.version_number));
  const nonCurrentIds = allAssets.filter(a => a.version_number !== maxVersion).map(a => a.id);
  const currentIds = allAssets.filter(a => a.version_number === maxVersion).map(a => a.id);

  if (nonCurrentIds.length > 0) {
    await window.supabase
      .from('kooperation_video_asset')
      .update({ is_current: false })
      .in('id', nonCurrentIds);
  }
  if (currentIds.length > 0) {
    await window.supabase
      .from('kooperation_video_asset')
      .update({ is_current: true })
      .in('id', currentIds);
  }
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

  let lastFileUrl = null;
  let folderUrl = null;

  for (let i = 0; i < queue.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const queueItem = queue[i];
    const file = queueItem.file;
    const variantName = (queueItem.variantName || '').trim();
    const versionNumber = String(queueItem.versionNumber || 1);
    const fileName = buildVersionedFileName_(file, versionNumber, metadaten);
    const item = job.items[i];

    updateItem(item.id, { status: 'uploading', loaded: 0, total: file.size });

    const { token, dropboxPath, kooperationFolderPath } = await fetchTokenAndPath({
      metadaten, versionNumber, variantName, fileName,
    });

    const getToken = async () => {
      const fresh = await fetchTokenAndPath({ metadaten, versionNumber, variantName, fileName });
      return fresh.token;
    };

    const uploadResult = await uploadFileDirect({
      file,
      dropboxPath,
      token,
      getToken,
      signal,
      onProgress: ({ loaded, total }) => {
        updateItem(item.id, { loaded, total });
      },
    });

    const actualPath = uploadResult.path_display || dropboxPath;

    updateItem(item.id, { status: 'saving' });

    const sharedLink = await createSharedLink(token, actualPath);
    if (!folderUrl) {
      folderUrl = await createFolderSharedLink(token, kooperationFolderPath);
    }

    const fileUrl = sharedLink || actualPath;
    lastFileUrl = fileUrl;

    await saveAssetVersion({ videoId, fileUrl, filePath: actualPath, variantName, versionNumber });

    updateItem(item.id, { status: 'done', loaded: file.size });
  }

  await updateCurrentFlags(videoId);

  const updateData = {};
  if (videoName) updateData.video_name = videoName;
  if (lastFileUrl) updateData.link_content = lastFileUrl;
  if (folderUrl) updateData.folder_url = folderUrl;

  if (Object.keys(updateData).length > 0) {
    await window.supabase
      .from('kooperation_videos')
      .update(updateData)
      .eq('id', videoId);
  }

  return { lastFileUrl, folderUrl, videoName };
}
