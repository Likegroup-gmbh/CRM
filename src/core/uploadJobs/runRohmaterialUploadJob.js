// runRohmaterialUploadJob.js
// Rohmaterial einer Kooperation über die Hintergrund-Queue: läuft beim Navigieren weiter,
// ist abbrechbar, und Erneut-Versuchen lädt nur die Dateien, die noch fehlen.
// Eine fehlerhafte Datei stoppt die übrigen nicht; der Job endet dann als Fehler.

import { RohmaterialService } from '../../modules/video/RohmaterialService.js';
import { trackUploadProgress } from './videoUploadSteps.js';

/**
 * @param {object} ctx
 * @param {object} ctx.job - payload = { kooperationId, pathContext, files, ordnerItemId? }
 * @param {AbortSignal} ctx.signal
 * @param {(itemId, patch) => void} ctx.updateItem
 */
export async function runRohmaterialUploadJob({ job, signal, updateItem }) {
  const { kooperationId, pathContext, files, ordnerItemId = null } = job.payload;
  if (!kooperationId) throw new Error('kooperationId fehlt');
  if (!Array.isArray(files) || files.length === 0) throw new Error('Keine Dateien');

  const group = { id: kooperationId, pathContext, ordnerItemId };
  const taken = await RohmaterialService.takenFileNames(kooperationId);
  const errors = [];
  let uploaded = 0;

  for (let i = 0; i < files.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const file = files[i];
    const item = job.items[i];
    updateItem(item.id, { status: 'uploading', loaded: 0, total: file.size, transport: 'direct' });

    try {
      await RohmaterialService.uploadOne(group, file, taken, {
        signal,
        onBytes: trackUploadProgress(item, updateItem),
      });
      if (item.directOk === null) updateItem(item.id, { directOk: true });
      updateItem(item.id, { status: 'done', loaded: file.size });
      uploaded++;
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      const message = err?.message || 'Upload fehlgeschlagen';
      updateItem(item.id, { status: 'error', error: message });
      errors.push(`${file.name}: ${message}`);
    }
  }

  if (errors.length) throw new Error(errors.join(' · '));
  return { kooperationId, uploaded };
}
