// runStillUploadJob.js
// Job-Runner für Bilder (Stills) im Videos-Tab: Feedbackschleife und Finale Version.
// Keine DOM-Zugriffe, Status-Updates über ctx.updateItem. Der Dateiname bleibt der
// Name der hochgeladenen Datei, es gibt keine Variante.

import { ablageZielHolen, hochladenNachSharePoint, sharePointAssetFelder, uploadVerwerfen } from '../ablage/ablageUpload.js';
import { trackUploadProgress } from './uploadFortschritt.js';
import { updateStillCurrentFlags } from '../stills/stillAssets.js';

async function saveStill({ videoId, kooperationId, felder, versionNumber, isFinal, titel }) {
  const { error } = await window.supabase
    .from('kooperation_bilder_asset')
    .insert({
      kooperation_id: kooperationId,
      video_id: videoId,
      ...felder,
      version_number: isFinal ? 1 : versionNumber,
      variant_name: null,
      titel: titel || null,
      is_current: !isFinal,
      is_final: !!isFinal,
      uploaded_by: window.currentUser?.id || null,
      created_at: new Date().toISOString(),
    });
  if (error) throw error;
}

/** Anzeigetitel aus dem Dateinamen (ohne Endung). */
const titelAusDateiname = (name) => String(name || '').replace(/\.[a-z0-9]{2,5}$/i, '').trim().slice(0, 120) || null;

/**
 * @param {object} ctx
 * @param {object} ctx.job payload = { videoId, metadaten, queue: [{ file, versionNumber, isFinal }] }
 */
export async function runStillUploadJob(ctx) {
  const { job, signal, updateItem } = ctx;
  const { videoId, metadaten, queue } = job.payload;

  if (!videoId) throw new Error('videoId fehlt');
  if (!Array.isArray(queue) || queue.length === 0) throw new Error('queue leer');

  const kooperationId = metadaten?.kooperationId ?? null;
  let uploaded = 0;
  let hasFinalUpload = false;

  for (let i = 0; i < queue.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const { file, isFinal = false } = queue[i];
    const versionNumber = parseInt(queue[i].versionNumber, 10) || 1;
    const item = job.items[i];
    const titel = titelAusDateiname(file.name);

    updateItem(item.id, { status: 'uploading', loaded: 0, total: file.size });

    const ziel = await ablageZielHolen({
      typ: 'still',
      kooperation_id: kooperationId,
      kooperation_video_id: videoId,
      version_number: isFinal ? 1 : versionNumber,
      is_final: !!isFinal,
      variant_name: null,
      file_name: file.name,
      file_size: file.size,
    });

    const commit = await hochladenNachSharePoint({ ziel, file, signal, onProgress: trackUploadProgress(item, updateItem) });
    updateItem(item.id, { status: 'saving' });
    const felder = sharePointAssetFelder(commit);
    try {
      await saveStill({
        videoId, kooperationId, versionNumber, isFinal, titel,
        felder: { ...felder, file_name: felder.file_name || file.name, file_size: felder.file_size ?? file.size },
      });
    } catch (err) {
      await uploadVerwerfen(ziel.upload_id);
      throw err;
    }

    if (isFinal) hasFinalUpload = true;
    uploaded++;
    updateItem(item.id, { status: 'done', loaded: file.size });
  }

  await updateStillCurrentFlags(videoId);
  return { uploaded, hasFinalUpload };
}
