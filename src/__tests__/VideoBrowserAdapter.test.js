import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/produktion/ProduktionService.js', () => ({ scopeKoopsByLinie: q => q }));
vi.mock('../modules/kampagne/KampagneUtils.js', () => ({ KampagneUtils: { getDisplayName: () => '' } }));
vi.mock('../core/VideoDeleteHelper.js', () => ({
  deleteSingleDropboxFile: vi.fn(async () => {}),
  syncVideoAssetsAfterDelete: vi.fn(async () => ({}))
}));
vi.mock('../core/stills/stillAssets.js', () => ({ updateStillCurrentFlags: vi.fn(async () => {}) }));

const { renameAsset, deleteAsset } = await import('../modules/video-browser/VideoBrowserAdapter.js');
const { titelAusDateiname } = await import('../core/uploadJobs/runVideoUploadJob.js');
const { deleteSingleDropboxFile, syncVideoAssetsAfterDelete } = await import('../core/VideoDeleteHelper.js');
const { updateStillCurrentFlags } = await import('../core/stills/stillAssets.js');

/** Supabase-Attrappe: zeichnet jede Abfrage auf, Ergebnis je "tabelle:op". */
function mockSupabase(results = {}) {
  const calls = [];
  const from = (table) => {
    const q = { table, op: null, payload: null, filters: [] };
    calls.push(q);
    const builder = {
      select() { if (!q.op) q.op = 'select'; return builder; },
      update(payload) { q.op = 'update'; q.payload = payload; return builder; },
      delete() { q.op = 'delete'; return builder; },
      eq(col, val) { q.filters.push([col, val]); return builder; },
      is(col, val) { q.filters.push([col, val]); return builder; },
      limit() { return builder; },
      then(resolve, reject) {
        const fn = results[`${table}:${q.op}`];
        return Promise.resolve(fn ? fn(q) : { data: [{ id: 'x' }], error: null }).then(resolve, reject);
      }
    };
    return builder;
  };
  return { from, calls };
}

const video = (asset = {}) => ({
  id: 'a1',
  type: 'video',
  asset: { id: 'a1', video_id: 'v1', file_path: '/K/v1.mp4', version_number: 1, is_final: false, ...asset }
});

describe('VideoBrowserAdapter: Dateititel', () => {
  afterEach(() => { delete window.supabase; });

  it('schreibt den getrimmten Titel in die Tabelle der Dateiart', async () => {
    window.supabase = mockSupabase();
    await expect(renameAsset({ id: 'r1', type: 'roh' }, '  Rohschnitt  ')).resolves.toBe('Rohschnitt');
    const [q] = window.supabase.calls;
    expect(q).toMatchObject({ table: 'kooperation_rohmaterial_asset', op: 'update', payload: { titel: 'Rohschnitt' } });
    expect(q.filters).toEqual([['id', 'r1']]);
  });

  it('meldet einen Fehler, wenn RLS keine Zeile schreiben lässt', async () => {
    window.supabase = mockSupabase({ 'kooperation_video_asset:update': () => ({ data: [], error: null }) });
    await expect(renameAsset(video(), 'Neu')).rejects.toThrow();
  });

  it('leerer Titel wird nicht gespeichert', async () => {
    window.supabase = mockSupabase();
    await expect(renameAsset(video(), '   ')).rejects.toThrow();
    expect(window.supabase.calls).toHaveLength(0);
  });

  it('Titel aus dem Dateinamen ohne Endung', () => {
    expect(titelAusDateiname('Interview Kudamm.MOV')).toBe('Interview Kudamm');
    expect(titelAusDateiname('clip.final.mp4')).toBe('clip.final');
    expect(titelAusDateiname('')).toBeNull();
  });
});

describe('VideoBrowserAdapter: Datei löschen', () => {
  beforeEach(() => {
    deleteSingleDropboxFile.mockClear();
    syncVideoAssetsAfterDelete.mockClear();
    updateStillCurrentFlags.mockClear();
  });
  afterEach(() => { delete window.supabase; });

  it('Video: Kommentare der Datei, Zeile und Dropbox-Datei weg, Video wird abgeglichen', async () => {
    window.supabase = mockSupabase({ 'kooperation_video_asset:select': () => ({ data: [], error: null }) });
    const item = video();
    await deleteAsset(item);
    const ops = window.supabase.calls.map(q => `${q.table}:${q.op}`);
    expect(ops).toEqual([
      'kooperation_video_zeitkommentar:update',
      'kooperation_video_asset:delete',
      'kooperation_video_asset:select'
    ]);
    expect(window.supabase.calls[0].payload.deleted_at).toBeTruthy();
    expect(window.supabase.calls[0].filters).toContainEqual(['asset_id', 'a1']);
    expect(deleteSingleDropboxFile).toHaveBeenCalledWith('/K/v1.mp4');
    expect(syncVideoAssetsAfterDelete).toHaveBeenCalledWith('v1');
  });

  it('Datei bleibt in Dropbox, solange eine andere Zeile denselben Pfad nutzt', async () => {
    window.supabase = mockSupabase({ 'kooperation_video_asset:select': () => ({ data: [{ id: 'f1' }], error: null }) });
    await deleteAsset(video());
    expect(deleteSingleDropboxFile).not.toHaveBeenCalled();
  });

  it('ohne gelöschte Zeile bleibt Dropbox unberührt', async () => {
    window.supabase = mockSupabase({ 'kooperation_video_asset:delete': () => ({ data: [], error: null }) });
    await expect(deleteAsset(video())).rejects.toThrow();
    expect(deleteSingleDropboxFile).not.toHaveBeenCalled();
    expect(syncVideoAssetsAfterDelete).not.toHaveBeenCalled();
  });

  it('Bild: eigene Tabelle, danach die Kennzeichnung der aktuellen Runde', async () => {
    window.supabase = mockSupabase({ 'kooperation_bilder_asset:select': () => ({ data: [], error: null }) });
    await deleteAsset({ id: 'b1', type: 'still', asset: { id: 'b1', video_id: 'v1', file_path: '/K/b1.jpg' } });
    expect(window.supabase.calls.map(q => q.table)).not.toContain('kooperation_video_zeitkommentar');
    expect(window.supabase.calls[0]).toMatchObject({ table: 'kooperation_bilder_asset', op: 'delete' });
    expect(updateStillCurrentFlags).toHaveBeenCalledWith('v1');
    expect(syncVideoAssetsAfterDelete).not.toHaveBeenCalled();
  });
});
