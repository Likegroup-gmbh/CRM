import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateLocal } from '../core/calendarDates.js';
import { CALENDAR_DRAG_TYPE } from '../core/components/calendarGridDnd.js';

const HEUTE = formatDateLocal(new Date());

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
  videoAssets: [],
  storyAssets: [],
  stillAssets: [],
  rohmaterial: [],
  slotNotes: [],
  zeitkommentare: [],
  tagTypen: [],
  varianteTags: []
};

const koop = (id, produktionId, vorname) => ({
  id, name: `Koop ${id}`, produktion_id: produktionId, briefing_id: null, kampagne_id: 'kamp',
  creator: { vorname, nachname: 'Test' }, linie: null
});
const POSTING = [
  { id: 'v1', kooperation_id: 'k1', position: 1, titel: 'Hook', posting_datum: HEUTE, created_at: '1', kooperation: koop('k1', 'p1', 'Mia') },
  { id: 'v2', kooperation_id: 'k2', position: 1, titel: 'Direkt', posting_datum: null, created_at: '2', kooperation: koop('k2', 'p1', 'Jan') },
  { id: 'v9', kooperation_id: 'k9', position: 1, titel: 'Fremd', posting_datum: HEUTE, created_at: '3', kooperation: koop('k9', 'p2', 'Lea') }
];

vi.mock('../modules/video-browser/VideoBrowserAdapter.js', () => ({
  loadVideoBrowserData: vi.fn(async () => structuredClone(RAW)),
  saveWiedergabeMessung: vi.fn(),
  saveVideoCaption: vi.fn(async () => null)
}));

vi.mock('../modules/video-browser/videoBrowserKalenderData.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadPostingVideos: vi.fn(async () => structuredClone(POSTING)),
  savePostingDatum: vi.fn(async () => {})
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

vi.mock('../modules/video-browser/VideoBrowserPlayer.js', () => ({
  mountPlayer: (host) => {
    host.innerHTML = '<div data-vb-frame></div>';
    return {
      seek: vi.fn(), getTime: () => 0, setMarkers: vi.fn(), markerEl: () => null, pause: vi.fn(), play: vi.fn(),
      destroy: vi.fn(), getDimensions: () => null, whenReady: () => Promise.resolve()
    };
  }
}));

vi.mock('../modules/video-browser/videoBrowserRatio.js', () => ({
  ratioOfItem: vi.fn(async () => null),
  ratioOfFile: vi.fn(async () => null)
}));

const { mountVideoBrowserPane, unmountVideoBrowser } = await import('../modules/video-browser/VideoBrowser.js');
const { savePostingDatum } = await import('../modules/video-browser/videoBrowserKalenderData.js');

function setup({ team = true, search = '' } = {}) {
  window.canFeature = (name) => ({
    videoTeamSicht: team, mediaUpload: team, skriptKommentieren: true, mediaDownload: true
  }[name] ?? false);
  window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} });
  window.toastSystem = { show: vi.fn() };
  window.history.replaceState(null, '', `/produktion/p1?tab=videos${search}`);
  const pane = document.createElement('div');
  document.body.appendChild(pane);
  const detail = { kampagneId: 'kamp', produktionId: 'p1', linien: [], linieAlle: false, linieId: null, produktion: { name: 'Prod' } };
  return { pane, detail };
}

const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const seg = (root, id, value) => root.querySelector(`[data-vb-seg="${id}"] [data-value="${value}"]`);
const eventIds = (pane) => [...pane.querySelectorAll('[data-vb-kalender] [data-cal-event]')].map(el => el.dataset.calEvent);
const cardIds = (pane) => [...pane.querySelectorAll('[data-vb-kal-card]')].map(el => el.dataset.vbKalCard);

function dragEvent(type, data = {}) {
  const store = new Map(Object.entries(data));
  const e = new Event(type, { bubbles: true, cancelable: true });
  e.dataTransfer = {
    types: [...store.keys()],
    getData: (t) => store.get(t) || '',
    setData: (t, v) => store.set(t, v),
    effectAllowed: 'none',
    dropEffect: 'none'
  };
  return e;
}

describe('VideoBrowser Kalender', () => {
  let ctx;
  beforeEach(() => {
    document.body.innerHTML = '';
    savePostingDatum.mockReset();
    savePostingDatum.mockResolvedValue(undefined);
  });
  afterEach(() => { if (ctx) unmountVideoBrowser(ctx.detail); });

  async function openKalender(opts) {
    ctx = setup(opts);
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    if (!opts?.search) click(seg(ctx.pane, 'view', 'kalender'));
    await flush();
    return ctx;
  }

  it('schaltet auf Kalender, zeigt Videos mit Posting-Datum der Produktion und die Liste ohne Datum', async () => {
    await openKalender();
    const root = ctx.pane.querySelector('[data-vb]');
    expect(root.dataset.vbView).toBe('kalender');
    expect(ctx.pane.querySelector('[data-vb-kalender]').hidden).toBe(false);
    expect(ctx.pane.querySelector('[data-vb-showcase]').hidden).toBe(true);
    expect(window.location.search).toContain('ansicht=kalender');
    expect(eventIds(ctx.pane)).toEqual(['v1']);
    expect(cardIds(ctx.pane)).toEqual(['v2']);
    expect(ctx.pane.querySelector('[data-vb-kal-count]').textContent).toBe('1');
    expect(ctx.pane.querySelector('[data-vb-kal-card="v2"] .vb-kal-card__titel').textContent).toBe('Direkt');

    click(seg(ctx.pane, 'view', 'ordner'));
    expect(root.dataset.vbView).toBe('ordner');
    expect(ctx.pane.querySelector('[data-vb-kalender]').hidden).toBe(true);
    expect(window.location.search).toContain('ansicht=ordner');
    expect(window.location.search).not.toContain('ansicht=kalender');
  });

  it('Umfang Gesamte Kampagne nimmt andere Produktionen dazu und steht in der URL', async () => {
    await openKalender();
    click(seg(ctx.pane, 'umfang', 'kampagne'));
    expect(eventIds(ctx.pane).sort()).toEqual(['v1', 'v9']);
    expect(window.location.search).toContain('umfang=kampagne');
    expect(seg(ctx.pane, 'umfang', 'kampagne').getAttribute('aria-checked')).toBe('true');
  });

  it('öffnet per Link in der Woche und schreibt Woche und Datum zurück', async () => {
    await openKalender({ search: '&ansicht=kalender&modus=woche' });
    expect(ctx.pane.querySelector('.calendar-week-grid')).not.toBeNull();
    click(ctx.pane.querySelector('[data-cal-nav="next"]'));
    expect(window.location.search).toContain('modus=woche');
    expect(window.location.search).toMatch(/datum=\d{4}-\d{2}-\d{2}/);
    click(ctx.pane.querySelector('[data-cal-nav="today"]'));
    expect(window.location.search).not.toContain('datum=');
  });

  it('Team: Karte aus der Liste auf einen Tag setzt das Posting-Datum, zurück auf die Liste entfernt es', async () => {
    await openKalender();
    const tag = ctx.pane.querySelector(`[data-vb-kalender] [data-cal-drop="${HEUTE}"]`);
    tag.dispatchEvent(dragEvent('drop', { [CALENDAR_DRAG_TYPE]: 'v2', 'application/x-vb-kal-liste': '1' }));
    await flush();
    expect(savePostingDatum).toHaveBeenCalledWith('v2', HEUTE);
    expect(eventIds(ctx.pane).sort()).toEqual(['v1', 'v2']);
    expect(cardIds(ctx.pane)).toEqual([]);

    const liste = ctx.pane.querySelector('[data-vb-kal-liste]');
    const over = dragEvent('dragover', { [CALENDAR_DRAG_TYPE]: 'v1' });
    liste.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    liste.dispatchEvent(dragEvent('drop', { [CALENDAR_DRAG_TYPE]: 'v1' }));
    await flush();
    expect(savePostingDatum).toHaveBeenCalledWith('v1', null);
    expect(cardIds(ctx.pane)).toEqual(['v1']);
  });

  it('Karten aus der Liste fallen nicht auf die eigene Liste zurück', async () => {
    await openKalender();
    const liste = ctx.pane.querySelector('[data-vb-kal-liste]');
    const over = dragEvent('dragover', { [CALENDAR_DRAG_TYPE]: 'v2', 'application/x-vb-kal-liste': '1' });
    liste.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(false);
  });

  it('Speicherfehler springt zurück und meldet es', async () => {
    savePostingDatum.mockRejectedValueOnce(new Error('rls'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await openKalender();
    const tag = ctx.pane.querySelector(`[data-vb-kalender] [data-cal-drop="${HEUTE}"]`);
    tag.dispatchEvent(dragEvent('drop', { [CALENDAR_DRAG_TYPE]: 'v2' }));
    await flush();
    expect(cardIds(ctx.pane)).toEqual(['v2']);
    expect(eventIds(ctx.pane)).toEqual(['v1']);
    expect(window.toastSystem.show).toHaveBeenCalledWith('Posting-Datum konnte nicht gespeichert werden.', 'error');
    err.mockRestore();
  });

  it('die Suche des Tabs filtert Liste und Einträge nach Creator, die Liste hat kein eigenes Feld', async () => {
    await openKalender();
    expect(ctx.pane.querySelector('[data-vb-kal-liste] input')).toBeNull();
    const input = ctx.pane.querySelector('[data-vb-suche-input]');
    input.value = 'mia';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(cardIds(ctx.pane)).toEqual([]);
    expect(eventIds(ctx.pane)).toEqual(['v1']);
    expect(ctx.pane.querySelector('[data-vb-kal-cards]').textContent).toContain('Keine Treffer');
    input.value = 'jan';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(cardIds(ctx.pane)).toEqual(['v2']);
    expect(eventIds(ctx.pane)).toEqual([]);
  });

  it('Kunde: keine Liste, nichts ziehbar, Hinweis auf Videos ohne Posting-Datum', async () => {
    await openKalender({ team: false });
    expect(ctx.pane.querySelector('[data-vb-kal-liste]')).toBeNull();
    expect(ctx.pane.querySelector('[data-vb-kalender] [data-cal-event][draggable]')).toBeNull();
    const hinweis = ctx.pane.querySelector('[data-vb-kal-hinweis]');
    expect(hinweis.hidden).toBe(false);
    expect(hinweis.textContent).toBe('1 Video ohne Posting-Datum');
  });
});
