import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/video-browser/videoBrowserMedia.js', () => ({
  cachedUrl: vi.fn(() => null),
  mediaOf: (item) => {
    const record = item?.asset || item;
    return { record, lookup: { file_path: record.file_path } };
  },
  resolveSource: vi.fn(),
  dropVorschauLink: vi.fn()
}));

const { mountPlayer } = await import('../modules/video-browser/VideoBrowserPlayer.js');
const media = await import('../modules/video-browser/videoBrowserMedia.js');
const { createWiedergabeMessung } = await import('../core/media/mediaPerf.js');

const item = { id: 'a1', type: 'video', ratio: '9:16', asset: { id: 'a1', file_path: '/K/clip.mov', created_at: 'c' } };
const flush = async () => { for (let i = 0; i < 3; i += 1) await new Promise((r) => setTimeout(r, 0)); };
const fire = (el, type) => el.dispatchEvent(new Event(type));

function mount(opts = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const player = mountPlayer(host, { item, ...opts });
  return { host, player, video: () => host.querySelector('video') };
}

describe('VideoBrowserPlayer', () => {
  let current;
  beforeAll(() => {
    HTMLMediaElement.prototype.load = () => {};
    HTMLMediaElement.prototype.pause = () => {};
    HTMLMediaElement.prototype.play = () => Promise.resolve();
  });
  afterEach(() => {
    current?.player.destroy();
    current = null;
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('wechselt die Quelle während der Wiedergabe nicht', async () => {
    media.resolveSource.mockResolvedValue({ url: 'https://dropbox.test/clip.mov', quelle: 'original' });
    current = mount();
    await flush();
    const el = current.video();
    expect(el.getAttribute('src')).toBe('https://dropbox.test/clip.mov#t=0.001');
    ['loadedmetadata', 'loadeddata', 'play', 'playing', 'timeupdate', 'canplaythrough'].forEach((t) => fire(el, t));
    await flush();
    expect(current.video()).toBe(el);
    expect(el.getAttribute('src')).toBe('https://dropbox.test/clip.mov#t=0.001');
    expect(media.resolveSource).toHaveBeenCalledTimes(1);
  });

  it('fällt bei nicht abspielbarer Vorschau einmal aufs Original zurück', async () => {
    media.resolveSource
      .mockResolvedValueOnce({ url: 'https://cf.test/a1.mp4', quelle: 'vorschau' })
      .mockResolvedValueOnce({ url: 'https://dropbox.test/clip.mov', quelle: 'original' });
    current = mount();
    await flush();
    fire(current.video(), 'error');
    await flush();
    expect(media.dropVorschauLink).toHaveBeenCalledWith(item);
    expect(media.resolveSource).toHaveBeenLastCalledWith(item, { original: true });
    expect(current.video().getAttribute('src')).toBe('https://dropbox.test/clip.mov#t=0.001');
    // Fehler im Original: kein weiterer Versuch, Hinweis statt Endlosschleife
    fire(current.video(), 'error');
    await flush();
    expect(media.resolveSource).toHaveBeenCalledTimes(2);
    expect(current.host.textContent).toContain('kann nicht abgespielt werden');
  });

  it('meldet je Wiedergabe eine Messung mit Quelle und Format', async () => {
    const onMessung = vi.fn();
    media.resolveSource.mockResolvedValue({ url: 'https://cf.test/a1.mp4', quelle: 'vorschau' });
    current = mount({ onMessung });
    await flush();
    fire(current.video(), 'loadeddata');
    current.player.destroy();
    current = null;
    expect(onMessung).toHaveBeenCalledTimes(1);
    expect(onMessung.mock.calls[0][0]).toMatchObject({ asset_id: 'a1', quelle: 'vorschau', format: 'mov', stalls: 0, fehler: false });
    expect(onMessung.mock.calls[0][0].ttff_ms).toEqual(expect.any(Number));
  });

  it('zählt eine nicht auflösbare Datei als Fehler', async () => {
    const onMessung = vi.fn();
    media.resolveSource.mockResolvedValue({ url: null, quelle: 'original' });
    current = mount({ onMessung });
    await flush();
    expect(onMessung).toHaveBeenCalledWith(expect.objectContaining({ fehler: true, ttff_ms: null }));
  });

  it('whenReady wartet auf canplaythrough (Gate fürs Vorwärmen)', async () => {
    media.resolveSource.mockResolvedValue({ url: 'https://cf.test/a1.mp4', quelle: 'vorschau' });
    current = mount();
    let ready = false;
    await flush();
    current.player.whenReady().then(() => { ready = true; });
    fire(current.video(), 'loadeddata');
    await flush();
    expect(ready).toBe(false);
    fire(current.video(), 'canplaythrough');
    await flush();
    expect(ready).toBe(true);
  });
});

describe('Wiedergabe-Messung', () => {
  function fakeVideo() {
    const el = new EventTarget();
    el.seeking = false;
    el.currentTime = 0;
    el.played = { length: 1, start: () => 0, end: () => 12.5 };
    return el;
  }

  it('misst erstes Bild, Start und Stalls, nicht das Puffern nach einem Sprung', () => {
    let t = 0;
    const m = createWiedergabeMessung({ quelle: 'original', format: 'mov', assetId: 'a1', now: () => t });
    const el = fakeVideo();
    m.attach(el);
    t = 900; fire(el, 'loadeddata');
    t = 1000; fire(el, 'play');
    fire(el, 'waiting');              // vor dem Start: Startlatenz, kein Stall
    t = 1300; fire(el, 'playing');
    el.currentTime = 5;
    t = 2000; fire(el, 'waiting');
    t = 2600; fire(el, 'playing');
    el.seeking = true;
    t = 3000; fire(el, 'waiting');    // Sprung
    el.seeking = false;
    el.currentTime = 61;
    t = 4000; fire(el, 'waiting');    // nach 60 s: zählt nicht mehr
    expect(m.finish()).toMatchObject({
      ttff_ms: 900, start_ms: 300, stalls: 1, stall_ms: 600, abgespielt_sek: 12.5, quelle: 'original', format: 'mov'
    });
  });

  it('liefert ohne erstes Bild und ohne Fehler keine Zeile (abgebrochen)', () => {
    const m = createWiedergabeMessung({ quelle: 'original', now: () => 0 });
    m.attach(fakeVideo());
    expect(m.finish()).toBeNull();
  });
});
