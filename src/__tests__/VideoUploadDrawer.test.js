import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoUploadDrawer } from '../modules/kampagne/VideoUploadDrawer.js';

function createMockSupabase(assets = []) {
  return {
    from: vi.fn((table) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: assets, error: null })),
      })),
      update: vi.fn((data) => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      insert: vi.fn((data) => Promise.resolve({ error: null })),
    })),
  };
}

function createTrackingSupabase(assets = []) {
  const log = [];
  return {
    from: vi.fn((table) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: assets, error: null })),
      })),
      update: vi.fn((data) => {
        log.push({ op: 'update', table, data });
        return {
          eq: vi.fn(() => Promise.resolve({ error: null })),
        };
      }),
      insert: vi.fn((data) => {
        log.push({ op: 'insert', table, data });
        return Promise.resolve({ error: null });
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

  describe('Versions-Dropdown', () => {
    it('zeigt Dropdown mit V1, V2, V3 wenn keine Versionen existieren', async () => {
      window.supabase = createMockSupabase([]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const select = document.getElementById('video-upload-version');
      expect(select).not.toBeNull();
      expect(select.options.length).toBe(3);
      expect(select.options[0].value).toBe('1');
      expect(select.options[1].value).toBe('2');
      expect(select.options[2].value).toBe('3');
    });

    it('zeigt nur verfügbare Versionen wenn V1 bereits existiert', async () => {
      window.supabase = createMockSupabase([{ version_number: 1 }]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const select = document.getElementById('video-upload-version');
      expect(select).not.toBeNull();
      expect(select.options.length).toBe(2);
      expect(select.options[0].value).toBe('2');
      expect(select.options[1].value).toBe('3');
    });

    it('erste verfügbare Version ist vorausgewählt', async () => {
      window.supabase = createMockSupabase([{ version_number: 1 }]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const select = document.getElementById('video-upload-version');
      expect(select.value).toBe('2');
    });
  });

  describe('Max Versionen erreicht', () => {
    it('deaktiviert Upload-Button wenn alle Versionen belegt', async () => {
      window.supabase = createMockSupabase([
        { version_number: 1 }, { version_number: 2 }, { version_number: 3 }
      ]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const submitBtn = document.getElementById('video-upload-submit-btn');
      expect(submitBtn.disabled).toBe(true);
    });

    it('zeigt Hinweistext wenn alle Versionen belegt', async () => {
      window.supabase = createMockSupabase([
        { version_number: 1 }, { version_number: 2 }, { version_number: 3 }
      ]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const select = document.getElementById('video-upload-version');
      expect(select).toBeNull();

      const hint = document.getElementById('video-upload-version-hint');
      expect(hint).not.toBeNull();
      expect(hint.textContent).toContain('3');
    });
  });

  describe('saveAssetVersion', () => {
    it('speichert korrekte version_number statt hardcoded 1', async () => {
      const sb = createTrackingSupabase([]);
      window.supabase = sb;

      await drawer.open('video-1', defaultMetadaten, vi.fn());
      drawer._selectedVersion = 2;
      await drawer.saveAssetVersion('https://file.url', '/path/to/file', 'videoname', 'https://folder.url');

      const assetInsert = sb._log.find(e => e.op === 'insert' && e.table === 'kooperation_video_asset');
      expect(assetInsert).toBeDefined();
      expect(assetInsert.data.version_number).toBe(2);
    });

    it('aktualisiert folder_url immer (nicht nur wenn leer)', async () => {
      const sb = createTrackingSupabase([]);
      window.supabase = sb;

      await drawer.open('video-1', defaultMetadaten, vi.fn());
      drawer._selectedVersion = 1;
      await drawer.saveAssetVersion('https://file.url', '/path', 'name', 'https://new-folder.url');

      const videoUpdate = sb._log.find(e => e.op === 'update' && e.table === 'kooperation_videos');
      expect(videoUpdate).toBeDefined();
      expect(videoUpdate.data.folder_url).toBe('https://new-folder.url');
    });
  });
});
