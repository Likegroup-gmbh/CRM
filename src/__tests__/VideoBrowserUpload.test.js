import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = {
  getActiveJobsForVideo: vi.fn(() => []),
  enqueueVideoJob: vi.fn(() => 'job1'),
  enqueueStillJob: vi.fn(() => 'job-still'),
  enqueueRohmaterialJob: vi.fn(() => 'job-roh'),
  getJob: vi.fn(() => ({ items: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }] }))
};

vi.mock('../core/BackgroundUploadService.js', () => ({
  backgroundUploadService: service,
  UPLOAD_EVENTS: { ITEM_UPDATE: 'upload:item', JOB_UPDATE: 'upload:job' }
}));
vi.mock('../modules/video/RohmaterialService.js', () => ({ RohmaterialService: { validateFile: () => ({ ok: true }) } }));
vi.mock('../modules/video-browser/VideoBrowserAdapter.js', () => ({
  loadUploadContext: vi.fn(async () => ({
    pathContext: { unternehmen: 'U', marke: 'M', kampagne: 'K', kooperation: 'Koop' },
    creatorName: 'Mia Roth',
    keinDropbox: false
  }))
}));

const FORMATE_VON = { 'hoch.mp4': '9:16', 'quer.mp4': null, 'vier-fuenf.mp4': '4:5', 'quadrat.mp4': '1:1' };
vi.mock('../modules/video-browser/videoBrowserRatio.js', () => ({
  ratioOfFile: vi.fn(async (file) => FORMATE_VON[file.name] ?? null)
}));

const { createUploader } = await import('../modules/video-browser/VideoBrowserUpload.js');

const file = (name, size = 1024) => ({ name, size });
const koop = { id: 'k1' };
const row = { id: 'v1', number: 2, title: 'Hook', folders: [] };
const finalFolder = { id: 'final', kind: 'final', items: [] };

describe('VideoBrowserUpload: Finale Version', () => {
  let toast;
  let onAdded;
  let uploader;

  beforeEach(() => {
    service.enqueueVideoJob.mockClear();
    service.enqueueStillJob.mockClear();
    service.getActiveJobsForVideo.mockReturnValue([]);
    toast = vi.fn();
    onAdded = vi.fn();
    uploader = createUploader({ onChange: vi.fn(), onAdded, onSettled: vi.fn(), toast });
  });

  it('legt jede Datei als finale Version in ihrem eigenen Seitenverhältnis ab', async () => {
    await uploader.start({ koop, row, folder: finalFolder, files: [file('hoch.mp4'), file('vier-fuenf.mp4'), file('quadrat.mp4')] });
    expect(service.enqueueVideoJob).toHaveBeenCalledTimes(1);
    const payload = service.enqueueVideoJob.mock.calls[0][0];
    expect(payload.videoId).toBe('v1');
    expect(payload.queue.map(q => [q.file.name, q.variantName, q.versionNumber, q.isFinal]))
      .toEqual([
        ['hoch.mp4', '9:16', 1, true],
        ['vier-fuenf.mp4', '4:5', 1, true],
        ['quadrat.mp4', '1:1', 1, true]
      ]);
    expect(payload.metadaten).toMatchObject({ kooperationId: 'k1', videoPosition: 2, creatorName: 'Mia Roth' });
    expect(onAdded).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'hoch.mp4', folderKey: 'k1:v1:final' })]));
    uploader.destroy();
  });

  it('lädt Dateien ohne Standardformat nicht hoch und sagt warum', async () => {
    await uploader.start({ koop, row, folder: finalFolder, files: [file('hoch.mp4'), file('quer.mp4')] });
    const payload = service.enqueueVideoJob.mock.calls[0][0];
    expect(payload.queue.map(q => q.file.name)).toEqual(['hoch.mp4']);
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('„quer.mp4“ hat kein Standardformat'));
    uploader.destroy();
  });

  it('startet keinen Job, wenn keine Datei ein Standardformat hat', async () => {
    await uploader.start({ koop, row, folder: finalFolder, files: [file('quer.mp4')] });
    expect(service.enqueueVideoJob).not.toHaveBeenCalled();
    uploader.destroy();
  });

  it('wartet, wenn für das Video schon ein Upload läuft', async () => {
    service.getActiveJobsForVideo.mockReturnValue([{ id: 'x' }]);
    await uploader.start({ koop, row, folder: finalFolder, files: [file('hoch.mp4')] });
    expect(service.enqueueVideoJob).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('warning', 'Für dieses Video läuft bereits ein Upload im Hintergrund.');
    uploader.destroy();
  });

  it('Feedbackschleife: flach, ohne Variantenbuchstaben, keine Finale', async () => {
    const schleife = { id: 's1', kind: 'schleife', number: 1, items: [] };
    await uploader.start({ koop, row, folder: schleife, files: [file('hoch.mp4')] });
    const payload = service.enqueueVideoJob.mock.calls[0][0];
    expect(payload.queue).toEqual([expect.objectContaining({ variantName: null, versionNumber: 1, isFinal: false })]);
    expect(service.enqueueStillJob).not.toHaveBeenCalled();
    uploader.destroy();
  });

  it('Feedbackschleife: Bilder gehen als Bild-Job hoch, nicht als Video', async () => {
    const schleife = { id: 's1', kind: 'schleife', number: 2, items: [] };
    await uploader.start({ koop, row, folder: schleife, files: [file('foto.jpg'), file('hoch.mp4'), file('notiz.pdf')] });
    expect(service.enqueueVideoJob.mock.calls[0][0].queue.map(q => q.file.name)).toEqual(['hoch.mp4']);
    const still = service.enqueueStillJob.mock.calls[0][0];
    expect(still.videoId).toBe('v1');
    expect(still.queue).toEqual([{ file: expect.objectContaining({ name: 'foto.jpg' }), versionNumber: 2, isFinal: false }]);
    expect(toast).toHaveBeenCalledWith('warning', expect.stringContaining('nur Videos und Bilder'));
    uploader.destroy();
  });

  it('Finale Version: Bild ohne Formatprüfung als finales Bild', async () => {
    await uploader.start({ koop, row, folder: finalFolder, files: [file('foto.png')] });
    expect(service.enqueueVideoJob).not.toHaveBeenCalled();
    expect(service.enqueueStillJob.mock.calls[0][0].queue).toEqual([{ file: expect.objectContaining({ name: 'foto.png' }), versionNumber: 1, isFinal: true }]);
    uploader.destroy();
  });
});
