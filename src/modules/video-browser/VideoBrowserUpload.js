// VideoBrowserUpload.js
// Upload-Zone des Videos-Tabs. Beide Wege laufen über backgroundUploadService, also
// weiter beim Navigieren, abbrechbar und mit Erneut-Versuchen im Upload-Panel:
//   Rohmaterial        → Rohmaterial-Job
//   Feedbackschleife   → Video-Job für Videos, Still-Job für Bilder, flach ohne Variante
//                        (Stories legt der Stories-Tab ab, hier erscheinen sie in der Runde)
//   Finale Version     → wie oben mit isFinal, Videos mit Format je Datei aus den Metadaten
// Der Fortschritt kommt aus den echten Upload-Events, nichts wird simuliert.

import { RohmaterialService } from '../video/RohmaterialService.js';
import { backgroundUploadService, UPLOAD_EVENTS } from '../../core/BackgroundUploadService.js';
import { MAX_VIDEO_SIZE } from '../../core/VideoUploadUtils.js';
import { loadUploadContext } from './VideoBrowserAdapter.js';
import { ratioOfFile } from './videoBrowserRatio.js';

const VIDEO_EXT = /\.(mp4|mov|avi|mkv|webm|m4v)$/i;
const BILD_EXT = /\.(jpe?g|png|webp|heic|heif|gif)$/i;
const MAX_VIDEO_GB = MAX_VIDEO_SIZE / (1024 * 1024 * 1024);
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
      if (job.raw) {
        const n = job.entries.length;
        toast('success', `${n} ${n === 1 ? 'Datei' : 'Dateien'} hochgeladen`);
      }
      onSettled({ ok: true, folderKey: job.folderKey });
    } else if (status === 'error' || status === 'aborted') {
      jobs.delete(jobId);
      // Fertige Dateien liegen schon in Dropbox und der DB: nicht als fehlgeschlagen zeigen
      const items = backgroundUploadService.getJob(jobId)?.items || [];
      const statusOf = (itemId) => items.find(i => i.id === itemId);
      let done = 0;
      for (const x of job.entries) {
        const item = statusOf(x.itemId);
        if (item?.status === 'done') { done++; continue; }
        onChange({ id: x.id, error: item?.error || (status === 'aborted' ? 'Upload abgebrochen' : 'Upload fehlgeschlagen') });
      }
      if (status === 'error') toast('error', error || 'Upload fehlgeschlagen');
      onSettled({ ok: done > 0, folderKey: job.folderKey });
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

    const jobId = backgroundUploadService.enqueueRohmaterialJob({
      kooperationId: koop.id,
      pathContext: ctx.pathContext,
      files: valid
    });
    track(jobId, folderKey, entries, { raw: true });
  }

  /** Videos (in erlaubter Größe) und Bilder getrennt, mit Hinweisen für den Rest. */
  function validDateien(files) {
    const videos = files.filter(f => VIDEO_EXT.test(f.name || ''));
    const bilder = files.filter(f => BILD_EXT.test(f.name || ''));
    if (videos.length + bilder.length < files.length) toast('warning', 'Es sind nur Videos und Bilder erlaubt. Andere Dateien wurden übersprungen.');
    const validVideos = videos.filter(f => f.size <= MAX_VIDEO_SIZE);
    if (validVideos.length < videos.length) toast('error', `Videos über ${MAX_VIDEO_GB} GB wurden übersprungen.`);
    return { videos: validVideos, bilder };
  }

  /** Legt Video-Job und Bilder-Job an; die Zeilen im Panel folgen der Reihenfolge Videos, dann Bilder. */
  function enqueueDateien({ row, folderKey, metadaten, videoQueue, stillQueue }) {
    const entries = [...videoQueue, ...stillQueue].map(q => entry(q.file, folderKey));
    onAdded(entries);
    if (videoQueue.length) {
      const jobId = backgroundUploadService.enqueueVideoJob({ videoId: row.id, metadaten, queue: videoQueue, videoName: null });
      track(jobId, folderKey, entries.slice(0, videoQueue.length));
    }
    if (stillQueue.length) {
      const jobId = backgroundUploadService.enqueueStillJob({ videoId: row.id, metadaten, queue: stillQueue });
      track(jobId, folderKey, entries.slice(videoQueue.length));
    }
  }

  /** Kontext für einen Video-Job, oder null (mit Hinweis), wenn gerade nicht hochgeladen werden kann. */
  async function videoJobContext(koop, row) {
    if (backgroundUploadService.getActiveJobsForVideo(row.id).length) {
      toast('warning', 'Für dieses Video läuft bereits ein Upload im Hintergrund.');
      return null;
    }
    const ctx = await getContext(koop.id);
    if (ctx.keinDropbox) { toast('error', 'Für dieses Unternehmen ist Dropbox deaktiviert. Hier ist kein Upload möglich.'); return null; }
    return {
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
  }

  async function startLoop({ koop, row, folder, files }) {
    const folderKey = `${koop.id}:${row.id}:${folder.id}`;
    const { videos, bilder } = validDateien(files);
    if (!videos.length && !bilder.length) return;

    const metadaten = await videoJobContext(koop, row);
    if (!metadaten) return;

    // Alles liegt flach in der Schleife: keine Variante, der Name ist der Dateiname
    enqueueDateien({
      row, folderKey, metadaten,
      videoQueue: videos.map(file => ({ file, variantName: null, versionNumber: folder.number, isFinal: false })),
      stillQueue: bilder.map(file => ({ file, versionNumber: folder.number, isFinal: false }))
    });
  }

  /**
   * Direkt als Finale Version ablegen. Videos: je Datei ein eigenes Seitenverhältnis, erkannt aus
   * den Metadaten; Dateien ohne Standardformat (9:16, 4:5, 1:1) werden nicht hochgeladen.
   * Bilder haben kein Format und gehen direkt als finales Bild hoch.
   */
  async function startFinal({ koop, row, folder, files }) {
    const folderKey = `${koop.id}:${row.id}:${folder.id}`;
    const { videos: candidates, bilder } = validDateien(files);
    if (!candidates.length && !bilder.length) return;

    const formats = await Promise.all(candidates.map(f => ratioOfFile(f)));
    const videoQueue = [];
    candidates.forEach((file, i) => {
      if (!formats[i]) {
        toast('error', `„${file.name}“ hat kein Standardformat (9:16, 4:5 oder 1:1) und wurde nicht hochgeladen.`);
        return;
      }
      videoQueue.push({ file, variantName: formats[i], versionNumber: 1, isFinal: true });
    });
    const stillQueue = bilder.map(file => ({ file, versionNumber: 1, isFinal: true }));
    if (!videoQueue.length && !stillQueue.length) return;

    const metadaten = await videoJobContext(koop, row);
    if (!metadaten) return;

    enqueueDateien({ row, folderKey, metadaten, videoQueue, stillQueue });
  }

  function track(jobId, folderKey, entries, { raw = false } = {}) {
    const job = backgroundUploadService.getJob(jobId);
    jobs.set(jobId, {
      folderKey,
      raw,
      entries: entries.map((e, i) => ({ id: e.id, itemId: job?.items?.[i]?.id }))
    });
  }

  return {
    async start(args) {
      try {
        if (args.folder.kind === 'raw') await startRaw(args);
        else if (args.folder.kind === 'final') await startFinal(args);
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
