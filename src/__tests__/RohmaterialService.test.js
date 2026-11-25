import { describe, it, expect, beforeEach, vi } from 'vitest';

// authorizedFetch holt sonst einen echten Supabase-Token; hier reicht der globale fetch-Mock.
vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: (...args) => globalThis.fetch(...args),
  getAccessToken: vi.fn(async () => 'tok'),
  setGuestJwt: vi.fn(),
}));

import creatorUpload from '../../netlify/functions/_shared/creator-upload.js';
import { RohmaterialService } from '../modules/video/RohmaterialService.js';

const { SIZE_CAPS } = creatorUpload;

// ────────────────────────────────────────────────────────────
// Staff-Upload / Loeschen
// ────────────────────────────────────────────────────────────

function chainable(result) {
  const mock = {
    select: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    in: vi.fn(() => mock),
    order: vi.fn(() => mock),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    delete: vi.fn(() => mock),
    then: (resolve) => resolve(result),
  };
  return mock;
}

describe('RohmaterialService.uploadFiles', () => {
  let inserted;
  let ablageCalls;

  beforeEach(() => {
    inserted = [];
    ablageCalls = [];
    window.currentUser = { id: 'u1', rolle: 'admin' };

    window.supabase = {
      from: vi.fn(() => {
        const mock = chainable({ data: [{ file_name: 'clip.mov' }], error: null });
        mock.insert = vi.fn((row) => {
          inserted.push(row);
          return Promise.resolve({ error: null });
        });
        return mock;
      }),
    };

    global.fetch = vi.fn((url, opts) => {
      const fn = String(url).split('/').pop();
      if (fn === 'ablage-upload-ziel') {
        const body = JSON.parse(opts.body);
        ablageCalls.push({ fn, body });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          ziel: 'sharepoint', upload_id: `up-${body.file_name}`, upload_url: 'https://graph.example/s', chunk_bytes: 327680,
        }) });
      }
      if (fn === 'ablage-upload-commit') {
        const body = JSON.parse(opts.body);
        ablageCalls.push({ fn, body });
        const name = body.upload_id.slice(3);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          ablage: 'sharepoint', drive_id: 'd1', item_id: 'it1', etag: 'e1', ctag: 'c1',
          file_path: `/U/K/C/Rohmaterial/${name}`, file_name: name, file_size: 1024,
          file_url: `https://sp.example/${name}`, folder_url: 'https://sp.example/Rohmaterial',
        }) });
      }
      if (fn === 'ablage-datei') {
        ablageCalls.push({ fn, body: JSON.parse(opts.body) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      }
      return Promise.resolve({ status: 201, ok: true, json: () => Promise.resolve({ id: 'it1' }) });
    });
  });

  const group = { id: 'koop-1' };
  const angefragt = () => ablageCalls.filter((c) => c.fn === 'ablage-upload-ziel').map((c) => c.body.file_name);

  it('weicht einem in der DB belegten Dateinamen aus', async () => {
    const file = new File(['x'], 'clip.mov', { type: 'video/quicktime' });
    Object.defineProperty(file, 'size', { value: 1024 });

    const { uploaded, errors } = await RohmaterialService.uploadFiles(group, [file]);

    expect(errors).toEqual([]);
    expect(uploaded).toBe(1);
    expect(angefragt()).toEqual(['clip_2.mov']);
    expect(inserted[0]).toMatchObject({
      kooperation_id: 'koop-1',
      file_name: 'clip_2.mov',
      file_path: '/U/K/C/Rohmaterial/clip_2.mov',
      uploaded_by: 'u1',
    });
  });

  it('vergibt innerhalb einer Auswahl unterschiedliche Namen', async () => {
    const mk = (name) => {
      const f = new File(['x'], name, { type: 'video/quicktime' });
      Object.defineProperty(f, 'size', { value: 1024 });
      return f;
    };

    await RohmaterialService.uploadFiles(group, [mk('neu.mov'), mk('neu.mov')]);
    expect(angefragt()).toEqual(['neu.mov', 'neu_2.mov']);
  });

  it('Bytes in die SharePoint-Session, Zeile mit Ablage-Feldern', async () => {
    const file = new File(['x'], 'clip.mov', { type: 'video/quicktime' });
    Object.defineProperty(file, 'size', { value: 1024 });

    const { uploaded, errors } = await RohmaterialService.uploadFiles(group, [file]);

    expect(errors).toEqual([]);
    expect(uploaded).toBe(1);
    expect(ablageCalls).toEqual([
      { fn: 'ablage-upload-ziel', body: { typ: 'roh', kooperation_id: 'koop-1', file_name: 'clip_2.mov', file_size: 1024 } },
      { fn: 'ablage-upload-commit', body: { upload_id: 'up-clip_2.mov', item_id: 'it1' } },
    ]);
    expect(global.fetch).toHaveBeenCalledWith('https://graph.example/s', expect.objectContaining({
      method: 'PUT', headers: { 'Content-Range': 'bytes 0-1023/1024' },
    }));
    expect(inserted[0]).toMatchObject({
      kooperation_id: 'koop-1', ablage: 'sharepoint', drive_id: 'd1', item_id: 'it1',
      file_path: '/U/K/C/Rohmaterial/clip_2.mov', file_url: 'https://sp.example/clip_2.mov',
      folder_url: 'https://sp.example/Rohmaterial', uploaded_by: 'u1',
    });
  });

  it('meldet ungueltige Dateien statt sie hochzuladen', async () => {
    const bad = new File(['x'], 'dokument.pdf', { type: 'application/pdf' });
    Object.defineProperty(bad, 'size', { value: 1024 });

    const { uploaded, errors } = await RohmaterialService.uploadFiles(group, [bad]);

    expect(uploaded).toBe(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/nur Videos, Bilder oder ZIP/);
    expect(ablageCalls).toEqual([]);
  });

  it('Team-Upload bis 20 GB (Server-Grenze), Creator-Upload bleibt bei 10 GB', () => {
    const gross = new File(['x'], 'clip.mov');
    Object.defineProperty(gross, 'size', { value: SIZE_CAPS.rohmaterial + 1 });
    expect(RohmaterialService.validateFile(gross)).toMatchObject({ ok: true });
    const big = new File(['x'], 'clip.mov');
    Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 * 1024 + 1 });
    expect(RohmaterialService.validateFile(big)).toMatchObject({ ok: false });
  });
});

describe('RohmaterialService.deleteAsset', () => {
  it('Altbestand ist nur ein Link: nur die Zeile verschwindet', async () => {
    global.fetch = vi.fn();
    let dbId = null;
    window.supabase = {
      from: vi.fn(() => ({
        delete: vi.fn(() => ({
          eq: vi.fn((_col, id) => { dbId = id; return Promise.resolve({ error: null }); }),
        })),
      })),
    };

    await RohmaterialService.deleteAsset({ id: 'a1', ablage: 'dropbox', file_path: '/U/K/C/Rohmaterial/clip.mov' });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(dbId).toBe('a1');
  });

  it('SharePoint: löscht über ablage-datei vor der Zeile', async () => {
    const order = [];
    global.fetch = vi.fn((url, opts) => {
      order.push({ url: String(url).split('/').pop(), body: JSON.parse(opts.body) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ geloescht: true }) });
    });
    window.supabase = {
      from: vi.fn(() => ({
        delete: vi.fn(() => ({
          eq: vi.fn((_col, id) => { order.push({ db: id }); return Promise.resolve({ error: null }); }),
        })),
      })),
    };

    await RohmaterialService.deleteAsset({ id: 'a1', ablage: 'sharepoint', file_path: '/U/K/C/Rohmaterial/clip.mov' });
    expect(order).toEqual([
      { url: 'ablage-datei', body: { aktion: 'loeschen', typ: 'roh', id: 'a1' } },
      { db: 'a1' },
    ]);
  });

  it('SharePoint: scheitert der Server, bleibt die Zeile', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({ error: 'Graph down' }) }));
    const del = vi.fn();
    window.supabase = { from: vi.fn(() => ({ delete: del })) };

    await expect(RohmaterialService.deleteAsset({ id: 'a1', ablage: 'sharepoint', file_path: '/x.mov' })).rejects.toThrow('Graph down');
    expect(del).not.toHaveBeenCalled();
  });
});
