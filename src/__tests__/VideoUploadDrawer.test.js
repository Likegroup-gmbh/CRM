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

function createTrackingSupabase(assets = [], { video = {} } = {}) {
  const log = [];

  function chainOf(data) {
    const result = Promise.resolve({ data, error: null });
    const chain = {
      maybeSingle: vi.fn(() => Promise.resolve({ data: data?.[0] || null, error: null })),
      single: vi.fn(() => Promise.resolve({ data: data?.[0] || null, error: null })),
      then: result.then.bind(result),
    };
    for (const m of ['eq', 'in', 'is', 'order', 'limit', 'select']) chain[m] = vi.fn(() => chain);
    return chain;
  }

  return {
    from: vi.fn((table) => ({
      select: vi.fn(() => chainOf(table === 'kooperation_videos' ? [video] : assets)),
      update: vi.fn((data) => {
        log.push({ op: 'update', table, data });
        return chainOf(null);
      }),
      insert: vi.fn((data) => {
        log.push({ op: 'insert', table, data });
        return Promise.resolve({ error: null });
      }),
      delete: vi.fn(() => {
        log.push({ op: 'delete', table });
        return chainOf([{ id: 'deleted' }]);
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
      // 3 Feedbackschleifen + Finale Version
      expect(selects[0].options.length).toBe(4);
      expect(selects[0].options[3].value).toBe('final');
      expect(selects[0].options[3].textContent).toBe('Finale Version');
    });

    it('preselectFinal: neue Dateien starten mit Finale Version + 9:16', async () => {
      window.supabase = createMockSupabase([]);
      await drawer.open('video-1', defaultMetadaten, vi.fn(), null, null, { preselectFinal: true });

      const file = new File(['x'], 'test.mp4', { type: 'video/mp4' });
      drawer.videoTab._addFiles([file]);

      expect(drawer.videoTab._queue[0].isFinal).toBe(true);
      expect(drawer.videoTab._queue[0].variantName).toBe('9:16');

      const queueEl = document.getElementById('video-upload-queue');
      const select = queueEl.querySelector('.video-version-select');
      expect(select.value).toBe('final');
      expect(queueEl.querySelector('.video-final-variant-select')).not.toBeNull();
    });

    it('ohne preselectFinal starten neue Dateien als Feedbackschleife', async () => {
      window.supabase = createMockSupabase([]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const file = new File(['x'], 'test.mp4', { type: 'video/mp4' });
      drawer.videoTab._addFiles([file]);

      expect(drawer.videoTab._queue[0].isFinal).toBeUndefined();
      expect(document.querySelector('.video-variant-name-input')).not.toBeNull();
    });

    it('zeigt keinen separaten Finale-Tab mehr', async () => {
      window.supabase = createMockSupabase([]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      expect(document.querySelector('[data-drawer-tab="finale"]')).toBeNull();
      expect(document.getElementById('upload-tab-finale')).toBeNull();
    });

    it('Finale Version: Freitext wird durch Varianten-Select 9:16/4:5 ersetzt', async () => {
      window.supabase = createMockSupabase([]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const file = new File(['x'], 'test.mp4', { type: 'video/mp4' });
      drawer.videoTab._addFiles([file]);

      const queueEl = document.getElementById('video-upload-queue');
      const select = queueEl.querySelector('.video-version-select');
      select.value = 'final';
      select.dispatchEvent(new Event('change', { bubbles: true }));

      expect(drawer.videoTab._queue[0].isFinal).toBe(true);
      expect(drawer.videoTab._queue[0].variantName).toBe('9:16');

      const variantSelect = queueEl.querySelector('.video-final-variant-select');
      expect(variantSelect).not.toBeNull();
      expect([...variantSelect.options].map(o => o.value)).toEqual(['9:16', '4:5', '1:1']);
      expect(queueEl.querySelector('.video-variant-name-input')).toBeNull();

      // Zurueck zu Feedbackschleife -> Freitext wieder da, Flag zurueckgesetzt
      const selectAfter = queueEl.querySelector('.video-version-select');
      selectAfter.value = '2';
      selectAfter.dispatchEvent(new Event('change', { bubbles: true }));
      expect(drawer.videoTab._queue[0].isFinal).toBe(false);
      expect(drawer.videoTab._queue[0].versionNumber).toBe(2);
      expect(document.querySelector('.video-variant-name-input')).not.toBeNull();
    });
  });

  describe('Abgeleitete Felder kommen aus der DB', () => {
    it('Löschen: Kommentare weg, Zeile weg, Abgleich über onVideoAssetDeleted', async () => {
      const finale = {
        id: 'a-final', file_url: 'https://dl/x', file_path: '/x/v1.mp4', version_number: 1,
        variant_name: '9:16', is_current: false, is_final: true, created_at: '2026-01-01T00:00:00Z',
      };
      const sb = createTrackingSupabase([finale]);
      window.supabase = sb;
      const onVideoAssetDeleted = vi.fn();
      const onFinaleChanged = vi.fn();
      await drawer.open('video-1', defaultMetadaten, vi.fn(), null, null, { onVideoAssetDeleted, onFinaleChanged });

      await vi.waitFor(() => expect(document.querySelector('.existing-video-delete[data-id="a-final"]')).not.toBeNull());
      document.querySelector('.existing-video-delete[data-id="a-final"]').click();
      await vi.waitFor(() => expect(onFinaleChanged).toHaveBeenCalledWith('video-1'));

      expect(sb._log).toContainEqual({
        op: 'update', table: 'kooperation_video_zeitkommentar', data: { deleted_at: expect.any(String) },
      });
      expect(sb._log).toContainEqual({ op: 'delete', table: 'kooperation_video_asset' });
      expect(onVideoAssetDeleted).toHaveBeenCalledWith(finale);
      expect(sb._log.filter(e => e.op === 'update' && e.table === 'kooperation_video_asset')).toEqual([]);
    });
  });

  describe('Upload-Drawer Layout und Icons', () => {
    it('setzt drawer-panel--upload am Panel', async () => {
      window.supabase = createMockSupabase([]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const panel = document.getElementById('video-upload-drawer');
      expect(panel?.classList.contains('drawer-panel--upload')).toBe(true);
    });

    it('kein Link-Modus mehr: immer Dropzone, kein Chip, keine Link- oder Ordner-Felder', async () => {
      window.supabase = createMockSupabase([]);
      await drawer.open('video-1', { ...defaultMetadaten, keinDropbox: true, folderUrl: 'https://contoso.sharepoint.com/:f:/g/abc' }, vi.fn());

      expect(document.getElementById('video-upload-dropzone')).not.toBeNull();
      expect(document.getElementById('external-links-chip')).toBeNull();
      expect(document.getElementById('video-link-add-btn')).toBeNull();
      expect(document.getElementById('video-folder-url-input')).toBeNull();
      expect(document.querySelector('[data-link-mode]')).toBeNull();
      expect(drawer.useExternalLinks).toBeUndefined();
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
