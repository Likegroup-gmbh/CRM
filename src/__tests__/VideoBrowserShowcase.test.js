import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RAW = {
  kooperationen: [
    { id: 'k1', name: 'Koop A', briefing_id: null, creator: { vorname: 'Mia', nachname: 'Roth' } },
    { id: 'k2', name: 'Koop B', briefing_id: null, creator: { vorname: 'Jan', nachname: 'Voss' } }
  ],
  linien: [],
  videos: [
    { id: 'v1', kooperation_id: 'k1', position: 1, titel: 'Hook', created_at: '2026-01-01' },
    { id: 'v2', kooperation_id: 'k2', position: 1, titel: 'Direkt', created_at: '2026-01-02' }
  ],
  stories: [],
  videoAssets: [
    { id: 'a1', video_id: 'v1', version_number: 1, variant_name: 'A', is_final: false, created_at: '2026-02-01' },
    { id: 'a2', video_id: 'v1', version_number: 1, variant_name: 'B', is_final: false, created_at: '2026-02-02' },
    { id: 'f1', video_id: 'v1', version_number: 1, variant_name: '9:16', is_final: true, source_asset_id: 'a1', created_at: '2026-03-01' },
    { id: 'f2', video_id: 'v1', version_number: 1, variant_name: '4:5', is_final: true, source_asset_id: 'a1', created_at: '2026-03-02' },
    { id: 'f3', video_id: 'v1', version_number: 1, variant_name: '9:16', is_final: true, source_asset_id: 'a2', created_at: '2026-03-03' },
    { id: 'f4', video_id: 'v2', version_number: 1, variant_name: '9:16', is_final: true, source_asset_id: null, created_at: '2026-03-04' }
  ],
  storyAssets: [],
  stillAssets: [],
  rohmaterial: [],
  slotNotes: [],
  zeitkommentare: [],
  tagTypen: [
    { id: 't1', label: 'Persona A', gruppe: 'Persona' },
    { id: 't2', label: 'TikTok', gruppe: 'Plattform' }
  ],
  varianteTags: [
    { video_id: 'v1', variant_key: 'videoA', tag_typ_id: 't1', created_at: '1' },
    { video_id: 'v1', variant_key: 'videoA', tag_typ_id: 't2', created_at: '2' },
    { video_id: 'v1', variant_key: 'videoB', tag_typ_id: 't2', created_at: '3' }
  ]
};

vi.mock('../modules/video-browser/VideoBrowserAdapter.js', () => ({
  loadVideoBrowserData: vi.fn(async () => structuredClone(RAW)),
  saveWiedergabeMessung: vi.fn(),
  saveVideoCaption: vi.fn(async () => null)
}));

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

const lightboxPlayer = { opts: null, destroyed: 0 };
vi.mock('../modules/video-browser/VideoBrowserPlayer.js', () => ({
  mountPlayer: (host, opts) => {
    host.innerHTML = '<div data-vb-frame></div>';
    lightboxPlayer.opts = opts;
    return {
      seek: vi.fn(), getTime: () => 0, setMarkers: vi.fn(), markerEl: () => null, pause: vi.fn(), play: vi.fn(),
      destroy: () => { lightboxPlayer.destroyed += 1; },
      getDimensions: () => null, whenReady: () => Promise.resolve()
    };
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

const { mountVideoBrowserPane, unmountVideoBrowser } = await import('../modules/video-browser/VideoBrowser.js');

function setup({ team = true, search = '' } = {}) {
  window.canFeature = (name) => ({
    videoTeamSicht: team, mediaUpload: team, skriptKommentieren: true, mediaDownload: true
  }[name] ?? false);
  window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} });
  window.history.replaceState(null, '', `/produktion/p1?tab=videos${search}`);
  const pane = document.createElement('div');
  document.body.appendChild(pane);
  const detail = { kampagneId: 'kamp', produktionId: 'p1', linien: [], linieAlle: false, linieId: null, produktion: { name: 'Prod' } };
  return { pane, detail };
}

const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const tiles = (pane) => [...pane.querySelectorAll('[data-vb-sc-tile]')];
const tileIds = (pane) => tiles(pane).map(t => t.dataset.itemId);
const seg = (pane, id, value) => pane.querySelector(`[data-vb-seg="${id}"] [data-value="${value}"]`);
const key = (k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

describe('VideoBrowser Showcase', () => {
  let ctx;
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { if (ctx) unmountVideoBrowser(ctx.detail); });

  async function openShowcase(opts) {
    ctx = setup(opts);
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    if (!opts?.search) click(seg(ctx.pane, 'view', 'showcase'));
    return ctx;
  }

  it('schaltet auf Showcase, blendet den Spaltenbrowser aus und spiegelt Ansicht und Einstellungen in die URL', async () => {
    await openShowcase();
    expect(ctx.pane.querySelector('[data-vb]').dataset.vbView).toBe('showcase');
    expect(ctx.pane.querySelector('[data-vb-showcase]').hidden).toBe(false);
    expect(seg(ctx.pane, 'view', 'showcase').getAttribute('aria-checked')).toBe('true');
    expect(window.location.search).toContain('ansicht=showcase');
    expect(window.location.search).toContain('format=9x16');
    expect(window.location.search).toContain('tab=videos');

    click(seg(ctx.pane, 'view', 'ordner'));
    expect(ctx.pane.querySelector('[data-vb]').dataset.vbView).toBe('ordner');
    expect(ctx.pane.querySelector('[data-vb-showcase]').hidden).toBe(true);
    expect(window.location.search).not.toContain('ansicht');
    expect(ctx.pane.querySelectorAll('.vb-col').length).toBeGreaterThan(0);
  });

  it('setzt den Ansicht-Umschalter in die Workflow-Tab-Zeile (ViewModeToggle) und nimmt ihn beim Abbau mit', async () => {
    ctx = setup();
    document.body.innerHTML = '<div class="kampagne-detail-body"><div class="tab-navigation"><div data-workflow-liste-slot></div></div></div>';
    const body = document.querySelector('.kampagne-detail-body');
    ctx.pane = body.appendChild(document.createElement('div'));
    await mountVideoBrowserPane(ctx.detail, ctx.pane);

    const slot = body.querySelector('[data-workflow-liste-slot]');
    expect(ctx.pane.querySelector('[data-vb-toolbar]')).toBeNull();
    expect(slot.querySelectorAll('[data-vb-seg="view"].view-toggle .mdc-btn')).toHaveLength(2);
    expect(slot.querySelector('.mdc-btn.active').textContent.trim()).toBe('Ordner');

    click(slot.querySelector('[data-value="showcase"]'));
    expect(ctx.pane.querySelector('[data-vb]').dataset.vbView).toBe('showcase');
    expect(slot.querySelector('.mdc-btn.active').textContent.trim()).toBe('Showcase');
    // Die Umschalter im Showcase sind ebenfalls ViewModeToggles
    expect(ctx.pane.querySelectorAll('.vb-sc-bar .view-toggle .mdc-btn.active')).toHaveLength(4);

    unmountVideoBrowser(ctx.detail);
    expect(slot.innerHTML.trim()).toBe('');
  });

  it('zeigt je Variante die Finale Version im Seitenverhältnis, nach Creator gruppiert', async () => {
    await openShowcase();
    expect(tileIds(ctx.pane)).toEqual(['f1', 'f3', 'f4']);
    expect([...ctx.pane.querySelectorAll('.vb-sc-group__name')].map(n => n.textContent)).toEqual(['Mia Roth', 'Jan Voss']);
    expect(ctx.pane.querySelector('[data-vb-sc-summary]').textContent).toBe('3 Inhalte von 2 Creators');

    click(seg(ctx.pane, 'fmt', '4:5'));
    expect(tileIds(ctx.pane)).toEqual(['f2', 'f3', 'f4']);
    expect(window.location.search).toContain('format=4x5');
  });

  it('Filter: Einfachauswahl als Toggle, UND-verknüpft, leerer Zustand mit „Filter aufheben“', async () => {
    await openShowcase();
    const chip = (id) => ctx.pane.querySelector(`[data-vb-sc-filter="${id}"]`);
    click(chip('tag:t1'));
    expect(tileIds(ctx.pane)).toEqual(['f1']);
    expect(chip('tag:t1').getAttribute('aria-pressed')).toBe('true');
    expect(window.location.search).toContain('tag=t1');

    click(chip('tag:t1'));
    expect(tileIds(ctx.pane)).toEqual(['f1', 'f3', 'f4']);

    click(chip('tag:t1'));
    click(chip('typ:video'));
    // Persona A + Videos = f1
    expect(tileIds(ctx.pane)).toEqual(['f1']);

    click(chip('tag:t2'));
    expect(tileIds(ctx.pane)).toEqual(['f1', 'f3']);
  });

  it('Persona gruppiert über die Tag-Gruppe, „Ohne Persona“ zuletzt, Keine blendet die Köpfe aus', async () => {
    await openShowcase();
    click(seg(ctx.pane, 'group', 'persona'));
    expect([...ctx.pane.querySelectorAll('.vb-sc-group__name')].map(n => n.textContent)).toEqual(['Persona A', 'Ohne Persona']);

    click(seg(ctx.pane, 'group', 'keine'));
    expect(ctx.pane.querySelectorAll('.vb-sc-group__head')).toHaveLength(0);
    expect(tileIds(ctx.pane)).toEqual(['f1', 'f3', 'f4']);
  });

  it('Inhalt „Aktueller Stand“ steht in der URL, Finale tragen dort den Stern', async () => {
    await openShowcase();
    expect(window.location.search).toContain('inhalt=final');
    expect(ctx.pane.querySelector('.vb-sc-tile__mark')).toBeNull();

    click(seg(ctx.pane, 'inhalt', 'aktuell'));
    expect(window.location.search).toContain('inhalt=aktuell');
    expect(seg(ctx.pane, 'inhalt', 'aktuell').getAttribute('aria-checked')).toBe('true');
    expect(tileIds(ctx.pane)).toEqual(expect.arrayContaining(['f1', 'f3', 'f4']));
    expect(ctx.pane.querySelectorAll('.vb-sc-tile__mark--final').length).toBeGreaterThan(0);
  });

  it('Größe ändert nur die Kachelbreite, ohne die Kacheln neu zu bauen', async () => {
    await openShowcase();
    const before = tiles(ctx.pane)[0];
    click(seg(ctx.pane, 'size', 'L'));
    expect(ctx.pane.querySelector('[data-vb-showcase]').style.getPropertyValue('--tile')).toBe('240px');
    expect(tiles(ctx.pane)[0]).toBe(before);
    expect(window.location.search).toContain('groesse=L');
  });

  it('stellt Ansicht und Einstellungen aus der URL wieder her', async () => {
    ctx = setup({ search: '&ansicht=showcase&format=4x5&gruppe=keine&groesse=S&tag=t1' });
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    expect(ctx.pane.querySelector('[data-vb-showcase]').hidden).toBe(false);
    expect(tileIds(ctx.pane)).toEqual(['f2']);
    expect(seg(ctx.pane, 'size', 'S').getAttribute('aria-checked')).toBe('true');
  });

  it('Vollansicht blättert zyklisch über die Anzeigeliste, Esc schließt', async () => {
    await openShowcase();
    click(tiles(ctx.pane)[0]);
    await flush();
    expect(document.querySelector('.vb-sc-lightbox')).not.toBeNull();
    expect(document.querySelector('.vb-sc-box__count').textContent).toBe('1 / 3');
    expect(lightboxPlayer.opts.autoplay).toBe(true);

    key('ArrowLeft');
    await flush();
    expect(document.querySelector('.vb-sc-box__count').textContent).toBe('3 / 3');
    key('ArrowRight');
    await flush();
    expect(document.querySelector('.vb-sc-box__count').textContent).toBe('1 / 3');

    key('Escape');
    await flush();
    expect(document.querySelector('.vb-sc-lightbox')).toBeNull();
    expect(lightboxPlayer.destroyed).toBeGreaterThan(0);
  });

  it('„Im Ordner öffnen“ nur fürs Team und springt in die Finale Version', async () => {
    await openShowcase({ team: true });
    click(tiles(ctx.pane)[1]);
    await flush();
    const open = document.querySelector('[data-vb-sc-open-folder]');
    expect(open).not.toBeNull();
    click(open);
    await flush();
    expect(document.querySelector('.vb-sc-lightbox')).toBeNull();
    expect(ctx.pane.querySelector('[data-vb]').dataset.vbView).toBe('ordner');
    expect(window.location.search).toContain('f=final');
    expect(window.location.search).toContain('i=f3');
    expect(window.location.search).not.toContain('ansicht');
  });

  it('Kunde sieht „Im Ordner öffnen“ nicht', async () => {
    await openShowcase({ team: false });
    click(tiles(ctx.pane)[0]);
    await flush();
    expect(document.querySelector('.vb-sc-lightbox')).not.toBeNull();
    expect(document.querySelector('[data-vb-sc-open-folder]')).toBeNull();
  });
});
