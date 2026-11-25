import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ablage = vi.hoisted(() => ({ calls: [], updateFehler: null }));

vi.mock('../core/AblageUploader.js', () => ({
  uploadToSession: vi.fn(async () => ({ id: 'item-neu' })),
}));
vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(async (url, opts) => {
    const fn = String(url).split('/').pop();
    ablage.calls.push({ fn, body: JSON.parse(opts.body) });
    if (fn === 'ablage-upload-ziel') {
      return { ok: true, json: async () => ({ ziel: 'sharepoint', upload_id: 'up1', upload_url: 'https://graph.example/s', chunk_bytes: 327680 }) };
    }
    if (fn === 'ablage-upload-commit') {
      return { ok: true, json: async () => ({
        ablage: 'sharepoint', drive_id: 'd1', item_id: 'item-neu', etag: 'e2', ctag: 'c2',
        file_path: '/Ada/ada_v1.mov', file_name: 'ada_v1.mov', file_size: 1, file_url: 'https://sp.example/ada_v1.mov',
      }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  }),
}));

const { runVideoReplaceJob } = await import('../core/uploadJobs/runVideoReplaceJob.js');

function mockSupabase() {
  const calls = [];
  window.supabase = {
    from(table) {
      const q = { table, op: null, payload: null, filters: [] };
      calls.push(q);
      const builder = {
        update(payload) { q.op = 'update'; q.payload = payload; return builder; },
        eq(col, val) { q.filters.push([col, val]); return builder; },
        then(resolve, reject) {
          const eigene = q.filters.some(([c]) => c === 'id');
          return Promise.resolve({ data: null, error: eigene ? ablage.updateFehler : null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return calls;
}

const run = (file) => runVideoReplaceJob({
  job: {
    payload: { videoId: 'v1', metadaten: { creatorName: 'Ada', kooperationId: 'k1' }, file, assetId: 'a2', versionNumber: 1, variantName: 'A' },
    items: [{ id: 'i1', directOk: null }],
  },
  signal: new AbortController().signal,
  updateItem: () => {},
});

describe('Datei ersetzen', () => {
  beforeEach(() => {
    ablage.calls = [];
    ablage.updateFehler = null;
  });
  afterEach(() => { delete window.supabase; });

  it('fragt das Ziel mit ersetzen, schreibt die Ablage-Felder an die Zeile und zieht Finale nach', async () => {
    const calls = mockSupabase();
    const res = await run(new File(['x'], 'neu.mov'));

    expect(ablage.calls[0]).toEqual({ fn: 'ablage-upload-ziel', body: {
      typ: 'video', kooperation_id: 'k1', kooperation_video_id: 'v1', version_number: 1, is_final: false,
      variant_name: 'A', file_name: expect.any(String), file_size: 1, ersetzen: { typ: 'video', id: 'a2' },
    } });
    expect(ablage.calls[1]).toEqual({ fn: 'ablage-upload-commit', body: { upload_id: 'up1', item_id: 'item-neu' } });

    const own = calls.find(q => q.op === 'update' && q.filters.some(([c, v]) => c === 'id' && v === 'a2'));
    expect(own.payload).toMatchObject({ ablage: 'sharepoint', drive_id: 'd1', item_id: 'item-neu', etag: 'e2', file_path: '/Ada/ada_v1.mov' });
    const finals = calls.find(q => q.op === 'update' && q.filters.some(([c]) => c === 'source_asset_id'));
    expect(finals.payload).toMatchObject({ item_id: 'item-neu', file_url: 'https://sp.example/ada_v1.mov' });
    expect(finals.filters).toEqual([['source_asset_id', 'a2']]);
    expect(res).toEqual({ assetId: 'a2', fileUrl: 'https://sp.example/ada_v1.mov', filePath: '/Ada/ada_v1.mov' });
  });

  it('scheitert das Update der Zeile, wird der Upload verworfen', async () => {
    ablage.updateFehler = { message: 'RLS' };
    mockSupabase();
    await expect(run(new File(['x'], 'neu.mov'))).rejects.toMatchObject({ message: 'RLS' });
    expect(ablage.calls.at(-1)).toEqual({ fn: 'ablage-datei', body: { aktion: 'upload_verwerfen', upload_id: 'up1' } });
  });
});
