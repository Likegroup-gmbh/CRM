import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncVideoAssetsAfterDelete, deleteVideoFull } from '../core/VideoDeleteHelper.js';

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

  describe('syncVideoAssetsAfterDelete', () => {
    // Mock: select().eq() liefert die verbleibenden Assets, update(...).in/eq wird geloggt.
    function createSyncSupabase(remaining) {
      const log = [];
      const sb = {
        from: vi.fn((table) => ({
          select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: remaining, error: null })) })),
          delete: vi.fn(() => { log.push({ op: 'delete', table }); return { eq: vi.fn(), in: vi.fn() }; }),
          update: vi.fn((data) => ({
            in: vi.fn((col, ids) => { log.push({ op: 'update.in', table, data, ids }); return Promise.resolve({ error: null }); }),
            eq: vi.fn((col, val) => { log.push({ op: 'update.eq', table, data, val }); return Promise.resolve({ error: null }); }),
          })),
        })),
        _log: log,
      };
      return sb;
    }
    const videoUpdates = (sb) => sb._log.filter(e => e.op === 'update.eq' && e.table === 'kooperation_videos');

    it('Geschwister derselben Schleife bleiben: kein Delete, andere Datei bleibt current, link_content zeigt auf sie', async () => {
      const sb = createSyncSupabase([
        { id: 'a2', version_number: 2, is_current: true, is_final: false, file_url: 'https://x/a2', created_at: '2026-02-01' },
      ]);

      const res = await syncVideoAssetsAfterDelete('v1', { id: 'a3', version_number: 2, is_final: false }, { supabase: sb });

      expect(sb._log.filter(e => e.op === 'delete')).toHaveLength(0);
      expect(res.currentAsset.id).toBe('a2');
      expect(res.linkContentChanged).toBe(true);
      expect(res.linkContent).toBe('https://x/a2');
      expect(videoUpdates(sb)[0].data).toEqual({ link_content: 'https://x/a2' });
    });

    it('letzte Datei der höchsten Schleife weg: tiefere Schleife wird current, link_content zeigt auf sie', async () => {
      const sb = createSyncSupabase([
        { id: 'a1', version_number: 1, is_current: false, is_final: false, file_url: 'https://x/a1', created_at: '2026-01-01' },
      ]);

      const res = await syncVideoAssetsAfterDelete('v1', { id: 'a2', version_number: 2, is_final: false }, { supabase: sb });

      const flagOps = sb._log.filter(e => e.op === 'update.in' && e.table === 'kooperation_video_asset');
      expect(flagOps).toEqual([expect.objectContaining({ data: { is_current: true }, ids: ['a1'] })]);
      expect(res.currentAsset.id).toBe('a1');
      expect(res.linkContent).toBe('https://x/a1');
    });

    it('Löschung aus älterer Runde: link_content wird nicht angefasst', async () => {
      const sb = createSyncSupabase([
        { id: 'a2', version_number: 2, is_current: true, is_final: false, file_url: null, created_at: '2026-02-01' },
      ]);

      const res = await syncVideoAssetsAfterDelete('v1', { id: 'a1', version_number: 1, is_final: false }, { supabase: sb });

      expect(res.linkContentChanged).toBe(false);
      expect(videoUpdates(sb)).toHaveLength(0);
      expect(sb._log.filter(e => e.op === 'update.in')).toHaveLength(0);
    });

    it('Final-Asset gelöscht: Loops unverändert, kein link_content-Update', async () => {
      const sb = createSyncSupabase([
        { id: 'a1', version_number: 1, is_current: true, is_final: false, file_url: 'https://x/a1', created_at: '2026-01-01' },
      ]);

      const res = await syncVideoAssetsAfterDelete('v1', { id: 'f1', version_number: 1, is_final: true }, { supabase: sb });

      expect(res.linkContentChanged).toBe(false);
      expect(res.currentAsset.id).toBe('a1');
      expect(videoUpdates(sb)).toHaveLength(0);
      expect(sb._log.filter(e => e.op === 'update.in')).toHaveLength(0);
    });

    it('letztes Asset weg: link_content und folder_url null, kein Dropbox-Call', async () => {
      const sb = createSyncSupabase([]);
      const ft = createTrackingFetch();
      vi.stubGlobal('fetch', ft);

      const res = await syncVideoAssetsAfterDelete('v1', { id: 'a1', version_number: 1, is_final: false }, { supabase: sb });
      vi.unstubAllGlobals();

      expect(res.hasRemainingAssets).toBe(false);
      expect(res.currentAsset).toBeNull();
      expect(videoUpdates(sb)[0].data).toEqual({ link_content: null, folder_url: null });
      expect(ft).not.toHaveBeenCalled();
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

    it('löscht nur Dropbox-Dateien mit file_path, übergeht externe Links', async () => {
      const sb = createTrackingSupabase({
        assets: [
          { id: 'a1', video_id: 'v1', file_path: '/path1.mp4', is_current: false },
          { id: 'a2', video_id: 'v1', file_path: null, file_url: 'https://ext.example.com/v', is_current: true },
        ],
      });
      const ft = createTrackingFetch();

      const result = await deleteVideoFull('v1', { supabase: sb, fetch: ft });

      expect(result).toEqual({ success: true });
      expect(ft).toHaveBeenCalledTimes(1);
      expect(ft).toHaveBeenCalledWith(
        '/.netlify/functions/dropbox-delete',
        expect.objectContaining({ body: JSON.stringify({ filePath: '/path1.mp4' }) })
      );
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
