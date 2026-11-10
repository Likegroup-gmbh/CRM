import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// SharePoint-Medienablage im Videos-Tab: Ordner-Link (Team und Kunden, nicht Gäste) und
// Weitere Ordner (nur Team). Controller wie in VideoBrowserController.test.js, die
// Functions laufen über das gemockte authorizedFetch.
const RAW = {
  kooperationen: [
    { id: 'k1', name: 'Koop A', briefing_id: null, creator: { vorname: 'Mia', nachname: 'Roth' } },
    { id: 'k2', name: 'Koop B', briefing_id: null, creator: { vorname: 'Jan', nachname: 'Voss' } }
  ],
  linien: [],
  videos: [
    { id: 'v1', kooperation_id: 'k1', position: 1, titel: 'Hook', created_at: '2026-01-01' },
    { id: 'v2', kooperation_id: 'k2', position: 1, titel: 'Dropbox', created_at: '2026-01-02' }
  ],
  stories: [],
  videoAssets: [
    { id: 'a1', video_id: 'v1', version_number: 1, variant_name: 'A', is_final: false, ablage: 'sharepoint', file_path: '/K/a1.mp4', created_at: '2026-02-01' },
    { id: 'a2', video_id: 'v2', version_number: 1, variant_name: 'A', is_final: false, ablage: 'dropbox', file_path: '/K/a2.mp4', created_at: '2026-02-02' }
  ],
  storyAssets: [],
  stillAssets: [],
  rohmaterial: [],
  slotNotes: [],
  zeitkommentare: []
};

vi.mock('../core/auth/getAccessToken.js', () => ({ authorizedFetch: vi.fn() }));

vi.mock('../modules/video-browser/VideoBrowserAdapter.js', () => ({
  loadVideoBrowserData: vi.fn(async () => structuredClone(RAW)),
  saveZeitkommentar: vi.fn(),
  saveWiedergabeMessung: vi.fn(),
  loadUploadContext: vi.fn(),
  renameAsset: vi.fn(),
  renameAdManagerFile: vi.fn(),
  deleteAsset: vi.fn(),
  insertVarianteTag: vi.fn(),
  deleteVarianteTag: vi.fn(),
  createTagTyp: vi.fn(),
  saveVideoCaption: vi.fn(async () => null),
  TITEL_MAX: 120
}));

vi.mock('../modules/video-browser/videoBrowserMedia.js', () => ({
  prefetchLinks: vi.fn(),
  warmNeighbors: vi.fn(),
  stopWarming: vi.fn()
}));

vi.mock('../core/media/PosterCache.js', () => ({ prefetchPosters: vi.fn() }));

vi.mock('../modules/video-browser/VideoBrowserUpload.js', () => ({
  createUploader: () => ({ start: vi.fn(), destroy: vi.fn() })
}));

vi.mock('../modules/video-browser/VideoBrowserPlayer.js', () => ({
  mountPlayer: (host) => {
    host.innerHTML = '<div data-vb-frame></div>';
    return { seek: vi.fn(), getTime: () => 0, setMarkers: vi.fn(), markerEl: () => null, destroy: vi.fn(), getDimensions: () => null, whenReady: () => Promise.resolve() };
  }
}));

vi.mock('../core/PromoteFinalAsset.js', () => ({
  promoteAssetToFinal: vi.fn(async () => ({})),
  unmarkFinalSlot: vi.fn(async () => {})
}));

vi.mock('../modules/video-browser/videoBrowserRatio.js', () => ({
  ratioOfItem: vi.fn(async () => null),
  ratioOfFile: vi.fn(async () => null)
}));

const { authorizedFetch } = await import('../core/auth/getAccessToken.js');
const { mountVideoBrowserPane, unmountVideoBrowser } = await import('../modules/video-browser/VideoBrowser.js');
const { hatSharepoint, ordnerLinkButton } = await import('../modules/video-browser/videoBrowserAblage.js');

const LINK = { id: 'l1', url: 'https://x.sharepoint.com/:f:/s/m/abc', laeuft_ab_at: '2026-12-09T10:00:00Z' };
const ORDNER = [{
  item_id: 'o1', name: 'Making-of', pfad: '/Acme/Koop A/Making-of', web_url: 'https://x/o1',
  dateien: [{ item_id: 'd1', name: 'notizen.pdf', groesse: 2048, web_url: 'https://x/d1', geaendert_at: '2026-11-01T09:00:00Z' }]
}];

const antwort = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
const ablageCalls = () => authorizedFetch.mock.calls
  .filter(([path]) => /ablage-(freigabe|link)/.test(path))
  .map(([path, opts]) => ({ path, body: JSON.parse(opts.body) }));
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

let ctx;
async function open(koop, { team = true } = {}) {
  window.canFeature = (name) => ({ videoTeamSicht: team, mediaUpload: team, skriptKommentieren: true, mediaDownload: false }[name] ?? false);
  window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} });
  window.history.replaceState(null, '', `/produktion/p1?tab=videos&k=${koop}`);
  const pane = document.createElement('div');
  document.body.appendChild(pane);
  ctx = { pane, detail: { kampagneId: 'kamp', produktionId: 'p1', linien: [], linieAlle: false, linieId: null, produktion: { name: 'Prod' } } };
  await mountVideoBrowserPane(ctx.detail, ctx.pane);
}

describe('Videos-Tab: SharePoint-Medienablage', () => {
  let freieOrdner;

  beforeEach(() => {
    document.body.innerHTML = '';
    authorizedFetch.mockReset();
    freieOrdner = () => antwort({ ordner: ORDNER });
    authorizedFetch.mockImplementation(async (path, opts) => {
      const body = JSON.parse(opts.body);
      if (path.endsWith('ablage-freigabe')) return antwort(LINK);
      if (body.frei) return freieOrdner();
      if (body.frei_datei) return antwort({ url: 'https://x/download/d1?tempauth=1' });
      return antwort({});
    });
    window.toastSystem = { show: vi.fn() };
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => {}) }, configurable: true });
  });

  afterEach(() => {
    if (ctx) unmountVideoBrowser(ctx.detail);
    ctx = null;
    delete window.toastSystem;
    delete window.isGast;
    delete window.guestShare;
  });

  describe('Ordner-Link', () => {
    it('erkennt SharePoint an asset.ablage und blendet den Button für Gäste aus', () => {
      const koop = (ablage) => ({ id: 'k', rows: [{ folders: [{ items: [{ asset: { ablage } }] }] }] });
      expect(hatSharepoint(koop('sharepoint'))).toBe(true);
      expect(hatSharepoint(koop('dropbox'))).toBe(false);
      expect(ordnerLinkButton(koop('sharepoint'))).toContain('data-vb-ordnerlink="k"');
      expect(ordnerLinkButton(koop('dropbox'))).toBe('');
      window.isGast = () => true;
      expect(ordnerLinkButton(koop('sharepoint'))).toBe('');
    });

    it('erstellt den Link, kopiert ihn und meldet das Ablaufdatum', async () => {
      await open('k1');
      const button = ctx.pane.querySelector('[data-vb-ordnerlink="k1"]');
      expect(button.textContent).toContain('Ordner-Link (30 Tage)');

      click(button);
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-busy')).toBe('true');

      await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(LINK.url));
      expect(ablageCalls()).toContainEqual({ path: '/.netlify/functions/ablage-freigabe', body: { aktion: 'erstellen', kooperation_id: 'k1' } });
      await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Link kopiert – gültig bis 9.12.2026', 'success'));
      expect(button.disabled).toBe(false);
      expect(button.hasAttribute('aria-busy')).toBe(false);
    });

    it('zeigt den Link im Prompt, wenn die Zwischenablage nicht geht', async () => {
      navigator.clipboard.writeText.mockRejectedValueOnce(new Error('NotAllowedError'));
      const prompt = vi.spyOn(window, 'prompt').mockImplementation(() => null);
      await open('k1');
      click(ctx.pane.querySelector('[data-vb-ordnerlink]'));
      await vi.waitFor(() => expect(prompt).toHaveBeenCalledWith('Link kopieren:', LINK.url));
      await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Link erstellt – gültig bis 9.12.2026', 'success'));
      prompt.mockRestore();
    });

    it('meldet eine Kooperation ohne SharePoint-Ordner verständlich', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      authorizedFetch.mockImplementation(async () => antwort({ code: 'nicht_sharepoint', error: 'Kein Ordner' }, 409));
      await open('k1');
      click(ctx.pane.querySelector('[data-vb-ordnerlink]'));
      await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Für diese Kooperation gibt es noch keinen SharePoint-Ordner.', 'error'));
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      spy.mockRestore();
      warn.mockRestore();
    });

    it('Kunden sehen den Button, aber keine weiteren Ordner', async () => {
      await open('k1', { team: false });
      expect(ctx.pane.querySelector('[data-vb-ordnerlink="k1"]')).not.toBeNull();
      expect(ctx.pane.querySelector('[data-vb-freie]')).toBeNull();
      expect(ablageCalls()).toEqual([]);
    });

    it('ohne SharePoint-Dateien gibt es weder Button noch Abruf', async () => {
      await open('k2');
      expect(ctx.pane.querySelector('[data-vb-ordnerlink]')).toBeNull();
      expect(ctx.pane.querySelector('[data-vb-freie]')).toBeNull();
      expect(ablageCalls()).toEqual([]);
    });
  });

  describe('Weitere Ordner', () => {
    it('lädt die Ordner der Kooperation und öffnet eine Datei in neuem Fenster', async () => {
      const win = { opener: {}, location: null, close: vi.fn() };
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => win);
      await open('k1');

      const slot = ctx.pane.querySelector('[data-vb-freie="k1"]');
      await vi.waitFor(() => expect(slot.hidden).toBe(false));
      expect(ablageCalls()).toContainEqual({ path: '/.netlify/functions/ablage-link', body: { frei: { kooperation_id: 'k1' } } });
      expect(slot.querySelector('summary').textContent).toContain('Weitere Ordner');
      expect(slot.textContent).toContain('Making-of');
      expect(slot.textContent).toContain('notizen.pdf');

      click(slot.querySelector('[data-vb-freie-datei="d1"]'));
      expect(openSpy).toHaveBeenCalledWith('', '_blank');
      await vi.waitFor(() => expect(win.location).toBe('https://x/download/d1?tempauth=1'));
      expect(win.opener).toBeNull();
      expect(ablageCalls()).toContainEqual({ path: '/.netlify/functions/ablage-link', body: { frei_datei: { item_id: 'd1' } } });
      openSpy.mockRestore();
    });

    it('lädt je Kooperation nur einmal, auch wenn das Detail neu rendert', async () => {
      await open('k1');
      await vi.waitFor(() => expect(ctx.pane.querySelector('[data-vb-freie="k1"]').hidden).toBe(false));
      click(ctx.pane.querySelector('[data-path-keep="0"]'));
      click(ctx.pane.querySelector('.vb-col--0 .vb-row[data-id="k1"]'));
      await vi.waitFor(() => expect(ctx.pane.querySelector('[data-vb-freie="k1"]').hidden).toBe(false));
      expect(ablageCalls().filter(c => c.body.frei)).toHaveLength(1);
    });

    it('bleibt still, wenn der Abruf scheitert oder nichts liefert', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      freieOrdner = () => antwort({ error: 'kaputt' }, 500);
      await open('k1');
      await vi.waitFor(() => expect(ablageCalls().some(c => c.body.frei)).toBe(true));
      await new Promise(r => setTimeout(r, 0));
      expect(ctx.pane.querySelector('[data-vb-freie="k1"]').hidden).toBe(true);
      expect(window.toastSystem.show).not.toHaveBeenCalled();
      unmountVideoBrowser(ctx.detail);

      freieOrdner = () => antwort({ ordner: [] });
      await open('k1');
      await vi.waitFor(() => expect(ablageCalls().filter(c => c.body.frei)).toHaveLength(2));
      await new Promise(r => setTimeout(r, 0));
      expect(ctx.pane.querySelector('[data-vb-freie="k1"]').hidden).toBe(true);
      warn.mockRestore();
    });
  });
});
