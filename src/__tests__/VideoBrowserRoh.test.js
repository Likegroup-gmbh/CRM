import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rohOrdnerBaum, rohOrdnerVonDatei, rohVerschiebbar, rohZielTyp } from '../modules/video-browser/videoBrowserRohOrdner.js';

const ROH = '/Firma/Medien/Sommer/Lisa/Rohmaterial';
const datei = (id, pfad, extra = {}) => ({
  id, kooperation_id: 'k1', file_name: pfad.split('/').pop(), file_path: pfad, file_size: 1024,
  ablage: 'sharepoint', drive_id: 'd1', item_id: `i-${id}`, created_at: '2026-01-10', ...extra
});

const REGISTER = [
  { item_id: 'root-roh', parent_item_id: 'koop', name: 'Rohmaterial', pfad: ROH, art: 'typ', kooperation_id: 'k1' },
  { item_id: 'o-anna', parent_item_id: 'root-roh', name: 'Anna Muster', pfad: `${ROH}/Anna Muster`, art: 'frei', kooperation_id: 'k1' },
  { item_id: 'o-final', parent_item_id: 'o-anna', name: 'final', pfad: `${ROH}/Anna Muster/final`, art: 'frei', kooperation_id: 'k1' },
  { item_id: 'o-bilder', parent_item_id: 'root-roh', name: 'Bilder', pfad: `${ROH}/Bilder`, art: 'frei', kooperation_id: 'k1' }
];

const RAW = {
  kooperationen: [{ id: 'k1', name: 'Koop A', briefing_id: null, creator: { vorname: 'Mia', nachname: 'Roth' } }],
  linien: [],
  videos: [
    { id: 'v1', kooperation_id: 'k1', position: 1, titel: 'Hook', created_at: '2026-01-01' },
    { id: 'v2', kooperation_id: 'k1', position: 2, titel: 'Zwei', created_at: '2026-01-02' }
  ],
  stories: [],
  videoAssets: [{ id: 'a1', video_id: 'v1', version_number: 1, variant_name: null, is_final: false, created_at: '2026-02-01' }],
  storyAssets: [],
  stillAssets: [],
  rohmaterial: [
    datei('r1', `${ROH}/Anna Muster/clip.mov`, { created_at: '2026-01-12' }),
    datei('r2', `${ROH}/Anna Muster/final/schnitt.mp4`, { created_at: '2026-01-11' }),
    datei('r3', `${ROH}/wurzel.jpg`),
    datei('r4', `${ROH}/pack.zip`, { created_at: '2026-01-09' })
  ],
  rohOrdner: REGISTER,
  slotNotes: [],
  zeitkommentare: []
};

describe('Rohmaterial-Unterordner (Logik)', () => {
  it('Ordner einer Datei relativ zu Rohmaterial/, auch ohne Register', () => {
    expect(rohOrdnerVonDatei(`${ROH}/Anna Muster/final/x.mov`, ROH)).toBe('Anna Muster/final');
    expect(rohOrdnerVonDatei(`${ROH}/x.mov`, ROH)).toBe('');
    expect(rohOrdnerVonDatei('/LikeGroup/U/K/Rohmaterial/Creator/x.mov')).toBe('Creator');
    expect(rohOrdnerVonDatei('/U/K/Rohmaterial/x.mov')).toBe('');
    expect(rohOrdnerVonDatei(null)).toBe('');
  });

  it('Baum: Register-Ordner auch leer, Ordner nur aus Pfaden, Eltern vor Kindern, Zähler', () => {
    const baum = rohOrdnerBaum(REGISTER, [...RAW.rohmaterial, datei('r9', `${ROH}/neu/x.mov`)]);
    expect(baum.wurzelItemId).toBe('root-roh');
    expect(baum.ordner.map(o => [o.pfad, o.tiefe, o.itemId, o.anzahl, o.gesamt])).toEqual([
      ['Anna Muster', 0, 'o-anna', 1, 2],
      ['Anna Muster/final', 1, 'o-final', 1, 1],
      ['Bilder', 0, 'o-bilder', 0, 0],
      ['neu', 0, null, 1, 1]
    ]);
  });

  it('verschiebbar sind nur Videos und Bilder in SharePoint', () => {
    expect(rohVerschiebbar(datei('a', '/R/Rohmaterial/a.MOV'))).toBe(true);
    expect(rohVerschiebbar(datei('b', '/R/Rohmaterial/b.heic'))).toBe(true);
    expect(rohVerschiebbar(datei('c', '/R/Rohmaterial/c.zip'))).toBe(false);
    expect(rohVerschiebbar({ ...datei('d', '/R/Rohmaterial/d.mov'), ablage: 'dropbox' })).toBe(false);
    expect(rohZielTyp('x.webm')).toBe('video');
    expect(rohZielTyp('x.png')).toBe('still');
    expect(rohZielTyp('x.tiff')).toBeNull();
  });
});

/* ---- Im Videos-Tab ---- */

const uploaderStart = vi.fn();

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
  createUploader: () => ({ start: uploaderStart, destroy: vi.fn() })
}));

vi.mock('../modules/video-browser/VideoBrowserPlayer.js', () => ({
  mountPlayer: (host) => {
    host.innerHTML = '<div data-vb-frame></div>';
    return { seek: vi.fn(), setMarkers: vi.fn(), destroy: vi.fn(), getDimensions: () => null, whenReady: () => Promise.resolve() };
  }
}));

vi.mock('../core/ablage/ablageApi.js', async (importOriginal) => ({
  ...(await importOriginal()),
  ablageRohVerschieben: vi.fn(async (ids) => ids.map(id => ({ id, ok: true, typ: 'video' }))),
  ablageRohUmordnen: vi.fn(async (ids) => ids.map(id => ({ id, ok: true }))),
  ablageRohOrdnerAnlegen: vi.fn(async (_k, name, parent) => ({
    ordner: { item_id: 'o-neu', parent_item_id: parent || 'root-roh', name, pfad: `${ROH}/${name}` }
  }))
}));

const { mountVideoBrowserPane, unmountVideoBrowser } = await import('../modules/video-browser/VideoBrowser.js');
const { loadVideoBrowserData } = await import('../modules/video-browser/VideoBrowserAdapter.js');
const { ablageRohVerschieben, ablageRohUmordnen, ablageRohOrdnerAnlegen } = await import('../core/ablage/ablageApi.js');

function setup() {
  window.canFeature = (name) => ({ videoTeamSicht: true, mediaUpload: true, skriptKommentieren: true }[name] ?? false);
  window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} });
  window.toastSystem = { show: vi.fn() };
  window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1&f=raw');
  const pane = document.createElement('div');
  document.body.appendChild(pane);
  const detail = { kampagneId: 'kamp', produktionId: 'p1', linien: [], linieAlle: false, linieId: null, produktion: { name: 'Prod' } };
  return { pane, detail };
}

const col3 = (pane) => pane.querySelector('.vb-col--3');
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const flush = () => new Promise(r => setTimeout(r, 0));

function dragEvent(type, dataTransfer) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'dataTransfer', { value: dataTransfer });
  return e;
}

function fakeDataTransfer() {
  const daten = new Map();
  return {
    get types() { return [...daten.keys()]; },
    setData: (t, v) => daten.set(t, v),
    getData: (t) => daten.get(t) || '',
    setDragImage: vi.fn(),
    effectAllowed: 'none',
    dropEffect: 'none',
    files: []
  };
}

describe('Rohmaterial im Videos-Tab', () => {
  let ctx;
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });
  afterEach(() => { if (ctx) unmountVideoBrowser(ctx.detail); });

  it('gruppiert nach Unterordnern: Ordner zuerst (verschachtelt, auch leer), dann die Wurzel', async () => {
    ctx = setup();
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    const col = col3(ctx.pane);
    const anna = col.querySelector('.vb-rohgroup[data-vb-roh-ordner="Anna Muster"]');
    expect(anna.dataset.itemId).toBe('o-anna');
    expect(anna.querySelector(':scope > .vb-rohgroup__body > li > .vb-row[data-id="r1"]')).toBeTruthy();
    const final = anna.querySelector('.vb-rohgroup[data-vb-roh-ordner="Anna Muster/final"]');
    expect(final.querySelector('.vb-row[data-id="r2"]')).toBeTruthy();
    expect(col.querySelector('.vb-rohgroup[data-vb-roh-ordner="Bilder"] .vb-rohgroup__leer')).toBeTruthy();

    const oben = [...col.querySelectorAll('.vb-rohlist > li')].map(li => li.dataset.vbRohOrdner || li.querySelector('.vb-row')?.dataset.id);
    expect(oben).toEqual(['Anna Muster', 'Bilder', 'r3', 'r4']);
    // Auch ZIP lässt sich markieren und ziehen (in einen Ordner, nicht in eine Schleife)
    expect([...col.querySelectorAll('[data-vb-roh-check]')].map(c => c.dataset.vbRohCheck)).toEqual(['r2', 'r1', 'r3', 'r4']);
    expect(col.querySelector('[data-vb-roh-drag="r4"]')).toBeTruthy();
    expect(col.querySelector('[data-vb-roh-neu=""]')).toBeTruthy();
  });

  it('klappt einen Ordner zu und wieder auf', async () => {
    ctx = setup();
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    click(col3(ctx.pane).querySelector('[data-vb-roh-toggle="Anna Muster"]'));
    const anna = col3(ctx.pane).querySelector('.vb-rohgroup[data-vb-roh-ordner="Anna Muster"]');
    expect(anna.classList.contains('is-collapsed')).toBe(true);
    expect(anna.querySelector(':scope > .vb-rohgroup__body').hidden).toBe(true);
    click(col3(ctx.pane).querySelector('[data-vb-roh-toggle="Anna Muster"]'));
    expect(col3(ctx.pane).querySelector('.vb-rohgroup[data-vb-roh-ordner="Anna Muster"] > .vb-rohgroup__body').hidden).toBe(false);
  });

  it('markieren, Ziel wählen: verschiebt sofort und lädt danach neu', async () => {
    ctx = setup();
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    col3(ctx.pane).querySelector('[data-vb-roh-check="r1"]').click();
    col3(ctx.pane).querySelector('[data-vb-roh-check="r3"]').click();
    expect(col3(ctx.pane).querySelector('.vb-rohbar__count').textContent).toBe('2 markiert');

    click(col3(ctx.pane).querySelector('[data-vb-roh-menu]'));
    const ziele = [...col3(ctx.pane).querySelectorAll('[data-vb-roh-ziel]')].map(b => `${b.dataset.vbRohZiel}:${b.dataset.version}`);
    expect(ziele).toEqual(['v1:1', 'v1:2', 'v2:1']);

    loadVideoBrowserData.mockClear();
    click(col3(ctx.pane).querySelector('[data-vb-roh-ziel="v2"][data-version="1"]'));
    expect(col3(ctx.pane).querySelector('.vb-row[data-id="r1"]')).toBeNull();
    expect(col3(ctx.pane).querySelector('.vb-row[data-id="r3"]')).toBeNull();
    expect(ablageRohVerschieben).toHaveBeenCalledWith(['r1', 'r3'], 'v2', 1);
    await flush();
    expect(loadVideoBrowserData).toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledWith(expect.stringContaining('2 Dateien nach „Feedbackschleife 1“'), 'success', undefined, expect.anything());
  });

  it('schlägt alles fehl, kommen die Dateien zurück', async () => {
    ctx = setup();
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    let fertig;
    ablageRohVerschieben.mockImplementationOnce((ids) => new Promise((resolve) => {
      fertig = () => resolve(ids.map(id => ({ id, ok: false, fehler: 'Datei ist nicht mehr in SharePoint' })));
    }));
    loadVideoBrowserData.mockImplementationOnce(() => new Promise(() => {}));
    col3(ctx.pane).querySelector('[data-vb-roh-check="r1"]').click();
    click(col3(ctx.pane).querySelector('[data-vb-roh-menu]'));
    click(col3(ctx.pane).querySelector('[data-vb-roh-ziel="v1"][data-version="2"]'));
    expect(col3(ctx.pane).querySelector('.vb-row[data-id="r1"]')).toBeNull();
    fertig();
    await flush();
    expect(col3(ctx.pane).querySelector('.vb-row[data-id="r1"]')).toBeTruthy();
    expect(window.toastSystem.show).toHaveBeenCalledWith('Datei ist nicht mehr in SharePoint', 'error');
  });

  it('Drag & Drop auf eine Feedbackschleife in Spalte 2, markierte Zeile nimmt alle markierten mit', async () => {
    ctx = setup();
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    const dt = fakeDataTransfer();
    col3(ctx.pane).querySelector('[data-vb-roh-drag="r3"]').dispatchEvent(dragEvent('dragstart', dt));
    const ziel = ctx.pane.querySelector('.vb-col--2 li[data-folder-id="s1"] .vb-row');
    const over = dragEvent('dragover', dt);
    ziel.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    // Rohmaterial ist kein Ziel, r3 liegt schon in der Wurzel
    const keinZiel = dragEvent('dragover', dt);
    ctx.pane.querySelector('.vb-col--2 li[data-folder-id="raw"] .vb-row').dispatchEvent(keinZiel);
    expect(keinZiel.defaultPrevented).toBe(false);
    ziel.dispatchEvent(dragEvent('drop', dt));
    expect(ablageRohVerschieben).toHaveBeenCalledWith(['r3'], 'v1', 1);
    await flush();

    col3(ctx.pane).querySelector('[data-vb-roh-check="r1"]').click();
    col3(ctx.pane).querySelector('[data-vb-roh-check="r2"]').click();
    const dt2 = fakeDataTransfer();
    col3(ctx.pane).querySelector('[data-vb-roh-drag="r1"]').dispatchEvent(dragEvent('dragstart', dt2));
    expect(JSON.parse(dt2.getData('application/x-vb-roh'))).toEqual(['r1', 'r2']);
    ctx.pane.querySelector('.vb-col--2 li[data-folder-id="s2"] .vb-row').dispatchEvent(dragEvent('drop', dt2));
    expect(ablageRohVerschieben).toHaveBeenLastCalledWith(['r1', 'r2'], 'v1', 2);
  });

  it('Menü: in einen anderen Ordner, der eigene ist gesperrt, die Datei wechselt sofort', async () => {
    ctx = setup();
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    col3(ctx.pane).querySelector('[data-vb-roh-check="r1"]').click();
    click(col3(ctx.pane).querySelector('[data-vb-roh-menu]'));
    const ordner = [...col3(ctx.pane).querySelectorAll('[data-vb-roh-ordner-ziel]')];
    expect(ordner.map(b => [b.dataset.vbRohOrdnerZiel, b.disabled])).toEqual([
      ['', false], ['Anna Muster', true], ['Anna Muster/final', false], ['Bilder', false]
    ]);

    loadVideoBrowserData.mockClear();
    click(col3(ctx.pane).querySelector('[data-vb-roh-ordner-ziel="Bilder"]'));
    expect(ablageRohUmordnen).toHaveBeenCalledWith(['r1'], 'k1', 'o-bilder');
    expect(col3(ctx.pane).querySelector('.vb-rohgroup[data-vb-roh-ordner="Bilder"] .vb-row[data-id="r1"]')).toBeTruthy();
    expect(col3(ctx.pane).querySelector('[data-vb-roh-menu-list]')).toBeNull();
    await flush();
    expect(loadVideoBrowserData).toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledWith('1 Datei nach „Bilder“ verschoben.', 'success');
  });

  it('nur ZIP markiert: Ordner als Ziel, keine Feedbackschleife', async () => {
    ctx = setup();
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    col3(ctx.pane).querySelector('[data-vb-roh-check="r4"]').click();
    click(col3(ctx.pane).querySelector('[data-vb-roh-menu]'));
    expect(col3(ctx.pane).querySelector('[data-vb-roh-ziel]')).toBeNull();
    expect(col3(ctx.pane).querySelector('.vb-rohmenu__leer').textContent).toContain('nur Videos und Bilder');
    click(col3(ctx.pane).querySelector('[data-vb-roh-ordner-ziel="Anna Muster/final"]'));
    expect(ablageRohUmordnen).toHaveBeenCalledWith(['r4'], 'k1', 'o-final');
  });

  it('Drag & Drop auf einen Ordner, in die Wurzel und auf Rohmaterial in Spalte 2', async () => {
    ctx = setup();
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    const bilder = () => col3(ctx.pane).querySelector('.vb-rohgroup[data-vb-roh-ordner="Bilder"] .vb-rohgroup__toggle');

    const dt = fakeDataTransfer();
    col3(ctx.pane).querySelector('[data-vb-roh-drag="r3"]').dispatchEvent(dragEvent('dragstart', dt));
    const over = dragEvent('dragover', dt);
    bilder().dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    expect(bilder().closest('.vb-rohgroup').classList.contains('is-roh-drop')).toBe(true);
    // Wurzel: r3 liegt schon dort
    const wurzel = dragEvent('dragover', dt);
    col3(ctx.pane).querySelector('.vb-row[data-id="r4"]').dispatchEvent(wurzel);
    expect(wurzel.defaultPrevented).toBe(false);
    bilder().dispatchEvent(dragEvent('drop', dt));
    expect(ablageRohUmordnen).toHaveBeenLastCalledWith(['r3'], 'k1', 'o-bilder');
    await flush();

    // Aus einem Unterordner in die Wurzel, über eine Zeile der Wurzel
    const dt2 = fakeDataTransfer();
    col3(ctx.pane).querySelector('[data-vb-roh-drag="r2"]').dispatchEvent(dragEvent('dragstart', dt2));
    col3(ctx.pane).querySelector('.vb-row[data-id="r4"]').dispatchEvent(dragEvent('drop', dt2));
    expect(ablageRohUmordnen).toHaveBeenLastCalledWith(['r2'], 'k1', null);
    await flush();

    // Auf Rohmaterial in Spalte 2 geht es ebenfalls in die Wurzel
    const dt3 = fakeDataTransfer();
    col3(ctx.pane).querySelector('[data-vb-roh-drag="r1"]').dispatchEvent(dragEvent('dragstart', dt3));
    const raw = ctx.pane.querySelector('.vb-col--2 li[data-folder-id="raw"] .vb-row');
    const overRaw = dragEvent('dragover', dt3);
    raw.dispatchEvent(overRaw);
    expect(overRaw.defaultPrevented).toBe(true);
    raw.dispatchEvent(dragEvent('drop', dt3));
    expect(ablageRohUmordnen).toHaveBeenLastCalledWith(['r1'], 'k1', null);
  });

  it('Umordnen schlägt fehl: die Datei kommt in ihren Ordner zurück', async () => {
    ctx = setup();
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    let fertig;
    ablageRohUmordnen.mockImplementationOnce((ids) => new Promise((resolve) => {
      fertig = () => resolve(ids.map(id => ({ id, ok: false, fehler: 'Datei liegt nicht in SharePoint' })));
    }));
    loadVideoBrowserData.mockImplementationOnce(() => new Promise(() => {}));
    const anna = () => col3(ctx.pane).querySelector('.vb-rohgroup[data-vb-roh-ordner="Anna Muster"] > .vb-rohgroup__body');
    col3(ctx.pane).querySelector('[data-vb-roh-check="r1"]').click();
    click(col3(ctx.pane).querySelector('[data-vb-roh-menu]'));
    click(col3(ctx.pane).querySelector('[data-vb-roh-ordner-ziel=""]'));
    expect(anna().querySelector(':scope > li > .vb-row[data-id="r1"]')).toBeNull();
    fertig();
    await flush();
    expect(anna().querySelector(':scope > li > .vb-row[data-id="r1"]')).toBeTruthy();
    expect(window.toastSystem.show).toHaveBeenCalledWith('Datei liegt nicht in SharePoint', 'error');
  });

  it('Neuer Ordner: Feld in der Liste, Anlegen zeigt den Ordner sofort', async () => {
    ctx = setup();
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    click(col3(ctx.pane).querySelector('[data-vb-roh-neu=""]'));
    const input = col3(ctx.pane).querySelector('[data-vb-roh-neu-input]');
    expect(document.activeElement).toBe(input);
    input.value = 'Schnitt';
    input.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(ablageRohOrdnerAnlegen).toHaveBeenCalledWith('k1', 'Schnitt', null);
    await flush();
    expect(col3(ctx.pane).querySelector('.vb-rohgroup[data-vb-roh-ordner="Schnitt"]').dataset.itemId).toBe('o-neu');
    expect(col3(ctx.pane).querySelector('[data-vb-roh-neu-input]')).toBeNull();

    // Unterordner: Feld im Ordner, Eltern-item_id geht mit
    click(col3(ctx.pane).querySelector('[data-vb-roh-neu="Anna Muster"]'));
    const unter = col3(ctx.pane).querySelector('.vb-rohgroup[data-vb-roh-ordner="Anna Muster"] [data-vb-roh-neu-input]');
    unter.value = 'Takes';
    unter.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(ablageRohOrdnerAnlegen).toHaveBeenLastCalledWith('k1', 'Takes', 'o-anna');
  });

  it('Upload über den Ordnerkopf geht in diesen Ordner', async () => {
    ctx = setup();
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    const input = col3(ctx.pane).querySelector('input[data-vb-file][data-ordner-item-id="o-final"]');
    const file = new File(['x'], 'neu.mov');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(uploaderStart).toHaveBeenCalledWith(expect.objectContaining({ files: [file], ordnerItemId: 'o-final' }));
  });
});
