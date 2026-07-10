// runCustomReplaceJob.js
// Ersetzt eine bestehende Custom-Column-Datei: alte Dropbox-Datei loeschen,
// neue Datei in denselben Ordner hochladen, Asset-Row updaten.
// Spiegel von runVideoReplaceJob, aber mit dropbox-upload-custom-Pfaden.

import { uploadFileDirect } from '../DropboxDirectUploader.js';

async function fetchTokenAndPath({ metadaten, folderName, fileName }) {
  const resp = await fetch('/.netlify/functions/dropbox-upload-custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      unternehmen: metadaten.unternehmen || '',
      marke: metadaten.marke || '',
      kampagne: metadaten.kampagne || '',
      kooperation: metadaten.kooperationName || '',
      folderName,
      fileName,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Token-Abruf fehlgeschlagen (${resp.status})`);
  }
  return resp.json();
}

async function createSharedLink(token, path) {
  try {
    const resp = await fetch('/.netlify/functions/dropbox-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'shared-link', path, token }),
    });
    if (!resp.ok) return null;
    const { url } = await resp.json();
    return url?.replace('?dl=0', '?raw=1') || null;
  } catch {
    return null;
  }
}

/**
 * @param {object} ctx
 * @param {object} ctx.job - payload = { columnId, entityId, metadaten, file, assetId, oldFilePath, folderName, assetTable }
 * @param {AbortSignal} ctx.signal
 * @param {(itemId, patch) => void} ctx.updateItem
 */
export async function runCustomReplaceJob(ctx) {
  const { job, signal, updateItem } = ctx;
  const {
    columnId, entityId, metadaten, file, assetId, oldFilePath, folderName,
    assetTable = 'custom_column_assets',
  } = job.payload;
  const item = job.items[0];

  if (!columnId || !entityId) throw new Error('columnId/entityId fehlt');
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
      console.warn('[CustomReplace] Dropbox-Löschung fehlgeschlagen:', err);
    }
  }

  updateItem(item.id, { status: 'uploading', loaded: 0, total: file.size, transport: 'direct' });

  const { token, dropboxPath } = await fetchTokenAndPath({
    metadaten, folderName, fileName: file.name,
  });

  const getToken = async () => {
    const fresh = await fetchTokenAndPath({ metadaten, folderName, fileName: file.name });
    return fresh.token;
  };

  const uploadResult = await uploadFileDirect({
    file, dropboxPath, token, getToken, signal,
    onProgress: ({ loaded, total, phase, error }) => {
      const patch = { loaded, total };
      if (phase === 'direct-failed') {
        patch.directOk = false;
        patch.directError = error || 'Unbekannter Fehler';
        patch.transport = 'proxy';
      }
      if (phase === 'proxy-fallback') patch.transport = 'proxy';
      updateItem(item.id, patch);
    },
  });

  const actualPath = uploadResult.path_display || dropboxPath;
  if (item.directOk === null) updateItem(item.id, { directOk: true });
  updateItem(item.id, { status: 'saving' });

  const sharedLink = await createSharedLink(token, actualPath);
  const fileUrl = sharedLink || actualPath;

  const { error: updateErr } = await window.supabase
    .from(assetTable)
    .update({
      file_url: fileUrl,
      file_path: actualPath,
      file_name: file.name,
      file_size: file.size,
      uploaded_by: window.currentUser?.id || null,
    })
    .eq('id', assetId);
  if (updateErr) throw updateErr;

  updateItem(item.id, { status: 'done', loaded: file.size });

  return { columnId, entityId, assetId, fileUrl, filePath: actualPath };
}
