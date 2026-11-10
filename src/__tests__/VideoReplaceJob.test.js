import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ablage = vi.hoisted(() => ({ ziel: { ziel: 'dropbox' }, calls: [] }));

vi.mock('../core/DropboxDirectUploader.js', () => ({
  uploadFileDirect: vi.fn(async ({ dropboxPath }) => ({ path_display: dropboxPath })),
}));
vi.mock('../core/AblageUploader.js', () => ({
  uploadToSession: vi.fn(async () => ({ id: 'item-neu' })),
}));
vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(async (url, opts) => {
    const fn = String(url).split('/').pop();
    if (fn.startsWith('ablage-')) {
      ablage.calls.push({ fn, body: JSON.parse(opts.body) });
      if (fn === 'ablage-upload-ziel') return { ok: true, json: async () => ablage.ziel };
      if (fn === 'ablage-upload-commit') {
        return { ok: true, json: async () => ({
          ablage: 'sharepoint', drive_id: 'd1', item_id: 'item-neu', etag: 'e2', ctag: 'c2',
          file_path: '/Ada/ada_v1.mov', file_name: 'ada_v1.mov', file_size: 1, file_url: 'https://sp.example/ada_v1.mov',
        }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    }
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

const run = (file, oldFilePath, oldAblage) => runVideoReplaceJob({
  job: {
    payload: {
      videoId: 'v1', metadaten: { creatorName: 'Ada', kooperationId: 'k1' }, file, assetId: 'a2',
      oldFilePath, oldAblage, versionNumber: 1, variantName: 'A',
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
    ablage.ziel = { ziel: 'dropbox' };
    ablage.calls = [];
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

  it('fragt das Ziel mit ersetzen und lädt bei sharepoint nicht nach Dropbox', async () => {
    ablage.ziel = { ziel: 'sharepoint', upload_id: 'up1', upload_url: 'https://graph.example/s', chunk_bytes: 327680 };
    const calls = mockSupabase();
    const res = await run(new File(['x'], 'neu.mov'), '/K/FS1/A/ada_v1.mp4');

    expect(ablage.calls[0]).toEqual({ fn: 'ablage-upload-ziel', body: {
      typ: 'video', kooperation_id: 'k1', kooperation_video_id: 'v1', version_number: 1, is_final: false,
      variant_name: 'A', file_name: expect.any(String), file_size: 1, ersetzen: { typ: 'video', id: 'a2' },
    } });
    expect(ablage.calls[1]).toEqual({ fn: 'ablage-upload-commit', body: { upload_id: 'up1', item_id: 'item-neu' } });
    expect(uploadFileDirect).not.toHaveBeenCalled();

    const own = calls.find(q => q.op === 'update' && q.filters.some(([c, v]) => c === 'id' && v === 'a2'));
    expect(own.payload).toMatchObject({ ablage: 'sharepoint', drive_id: 'd1', item_id: 'item-neu', etag: 'e2', file_path: '/Ada/ada_v1.mov' });
    const finals = calls.find(q => q.op === 'update' && q.filters.some(([c]) => c === 'source_asset_id'));
    expect(finals.payload).toMatchObject({ item_id: 'item-neu', file_url: 'https://sp.example/ada_v1.mov' });
    // Alte Dropbox-Datei ohne weitere Verweise wird wie bisher entfernt
    expect(deleteSingleDropboxFile).toHaveBeenCalledWith('/K/FS1/A/ada_v1.mp4');
    expect(res.filePath).toBe('/Ada/ada_v1.mov');
  });

  it('alte SharePoint-Datei: kein Dropbox-Delete (räumt der Server ab)', async () => {
    ablage.ziel = { ziel: 'sharepoint', upload_id: 'up1', upload_url: 'https://graph.example/s' };
    mockSupabase();
    await run(new File(['x'], 'neu.mov'), '/Ada/ada_v1.mp4', 'sharepoint');
    expect(deleteSingleDropboxFile).not.toHaveBeenCalled();
  });

  it('Ziel dropbox für eine SharePoint-Datei bricht ab statt einen fremden Pfad zu überschreiben', async () => {
    mockSupabase();
    await expect(run(new File(['x'], 'neu.mp4'), '/Ada/ada_v1.mp4', 'sharepoint')).rejects.toThrow(/SharePoint/);
    expect(uploadFileDirect).not.toHaveBeenCalled();
  });
});
