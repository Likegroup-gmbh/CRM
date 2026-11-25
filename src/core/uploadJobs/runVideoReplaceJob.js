// runVideoReplaceJob.js
// Ersetzt eine bestehende Asset-Datei (gleiche version_number) durch eine neue Datei.
// Die alte SharePoint-Datei räumt der Server ab (ersetzen im Ziel-Request). Altbestand
// außerhalb von SharePoint bleibt liegen, die Zeile zeigt danach auf die neue Datei.

import { buildVersionedFileName } from '../VideoUploadUtils.js';
import { ablageZielHolen, hochladenNachSharePoint, sharePointAssetFelder, uploadVerwerfen } from '../ablage/ablageUpload.js';
import { trackUploadProgress } from './uploadFortschritt.js';

export async function runVideoReplaceJob(ctx) {
  const { job, signal, updateItem } = ctx;
  const { videoId, metadaten, file, assetId, versionNumber, variantName } = job.payload;
  const item = job.items[0];

  if (!videoId) throw new Error('videoId fehlt');
  if (!file) throw new Error('file fehlt');
  if (!assetId) throw new Error('assetId fehlt');

  const ext = file.name.split('.').pop() || 'mp4';
  const fileName = buildVersionedFileName(
    metadaten?.creatorName || '',
    metadaten?.unternehmen || '',
    metadaten?.kampagne || '',
    metadaten?.videoPosition || 1,
    versionNumber,
    ext
  );

  updateItem(item.id, { status: 'uploading', loaded: 0, total: file.size });

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

  const commit = await hochladenNachSharePoint({ ziel, file, signal, onProgress: trackUploadProgress(item, updateItem) });
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

  // Finale Versionen dieser Datei zeigen auf dieselbe Datei und ziehen mit
  const { error: finalsErr } = await window.supabase
    .from('kooperation_video_asset')
    .update(felder)
    .eq('source_asset_id', assetId);
  if (finalsErr) console.warn('[VideoReplace] Finale Versionen nicht nachgezogen:', finalsErr.message || finalsErr);

  updateItem(item.id, { status: 'done', loaded: file.size });
  return { assetId, fileUrl: felder.file_url, filePath: felder.file_path };
}
