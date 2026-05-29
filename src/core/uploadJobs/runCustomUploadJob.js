// runCustomUploadJob.js
// Job-Runner fuer Custom Column Upload (beliebige Dateien -> Dropbox-Ordner).

import { uploadFileDirect } from '../DropboxDirectUploader.js';
import { createFolderSharedLink } from '../VideoUploadUtils.js';

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
 * @param {object} ctx.job - payload = { columnId, entityId, metadaten, files, folderName }
 * @param {AbortSignal} ctx.signal
 * @param {(itemId, patch) => void} ctx.updateItem
 */
export async function runCustomUploadJob(ctx) {
  const { job, signal, updateItem } = ctx;
  const {
    columnId, entityId, metadaten, files, folderName,
    valueTable = 'custom_column_values',
    assetTable = 'custom_column_assets',
  } = job.payload;

  if (!columnId || !entityId) throw new Error('columnId/entityId fehlt');
  if (!files || files.length === 0) throw new Error('Keine Dateien');

  let folderUrl = null;

  for (let i = 0; i < files.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const file = files[i];
    const item = job.items[i];

    updateItem(item.id, { status: 'uploading', loaded: 0, total: file.size, transport: 'direct' });

    const { token, dropboxPath, folderPath } = await fetchTokenAndPath({
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

    if (job.items[i].directOk === null) updateItem(item.id, { directOk: true });
    updateItem(item.id, { status: 'saving' });

    const sharedLink = await createSharedLink(token, actualPath);

    if (!folderUrl) {
      folderUrl = await createFolderSharedLink(token, folderPath);
    }

    await window.supabase.from(assetTable).insert({
      custom_column_id: columnId,
      entity_id: entityId,
      file_url: sharedLink || actualPath,
      file_path: actualPath,
      file_name: file.name,
      file_size: file.size,
      uploaded_by: window.currentUser?.id || null,
    });

    updateItem(item.id, { status: 'done', loaded: file.size });
  }

  if (folderUrl) {
    await window.supabase.from(valueTable).upsert(
      {
        custom_column_id: columnId,
        entity_id: entityId,
        value: folderUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'custom_column_id,entity_id' }
    );
  }

  return { columnId, entityId, folderUrl };
}
