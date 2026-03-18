import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteVideoFile, deleteVideoFull } from '../core/VideoDeleteHelper.js';

function createTrackingSupabase(config = {}) {
  const log = [];

  const mock = {
    from: vi.fn((table) => {
      const tableApi = {
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
            return {
              eq: vi.fn((col2, val2) => {
                log.push({ op: 'delete.eq.eq', table, col2, val2 });
                return Promise.resolve({ error: config.deleteAssetError || null });
              }),
            };
          }),
          in: vi.fn((col, vals) => {
            log.push({ op: 'delete.in', table, col, vals });
            return Promise.resolve({ error: config.deleteAssetError || null });
          }),
        })),
        update: vi.fn((data) => {
          log.push({ op: 'update', table, data });
          return {
            eq: vi.fn((col, val) => {
              log.push({ op: 'update.eq', table, col, val });
              return Promise.resolve({ error: config.updateVideoError || null });
            }),
          };
        }),
      };
      return tableApi;
    }),
    _log: log,
  };
  return mock;
}

function createTrackingFetch(overrides = {}) {
  const log = [];
  const fn = vi.fn(async (url, opts) => {
    log.push({ url, opts });
    const preset = overrides[url];
    return {
      ok: preset?.ok ?? true,
      status: preset?.status ?? 200,
      json: preset?.json || (async () => ({ success: true })),
    };
  });
  fn._log = log;
  return fn;
}

describe('VideoDeleteHelper', () => {

  describe('deleteVideoFile (Soft-Delete)', () => {

    it('lädt Assets und löscht Dropbox-Datei via fetch', async () => {
      const sb = createTrackingSupabase({
        assets: [{ id: 'a1', video_id: 'v1', file_path: '/Videos/test/video.mp4', is_current: true }],
      });
      const ft = createTrackingFetch();

      await deleteVideoFile('v1', { supabase: sb, fetch: ft });

      expect(ft).toHaveBeenCalledWith(
        '/.netlify/functions/dropbox-delete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ filePath: '/Videos/test/video.mp4' }),
        })
      );
    });

    it('löscht current Asset aus kooperation_video_asset', async () => {
      const sb = createTrackingSupabase({
        assets: [{ id: 'a1', video_id: 'v1', file_path: '/path.mp4', is_current: true }],
      });
      const ft = createTrackingFetch();

      await deleteVideoFile('v1', { supabase: sb, fetch: ft });

      const deleteOps = sb._log.filter(e => e.op === 'delete.eq' && e.table === 'kooperation_video_asset');
      expect(deleteOps.length).toBeGreaterThanOrEqual(1);
      expect(deleteOps[0]).toMatchObject({ col: 'video_id', val: 'v1' });
    });

    it('setzt link_content auf null in kooperation_videos (NICHT file_url)', async () => {
      const sb = createTrackingSupabase({
        assets: [{ id: 'a1', video_id: 'v1', file_path: '/path.mp4', is_current: true }],
      });
      const ft = createTrackingFetch();

      await deleteVideoFile('v1', { supabase: sb, fetch: ft });

      const updateOps = sb._log.filter(e => e.op === 'update' && e.table === 'kooperation_videos');
      expect(updateOps.length).toBe(1);
      expect(updateOps[0].data).toEqual({ link_content: null });
      expect(updateOps[0].data).not.toHaveProperty('file_url');
    });

    it('funktioniert auch ohne Asset (kein Dropbox-Call)', async () => {
      const sb = createTrackingSupabase({ assets: [] });
      const ft = createTrackingFetch();

      const result = await deleteVideoFile('v1', { supabase: sb, fetch: ft });

      expect(result).toEqual({ success: true });
      expect(ft).not.toHaveBeenCalled();
      const deleteOps = sb._log.filter(e => e.op.startsWith('delete'));
      expect(deleteOps.length).toBe(0);
    });

    it('toleriert Dropbox-404 (Datei schon gelöscht)', async () => {
      const sb = createTrackingSupabase({
        assets: [{ id: 'a1', video_id: 'v1', file_path: '/gone.mp4', is_current: true }],
      });
      const ft = createTrackingFetch({
        '/.netlify/functions/dropbox-delete': { ok: false, status: 404, json: async () => ({ error: 'not found' }) },
      });

      const result = await deleteVideoFile('v1', { supabase: sb, fetch: ft });

      expect(result).toEqual({ success: true });
      const deleteOps = sb._log.filter(e => e.op === 'delete.eq' && e.table === 'kooperation_video_asset');
      expect(deleteOps.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('deleteVideoFull (Hard-Delete)', () => {

    it('löscht Dropbox-Dateien + alle Assets + Video-Zeile', async () => {
      const sb = createTrackingSupabase({
        assets: [
          { id: 'a1', video_id: 'v1', file_path: '/path1.mp4', is_current: false },
          { id: 'a2', video_id: 'v1', file_path: '/path2.mp4', is_current: true },
        ],
      });
      const ft = createTrackingFetch();

      const result = await deleteVideoFull('v1', { supabase: sb, fetch: ft });

      expect(result).toEqual({ success: true });

      expect(ft).toHaveBeenCalledTimes(2);
      expect(ft).toHaveBeenCalledWith(
        '/.netlify/functions/dropbox-delete',
        expect.objectContaining({ body: JSON.stringify({ filePath: '/path1.mp4' }) })
      );
      expect(ft).toHaveBeenCalledWith(
        '/.netlify/functions/dropbox-delete',
        expect.objectContaining({ body: JSON.stringify({ filePath: '/path2.mp4' }) })
      );

      const assetDeleteOps = sb._log.filter(e => e.op === 'delete.in' && e.table === 'kooperation_video_asset');
      expect(assetDeleteOps.length).toBe(1);

      const videoDeleteOps = sb._log.filter(e => e.op === 'delete.eq' && e.table === 'kooperation_videos');
      expect(videoDeleteOps.length).toBe(1);
      expect(videoDeleteOps[0]).toMatchObject({ col: 'id', val: 'v1' });
    });

    it('toleriert fehlende Assets – löscht trotzdem die Video-Zeile', async () => {
      const sb = createTrackingSupabase({ assets: [] });
      const ft = createTrackingFetch();

      const result = await deleteVideoFull('v1', { supabase: sb, fetch: ft });

      expect(result).toEqual({ success: true });
      expect(ft).not.toHaveBeenCalled();

      const videoDeleteOps = sb._log.filter(e => e.op === 'delete.eq' && e.table === 'kooperation_videos');
      expect(videoDeleteOps.length).toBe(1);
    });

    it('gibt Fehler zurück bei DB-Fehler beim Video-Löschen', async () => {
      const sb = createTrackingSupabase({
        assets: [],
        deleteVideoError: { message: 'DB connection lost' },
      });

      // Override: kooperation_videos delete soll Fehler zurückgeben
      const origFrom = sb.from;
      sb.from = vi.fn((table) => {
        const api = origFrom(table);
        if (table === 'kooperation_videos') {
          api.delete = vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: { message: 'DB connection lost' } })),
          }));
        }
        return api;
      });

      const ft = createTrackingFetch();

      const result = await deleteVideoFull('v1', { supabase: sb, fetch: ft });

      expect(result.success).toBe(false);
      expect(result.error).toContain('DB connection lost');
    });
  });
});
