// runCustomReplaceJob.js
// Ersetzt eine Datei einer Upload-Spalte. Liegt die alte Datei in SharePoint, wird sie zur neuen
// Version desselben Items; Altbestand außerhalb von SharePoint bleibt liegen, die neue Datei kommt
// in den Spalten-Ordner und die Zeile zeigt danach auf sie.

import { sharePointAssetFelder, uploadVerwerfen } from '../ablage/ablageUpload.js';
import { spalteHochladen, spaltenWertSetzen } from './spalteAblage.js';

/**
 * @param {object} ctx
 * @param {object} ctx.job - payload = { columnId, entityId, file, assetId }
 * @param {AbortSignal} ctx.signal
 * @param {(itemId, patch) => void} ctx.updateItem
 */
export async function runCustomReplaceJob(ctx) {
  const { job, signal, updateItem } = ctx;
  const { columnId, entityId, file, assetId } = job.payload;
  const item = job.items[0];

  if (!columnId || !entityId) throw new Error('columnId/entityId fehlt');
  if (!file) throw new Error('file fehlt');
  if (!assetId) throw new Error('assetId fehlt');

  updateItem(item.id, { status: 'uploading', loaded: 0, total: file.size });

  const { ziel, commit } = await spalteHochladen({ columnId, entityId, file, ersetzenId: assetId, item, signal, updateItem });
  updateItem(item.id, { status: 'saving' });

  const felder = sharePointAssetFelder(commit);
  const { error: updateErr } = await window.supabase
    .from('custom_column_assets')
    .update({
      kooperation_id: commit.kooperation_id || null,
      ...felder,
      file_name: felder.file_name || file.name,
      file_size: felder.file_size ?? file.size,
      uploaded_by: window.currentUser?.id || null,
    })
    .eq('id', assetId);
  if (updateErr) {
    await uploadVerwerfen(ziel.upload_id);
    throw updateErr;
  }

  await spaltenWertSetzen(columnId, entityId, commit.folder_url);
  updateItem(item.id, { status: 'done', loaded: file.size });

  return { columnId, entityId, assetId, folderUrl: commit.folder_url || null, fileUrl: felder.file_url, filePath: felder.file_path };
}
