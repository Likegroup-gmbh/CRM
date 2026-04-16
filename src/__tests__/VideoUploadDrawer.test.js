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

function createTrackingSupabase(assets = [], opts = {}) {
  const log = [];

  function makeSelectChain(data) {
    const result = Promise.resolve({ data, error: null });
    const chain = {
      eq: vi.fn(() => chain),
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

    it('zeigt alle Versionen auch wenn V1 bereits existiert, markiert belegte mit (ersetzen)', async () => {
      window.supabase = createMockSupabase([{ version_number: 1 }]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const select = document.getElementById('video-upload-version');
      expect(select).not.toBeNull();
      expect(select.options.length).toBe(3);
      expect(select.options[0].value).toBe('1');
      expect(select.options[0].textContent).toContain('ersetzen');
      expect(select.options[1].value).toBe('2');
      expect(select.options[1].textContent).not.toContain('ersetzen');
      expect(select.options[2].value).toBe('3');
    });

    it('erste nicht-belegte Version ist vorausgewählt', async () => {
      window.supabase = createMockSupabase([{ version_number: 1 }]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const select = document.getElementById('video-upload-version');
      expect(select.value).toBe('2');
    });
  });

  describe('Alle Versionen belegt', () => {
    it('zeigt trotzdem Dropdown mit allen Versionen als (ersetzen)', async () => {
      window.supabase = createMockSupabase([
        { version_number: 1 }, { version_number: 2 }, { version_number: 3 }
      ]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const select = document.getElementById('video-upload-version');
      expect(select).not.toBeNull();
      expect(select.options.length).toBe(3);
      for (const opt of select.options) {
        expect(opt.textContent).toContain('ersetzen');
      }
    });

    it('Upload-Button bleibt aktivierbar wenn alle belegt aber Datei+Name vorhanden', async () => {
      window.supabase = createMockSupabase([
        { version_number: 1 }, { version_number: 2 }, { version_number: 3 }
      ]);
      await drawer.open('video-1', defaultMetadaten, vi.fn());

      const submitBtn = document.getElementById('video-upload-submit-btn');
      expect(submitBtn.disabled).toBe(true);

      drawer.videoTab._selectedFile = new File(['x'], 'test.mp4', { type: 'video/mp4' });
      document.getElementById('video-upload-name').value = 'Test';
      drawer._updateSubmitButtonState();
      expect(submitBtn.disabled).toBe(false);
    });
  });

  describe('saveAssetVersion', () => {
    it('speichert korrekte version_number statt hardcoded 1', async () => {
      const sb = createTrackingSupabase([]);
      window.supabase = sb;

      await drawer.open('video-1', defaultMetadaten, vi.fn());
      drawer.videoTab._selectedVersion = 2;
      await drawer.saveAssetVersion('https://file.url', '/path/to/file', 'videoname', 'https://folder.url');

      const assetInsert = sb._log.find(e => e.op === 'insert' && e.table === 'kooperation_video_asset');
      expect(assetInsert).toBeDefined();
      expect(assetInsert.data.version_number).toBe(2);
    });

    it('aktualisiert folder_url immer (nicht nur wenn leer)', async () => {
      const sb = createTrackingSupabase([]);
      window.supabase = sb;

      await drawer.open('video-1', defaultMetadaten, vi.fn());
      drawer.videoTab._selectedVersion = 1;
      await drawer.saveAssetVersion('https://file.url', '/path', 'name', 'https://new-folder.url');

      const videoUpdate = sb._log.find(e => e.op === 'update' && e.table === 'kooperation_videos');
      expect(videoUpdate).toBeDefined();
      expect(videoUpdate.data.folder_url).toBe('https://new-folder.url');
    });

    it('löscht alten Asset-Eintrag wenn Version bereits existiert', async () => {
      const sb = createTrackingSupabase([{ version_number: 1 }]);
      window.supabase = sb;

      await drawer.open('video-1', defaultMetadaten, vi.fn());
      drawer.videoTab._selectedVersion = 1;
      await drawer.saveAssetVersion('https://new.url', '/new/path', 'name', 'https://folder.url');

      const deleteOps = sb._log.filter(e => e.op === 'delete' && e.table === 'kooperation_video_asset');
      expect(deleteOps.length).toBe(1);

      const assetInsert = sb._log.find(e => e.op === 'insert' && e.table === 'kooperation_video_asset');
      expect(assetInsert).toBeDefined();
      expect(assetInsert.data.version_number).toBe(1);
    });

    it('löscht alte Dropbox-Datei beim Versions-Overwrite', async () => {
      const fetchLog = [];
      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async (url, opts) => {
        fetchLog.push({ url, body: opts?.body ? JSON.parse(opts.body) : null });
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      });

      const sb = createTrackingSupabase([
        { version_number: 1, file_path: '/Videos/Firma/old-video.mp4' },
      ]);
      window.supabase = sb;

      await drawer.open('video-1', defaultMetadaten, vi.fn());
      drawer.videoTab._selectedVersion = 1;
      await drawer.saveAssetVersion('https://new.url', '/new/path', 'newname', null);

      const dropboxCall = fetchLog.find(l => l.url === '/.netlify/functions/dropbox-delete');
      expect(dropboxCall).toBeDefined();
      expect(dropboxCall.body.filePath).toBe('/Videos/Firma/old-video.mp4');

      globalThis.fetch = origFetch;
    });

    it('Version-Overwrite funktioniert auch wenn alte Datei kein file_path hat', async () => {
      const fetchLog = [];
      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async (url, opts) => {
        fetchLog.push({ url });
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      });

      const sb = createTrackingSupabase([{ version_number: 1, file_path: null }]);
      window.supabase = sb;

      await drawer.open('video-1', defaultMetadaten, vi.fn());
      drawer.videoTab._selectedVersion = 1;
      await drawer.saveAssetVersion('https://new.url', '/new/path', 'name', null);

      const dropboxCalls = fetchLog.filter(l => l.url === '/.netlify/functions/dropbox-delete');
      expect(dropboxCalls.length).toBe(0);

      globalThis.fetch = origFetch;
    });
  });
});
