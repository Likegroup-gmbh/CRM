import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoUploadDrawer } from '../modules/kampagne/VideoUploadDrawer.js';

function createMockSupabase(assets = []) {
  const chainable = () => {
    const chain = {
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      in: vi.fn(() => chain),
      then: Promise.resolve({ data: assets, error: null }).then.bind(Promise.resolve({ data: assets, error: null })),
    };
    return chain;
  };
  return {
    from: vi.fn((table) => ({
      select: vi.fn(() => chainable()),
      update: vi.fn((data) => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
        in: vi.fn(() => Promise.resolve({ error: null })),
      })),
      insert: vi.fn((data) => Promise.resolve({ error: null })),
    })),
  };
}

function createTrackingSupabase(assets = [], opts = {}) {
  const log = [];

  function makeSelectChain(data) {
    const result = Promise.resolve({ data, error: null });
    const chain = {
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      in: vi.fn(() => chain),
      maybeSingle: vi.fn(() => Promise.resolve({ data: data?.[0] || null, error: null })),
      single: vi.fn(() => Promise.resolve({ data: data?.[0] || null, error: null })),
      then: result.then.bind(result),
    };
    return chain;
  }

  return {
    from: vi.fn((table) => ({
      select: vi.fn(() => makeSelectChain(assets)),
      update: vi.fn((data) => {
        log.push({ op: 'update', table, data });
        return {
          eq: vi.fn(() => Promise.resolve({ error: null })),
          in: vi.fn(() => Promise.resolve({ error: null })),
        };
      }),
      insert: vi.fn((data) => {
        log.push({ op: 'insert', table, data });
        return Promise.resolve({ error: null });
      }),
      delete: vi.fn(() => {
        log.push({ op: 'delete', table });
        return {
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        };
      }),
    })),
    _log: log,
  };
}

const defaultMetadaten = {
  kooperationId: 'koop-1',
  kooperationName: 'TestKoop',
  videoTitel: 'Video',
  videoName: 'Testvideo',
  unternehmen: 'TestFirma',
  marke: 'TestMarke',
  kampagne: 'TestKampagne',
  creatorName: 'Max Mustermann',
};

describe('VideoUploadDrawer', () => {
  let drawer;

  beforeEach(() => {
    document.body.innerHTML = '';
    window.supabase = createMockSupabase();
    window.currentUser = { id: 'user-1' };
    drawer = new VideoUploadDrawer();
  });

  afterEach(() => {
    drawer.removeDrawer();
    delete window.supabase;
    delete window.currentUser;
  });

  describe('Per-Item Versions-Dropdown', () => {
    it('zeigt kein globales Versions-Dropdown mehr', async () => {
      window.supabase = createMockSupabase([]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const globalSelect = document.getElementById('video-upload-version');
      expect(globalSelect).toBeNull();
    });

    it('zeigt Feedbackschleife-Dropdown pro Queue-Item', async () => {
      window.supabase = createMockSupabase([]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const file = new File(['x'], 'test.mp4', { type: 'video/mp4' });
      drawer.videoTab._addFiles([file]);

      const queueEl = document.getElementById('video-upload-queue');
      const selects = queueEl.querySelectorAll('.video-version-select');
      expect(selects.length).toBe(1);
      expect(selects[0].options.length).toBe(3);
    });
  });

  describe('saveAssetVersion', () => {
    it('speichert korrekte version_number statt hardcoded 1', async () => {
      const sb = createTrackingSupabase([]);
      window.supabase = sb;

      await drawer.open('video-1', defaultMetadaten, vi.fn());
      await drawer.saveAssetVersion('https://file.url', '/path/to/file', 'videoname', 'https://folder.url', 2);

      const assetInsert = sb._log.find(e => e.op === 'insert' && e.table === 'kooperation_video_asset');
      expect(assetInsert).toBeDefined();
      expect(assetInsert.data.version_number).toBe(2);
    });

    it('aktualisiert folder_url immer (nicht nur wenn leer)', async () => {
      const sb = createTrackingSupabase([]);
      window.supabase = sb;

      await drawer.open('video-1', defaultMetadaten, vi.fn());
      await drawer.saveAssetVersion('https://file.url', '/path', 'name', 'https://new-folder.url', 1);

      const videoUpdate = sb._log.find(e => e.op === 'update' && e.table === 'kooperation_videos');
      expect(videoUpdate).toBeDefined();
      expect(videoUpdate.data.folder_url).toBe('https://new-folder.url');
    });

    it('fügt neuen Asset hinzu ohne alten zu löschen (Append-Modus)', async () => {
      const sb = createTrackingSupabase([{ version_number: 1 }]);
      window.supabase = sb;

      await drawer.open('video-1', defaultMetadaten, vi.fn());
      await drawer.saveAssetVersion('https://new.url', '/new/path', 'name', 'https://folder.url', 1);

      const deleteOps = sb._log.filter(e => e.op === 'delete' && e.table === 'kooperation_video_asset');
      expect(deleteOps.length).toBe(0);

      const assetInsert = sb._log.find(e => e.op === 'insert' && e.table === 'kooperation_video_asset');
      expect(assetInsert).toBeDefined();
      expect(assetInsert.data.version_number).toBe(1);
    });

    it('ruft _updateCurrentFlags nach dem Speichern auf', async () => {
      const sb = createTrackingSupabase([{ version_number: 1 }]);
      window.supabase = sb;

      await drawer.open('video-1', defaultMetadaten, vi.fn());
      await drawer.saveAssetVersion('https://new.url', '/new/path', 'name', null, 1);

      const updateOps = sb._log.filter(e => e.op === 'update');
      expect(updateOps.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Background Upload Integration', () => {
    it('close() schließt den Drawer auch wenn ein Background-Job für das Video läuft', async () => {
      const { backgroundUploadService } = await import('../core/BackgroundUploadService.js');
      const { runVideoUploadJob } = await import('../core/uploadJobs/runVideoUploadJob.js');
      const originalRunner = runVideoUploadJob;

      window.supabase = createMockSupabase([]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      // Einen "hängenden" Job einreihen — Drawer muss trotzdem schließbar bleiben
      let resolveJob;
      const enqueueSpy = vi.spyOn(backgroundUploadService, 'enqueueVideoJob')
        .mockImplementation((payload) => {
          // Realer Service ist gestubbt; wir simulieren ihn minimal
          return 'fake-job-id';
        });
      vi.spyOn(backgroundUploadService, 'getActiveJobsForVideo').mockReturnValue([
        { id: 'fake-job-id', videoId: 'video-1', kind: 'video', status: 'running', items: [] },
      ]);

      // isAnyUploadActive darf NICHT mehr blockieren
      expect(drawer.isAnyUploadActive()).toBe(false);

      // close() funktioniert
      drawer.close();
      // Nach 300ms ist der DOM weg
      await new Promise(r => setTimeout(r, 350));
      expect(document.getElementById('video-upload-drawer')).toBeNull();

      enqueueSpy.mockRestore();
    });

    it('open() zeigt Banner wenn ein Job für die videoId läuft', async () => {
      const { backgroundUploadService } = await import('../core/BackgroundUploadService.js');
      vi.spyOn(backgroundUploadService, 'getActiveJobsForVideo').mockReturnValue([
        { id: 'fake', videoId: 'video-1', kind: 'video', status: 'running', items: [] },
      ]);

      window.supabase = createMockSupabase([]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const banner = document.querySelector('.video-upload-active-banner');
      expect(banner).not.toBeNull();
      expect(banner.textContent).toContain('Upload');
    });
  });
});
