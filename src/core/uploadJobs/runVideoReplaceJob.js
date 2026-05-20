// runVideoReplaceJob.js
// Ersetzt eine bestehende Asset-Datei (gleiche version_number) durch eine neue Datei.

import { uploadFileDirect } from '../DropboxDirectUploader.js';
import { buildVersionedFileName } from '../VideoUploadUtils.js';

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

export async function runVideoReplaceJob(ctx) {
  const { job, signal, updateItem } = ctx;
  const { videoId, metadaten, file, assetId, oldFilePath, versionNumber, variantName } = job.payload;
  const item = job.items[0];

  if (!videoId) throw new Error('videoId fehlt');
  if (!file) throw new Error('file fehlt');
  if (!assetId) throw new Error('assetId fehlt');

  // Alte Datei aus Dropbox löschen (best effort)
  if (oldFilePath) {
    try {
      await fetch('/.netlify/functions/dropbox-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: oldFilePath }),
      });
    } catch (err) {
      console.warn('[VideoReplace] Dropbox-Löschung fehlgeschlagen:', err);
    }
  }

  const ext = file.name.split('.').pop() || 'mp4';
  const fileName = buildVersionedFileName(
    metadaten?.creatorName || '',
    metadaten?.unternehmen || '',
    metadaten?.kampagne || '',
    versionNumber,
    ext
  );

  updateItem(item.id, { status: 'uploading', loaded: 0, total: file.size, transport: 'direct' });

  const { token, dropboxPath } = await fetchTokenAndPath({
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
    onProgress: ({ loaded, total, phase }) => {
      const patch = { loaded, total };
      if (phase === 'proxy-fallback') patch.transport = 'proxy';
      updateItem(item.id, patch);
    },
  });

  const actualPath = uploadResult.path_display || dropboxPath;
  updateItem(item.id, { status: 'saving' });

  const sharedLink = await createSharedLink(token, actualPath);
  const fileUrl = sharedLink || actualPath;

  const { error: updateErr } = await window.supabase
    .from('kooperation_video_asset')
    .update({
      file_url: fileUrl,
      file_path: actualPath,
      created_at: new Date().toISOString(),
    })
    .eq('id', assetId);
  if (updateErr) throw updateErr;

  updateItem(item.id, { status: 'done', loaded: file.size });

  return { assetId, fileUrl, filePath: actualPath };
}
