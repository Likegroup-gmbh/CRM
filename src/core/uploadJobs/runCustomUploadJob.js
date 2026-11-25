// runCustomUploadJob.js
// Job-Runner für Upload-Spalten der Kampagne: Dateien in den Spalten-Ordner der Kooperation
// (bzw. des Videos) in SharePoint, je Datei eine Zeile in custom_column_assets.

import { sharePointAssetFelder, uploadVerwerfen } from '../ablage/ablageUpload.js';
import { spalteHochladen, spaltenWertSetzen } from './spalteAblage.js';

/**
 * @param {object} ctx
 * @param {object} ctx.job - payload = { columnId, entityId, files }
 * @param {AbortSignal} ctx.signal
 * @param {(itemId, patch) => void} ctx.updateItem
 */
export async function runCustomUploadJob(ctx) {
  const { job, signal, updateItem } = ctx;
  const { columnId, entityId, files } = job.payload;

  if (!columnId || !entityId) throw new Error('columnId/entityId fehlt');
  if (!files || files.length === 0) throw new Error('Keine Dateien');

  let folderUrl = null;

  for (let i = 0; i < files.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const file = files[i];
    const item = job.items[i];
    updateItem(item.id, { status: 'uploading', loaded: 0, total: file.size });

    const { ziel, commit } = await spalteHochladen({ columnId, entityId, file, item, signal, updateItem });
    updateItem(item.id, { status: 'saving' });
    if (!folderUrl) folderUrl = commit.folder_url || null;

    const felder = sharePointAssetFelder(commit);
    const { error } = await window.supabase.from('custom_column_assets').insert({
      custom_column_id: columnId,
      entity_id: entityId,
      kooperation_id: commit.kooperation_id || null,
      ...felder,
      file_name: felder.file_name || file.name,
      file_size: felder.file_size ?? file.size,
      uploaded_by: window.currentUser?.id || null,
    });
    if (error) {
      await uploadVerwerfen(ziel.upload_id);
      throw error;
    }

    updateItem(item.id, { status: 'done', loaded: file.size });
  }

  await spaltenWertSetzen(columnId, entityId, folderUrl);
  return { columnId, entityId, folderUrl };
}
