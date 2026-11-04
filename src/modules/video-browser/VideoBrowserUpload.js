// VideoBrowserUpload.js
// Upload-Zone des Videos-Tabs. Verwendet die vorhandene Upload-Infrastruktur:
//   Rohmaterial        → RohmaterialService.uploadFiles (Byte-Fortschritt)
//   Feedbackschleife   → backgroundUploadService (Video-Job; Stories und Bilder legt
//                        der Stories- bzw. Bilder-Tab ab, hier erscheinen sie in der Runde)
// Der Fortschritt kommt aus den echten Upload-Events, nichts wird simuliert.

import { RohmaterialService } from '../video/RohmaterialService.js';
import { backgroundUploadService, UPLOAD_EVENTS } from '../../core/BackgroundUploadService.js';
import { loadUploadContext } from './VideoBrowserAdapter.js';
import { nextVariantLetters } from './videoBrowserLogic.js';

const VIDEO_EXT = /\.(mp4|mov|avi|mkv|webm|m4v)$/i;
let seq = 0;
const uid = () => `up-${Date.now().toString(36)}-${++seq}`;

/**
 * @param {{ onChange: (u: object) => void, onAdded: (list: object[]) => void,
 *           onSettled: (info: { ok: boolean, folderKey: string }) => void,
 *           toast: (type: 'success'|'error'|'warning', text: string) => void }} hooks
 */
export function createUploader({ onChange, onAdded, onSettled, toast }) {
  const jobs = new Map(); // jobId -> { folderKey, entries: [{ id, itemId }] }
  const contextCache = new Map();

  const getContext = async (kooperationId) => {
    if (!contextCache.has(kooperationId)) contextCache.set(kooperationId, loadUploadContext(kooperationId));
    return contextCache.get(kooperationId);
  };

  const entry = (file, folderKey) => ({ id: uid(), name: file.name, progress: 0, error: null, folderKey });

  /* ---- Events der Hintergrund-Uploads ---- */

  const onItem = (e) => {
    const { jobId, itemId, item } = e.detail || {};
    const job = jobs.get(jobId);
    const target = job?.entries.find(x => x.itemId === itemId);
    if (!target) return;
    const progress = item.total ? Math.min(1, item.loaded / item.total) : 0;
    onChange({ id: target.id, progress: item.status === 'done' ? 1 : progress, error: item.status === 'error' ? (item.error || 'Upload fehlgeschlagen') : null });
  };

  const onJob = (e) => {
    const { jobId, status, error } = e.detail || {};
    const job = jobs.get(jobId);
    if (!job) return;
    if (status === 'done') {
      jobs.delete(jobId);
      onSettled({ ok: true, folderKey: job.folderKey });
    } else if (status === 'error' || status === 'aborted') {
      jobs.delete(jobId);
      job.entries.forEach(x => onChange({ id: x.id, error: error || 'Upload abgebrochen' }));
      toast('error', error || 'Upload fehlgeschlagen');
      onSettled({ ok: false, folderKey: job.folderKey });
    }
  };

  window.addEventListener(UPLOAD_EVENTS.ITEM_UPDATE, onItem);
  window.addEventListener(UPLOAD_EVENTS.JOB_UPDATE, onJob);

  /* ---- Upload starten ---- */

  async function startRaw({ koop, folder, files }) {
    const folderKey = `${koop.id}:${folder.id}`;
    const valid = [];
    for (const file of files) {
      const check = RohmaterialService.validateFile(file);
      if (check.ok) valid.push(file);
      else toast('error', check.error);
    }
    if (!valid.length) return;

    const ctx = await getContext(koop.id);
    if (ctx.keinDropbox) { toast('error', 'Für dieses Unternehmen ist Dropbox deaktiviert. Hier ist kein Upload möglich.'); return; }

    const entries = valid.map(f => entry(f, folderKey));
    onAdded(entries);

    const { uploaded, errors } = await RohmaterialService.uploadFiles(
      { id: koop.id, pathContext: ctx.pathContext },
      valid,
      undefined,
      (index, { loaded, total }) => onChange({ id: entries[index].id, progress: total ? Math.min(1, loaded / total) : 0 })
    );
    errors.forEach(msg => toast('error', msg));
    if (uploaded) toast('success', `${uploaded} ${uploaded === 1 ? 'Datei' : 'Dateien'} hochgeladen`);
    onSettled({ ok: uploaded > 0, folderKey });
  }

  async function startLoop({ koop, row, folder, files }) {
    const folderKey = `${koop.id}:${row.id}:${folder.id}`;
    const valid = files.filter(f => VIDEO_EXT.test(f.name || ''));
    if (valid.length < files.length) toast('warning', 'Es sind nur Videodateien erlaubt. Andere Dateien wurden übersprungen.');
    if (!valid.length) return;

    const videoId = row.id;
    if (backgroundUploadService.getActiveJobsForVideo(videoId).length) {
      toast('warning', 'Für dieses Video läuft bereits ein Upload im Hintergrund.');
      return;
    }

    const ctx = await getContext(koop.id);
    if (ctx.keinDropbox) { toast('error', 'Für dieses Unternehmen ist Dropbox deaktiviert. Hier ist kein Upload möglich.'); return; }

    const letters = nextVariantLetters(row, valid.length);
    const queue = valid.map((file, i) => ({
      file,
      variantName: letters[i],
      versionNumber: folder.number,
      isFinal: false
    }));

    const metadaten = {
      kooperationId: koop.id,
      kooperationName: ctx.pathContext.kooperation,
      unternehmen: ctx.pathContext.unternehmen,
      marke: ctx.pathContext.marke,
      kampagne: ctx.pathContext.kampagne,
      creatorName: ctx.creatorName,
      videoPosition: row.number,
      videoThema: row.title || '',
      videoTitel: row.title || 'Video'
    };

    const entries = valid.map(f => entry(f, folderKey));
    onAdded(entries);

    const jobId = backgroundUploadService.enqueueVideoJob({ videoId, metadaten, queue, videoName: null });

    const job = backgroundUploadService.getJob(jobId);
    jobs.set(jobId, {
      folderKey,
      entries: entries.map((e, i) => ({ id: e.id, itemId: job?.items?.[i]?.id }))
    });
  }

  return {
    async start(args) {
      try {
        if (args.folder.kind === 'raw') await startRaw(args);
        else await startLoop(args);
      } catch (err) {
        console.error('VideoBrowserUpload:', err);
        toast('error', err?.message || 'Upload fehlgeschlagen');
      }
    },
    destroy() {
      window.removeEventListener(UPLOAD_EVENTS.ITEM_UPDATE, onItem);
      window.removeEventListener(UPLOAD_EVENTS.JOB_UPDATE, onJob);
      jobs.clear();
    }
  };
}
