import { describe, it, expect, vi, beforeEach } from 'vitest';

// Job-Runner mocken, damit der Service ohne echte Dropbox-/Supabase-Calls testbar ist
vi.mock('../core/uploadJobs/runVideoUploadJob.js', () => ({
  runVideoUploadJob: vi.fn(),
}));
vi.mock('../core/uploadJobs/runVideoReplaceJob.js', () => ({
  runVideoReplaceJob: vi.fn(),
}));
vi.mock('../core/uploadJobs/runStorysUploadJob.js', () => ({
  runStorysUploadJob: vi.fn(),
}));

import { backgroundUploadService, UPLOAD_EVENTS } from '../core/BackgroundUploadService.js';
import { runVideoUploadJob } from '../core/uploadJobs/runVideoUploadJob.js';

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('BackgroundUploadService', () => {
  beforeEach(() => {
    // Service zurücksetzen
    for (const job of backgroundUploadService.getAllJobs()) {
      backgroundUploadService.abort(job.id);
    }
    for (const job of backgroundUploadService.getAllJobs()) {
      backgroundUploadService.dismiss(job.id);
    }
    runVideoUploadJob.mockReset();
  });

  it('enqueueVideoJob baut Items pro File und startet Runner', async () => {
    runVideoUploadJob.mockResolvedValueOnce({ lastFileUrl: 'u', videoName: 'n', folderUrl: null });

    const file1 = new File([new Uint8Array(10)], 'a.mp4');
    const file2 = new File([new Uint8Array(20)], 'b.mp4');

    const jobId = backgroundUploadService.enqueueVideoJob({
      videoId: 'v1',
      metadaten: {},
      queue: [
        { file: file1, variantName: 'A', versionNumber: 1 },
        { file: file2, variantName: 'B', versionNumber: 1 },
      ],
      videoName: 'n',
    });

    const job = backgroundUploadService.getJob(jobId);
    expect(job).toBeTruthy();
    expect(job.items).toHaveLength(2);
    expect(job.items[0].fileName).toBe('a.mp4');
    expect(job.items[1].fileSize).toBe(20);

    await flush();
    expect(runVideoUploadJob).toHaveBeenCalledTimes(1);
    await flush();
    expect(backgroundUploadService.getJob(jobId).status).toBe('done');
  });

  it('emittiert VIDEO_DONE mit videoId und Result', async () => {
    runVideoUploadJob.mockResolvedValueOnce({ lastFileUrl: 'https://x', videoName: 'n', folderUrl: 'fu' });
    const events = [];
    const handler = (e) => events.push(e.detail);
    window.addEventListener(UPLOAD_EVENTS.VIDEO_DONE, handler);

    backgroundUploadService.enqueueVideoJob({
      videoId: 'v42', metadaten: {},
      queue: [{ file: new File([new Uint8Array(1)], 'x.mp4'), variantName: 'X', versionNumber: 1 }],
    });
    await flush(); await flush();

    window.removeEventListener(UPLOAD_EVENTS.VIDEO_DONE, handler);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const last = events[events.length - 1];
    expect(last.videoId).toBe('v42');
    expect(last.result.lastFileUrl).toBe('https://x');
  });

  it('getActiveJobsForVideo zeigt laufende Jobs nach videoId', async () => {
    let resolveJob;
    runVideoUploadJob.mockReturnValueOnce(new Promise((r) => { resolveJob = r; }));

    const jobId = backgroundUploadService.enqueueVideoJob({
      videoId: 'v-active', metadaten: {},
      queue: [{ file: new File([new Uint8Array(1)], 'x.mp4'), variantName: 'X', versionNumber: 1 }],
    });
    await flush();
    expect(backgroundUploadService.getActiveJobsForVideo('v-active')).toHaveLength(1);
    expect(backgroundUploadService.getActiveJobsForVideo('other')).toHaveLength(0);

    resolveJob({ lastFileUrl: null, videoName: null, folderUrl: null });
    await flush(); await flush();
    expect(backgroundUploadService.getActiveJobsForVideo('v-active')).toHaveLength(0);
    expect(backgroundUploadService.getJob(jobId).status).toBe('done');
  });

  it('abort feuert AbortSignal, Job wird auf "aborted" gesetzt', async () => {
    runVideoUploadJob.mockImplementationOnce(async ({ signal }) => {
      await new Promise((_, rej) => {
        signal.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')));
      });
    });

    const jobId = backgroundUploadService.enqueueVideoJob({
      videoId: 'v', metadaten: {},
      queue: [{ file: new File([new Uint8Array(1)], 'x.mp4'), variantName: 'X', versionNumber: 1 }],
    });
    await flush();
    backgroundUploadService.abort(jobId);
    await flush(); await flush();
    expect(backgroundUploadService.getJob(jobId).status).toBe('aborted');
  });

  it('Fehler setzt Job auf "error" und emittiert ERROR', async () => {
    runVideoUploadJob.mockRejectedValueOnce(new Error('Boom'));
    const errors = [];
    const h = (e) => errors.push(e.detail);
    window.addEventListener(UPLOAD_EVENTS.ERROR, h);

    const jobId = backgroundUploadService.enqueueVideoJob({
      videoId: 'v', metadaten: {},
      queue: [{ file: new File([new Uint8Array(1)], 'x.mp4'), variantName: 'X', versionNumber: 1 }],
    });
    await flush(); await flush();
    window.removeEventListener(UPLOAD_EVENTS.ERROR, h);

    expect(backgroundUploadService.getJob(jobId).status).toBe('error');
    expect(errors[0].error).toBe('Boom');
  });

  it('Jobs werden sequentiell abgearbeitet', async () => {
    const log = [];
    let resolve1, resolve2;
    runVideoUploadJob
      .mockImplementationOnce(() => new Promise((r) => { log.push('start1'); resolve1 = r; }))
      .mockImplementationOnce(() => new Promise((r) => { log.push('start2'); resolve2 = r; }));

    const id1 = backgroundUploadService.enqueueVideoJob({
      videoId: 'v1', metadaten: {},
      queue: [{ file: new File([new Uint8Array(1)], 'a.mp4'), variantName: 'A', versionNumber: 1 }],
    });
    const id2 = backgroundUploadService.enqueueVideoJob({
      videoId: 'v2', metadaten: {},
      queue: [{ file: new File([new Uint8Array(1)], 'b.mp4'), variantName: 'B', versionNumber: 1 }],
    });

    await flush();
    // Nur Job 1 sollte gestartet sein
    expect(log).toEqual(['start1']);
    expect(backgroundUploadService.getJob(id1).status).toBe('running');
    expect(backgroundUploadService.getJob(id2).status).toBe('pending');

    resolve1({ lastFileUrl: null, videoName: null, folderUrl: null });
    await flush(); await flush();
    expect(log).toEqual(['start1', 'start2']);
    expect(backgroundUploadService.getJob(id2).status).toBe('running');

    resolve2({ lastFileUrl: null, videoName: null, folderUrl: null });
    await flush(); await flush();
    expect(backgroundUploadService.getJob(id2).status).toBe('done');
  });
});
