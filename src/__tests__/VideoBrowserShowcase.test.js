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

vi.mock('../core/PromoteFinalAsset.js', () => ({
  promoteAssetToFinal: vi.fn(async () => ({})),
  unmarkFinalSlot: vi.fn(async () => {})
}));

vi.mock('../modules/video-browser/videoBrowserRatio.js', () => ({
  ratioOfItem: vi.fn(async () => null),
  ratioOfFile: vi.fn(async () => null)
}));

const { mountVideoBrowserPane, unmountVideoBrowser } = await import('../modules/video-browser/VideoBrowser.js');
const { RAW, click, seg, setup, tileIds, tiles } = await import('./videoBrowserShowcaseTestKit.js');

/** Dazu ein zweites Video von Mia ohne Datei. */
const MIT_AUSSTEHEND = {
  ...RAW,
  videos: [...RAW.videos, { id: 'v3', kooperation_id: 'k1', position: 2, titel: 'Unboxing', created_at: '2026-01-03' }]
};

describe('VideoBrowser Showcase', () => {
  let ctx;
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { if (ctx) unmountVideoBrowser(ctx.detail); });

  async function openShowcase(opts) {
    ctx = setup(opts);
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    return ctx;
  }

  it('Showcase ist Standard und spiegelt Ansicht und Einstellungen in die URL, der Ordner schreibt ansicht=ordner', async () => {
    await openShowcase();
    expect(ctx.pane.querySelector('[data-vb]').dataset.vbView).toBe('showcase');
    expect(ctx.pane.querySelector('[data-vb-showcase]').hidden).toBe(false);
    expect(seg(ctx.pane, 'view', 'showcase').getAttribute('aria-checked')).toBe('true');
    expect(window.location.search).toContain('ansicht=showcase');
    expect(window.location.search).toContain('inhalt=aktuell');
    expect(window.location.search).not.toContain('format=');
    expect(window.location.search).not.toContain('status=');
    expect(window.location.search).toContain('tab=videos');

    click(seg(ctx.pane, 'view', 'ordner'));
    expect(ctx.pane.querySelector('[data-vb]').dataset.vbView).toBe('ordner');
    expect(ctx.pane.querySelector('[data-vb-showcase]').hidden).toBe(true);
    expect(window.location.search).toContain('ansicht=ordner');
    expect(window.location.search).not.toContain('inhalt=');
    expect(ctx.pane.querySelectorAll('.vb-col').length).toBeGreaterThan(0);
  });

  it('ein Link mit Auswahl ohne Ansicht öffnet den Ordner', async () => {
    await openShowcase({ search: '&k=k1&v=v1' });
    expect(ctx.pane.querySelector('[data-vb]').dataset.vbView).toBe('ordner');
    expect(window.location.search).toContain('k=k1');
    expect(window.location.search).toContain('ansicht=ordner');
  });

  it('setzt den Ansicht-Umschalter in die Workflow-Tab-Zeile (ViewModeToggle) und nimmt ihn beim Abbau mit', async () => {
    ctx = setup();
    document.body.innerHTML = '<div class="kampagne-detail-body"><div class="tab-navigation"><div data-workflow-liste-slot></div></div></div>';
    const body = document.querySelector('.kampagne-detail-body');
    ctx.pane = body.appendChild(document.createElement('div'));
    await mountVideoBrowserPane(ctx.detail, ctx.pane);

    const slot = body.querySelector('[data-workflow-liste-slot]');
    expect(ctx.pane.querySelector('[data-vb-toolbar]')).toBeNull();
    const buttons = [...slot.querySelectorAll('[data-vb-seg="view"].view-toggle .mdc-btn')];
    expect(buttons.map(b => b.textContent.trim())).toEqual(['Showcase', 'Ordner', 'Kalender']);
    expect(slot.querySelector('.mdc-btn.active').textContent.trim()).toBe('Showcase');
    // Die Umschalter im Showcase sind ebenfalls ViewModeToggles
    expect(ctx.pane.querySelectorAll('.vb-sc-bar .view-toggle .mdc-btn.active')).toHaveLength(4);

    click(slot.querySelector('[data-value="ordner"]'));
    expect(ctx.pane.querySelector('[data-vb]').dataset.vbView).toBe('ordner');
    expect(slot.querySelector('.mdc-btn.active').textContent.trim()).toBe('Ordner');

    unmountVideoBrowser(ctx.detail);
    expect(slot.innerHTML.trim()).toBe('');
  });

  it('zeigt je Variante die Finale Version in 9:16, nach Creator gruppiert, ohne Seitenverhältnis-Umschalter', async () => {
    await openShowcase();
    expect(tileIds(ctx.pane)).toEqual(['f1', 'f3', 'f4']);
    expect([...ctx.pane.querySelectorAll('.vb-sc-group__name')].map(n => n.textContent)).toEqual(['Mia Roth', 'Jan Voss']);
    expect(ctx.pane.querySelector('[data-vb-sc-summary]').textContent).toBe('3 Inhalte von 2 Creators');
    expect(ctx.pane.querySelector('[data-vb-seg="fmt"]')).toBeNull();
  });

  it('Status-Filter nach Inhalt und Gruppieren: Team-Labels, Zähler, URL, „Filter aufheben“', async () => {
    await openShowcase({ raw: MIT_AUSSTEHEND });
    const ids = [...ctx.pane.querySelectorAll('.vb-sc-bar [data-vb-seg]')].map(g => g.dataset.vbSeg);
    expect(ids).toEqual(['inhalt', 'group', 'status', 'size']);
    const opts = [...ctx.pane.querySelectorAll('[data-vb-seg="status"] [data-value]')];
    expect(opts.map(o => o.textContent.trim())).toEqual(['Alle', 'Feedback erhalten', 'Wartet auf Kunde', 'Ausstehend', 'Freigegeben']);
    expect(opts.map(o => o.dataset.count ?? null)).toEqual([null, '0', '0', '1', '3']);

    click(seg(ctx.pane, 'status', 'ausstehend'));
    expect(tileIds(ctx.pane)).toEqual(['ausstehend:v3']);
    expect(window.location.search).toContain('status=ausstehend');

    click(seg(ctx.pane, 'status', 'feedback'));
    expect(tileIds(ctx.pane)).toEqual([]);
    click(ctx.pane.querySelector('[data-vb-sc-filter-clear]'));
    expect(tileIds(ctx.pane)).toHaveLength(4);
    expect(seg(ctx.pane, 'status', 'alle').getAttribute('aria-checked')).toBe('true');
  });

  it('Kunde: dieselben Status mit Kunden-Labels, seine Aufgabe „Zu prüfen“ vorn', async () => {
    await openShowcase({ raw: MIT_AUSSTEHEND, team: false });
    const opts = [...ctx.pane.querySelectorAll('[data-vb-seg="status"] [data-value]')];
    expect(opts.map(o => o.textContent.trim())).toEqual(['Alle', 'Zu prüfen', 'Feedback gegeben', 'In Produktion', 'Freigegeben']);
    click(seg(ctx.pane, 'status', 'freigegeben'));
    expect(tileIds(ctx.pane)).toEqual(['f1', 'f3', 'f4']);
  });

  it('„Nur final“ sperrt den Status-Filter und setzt ihn auf „Alle“', async () => {
    await openShowcase({ search: '&ansicht=showcase&status=freigegeben' });
    expect(seg(ctx.pane, 'status', 'freigegeben').getAttribute('aria-checked')).toBe('true');
    click(seg(ctx.pane, 'inhalt', 'final'));
    await new Promise(resolve => setTimeout(resolve, 0));
    const field = ctx.pane.querySelector('[data-vb-seg="status"]').closest('.segment-field');
    expect(field.classList.contains('is-off')).toBe(true);
    expect(field.hasAttribute('inert')).toBe(true);
    expect(seg(ctx.pane, 'status', 'alle').getAttribute('aria-checked')).toBe('true');
    expect(window.location.search).not.toContain('status=');
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

  it('Gruppieren kennt nur Creator und Keine, Keine blendet die Köpfe aus', async () => {
    await openShowcase();
    expect([...ctx.pane.querySelectorAll('[data-vb-seg="group"] [data-value]')].map(b => b.dataset.value)).toEqual(['creator', 'keine']);

    click(seg(ctx.pane, 'group', 'keine'));
    expect(ctx.pane.querySelectorAll('.vb-sc-group__head')).toHaveLength(0);
    expect(tileIds(ctx.pane)).toEqual(['f1', 'f3', 'f4']);
  });

  it('Inhalt „Aktueller Stand“ steht vorn und ist Standard, Finale tragen dort den Stern', async () => {
    await openShowcase();
    expect([...ctx.pane.querySelectorAll('[data-vb-seg="inhalt"] [data-value]')].map(b => b.dataset.value)).toEqual(['aktuell', 'final']);
    expect(seg(ctx.pane, 'inhalt', 'aktuell').getAttribute('aria-checked')).toBe('true');
    expect(tileIds(ctx.pane)).toEqual(['f1', 'f3', 'f4']);
    expect(ctx.pane.querySelectorAll('.vb-sc-tile__mark--final').length).toBeGreaterThan(0);

    click(seg(ctx.pane, 'inhalt', 'final'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(window.location.search).toContain('inhalt=final');
    expect(ctx.pane.querySelector('.vb-sc-tile__mark')).toBeNull();
  });

  it('Größe ändert nur die Kachelbreite, ohne die Kacheln neu zu bauen', async () => {
    await openShowcase();
    const before = tiles(ctx.pane)[0];
    click(seg(ctx.pane, 'size', 'L'));
    expect(ctx.pane.querySelector('[data-vb-showcase]').style.getPropertyValue('--tile')).toBe('240px');
    expect(tiles(ctx.pane)[0]).toBe(before);
    expect(window.location.search).toContain('groesse=L');
  });

  it('stellt Ansicht und Einstellungen aus der URL wieder her, ein altes format= fällt weg', async () => {
    ctx = setup({ search: '&ansicht=showcase&format=4x5&gruppe=keine&groesse=S&tag=t1' });
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    expect(ctx.pane.querySelector('[data-vb-showcase]').hidden).toBe(false);
    expect(tileIds(ctx.pane)).toEqual(['f1']);
    expect(seg(ctx.pane, 'size', 'S').getAttribute('aria-checked')).toBe('true');
    expect(window.location.search).not.toContain('format=');
  });
});
