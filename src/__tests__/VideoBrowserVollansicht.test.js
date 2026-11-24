import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../modules/video-browser/VideoBrowserUpload.js', async () => {
  const { kit } = await import('./videoBrowserShowcaseTestKit.js');
  return {
    createUploader: () => {
      kit.uploader = { start: vi.fn(async () => {}), destroy: vi.fn() };
      return kit.uploader;
    }
  };
});

vi.mock('../modules/video-browser/VideoBrowserPlayer.js', async () => {
  const { kit } = await import('./videoBrowserShowcaseTestKit.js');
  return {
    mountPlayer: (host, opts) => {
      host.innerHTML = '<div data-vb-frame></div>';
      kit.player.opts = opts;
      return {
        seek: vi.fn(), getTime: () => 0, setMarkers: vi.fn(), markerEl: () => null, pause: vi.fn(), play: vi.fn(),
        destroy: () => { kit.player.destroyed += 1; },
        getDimensions: () => null, getDuration: () => 12, whenReady: () => Promise.resolve()
      };
    }
  };
});

vi.mock('../modules/video-browser/videoBrowserKalenderData.js', async (importOriginal) => ({
  ...(await importOriginal()),
  savePostingDatum: vi.fn(async () => {})
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
const { savePostingDatum } = await import('../modules/video-browser/videoBrowserKalenderData.js');
const { fitFrame } = await import('../modules/video-browser/videoBrowserLogic.js');
const { RAW, click, flush, key, kit, setup, tileIds, tiles } = await import('./videoBrowserShowcaseTestKit.js');

const LINKS = {
  v1: {
    idee: { id: 'i1', beschreibung: 'Morgenroutine', strategieId: 's1', produkt: { id: 'pr1', name: 'Serum' } },
    skript: { id: 'sk1', titel: 'Skript Hook', status: 'freigegeben', briefingId: null },
    ideeVirtuell: true,
    skriptVirtuell: false
  }
};
/** Dazu ein drittes Video von Mia ohne Datei, mit Posting-Datum. */
const MIT_AUSSTEHEND = {
  ...RAW,
  videos: [...RAW.videos, { id: 'v3', kooperation_id: 'k1', position: 2, titel: 'Unboxing', posting_datum: '2026-12-01', created_at: '2026-01-03' }],
  links: LINKS
};

const voll = () => document.querySelector('.vb-voll-lightbox');
const count = () => voll()?.querySelector('.vb-voll__count')?.textContent;
const prop = (label) => [...voll().querySelectorAll('.vb-prop')]
  .find(p => p.querySelector('.vb-prop__label span')?.textContent === label) || null;
const settle = async () => { await flush(); await flush(); };

describe('Vollansicht', () => {
  let ctx;
  beforeEach(() => {
    document.body.innerHTML = '';
    kit.player = { opts: null, destroyed: 0 };
    window.navigateTo = vi.fn();
  });
  afterEach(() => { if (ctx) unmountVideoBrowser(ctx.detail); });

  async function mount(opts) {
    ctx = setup({ raw: MIT_AUSSTEHEND, ...opts });
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    await settle();
    return ctx;
  }

  async function openTile(index) {
    click(tiles(ctx.pane)[index]);
    await settle();
  }

  it('Showcase: blättert zyklisch über die Anzeigeliste, die URL trägt die Auswahl nur solange sie offen ist', async () => {
    await mount();
    expect(tileIds(ctx.pane)).toEqual(['f1', 'f3', 'ausstehend:v3', 'f4']);
    expect(window.location.search).not.toContain('k=');

    await openTile(0);
    expect(voll()).not.toBeNull();
    expect(count()).toBe('1 / 4');
    expect(kit.player.opts.autoplay).toBe(true);
    expect(voll().querySelector('[data-vb-voll-panel="feedback"]')).not.toBeNull();
    expect(voll().querySelector('[data-vb-voll-panel="details"]')).not.toBeNull();
    expect(window.location.search).toContain('ansicht=showcase');
    expect(window.location.search).toContain('i=f1');

    key('ArrowLeft');
    await settle();
    expect(count()).toBe('4 / 4');
    expect(window.location.search).toContain('i=f4');
    key('ArrowRight');
    await settle();
    expect(count()).toBe('1 / 4');

    key('Escape');
    await settle();
    expect(voll()).toBeNull();
    expect(kit.player.destroyed).toBeGreaterThan(0);
    expect(window.location.search).not.toContain('k=');
    expect(window.location.search).toContain('ansicht=showcase');
  });

  it('ein Showcase-Link mit Auswahl öffnet die Vollansicht an dieser Kachel', async () => {
    await mount({ search: '&ansicht=showcase&k=k1&v=v1&f=final&i=f3' });
    expect(ctx.pane.querySelector('[data-vb]').dataset.vbView).toBe('showcase');
    expect(count()).toBe('2 / 4');
  });

  it('Team: Details mit Verknüpfungen, ein Link schließt und navigiert', async () => {
    await mount();
    await openTile(0);
    expect(prop('Creator').querySelector('a[data-vb-voll-link]').getAttribute('href')).toBe('/creator/c1');
    expect(prop('Kooperation').querySelector('a').getAttribute('href')).toBe('/kooperation/k1');
    expect(prop('Videoidee').querySelector('a').getAttribute('href')).toBe('/konzepte/s1');
    expect(prop('Videoidee').textContent).toContain('automatisch');
    expect(prop('Skript').querySelector('a').getAttribute('href')).toBe('/skripte/sk1');
    expect(prop('Produkt').querySelector('a').getAttribute('href')).toBe('/produkt/pr1');
    expect(prop('Dauer').textContent).toContain('0:12');
    // Den Ad Manager gibt es nur im Ordner
    expect(prop('Dateiname')).toBeNull();

    const linkClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    prop('Creator').querySelector('a').dispatchEvent(linkClick);
    expect(linkClick.defaultPrevented).toBe(true);
    await settle();
    expect(voll()).toBeNull();
    expect(window.navigateTo).toHaveBeenCalledWith('/creator/c1');
  });

  it('Kunde: Creator und Skript ohne Link, keine Videoidee, Kooperation und Produkt', async () => {
    await mount({ team: false });
    await openTile(0);
    expect(prop('Creator').querySelector('a')).toBeNull();
    expect(prop('Creator').textContent).toContain('Mia Roth');
    expect(prop('Skript').querySelector('a')).toBeNull();
    expect(prop('Skript').textContent).toContain('Skript Hook');
    expect(prop('Videoidee')).toBeNull();
    expect(prop('Kooperation')).toBeNull();
    expect(prop('Produkt')).toBeNull();
    expect(voll().querySelector('[data-vb-final-toggle]')).toBeNull();
    expect(voll().querySelector('[data-vb-voll-folder]')).not.toBeNull();
  });

  it('„Im Ordner öffnen“ springt in die Datei, der Ordner schreibt ansicht=ordner', async () => {
    await mount({ team: false });
    await openTile(1);
    click(voll().querySelector('[data-vb-voll-folder]'));
    await settle();
    expect(voll()).toBeNull();
    expect(ctx.pane.querySelector('[data-vb]').dataset.vbView).toBe('ordner');
    expect(window.location.search).toContain('f=final');
    expect(window.location.search).toContain('i=f3');
    expect(window.location.search).toContain('ansicht=ordner');
  });

  it('Posting-Datum ist für das Team editierbar', async () => {
    await mount();
    await openTile(0);
    const input = voll().querySelector('.custom-date-picker__input[data-field="posting_datum"]');
    input.dataset.isoValue = '2026-12-24';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(savePostingDatum).toHaveBeenCalledWith('v1', '2026-12-24');
  });

  it('Esc in einem Feld schließt die Vollansicht nicht', async () => {
    await mount();
    await openTile(0);
    const textarea = voll().querySelector('textarea');
    textarea.focus();
    key('Escape', textarea);
    await settle();
    expect(voll()).not.toBeNull();
  });
});

describe('Ausstehende Videos', () => {
  let ctx;
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { if (ctx) unmountVideoBrowser(ctx.detail); });

  async function mount(opts) {
    ctx = setup({ raw: MIT_AUSSTEHEND, ...opts });
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    await settle();
  }
  const ausTile = () => ctx.pane.querySelector('[data-item-id="ausstehend:v3"]');

  it('Team: Kachel mit Video-Nr, Hinweis, Datum und Skript-Status, der Creator-Kopf zählt hochgeladen', async () => {
    await mount();
    const tile = ausTile();
    expect(tile.textContent).toContain('Video 2');
    expect(tile.textContent).toContain('Unboxing');
    expect(tile.textContent).toContain('Noch keine Datei');
    expect(tile.textContent).toContain('1.12.2026');
    expect(tile.hasAttribute('data-vb-sc-aus')).toBe(true);
    const heads = [...ctx.pane.querySelectorAll('[data-vb-sc-upload-count]')].map(h => h.textContent.trim());
    expect(heads).toEqual(['1 von 2 hochgeladen', '1 von 1 hochgeladen']);
    expect(ctx.pane.querySelector('[data-vb-sc-summary]').textContent).toBe('3 Inhalte von 2 Creators · 1 ausstehend');
  });

  it('Tag- und Bilder-Filter blenden sie aus', async () => {
    await mount();
    click(ctx.pane.querySelector('[data-vb-sc-filter="tag:t2"]'));
    expect(tileIds(ctx.pane)).not.toContain('ausstehend:v3');
  });

  it('Team: Datei auf die Kachel ziehen lädt in die nächste leere Feedbackschleife', async () => {
    await mount();
    const file = new File(['x'], 'v3.mp4', { type: 'video/mp4' });
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    drop.dataTransfer = { types: ['Files'], files: [file] };
    ausTile().dispatchEvent(drop);
    expect(kit.uploader.start).toHaveBeenCalledTimes(1);
    const { row, folder, files } = kit.uploader.start.mock.calls[0][0];
    expect([row.id, folder.kind, folder.id, files]).toEqual(['v3', 'schleife', 's1', [file]]);
  });

  it('Team: in der Vollansicht eine Upload-Zone, die Datei geht in dieselbe Schleife', async () => {
    await mount();
    click(ausTile());
    await settle();
    expect(count()).toBe('3 / 4');
    const input = voll().querySelector('[data-vb-voll-file]');
    const file = new File(['x'], 'v3.mp4', { type: 'video/mp4' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(kit.uploader.start.mock.calls[0][0].folder.id).toBe('s1');
    expect(voll().querySelector('[data-vb-voll-region="feedback"]').textContent).toContain('erste Version');
  });

  it('die Bühne ist so groß wie der Rahmen eines 9:16-Players, die Lightbox springt beim Blättern nicht', async () => {
    await mount();
    click(tiles(ctx.pane)[1]);
    await settle();
    const { maxWidth, maxHeight } = kit.player.opts;
    const rahmen = fitFrame('9:16', Math.max(120, maxWidth()), maxHeight());
    key('ArrowRight');
    await settle();
    const buehne = voll().querySelector('.vb-voll-aus');
    expect([buehne.style.width, buehne.style.height]).toEqual([`${rahmen.w}px`, `${rahmen.h}px`]);
  });

  it('Kunde: „In Produktion“ ohne Upload', async () => {
    await mount({ team: false });
    expect(ausTile().textContent).toContain('In Produktion');
    expect(ausTile().hasAttribute('data-vb-sc-aus')).toBe(false);
    click(ausTile());
    await settle();
    expect(voll().querySelector('[data-vb-voll-drop]')).toBeNull();
    expect(voll().querySelector('.vb-voll-aus__title').textContent).toContain('in Produktion');
  });
});

describe('Vollansicht aus dem Ordner', () => {
  let ctx;
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { if (ctx) unmountVideoBrowser(ctx.detail); });

  it('blättert durch die Dateien des Ordners, beim Schließen folgt die Auswahl', async () => {
    ctx = setup({ search: '&ansicht=ordner&k=k1&v=v1&f=final&i=f1' });
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    await settle();
    click(ctx.pane.querySelector('[data-vb-voll-open]'));
    await settle();
    expect(count()).toMatch(/ \/ 3$/);
    const start = Number(count().split(' / ')[0]);

    key('ArrowRight');
    await settle();
    expect(Number(count().split(' / ')[0])).toBe((start % 3) + 1);
    expect(window.location.search).toContain('ansicht=ordner');

    key('Escape');
    await settle();
    expect(voll()).toBeNull();
    expect(window.location.search).not.toContain('i=f1');
    expect(window.location.search).toMatch(/i=f[23]/);
  });

  it('Team sieht die Final-Leiste unter dem Player', async () => {
    ctx = setup({ search: '&k=k1&v=v1&f=s1&i=a2' });
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    await settle();
    click(ctx.pane.querySelector('[data-vb-voll-open]'));
    await settle();
    expect(voll().querySelector('[data-vb-voll-region="final"] [data-vb-final-toggle]')).not.toBeNull();
  });
});
