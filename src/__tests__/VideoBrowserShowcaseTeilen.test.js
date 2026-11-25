import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Showcase: Links in SharePoint zum Weitergeben. Produktions-Link in der Leiste (nur Team),
// Ordner-Link im Kopf je Creator (Team und Kunden, nicht Gäste). Ein Creator mit mehreren
// Kooperationen hat keinen eigenen Ordner, er bekommt je Kooperation eine Zeile.

vi.mock('../core/auth/getAccessToken.js', () => ({ authorizedFetch: vi.fn() }));

vi.mock('../modules/video-browser/VideoBrowserAdapter.js', async () => {
  const { kit } = await import('./videoBrowserShowcaseTestKit.js');
  return {
    loadVideoBrowserData: vi.fn(async () => structuredClone(kit.raw)),
    saveWiedergabeMessung: vi.fn(),
    saveVideoCaption: vi.fn(async () => null)
  };
});

vi.mock('../modules/video-browser/videoBrowserMedia.js', () => ({
  prefetchLinks: vi.fn(),
  warmNeighbors: vi.fn(),
  stopWarming: vi.fn(),
  cachedUrl: () => null,
  networkUrl: async () => null
}));

vi.mock('../modules/video-browser/VideoBrowserUpload.js', () => ({
  createUploader: () => ({ start: vi.fn(), destroy: vi.fn() })
}));

vi.mock('../modules/video-browser/videoBrowserRatio.js', () => ({
  ratioOfItem: vi.fn(async () => null),
  ratioOfFile: vi.fn(async () => null)
}));

const { authorizedFetch } = await import('../core/auth/getAccessToken.js');
const { mountVideoBrowserPane, unmountVideoBrowser } = await import('../modules/video-browser/VideoBrowser.js');
const { click, seg, setup } = await import('./videoBrowserShowcaseTestKit.js');

const mia = { id: 'c1', vorname: 'Mia', nachname: 'Roth' };
const final = (id, videoId, ablage) => ({
  id, video_id: videoId, version_number: 1, variant_name: '9:16', is_final: true, ablage, file_path: `/K/${id}.mp4`, created_at: '2026-03-01'
});

// Mia: zwei Kooperationen in SharePoint (Linie A und B). Jan: nur Dropbox. Ilias: noch keine Datei.
const RAW = {
  kooperationen: [
    { id: 'k1', name: 'Koop A', briefing_id: 'l1', creator_id: 'c1', creator: mia },
    { id: 'k3', name: 'Koop C', briefing_id: 'l2', creator_id: 'c1', creator: mia },
    { id: 'k2', name: 'Koop B', briefing_id: 'l1', creator_id: 'c2', creator: { id: 'c2', vorname: 'Jan', nachname: 'Voss' } },
    { id: 'k4', name: 'Koop D', briefing_id: 'l1', creator_id: 'c4', creator: { id: 'c4', vorname: 'Ilias', nachname: 'Bousaidi' } }
  ],
  linien: [{ id: 'l1', name: 'Linie A' }, { id: 'l2', name: 'Linie B' }],
  videos: [
    { id: 'v1', kooperation_id: 'k1', position: 1, titel: 'Hook', created_at: '2026-01-01' },
    { id: 'v3', kooperation_id: 'k3', position: 1, titel: 'Unboxing', created_at: '2026-01-02' },
    { id: 'v2', kooperation_id: 'k2', position: 1, titel: 'Direkt', created_at: '2026-01-03' },
    { id: 'v4', kooperation_id: 'k4', position: 1, titel: 'Leer', created_at: '2026-01-04' }
  ],
  stories: [],
  videoAssets: [final('f1', 'v1', 'sharepoint'), final('f3', 'v3', 'sharepoint'), final('f2', 'v2', 'dropbox')],
  storyAssets: [],
  stillAssets: [],
  rohmaterial: [],
  slotNotes: [],
  zeitkommentare: [],
  tagTypen: [],
  varianteTags: [],
  links: {}
};

const ABLAUF = { k1: '2027-11-24T10:00:00Z', k3: '2026-12-09T10:00:00Z', k4: '2027-11-24T10:00:00Z' };
const urlFuer = (bezug) => `https://x.sharepoint.com/:f:/s/m/${bezug.kooperation_id || bezug.produktion_id}`;
const antwort = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
const freigaben = () => authorizedFetch.mock.calls
  .filter(([path]) => path.endsWith('ablage-freigabe'))
  .map(([, opts]) => JSON.parse(opts.body));

const kopf = (pane, creatorId) => pane.querySelector(`[data-vb-sc-group="creator:${creatorId}"] .vb-sc-group__head`);
const creatorLink = (pane, creatorId) => kopf(pane, creatorId)?.querySelector('[data-vb-creatorlink]') || null;

describe('Showcase: Ordner- und Produktions-Link', () => {
  let ctx;
  let ohneOrdner;

  beforeEach(() => {
    document.body.innerHTML = '';
    ohneOrdner = new Set();
    authorizedFetch.mockReset();
    authorizedFetch.mockImplementation(async (path, opts) => {
      if (!path.endsWith('ablage-freigabe')) return antwort({});
      const body = JSON.parse(opts.body);
      if (ohneOrdner.has(body.kooperation_id)) return antwort({ code: 'nicht_sharepoint', error: 'Kein Ordner' }, 409);
      return antwort({ id: 'l', url: urlFuer(body), laeuft_ab_at: ABLAUF[body.kooperation_id] || '2026-12-09T10:00:00Z' });
    });
    window.toastSystem = { show: vi.fn() };
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => {}) }, configurable: true });
  });

  afterEach(() => {
    if (ctx) unmountVideoBrowser(ctx.detail);
    ctx = null;
    delete window.toastSystem;
    delete window.isGast;
  });

  async function open(opts) {
    ctx = setup({ raw: RAW, ...opts });
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
  }

  it('Team: Produktions-Link in der Leiste kopiert den ganzen Ordner und bleibt beim Umgruppieren stehen', async () => {
    await open();
    const button = ctx.pane.querySelector('.vb-sc-bar [data-vb-produktionlink="p1"]');
    expect(button.textContent.trim()).toBe('Produktions-Link');
    expect(button.title).toContain('Rohmaterial');

    click(button);
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(urlFuer({ produktion_id: 'p1' })));
    expect(freigaben()).toEqual([{ aktion: 'erstellen', produktion_id: 'p1' }]);
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Link kopiert – gültig bis 9.12.2026', 'success'));

    click(seg(ctx.pane, 'group', 'keine'));
    expect(ctx.pane.querySelector('.vb-sc-bar [data-vb-produktionlink]')).toBe(button);
    expect(ctx.pane.querySelector('[data-vb-creatorlink]')).toBeNull();
  });

  it('Kopf je Creator: Ordner-Link mit SharePoint-Ordner, auch vor der ersten Datei, nie bei reinem Dropbox-Bestand', async () => {
    await open();
    expect(creatorLink(ctx.pane, 'c1').dataset.vbCreatorlink).toBe('k1 k3');
    expect(creatorLink(ctx.pane, 'c1').textContent.trim()).toBe('2 Ordner-Links');
    expect(creatorLink(ctx.pane, 'c4').dataset.vbCreatorlink).toBe('k4');
    expect(creatorLink(ctx.pane, 'c4').textContent.trim()).toBe('Ordner-Link');
    expect(kopf(ctx.pane, 'c2')).not.toBeNull();
    expect(creatorLink(ctx.pane, 'c2')).toBeNull();
  });

  it('ein Creator: nur der Link, ohne Ordner eine verständliche Meldung', async () => {
    await open();
    click(creatorLink(ctx.pane, 'c4'));
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(urlFuer({ kooperation_id: 'k4' })));
    expect(freigaben()).toEqual([{ aktion: 'erstellen', kooperation_id: 'k4' }]);

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    ohneOrdner.add('k4');
    click(creatorLink(ctx.pane, 'c4'));
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Für diesen Creator gibt es noch keinen SharePoint-Ordner.', 'error'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('mehrere Kooperationen: je Linie eine Zeile, gültig bis zum frühesten Ablauf', async () => {
    await open();
    const button = creatorLink(ctx.pane, 'c1');
    click(button);
    expect(button.disabled).toBe(true);
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `Mia Roth – Linie A: ${urlFuer({ kooperation_id: 'k1' })}\nMia Roth – Linie B: ${urlFuer({ kooperation_id: 'k3' })}`
    ));
    expect(freigaben()).toEqual([
      { aktion: 'erstellen', kooperation_id: 'k1' },
      { aktion: 'erstellen', kooperation_id: 'k3' }
    ]);
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('2 Links kopiert – gültig bis 9.12.2026', 'success'));
    expect(button.disabled).toBe(false);
  });

  it('scheitert eine Kooperation, kommen die übrigen und der Hinweis sagt, wie viele', async () => {
    ohneOrdner.add('k3');
    await open();
    click(creatorLink(ctx.pane, 'c1'));
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`Mia Roth – Linie A: ${urlFuer({ kooperation_id: 'k1' })}`));
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('1 von 2 Links kopiert – gültig bis 24.11.2027', 'warning'));
  });

  it('ohne Zwischenablage stehen mehrere Links einzeilig im Prompt', async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error('NotAllowedError'));
    const prompt = vi.spyOn(window, 'prompt').mockImplementation(() => null);
    await open();
    click(creatorLink(ctx.pane, 'c1'));
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledWith('Link kopieren:',
      `Mia Roth – Linie A: ${urlFuer({ kooperation_id: 'k1' })}  Mia Roth – Linie B: ${urlFuer({ kooperation_id: 'k3' })}`));
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('2 Links erstellt – gültig bis 9.12.2026', 'success'));
    prompt.mockRestore();
  });

  it('Kunde: Ordner-Link je Creator ja, Produktions-Link nein; Gast: keiner', async () => {
    await open({ team: false });
    expect(creatorLink(ctx.pane, 'c1')).not.toBeNull();
    expect(ctx.pane.querySelector('[data-vb-produktionlink]')).toBeNull();
    unmountVideoBrowser(ctx.detail);

    window.isGast = () => true;
    await open();
    expect(ctx.pane.querySelector('[data-vb-creatorlink]')).toBeNull();
    expect(ctx.pane.querySelector('[data-vb-produktionlink]')).toBeNull();
  });
});
