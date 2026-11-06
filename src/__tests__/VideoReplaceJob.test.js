import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/DropboxDirectUploader.js', () => ({
  uploadFileDirect: vi.fn(async ({ dropboxPath }) => ({ path_display: dropboxPath })),
}));
vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(async (url) => {
    if (String(url).includes('dropbox-upload')) {
      return { ok: true, json: async () => ({ token: 't', dropboxPath: '/K/FS1/A/ada_v1.mov' }) };
    }
    return { ok: true, json: async () => ({ url: 'https://dropbox.example/neu?dl=0' }) };
  }),
}));
vi.mock('../core/VideoDeleteHelper.js', () => ({
  deleteSingleDropboxFile: vi.fn(async () => {}),
  syncVideoAssetsAfterDelete: vi.fn(async () => ({})),
}));
vi.mock('../core/stills/stillAssets.js', () => ({ updateStillCurrentFlags: vi.fn(async () => {}) }));

const { runVideoReplaceJob } = await import('../core/uploadJobs/runVideoReplaceJob.js');
const { uploadFileDirect } = await import('../core/DropboxDirectUploader.js');
const { deleteSingleDropboxFile } = await import('../core/VideoDeleteHelper.js');

function mockSupabase({ referenced = false } = {}) {
  const calls = [];
  window.supabase = {
    from(table) {
      const q = { table, op: null, payload: null, filters: [] };
      calls.push(q);
      const builder = {
        select() { if (!q.op) q.op = 'select'; return builder; },
        update(payload) { q.op = 'update'; q.payload = payload; return builder; },
        eq(col, val) { q.filters.push([col, val]); return builder; },
        limit() { return builder; },
        then(resolve, reject) {
          const data = q.op === 'select' ? (referenced ? [{ id: 'other' }] : []) : null;
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return calls;
}

const run = (file, oldFilePath) => runVideoReplaceJob({
  job: {
    payload: {
      videoId: 'v1', metadaten: { creatorName: 'Ada' }, file, assetId: 'a2',
      oldFilePath, versionNumber: 1, variantName: 'A',
    },
    items: [{ id: 'i1', directOk: null }],
  },
  signal: new AbortController().signal,
  updateItem: () => {},
});

describe('Datei ersetzen', () => {
  beforeEach(() => {
    uploadFileDirect.mockClear();
    deleteSingleDropboxFile.mockClear();
  });
  afterEach(() => { delete window.supabase; });

  it('gleiche Endung: überschreibt die eigene Datei, nicht den Standardpfad der Schleife', async () => {
    const calls = mockSupabase();
    await run(new File(['x'], 'neu.mp4'), '/K/FS1/A/ada_v1 (1).mp4');

    expect(uploadFileDirect).toHaveBeenCalledWith(expect.objectContaining({
      dropboxPath: '/K/FS1/A/ada_v1 (1).mp4', mode: 'overwrite',
    }));
    expect(calls.filter(q => q.op === 'update')).toHaveLength(1);
    expect(deleteSingleDropboxFile).not.toHaveBeenCalled();
  });

  it('andere Endung: neue Datei mit add, Finale ziehen mit, alte Datei wird gelöscht', async () => {
    const calls = mockSupabase();
    await run(new File(['x'], 'neu.mov'), '/K/FS1/A/ada_v1.mp4');

    expect(uploadFileDirect).toHaveBeenCalledWith(expect.objectContaining({
      dropboxPath: '/K/FS1/A/ada_v1.mov', mode: 'add',
    }));
    const finals = calls.find(q => q.op === 'update' && q.filters.some(([c]) => c === 'source_asset_id'));
    expect(finals.payload).toEqual({ file_url: 'https://dropbox.example/neu?raw=1', file_path: '/K/FS1/A/ada_v1.mov' });
    expect(finals.filters).toEqual([['source_asset_id', 'a2'], ['file_path', '/K/FS1/A/ada_v1.mp4']]);
    expect(deleteSingleDropboxFile).toHaveBeenCalledWith('/K/FS1/A/ada_v1.mp4');
  });

  it('alte Datei bleibt, solange noch eine Zeile auf sie zeigt', async () => {
    mockSupabase({ referenced: true });
    await run(new File(['x'], 'neu.mov'), '/K/FS1/A/ada_v1.mp4');
    expect(deleteSingleDropboxFile).not.toHaveBeenCalled();
  });
});
