import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  deleteDropboxCascade,
  deleteSingleDropboxFile,
  deleteVideoFull,
} from '../core/VideoDeleteHelper.js';

function createTrackingFetch(overrides = {}) {
  const log = [];
  const fn = vi.fn(async (url, opts) => {
    log.push({ url, body: opts?.body ? JSON.parse(opts.body) : null });
    const preset = overrides[url];
    return {
      ok: preset?.ok ?? true,
      status: preset?.status ?? 200,
      json: preset?.json || (async () => ({ success: true, totalFiles: 0, deleted: 0, alreadyGone: 0, failed: 0, failures: [] })),
    };
  });
  fn._log = log;
  return fn;
}

describe('deleteDropboxCascade', () => {
  it('ruft Netlify-Funktion mit entityType und entityId auf', async () => {
    const ft = createTrackingFetch();

    const result = await deleteDropboxCascade('kampagne', 'k-123', { fetch: ft });

    expect(ft).toHaveBeenCalledTimes(1);
    expect(ft._log[0].url).toBe('/.netlify/functions/dropbox-delete-cascade');
    expect(ft._log[0].body).toEqual({ entityType: 'kampagne', entityId: 'k-123' });
    expect(result.success).toBe(true);
  });

  it('funktioniert für kooperation', async () => {
    const ft = createTrackingFetch();

    await deleteDropboxCascade('kooperation', 'koop-456', { fetch: ft });

    expect(ft._log[0].body).toEqual({ entityType: 'kooperation', entityId: 'koop-456' });
  });

  it('funktioniert für einzelnes video', async () => {
    const ft = createTrackingFetch();

    await deleteDropboxCascade('video', 'v-789', { fetch: ft });

    expect(ft._log[0].body).toEqual({ entityType: 'video', entityId: 'v-789' });
  });

  it('gibt Fehler zurück bei HTTP-Fehler', async () => {
    const ft = createTrackingFetch({
      '/.netlify/functions/dropbox-delete-cascade': {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      },
    });

    const result = await deleteDropboxCascade('kampagne', 'k-1', { fetch: ft });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Server error');
  });

  it('gibt Fehler zurück bei Netzwerkfehler', async () => {
    const ft = vi.fn(async () => { throw new Error('Network down'); });

    const result = await deleteDropboxCascade('kampagne', 'k-1', { fetch: ft });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network down');
  });
});

describe('deleteSingleDropboxFile', () => {
  it('ruft dropbox-delete mit dem filePath auf', async () => {
    const ft = createTrackingFetch();

    await deleteSingleDropboxFile('/Videos/test/v1.mp4', { fetch: ft });

    expect(ft).toHaveBeenCalledTimes(1);
    expect(ft._log[0].url).toBe('/.netlify/functions/dropbox-delete');
    expect(ft._log[0].body).toEqual({ filePath: '/Videos/test/v1.mp4' });
  });

  it('toleriert 404 (Datei schon weg)', async () => {
    const ft = createTrackingFetch({
      '/.netlify/functions/dropbox-delete': {
        ok: false,
        status: 404,
        json: async () => ({ error: 'not found' }),
      },
    });

    await expect(deleteSingleDropboxFile('/gone.mp4', { fetch: ft })).resolves.toBeUndefined();
  });
});

describe('deleteVideoFull löscht alle Dropbox-Dateien inkl. Versionen', () => {
  function createTrackingSupabase(config = {}) {
    const log = [];
    return {
      from: vi.fn((table) => ({
        select: vi.fn(() => ({
          eq: vi.fn((col, val) => {
            log.push({ op: 'select', table, col, val });
            const assets = config.assets || [];
            const filtered = assets.filter(a => a[col] === val);
            return Promise.resolve({ data: filtered, error: null });
          }),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn((col, val) => {
            log.push({ op: 'delete.eq', table, col, val });
            return Promise.resolve({ error: null });
          }),
          in: vi.fn((col, vals) => {
            log.push({ op: 'delete.in', table, col, vals });
            return Promise.resolve({ error: null });
          }),
        })),
      })),
      _log: log,
    };
  }

  it('löscht alle 3 Versionen eines Videos aus Dropbox', async () => {
    const sb = createTrackingSupabase({
      assets: [
        { id: 'a1', video_id: 'v1', file_path: '/Videos/Firma/Marke/Kampagne/Koop/Video_1/Version_1/file.mp4', is_current: false },
        { id: 'a2', video_id: 'v1', file_path: '/Videos/Firma/Marke/Kampagne/Koop/Video_1/Version_2/file.mp4', is_current: false },
        { id: 'a3', video_id: 'v1', file_path: '/Videos/Firma/Marke/Kampagne/Koop/Video_1/Version_3/file.mp4', is_current: true },
      ],
    });
    const ft = createTrackingFetch();

    const result = await deleteVideoFull('v1', { supabase: sb, fetch: ft });

    expect(result.success).toBe(true);
    expect(ft).toHaveBeenCalledTimes(3);
    const paths = ft._log.map(l => l.body.filePath);
    expect(paths).toContain('/Videos/Firma/Marke/Kampagne/Koop/Video_1/Version_1/file.mp4');
    expect(paths).toContain('/Videos/Firma/Marke/Kampagne/Koop/Video_1/Version_2/file.mp4');
    expect(paths).toContain('/Videos/Firma/Marke/Kampagne/Koop/Video_1/Version_3/file.mp4');
  });
});
