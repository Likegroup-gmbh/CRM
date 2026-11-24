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

vi.mock('../modules/video-browser/VideoBrowserUpload.js', () => ({
  createUploader: () => ({ start: vi.fn(), destroy: vi.fn() })
}));

vi.mock('../modules/video-browser/VideoBrowserPlayer.js', () => ({
  mountPlayer: (host) => {
    host.innerHTML = '<div data-vb-frame></div>';
    return {
      seek: vi.fn(), getTime: () => 0, setMarkers: vi.fn(), markerEl: () => null, pause: vi.fn(), play: vi.fn(),
      destroy: vi.fn(), getDimensions: () => null, getDuration: () => 0, whenReady: () => Promise.resolve()
    };
  }
}));

vi.mock('../modules/video-browser/videoBrowserRatio.js', () => ({
  ratioOfItem: vi.fn(async () => null),
  ratioOfFile: vi.fn(async () => null)
}));

const { mountVideoBrowserPane, unmountVideoBrowser } = await import('../modules/video-browser/VideoBrowser.js');
const { RAW, click, seg, setup, tiles } = await import('./videoBrowserShowcaseTestKit.js');

const MIT_AUSSTEHEND = {
  ...RAW,
  videos: [...RAW.videos, { id: 'v3', kooperation_id: 'k1', position: 2, titel: 'Unboxing', created_at: '2026-01-03' }]
};

const sichtbar = (el) => !el.closest('[data-vb-suche-aus]');
const treffer = (pane) => tiles(pane).filter(sichtbar).map(t => t.dataset.itemId);
const koopRows = (pane) => [...pane.querySelectorAll('.vb-col--0 .vb-row[data-depth="0"]')].filter(sichtbar).map(b => b.dataset.id);
const videoRows = (pane) => [...pane.querySelectorAll('.vb-col--1 .vb-row[data-depth="1"]')].filter(sichtbar).map(b => b.dataset.id);

describe('VideoBrowser Suche', () => {
  let ctx;
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { if (ctx) unmountVideoBrowser(ctx.detail); });

  async function open(opts) {
    ctx = setup(opts);
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    return ctx;
  }
  const input = () => ctx.pane.querySelector('[data-vb-suche-input]');
  function tippe(text) {
    input().value = text;
    input().dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('Showcase: filtert live nach Creator, ohne Akzente, Gruppen ohne Treffer fallen weg', async () => {
    await open();
    const vorher = tiles(ctx.pane);
    tippe('vöss');
    expect(treffer(ctx.pane)).toEqual(['f4']);
    // Kein Neuaufbau: dieselben Kacheln, nur ausgeblendet
    expect(tiles(ctx.pane)).toEqual(vorher);
    const gruppen = [...ctx.pane.querySelectorAll('[data-vb-sc-group]')].filter(sichtbar);
    expect(gruppen.map(g => g.querySelector('.vb-sc-group__name').textContent)).toEqual(['Jan Voss']);
    expect(ctx.pane.querySelector('[data-vb-sc-summary]').textContent).toBe('1 Inhalt von 1 Creator');
    expect(ctx.pane.querySelector('[data-vb-suche]').classList.contains('is-aktiv')).toBe(true);
  });

  it('Showcase: trifft Videotitel und Tags, Indizes der Kacheln folgen den Treffern', async () => {
    await open();
    tippe('hook');
    expect(treffer(ctx.pane)).toEqual(['f1', 'f3']);
    tippe('persona');
    expect(treffer(ctx.pane)).toEqual(['f1']);
    tippe('jan');
    const f4 = tiles(ctx.pane).find(t => t.dataset.itemId === 'f4');
    expect(f4.dataset.index).toBe('0');
    expect(tiles(ctx.pane).filter(t => t.dataset.index !== undefined)).toHaveLength(1);
  });

  it('Showcase: Status-Zähler und Gruppenzähler zählen nur die Treffer', async () => {
    await open({ raw: MIT_AUSSTEHEND });
    tippe('unbox');
    expect(treffer(ctx.pane)).toEqual(['ausstehend:v3']);
    const count = (v) => ctx.pane.querySelector(`[data-vb-seg="status"] [data-value="${v}"]`).dataset.count;
    expect(count('ausstehend')).toBe('1');
    expect(count('freigegeben')).toBe('0');
    expect(ctx.pane.querySelector('[data-vb-sc-group]:not([data-vb-suche-aus]) .vb-sc-group__count').textContent).toBe('0 Inhalte');
  });

  it('kein Treffer: leerer Zustand mit „Suche leeren“, Escape leert ebenfalls', async () => {
    await open();
    tippe('gibtsnicht');
    expect(treffer(ctx.pane)).toEqual([]);
    const leer = ctx.pane.querySelector('[data-vb-sc-grid] [data-vb-suche-leer]');
    expect(leer.textContent).toContain('„gibtsnicht“');
    click(leer.querySelector('[data-vb-suche-clear]'));
    expect(input().value).toBe('');
    expect(treffer(ctx.pane)).toEqual(['f1', 'f3', 'f4']);
    expect(ctx.pane.querySelector('[data-vb-suche-leer]')).toBeNull();

    tippe('mia');
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(input().value).toBe('');
    expect(treffer(ctx.pane)).toHaveLength(3);
  });

  it('Chips und Suche wirken zusammen, ein Neuaufbau behält die Suche', async () => {
    await open();
    tippe('mia');
    click(ctx.pane.querySelector('[data-vb-sc-filter="tag:t2"]'));
    expect(treffer(ctx.pane)).toEqual(['f1', 'f3']);
    click(ctx.pane.querySelector('[data-vb-sc-filter="tag:t1"]'));
    expect(treffer(ctx.pane)).toEqual(['f1']);
  });

  it('Ordner: Spalte 0 zeigt treffende Kooperationen, Spalte 1 die treffenden Videos, Enter öffnet den Treffer', async () => {
    await open({ raw: MIT_AUSSTEHEND });
    tippe('unbox');
    click(seg(ctx.pane, 'view', 'ordner'));
    // Der Wechsel der Ansicht behält die Suche
    expect(input().value).toBe('unbox');
    expect(koopRows(ctx.pane)).toEqual(['k1']);

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(window.location.search).toContain('k=k1');
    expect(window.location.search).toContain('v=v3');
    expect(videoRows(ctx.pane)).toEqual(['v3']);

    tippe('mia');
    expect(videoRows(ctx.pane)).toEqual(['v1', 'v3']);
    tippe('');
    expect(koopRows(ctx.pane).sort()).toEqual(['k1', 'k2']);
  });

  it('Ordner: kein Treffer zeigt den leeren Zustand in Spalte 0', async () => {
    await open({ search: '&ansicht=ordner' });
    tippe('xyz');
    expect(koopRows(ctx.pane)).toEqual([]);
    expect(ctx.pane.querySelector('.vb-col--0 [data-vb-suche-leer]')).not.toBeNull();
  });

  it('„/“ springt ins Suchfeld, nicht aus einem anderen Eingabefeld heraus', async () => {
    await open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(input());
    input().blur();
    const anderes = document.body.appendChild(document.createElement('input'));
    anderes.focus();
    anderes.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(anderes);
  });
});
