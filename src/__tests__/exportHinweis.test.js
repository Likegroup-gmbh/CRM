import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RAW = {
  kooperationen: [{ id: 'k1', name: 'Koop A', briefing_id: null, creator: { vorname: 'Mia', nachname: 'Roth' } }],
  linien: [],
  videos: [{ id: 'v1', kooperation_id: 'k1', position: 1, titel: 'Hook', created_at: '2026-01-01' }],
  stories: [],
  videoAssets: [{ id: 'a1', video_id: 'v1', version_number: 1, variant_name: 'A', is_final: false, created_at: '2026-02-01' }],
  storyAssets: [],
  stillAssets: [],
  rohmaterial: [{ id: 'r1', kooperation_id: 'k1', file_name: 'clip.mov', file_size: 1024, created_at: '2026-01-10' }],
  slotNotes: [],
  zeitkommentare: []
};

vi.mock('../modules/video-browser/VideoBrowserAdapter.js', () => ({
  loadVideoBrowserData: vi.fn(async () => structuredClone(RAW)),
  saveWiedergabeMessung: vi.fn(),
  loadUploadContext: vi.fn(),
  deleteAsset: vi.fn(async () => {}),
  TITEL_MAX: 120
}));

vi.mock('../modules/video-browser/videoBrowserMedia.js', () => ({
  prefetchLinks: vi.fn(),
  warmNeighbors: vi.fn(),
  stopWarming: vi.fn()
}));

vi.mock('../modules/video-browser/VideoBrowserUpload.js', () => ({
  createUploader: () => ({ start: vi.fn(), destroy: vi.fn() })
}));

vi.mock('../modules/video-browser/VideoBrowserPlayer.js', () => ({
  mountPlayer: (host) => {
    host.innerHTML = '<div data-vb-frame></div>';
    return { seek: vi.fn(), setMarkers: vi.fn(), destroy: vi.fn(), getDimensions: () => null, whenReady: () => Promise.resolve() };
  }
}));

const { mountVideoBrowserPane, unmountVideoBrowser } = await import('../modules/video-browser/VideoBrowser.js');
const { VideoUploadDrawer } = await import('../modules/kampagne/VideoUploadDrawer.js');

function fakeSupabase() {
  const chainOf = () => {
    const result = Promise.resolve({ data: [], error: null });
    const chain = {
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: result.then.bind(result)
    };
    for (const m of ['eq', 'in', 'is', 'not', 'neq', 'order', 'limit', 'range', 'select']) chain[m] = vi.fn(() => chain);
    return chain;
  };
  return { from: vi.fn(() => ({ select: vi.fn(chainOf) })) };
}

const META = { kooperationId: 'koop-1', kooperationName: 'TestKoop', videoName: 'Testvideo', unternehmen: 'TestFirma' };
const hinweis = () => document.querySelector('#video-upload-drawer [data-export-hinweis]');
const sichtbar = (el) => !!el && el.style.display !== 'none';

describe('Export-Hinweis', () => {
  describe('im Upload-Drawer', () => {
    let drawer;
    beforeEach(() => {
      document.body.innerHTML = '';
      window.supabase = fakeSupabase();
      window.currentUser = { id: 'user-1' };
      drawer = new VideoUploadDrawer();
    });
    afterEach(() => {
      drawer.removeDrawer();
      delete window.supabase;
      delete window.currentUser;
    });

    it('steht im Video-Tab und nennt H.264 und HEVC', async () => {
      await drawer.open('video-1', META, vi.fn());
      expect(sichtbar(hinweis())).toBe(true);
      expect(hinweis().textContent).toContain('H.264');
      expect(hinweis().textContent).toContain('HEVC');
    });

    it('bleibt im Storys-Tab sichtbar und verschwindet bei Stills', async () => {
      await drawer.open('video-1', META, vi.fn(), null, null, { initialTab: 'storys' });
      expect(sichtbar(hinweis())).toBe(true);

      drawer._switchTab('bilder');
      expect(sichtbar(hinweis())).toBe(false);

      drawer._switchTab('video');
      expect(sichtbar(hinweis())).toBe(true);
    });

    it('fehlt, wenn der Drawer im Stills-Tab öffnet, bis Video gewählt wird', async () => {
      await drawer.open('video-1', META, vi.fn(), null, null, { initialTab: 'bilder' });
      expect(sichtbar(hinweis())).toBe(false);
      drawer._switchTab('video');
      expect(sichtbar(hinweis())).toBe(true);
    });

    it('fehlt im Link-Modus und in eigenen Upload-Spalten', async () => {
      await drawer.open('video-1', { ...META, keinDropbox: true }, vi.fn());
      expect(hinweis()).toBeNull();

      drawer.removeDrawer();
      await drawer.open('video-1', META, vi.fn(), null, null, { initialTab: 'custom', customMeta: { columnName: 'Extra' } });
      expect(hinweis()).toBeNull();
    });
  });

  describe('an den Upload-Zonen im Videos-Tab', () => {
    let detail;
    const open = async (folder, team = true) => {
      window.canFeature = (name) => ({ videoTeamSicht: team, mediaUpload: team, skriptKommentieren: true }[name] ?? false);
      window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} });
      window.history.replaceState(null, '', `/produktion/p1?tab=videos&k=k1&v=v1&f=${folder}`);
      const pane = document.createElement('div');
      document.body.appendChild(pane);
      detail = { kampagneId: 'kamp', produktionId: 'p1', linien: [], linieAlle: false, linieId: null, produktion: { name: 'Prod' } };
      await mountVideoBrowserPane(detail, pane);
      return pane.querySelector('.vb-col--3');
    };

    beforeEach(() => { document.body.innerHTML = ''; });
    afterEach(() => { if (detail) unmountVideoBrowser(detail); });

    it('steht über der Zone einer Feedbackschleife', async () => {
      const col = await open('s1');
      expect(col.querySelector('[data-vb-dropzone]')).not.toBeNull();
      expect(col.querySelector('.vb-col__foot [data-export-hinweis]')).not.toBeNull();
    });

    it('steht über der Zone der Finalen Version', async () => {
      const col = await open('final');
      expect(col.querySelector('.vb-col__foot [data-export-hinweis]')).not.toBeNull();
    });

    it('fehlt beim Rohmaterial', async () => {
      const col = await open('raw');
      expect(col.querySelector('[data-vb-dropzone]')).not.toBeNull();
      expect(col.querySelector('[data-export-hinweis]')).toBeNull();
    });
  });
});
