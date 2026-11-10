import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({ calls: [], antworten: {} }));

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(async (url, opts) => {
    const fn = String(url).split('/').pop();
    server.calls.push({ fn, body: JSON.parse(opts.body) });
    const a = server.antworten[fn] ?? { status: 200, body: { ok: true } };
    if (a instanceof Error) throw a;
    return { ok: a.status < 400, status: a.status, json: async () => a.body };
  }),
}));
vi.mock('../core/AblageUploader.js', () => ({ uploadToSession: vi.fn(async () => ({ id: 'item1' })) }));

const { ablageZielHolen, hochladenNachSharePoint, sharePointAssetFelder, uploadVerwerfen, ablageVonQuelle } =
  await import('../core/ablage/ablageUpload.js');
const { uploadToSession } = await import('../core/AblageUploader.js');

const ZIEL = { ziel: 'sharepoint', upload_id: 'up1', upload_url: 'https://graph.example/s', chunk_bytes: 327680, file_name: 'a.mp4' };
const COMMIT = {
  ablage: 'sharepoint', drive_id: 'd1', item_id: 'item1', etag: 'e1', ctag: 'c1',
  file_path: '/K/a.mp4', file_name: 'a.mp4', file_size: 10, file_url: 'https://sp.example/a.mp4',
  folder_url: 'https://sp.example/K', breite: 1080, hoehe: 1920,
};

beforeEach(() => {
  server.calls = [];
  server.antworten = {};
  uploadToSession.mockClear();
});

describe('ablageZielHolen', () => {
  const body = { typ: 'video', kooperation_id: 'k1', file_name: 'a.mp4', file_size: 10 };

  it('schickt den Body unverändert an ablage-upload-ziel', async () => {
    server.antworten['ablage-upload-ziel'] = { status: 200, body: { ziel: 'dropbox' } };
    await expect(ablageZielHolen(body)).resolves.toEqual({ ziel: 'dropbox' });
    expect(server.calls).toEqual([{ fn: 'ablage-upload-ziel', body }]);
  });

  it('liefert das SharePoint-Ziel', async () => {
    server.antworten['ablage-upload-ziel'] = { status: 200, body: ZIEL };
    await expect(ablageZielHolen(body)).resolves.toEqual(ZIEL);
  });

  it('unvollständiges oder unbekanntes Ziel ist ein Fehler, kein Dropbox-Rückfall', async () => {
    server.antworten['ablage-upload-ziel'] = { status: 200, body: { ziel: 'sharepoint', upload_id: 'up1' } };
    await expect(ablageZielHolen(body)).rejects.toThrow('Ablage-Ziel konnte nicht bestimmt werden');
    server.antworten['ablage-upload-ziel'] = { status: 200, body: {} };
    await expect(ablageZielHolen(body)).rejects.toThrow('Ablage-Ziel konnte nicht bestimmt werden');
  });

  it('413 trägt code und max_bytes', async () => {
    server.antworten['ablage-upload-ziel'] = { status: 413, body: { error: 'Datei zu groß', code: 'zu_gross', max_bytes: 1000 } };
    await expect(ablageZielHolen(body)).rejects.toMatchObject({ message: 'Datei zu groß', status: 413, code: 'zu_gross', maxBytes: 1000 });
  });

  it('5xx und Netzwerkfehler werfen', async () => {
    server.antworten['ablage-upload-ziel'] = { status: 503, body: {} };
    await expect(ablageZielHolen(body)).rejects.toMatchObject({ status: 503 });
    server.antworten['ablage-upload-ziel'] = new TypeError('Failed to fetch');
    await expect(ablageZielHolen(body)).rejects.toThrow('Failed to fetch');
  });
});

describe('hochladenNachSharePoint', () => {
  const file = new Blob(['0123456789']);

  it('lädt in die Session und bestätigt mit upload_id und item_id', async () => {
    server.antworten['ablage-upload-commit'] = { status: 200, body: COMMIT };
    const onProgress = vi.fn();

    await expect(hochladenNachSharePoint({ ziel: ZIEL, file, onProgress })).resolves.toEqual(COMMIT);

    expect(uploadToSession).toHaveBeenCalledWith(expect.objectContaining({
      file, uploadUrl: ZIEL.upload_url, chunkBytes: 327680, onProgress,
    }));
    expect(server.calls).toEqual([{ fn: 'ablage-upload-commit', body: { upload_id: 'up1', item_id: 'item1' } }]);
  });

  it('scheitert der Upload, wird der Upload verworfen', async () => {
    uploadToSession.mockRejectedValueOnce(new Error('Upload-Sitzung abgelaufen'));
    await expect(hochladenNachSharePoint({ ziel: ZIEL, file })).rejects.toThrow('Upload-Sitzung abgelaufen');
    expect(server.calls).toEqual([{ fn: 'ablage-datei', body: { aktion: 'upload_verwerfen', upload_id: 'up1' } }]);
  });

  it('scheitert der Commit, wird der Upload verworfen', async () => {
    server.antworten['ablage-upload-commit'] = { status: 409, body: { error: 'Datei geändert' } };
    await expect(hochladenNachSharePoint({ ziel: ZIEL, file })).rejects.toThrow('Datei geändert');
    expect(server.calls.map(c => c.fn)).toEqual(['ablage-upload-commit', 'ablage-datei']);
  });

  it('ohne driveItem kein Commit', async () => {
    uploadToSession.mockResolvedValueOnce({ deferred: true });
    await expect(hochladenNachSharePoint({ ziel: ZIEL, file })).rejects.toThrow('SharePoint hat keine Datei zurückgegeben');
    expect(server.calls.map(c => c.fn)).toEqual(['ablage-datei']);
  });
});

describe('uploadVerwerfen', () => {
  it('ist best effort', async () => {
    server.antworten['ablage-datei'] = { status: 500, body: { error: 'kaputt' } };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(uploadVerwerfen('up1')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ohne upload_id kein Aufruf', async () => {
    await uploadVerwerfen(null);
    expect(server.calls).toEqual([]);
  });
});

describe('Asset-Felder', () => {
  it('sharePointAssetFelder übernimmt die Spalten aus dem Commit, folder_url nicht', () => {
    expect(sharePointAssetFelder(COMMIT)).toEqual({
      ablage: 'sharepoint', drive_id: 'd1', item_id: 'item1', etag: 'e1', ctag: 'c1', breite: 1080, hoehe: 1920,
      file_path: '/K/a.mp4', file_name: 'a.mp4', file_size: 10, file_url: 'https://sp.example/a.mp4',
    });
  });

  it('fehlende optionale Felder werden null', () => {
    expect(sharePointAssetFelder({ drive_id: 'd1', item_id: 'i1', file_path: '/x' })).toMatchObject({
      etag: null, ctag: null, breite: null, hoehe: null, file_name: null, file_size: null, file_url: null,
    });
  });

  it('ablageVonQuelle kopiert nur vorhandene Ablage-Spalten', () => {
    expect(ablageVonQuelle({ id: 'a', file_path: '/x', ablage: 'sharepoint', drive_id: 'd1', item_id: 'i1', etag: null }))
      .toEqual({ ablage: 'sharepoint', drive_id: 'd1', item_id: 'i1', etag: null });
    expect(ablageVonQuelle({ id: 'a', file_path: '/x' })).toEqual({});
  });
});
