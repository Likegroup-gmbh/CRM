// BackgroundUploadService.js
// Globale Upload-Queue: hält File-Uploads am Leben, während der User in der SPA weiternavigiert.
// - Sequenzielle Queue (concurrency=1) — eine 600-MB-Datei sättigt den Uplink ohnehin
// - Pro Job N Items (Files); pro Item Progress + Status
// - CustomEvents (window.dispatchEvent), keine Drawer-/DOM-Referenzen im Service
// - AbortController pro Job; beforeunload-Guard solange aktiv

import { runVideoUploadJob } from './uploadJobs/runVideoUploadJob.js';
import { runVideoReplaceJob } from './uploadJobs/runVideoReplaceJob.js';
import { runStorysUploadJob } from './uploadJobs/runStorysUploadJob.js';

const EVT = {
  QUEUE_CHANGED: 'upload:queue-changed',
  ITEM_UPDATE: 'upload:item-update',
  JOB_UPDATE: 'upload:job-update',
  VIDEO_DONE: 'upload:video-done',
  STORYS_DONE: 'upload:storys-done',
  ERROR: 'upload:error',
};

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const RUNNERS = {
  video: runVideoUploadJob,
  'video-replace': runVideoReplaceJob,
  storys: runStorysUploadJob,
};

class BackgroundUploadService {
  constructor() {
    this._jobs = new Map();
    this._order = [];
    this._running = false;
    this._beforeUnloadHandler = null;
  }

  // ─── Public API ────────────────────────────────────────────

  /**
   * Job in die Queue legen. Items werden aus payload abgeleitet.
   * @returns {string} jobId
   */
  enqueueVideoJob(payload) {
    return this._enqueue('video', payload);
  }
  enqueueVideoReplaceJob(payload) {
    return this._enqueue('video-replace', payload);
  }
  enqueueStorysJob(payload) {
    return this._enqueue('storys', payload);
  }

  getJob(jobId) {
    return this._jobs.get(jobId) || null;
  }

  getAllJobs() {
    return this._order.map(id => this._jobs.get(id)).filter(Boolean);
  }

  getActiveJobs() {
    return this.getAllJobs().filter(j => j.status === 'pending' || j.status === 'running');
  }

  /**
   * Aktive Jobs für eine bestimmte videoId (für Drawer-Re-Entry).
   */
  getActiveJobsForVideo(videoId) {
    if (!videoId) return [];
    return this.getActiveJobs().filter(j => j.videoId === videoId);
  }

  /**
   * Job abbrechen. Wenn er gerade läuft, AbortController feuert.
   */
  abort(jobId) {
    const job = this._jobs.get(jobId);
    if (!job) return;
    if (job.status === 'done' || job.status === 'error' || job.status === 'aborted') return;
    job.abortController?.abort();
    if (job.status === 'pending') {
      this._setJobStatus(job, 'aborted');
    }
  }

  /**
   * Fehlgeschlagenen Job neu in die Queue legen (mit neuer ID, gleiche Payload).
   */
  retry(jobId) {
    const old = this._jobs.get(jobId);
    if (!old) return null;
    if (old.status !== 'error' && old.status !== 'aborted') return null;
    return this._enqueue(old.kind, old.payload);
  }

  /**
   * Entfernt einen abgeschlossenen Job aus der Sichtbarkeit (Panel-Cleanup).
   */
  dismiss(jobId) {
    const job = this._jobs.get(jobId);
    if (!job) return;
    if (job.status === 'pending' || job.status === 'running') return;
    this._jobs.delete(jobId);
    this._order = this._order.filter(id => id !== jobId);
    this._emit(EVT.QUEUE_CHANGED, { jobs: this.getAllJobs() });
    this._refreshBeforeUnload();
  }

  // ─── Internals ─────────────────────────────────────────────

  _enqueue(kind, payload) {
    const runner = RUNNERS[kind];
    if (!runner) throw new Error(`Unbekannter Job-Typ: ${kind}`);

    const id = uuid();
    const items = this._buildItems(kind, payload);
    const job = {
      id,
      kind,
      payload,
      videoId: payload?.videoId || null,
      items,
      status: 'pending',
      error: null,
      createdAt: Date.now(),
      abortController: new AbortController(),
    };
    this._jobs.set(id, job);
    this._order.push(id);
    this._emit(EVT.QUEUE_CHANGED, { jobs: this.getAllJobs() });
    this._refreshBeforeUnload();
    this._tick();
    return id;
  }

  _buildItems(kind, payload) {
    if (kind === 'video') {
      return (payload.queue || []).map(q => this._mkItem({
        fileName: q.file?.name || 'video',
        fileSize: q.file?.size || 0,
        meta: { variantName: q.variantName, versionNumber: q.versionNumber },
      }));
    }
    if (kind === 'video-replace') {
      return [this._mkItem({
        fileName: payload.file?.name || 'video',
        fileSize: payload.file?.size || 0,
        meta: { assetId: payload.assetId, versionNumber: payload.versionNumber },
      })];
    }
    if (kind === 'storys') {
      return (payload.queue || []).map(q => this._mkItem({
        fileName: q.file?.name || 'story',
        fileSize: q.file?.size || 0,
        meta: { slotId: q.slotId, versionNumber: q.versionNumber, variantName: q.variantName },
      }));
    }
    return [];
  }

  _mkItem({ fileName, fileSize, meta }) {
    return {
      id: uuid(),
      fileName,
      fileSize,
      loaded: 0,
      total: fileSize,
      status: 'pending', // pending | uploading | saving | done | error | aborted
      error: null,
      meta: meta || {},
      startedAt: null,
      finishedAt: null,
    };
  }

  async _tick() {
    if (this._running) return;
    const next = this._order.map(id => this._jobs.get(id)).find(j => j && j.status === 'pending');
    if (!next) return;

    this._running = true;
    this._setJobStatus(next, 'running');

    const runner = RUNNERS[next.kind];
    const ctx = {
      job: next,
      signal: next.abortController.signal,
      updateItem: (itemId, patch) => this._updateItem(next, itemId, patch),
    };

    try {
      const result = await runner(ctx);
      this._setJobStatus(next, 'done', null, result);
      if (next.kind === 'video' || next.kind === 'video-replace') {
        this._emit(EVT.VIDEO_DONE, { jobId: next.id, videoId: next.videoId, result });
      } else if (next.kind === 'storys') {
        this._emit(EVT.STORYS_DONE, { jobId: next.id, videoId: next.videoId, result });
      }
    } catch (err) {
      console.error('[BackgroundUpload] Job fehlgeschlagen:', err);
      if (err?.name === 'AbortError') {
        this._setJobStatus(next, 'aborted');
        for (const item of next.items) {
          if (item.status === 'uploading' || item.status === 'saving' || item.status === 'pending') {
            this._updateItem(next, item.id, { status: 'aborted' });
          }
        }
      } else {
        this._setJobStatus(next, 'error', err);
        this._emit(EVT.ERROR, { jobId: next.id, error: err?.message || String(err) });
      }
    } finally {
      this._running = false;
      this._refreshBeforeUnload();
      // Nächsten Job antriggern
      setTimeout(() => this._tick(), 0);
    }
  }

  _updateItem(job, itemId, patch) {
    const item = job.items.find(i => i.id === itemId);
    if (!item) return;
    const prevStatus = item.status;
    Object.assign(item, patch);
    if (patch.status && patch.status !== prevStatus) {
      const FINAL = new Set(['done', 'error', 'aborted']);
      if (patch.status === 'uploading' && !item.startedAt) {
        item.startedAt = Date.now();
      }
      if (FINAL.has(patch.status) && !item.finishedAt) {
        item.finishedAt = Date.now();
        if (!item.startedAt) item.startedAt = item.finishedAt; // 0s saving-only
      }
    }
    this._emit(EVT.ITEM_UPDATE, { jobId: job.id, itemId, item: { ...item } });
  }

  _setJobStatus(job, status, error = null, result = null) {
    job.status = status;
    if (error) job.error = error?.message || String(error);
    if (result) job.result = result;
    this._emit(EVT.JOB_UPDATE, { jobId: job.id, status, error: job.error || null });
    this._emit(EVT.QUEUE_CHANGED, { jobs: this.getAllJobs() });
  }

  _emit(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (err) {
      console.warn('[BackgroundUpload] emit failed:', name, err);
    }
  }

  _refreshBeforeUnload() {
    const hasActive = this.getActiveJobs().length > 0;
    if (hasActive && !this._beforeUnloadHandler) {
      this._beforeUnloadHandler = (e) => {
        e.preventDefault();
        e.returnValue = 'Upload läuft noch — wirklich verlassen? Der Upload wird abgebrochen.';
        return e.returnValue;
      };
      window.addEventListener('beforeunload', this._beforeUnloadHandler);
    } else if (!hasActive && this._beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler);
      this._beforeUnloadHandler = null;
    }
  }
}

export const backgroundUploadService = new BackgroundUploadService();
export const UPLOAD_EVENTS = EVT;
