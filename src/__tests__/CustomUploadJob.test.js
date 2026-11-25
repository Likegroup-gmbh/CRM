import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ablage = vi.hoisted(() => ({ calls: [] }));

vi.mock('../core/AblageUploader.js', () => ({
  uploadToSession: vi.fn(async () => ({ id: 'item1' })),
}));
vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(async (url, opts) => {
    const fn = String(url).split('/').pop();
    const body = JSON.parse(opts.body);
    ablage.calls.push({ fn, body });
    if (fn === 'ablage-upload-ziel') {
      return { ok: true, json: async () => ({ ziel: 'sharepoint', upload_id: `up-${body.file_name}`, upload_url: 'https://graph.example/s', chunk_bytes: 327680 }) };
    }
    if (fn === 'ablage-upload-commit') {
      const name = body.upload_id.slice(3);
      return { ok: true, json: async () => ({
        ablage: 'sharepoint', drive_id: 'd1', item_id: 'item1', etag: 'e1', ctag: 'c1',
        file_path: `/Firma/Medien/Sommer/Lisa/Rohschnitt/${name}`, file_name: name, file_size: 4,
        file_url: `https://sp.example/${name}`, folder_url: 'https://sp.example/Rohschnitt', kooperation_id: 'k1',
      }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  }),
}));

const { runCustomUploadJob } = await import('../core/uploadJobs/runCustomUploadJob.js');
const { runCustomReplaceJob } = await import('../core/uploadJobs/runCustomReplaceJob.js');

function fakeDb({ insertFehler = null, updateFehler = null } = {}) {
  const log = [];
  window.supabase = {
    from(table) {
      const q = { table, filters: [] };
      return {
        insert(row) { log.push({ ...q, op: 'insert', row }); return Promise.resolve({ error: insertFehler }); },
        upsert(row, opts) { log.push({ ...q, op: 'upsert', row, opts }); return Promise.resolve({ error: null }); },
        update(row) {
          log.push({ ...q, op: 'update', row });
          return { eq: (col, val) => { q.filters.push([col, val]); log.at(-1).filters = q.filters; return Promise.resolve({ error: updateFehler }); } };
        },
      };
    },
  };
  return log;
}

const datei = (name) => new File(['abcd'], name);
const ctx = (payload, n = 1) => ({
  job: { payload, items: Array.from({ length: n }, (_, i) => ({ id: `i${i}` })) },
  signal: new AbortController().signal,
  updateItem: vi.fn(),
});

describe('Upload-Spalten: neue Dateien', () => {
  beforeEach(() => {
    ablage.calls = [];
    window.currentUser = { id: 'b1' };
  });
  afterEach(() => {
    delete window.supabase;
    delete window.currentUser;
  });

  it('je Datei Ziel typ spalte, Commit, Zeile in custom_column_assets; Zelle bekommt den Ordner-Link', async () => {
    const log = fakeDb();
    const res = await runCustomUploadJob(ctx({ columnId: 'c1', entityId: 'k1', files: [datei('a.mp4'), datei('b.pdf')] }, 2));

    expect(ablage.calls.filter((c) => c.fn === 'ablage-upload-ziel').map((c) => c.body)).toEqual([
      { typ: 'spalte', custom_column_id: 'c1', entity_id: 'k1', file_name: 'a.mp4', file_size: 4 },
      { typ: 'spalte', custom_column_id: 'c1', entity_id: 'k1', file_name: 'b.pdf', file_size: 4 },
    ]);
    const inserts = log.filter((l) => l.op === 'insert');
    expect(inserts.map((l) => l.table)).toEqual(['custom_column_assets', 'custom_column_assets']);
    expect(inserts[0].row).toMatchObject({
      custom_column_id: 'c1', entity_id: 'k1', kooperation_id: 'k1', ablage: 'sharepoint', drive_id: 'd1', item_id: 'item1',
      file_name: 'a.mp4', file_path: '/Firma/Medien/Sommer/Lisa/Rohschnitt/a.mp4', file_url: 'https://sp.example/a.mp4', uploaded_by: 'b1',
    });
    expect(log.find((l) => l.op === 'upsert')).toMatchObject({
      table: 'custom_column_values',
      row: { custom_column_id: 'c1', entity_id: 'k1', value: 'https://sp.example/Rohschnitt' },
      opts: { onConflict: 'custom_column_id,entity_id' },
    });
    expect(res).toEqual({ columnId: 'c1', entityId: 'k1', folderUrl: 'https://sp.example/Rohschnitt' });
  });

  it('scheitert die Zeile, wird der Upload verworfen und der Job bricht ab', async () => {
    const log = fakeDb({ insertFehler: { message: 'RLS' } });
    await expect(runCustomUploadJob(ctx({ columnId: 'c1', entityId: 'k1', files: [datei('a.mp4'), datei('b.mp4')] }, 2)))
      .rejects.toMatchObject({ message: 'RLS' });
    expect(ablage.calls.at(-1)).toEqual({ fn: 'ablage-datei', body: { aktion: 'upload_verwerfen', upload_id: 'up-a.mp4' } });
    expect(ablage.calls.filter((c) => c.fn === 'ablage-upload-ziel')).toHaveLength(1);
    expect(log.find((l) => l.op === 'upsert')).toBeUndefined();
  });

  it('ohne Spalte, Entitaet oder Dateien kein Aufruf', async () => {
    fakeDb();
    await expect(runCustomUploadJob(ctx({ columnId: null, entityId: 'k1', files: [datei('a.mp4')] }))).rejects.toThrow('columnId/entityId fehlt');
    await expect(runCustomUploadJob(ctx({ columnId: 'c1', entityId: 'k1', files: [] }))).rejects.toThrow('Keine Dateien');
    expect(ablage.calls).toEqual([]);
  });
});

describe('Upload-Spalten: Datei ersetzen', () => {
  beforeEach(() => {
    ablage.calls = [];
    window.currentUser = { id: 'b1' };
  });
  afterEach(() => {
    delete window.supabase;
    delete window.currentUser;
  });

  it('fragt das Ziel mit ersetzen und schreibt die Ablage-Felder an die bestehende Zeile', async () => {
    const log = fakeDb();
    const res = await runCustomReplaceJob(ctx({ columnId: 'c1', entityId: 'k1', file: datei('neu.mp4'), assetId: 'x1' }));

    expect(ablage.calls[0]).toEqual({ fn: 'ablage-upload-ziel', body: {
      typ: 'spalte', custom_column_id: 'c1', entity_id: 'k1', file_name: 'neu.mp4', file_size: 4, ersetzen: { typ: 'spalte', id: 'x1' },
    } });
    const update = log.find((l) => l.op === 'update');
    expect(update).toMatchObject({ table: 'custom_column_assets', filters: [['id', 'x1']] });
    expect(update.row).toMatchObject({ ablage: 'sharepoint', item_id: 'item1', file_name: 'neu.mp4', kooperation_id: 'k1', uploaded_by: 'b1' });
    expect(res).toMatchObject({ assetId: 'x1', folderUrl: 'https://sp.example/Rohschnitt', fileUrl: 'https://sp.example/neu.mp4' });
  });

  it('scheitert das Update, wird der Upload verworfen', async () => {
    fakeDb({ updateFehler: { message: 'RLS' } });
    await expect(runCustomReplaceJob(ctx({ columnId: 'c1', entityId: 'k1', file: datei('neu.mp4'), assetId: 'x1' })))
      .rejects.toMatchObject({ message: 'RLS' });
    expect(ablage.calls.at(-1)).toEqual({ fn: 'ablage-datei', body: { aktion: 'upload_verwerfen', upload_id: 'up-neu.mp4' } });
  });
});
