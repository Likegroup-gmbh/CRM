import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Anzeige der Poster (ADR 0064): Showcase-Kacheln nehmen zuerst das Poster und fallen nur ohne
// Poster auf das Original zurueck; der Player im Ordner setzt das Poster als poster-Attribut.

vi.mock('../core/media/PosterCache.js', () => ({
  getPoster: vi.fn(async () => null),
  peekPoster: vi.fn(() => null),
  prefetchPosters: vi.fn()
}));

vi.mock('../modules/video-browser/videoBrowserMedia.js', () => ({
  cachedUrl: vi.fn(() => null),
  networkUrl: vi.fn(async () => null),
  mediaOf: (item) => {
    const record = item?.asset || item;
    return { record, lookup: { file_path: record.file_path } };
  },
  resolveSource: vi.fn(async () => ({ url: null, quelle: 'original' }))
}));

const posterCache = await import('../core/media/PosterCache.js');
const media = await import('../modules/video-browser/videoBrowserMedia.js');
const { createShowcaseMedia } = await import('../modules/video-browser/videoBrowserShowcaseMedia.js');
const { mountPlayer } = await import('../modules/video-browser/VideoBrowserPlayer.js');

const flush = async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0)); };

// jsdom laedt keine Bilder: load bzw. error (URL mit "kaputt") selbst ausloesen
const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
beforeAll(() => {
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    get() { return this.getAttribute('src') || ''; },
    set(value) {
      this.setAttribute('src', value);
      setTimeout(() => this.dispatchEvent(new Event(String(value).includes('kaputt') ? 'error' : 'load')));
    }
  });
  HTMLMediaElement.prototype.load = () => {};
  HTMLMediaElement.prototype.pause = () => {};
  HTMLMediaElement.prototype.play = () => Promise.resolve();
});
afterAll(() => {
  Object.defineProperty(HTMLImageElement.prototype, 'src', srcDescriptor);
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

function grid(items) {
  const el = document.createElement('div');
  el.innerHTML = items.map((item) => `
    <button data-vb-sc-tile data-item-id="${item.id}"><span data-vb-sc-media></span></button>`).join('');
  document.body.appendChild(el);
  return el;
}

const still = { id: 's1', type: 'still', asset: { id: 's1', file_path: '/K/s1.jpg', created_at: 'c' } };
const video = { id: 'v1', type: 'video', asset: { id: 'v1', file_path: '/K/v1.mov', created_at: 'c' } };

describe('Showcase-Kacheln mit Poster', () => {
  it('zeigt das Poster und laedt das Original nicht', async () => {
    posterCache.getPoster.mockResolvedValue('blob:poster-s1');
    const el = grid([still]);
    const sc = createShowcaseMedia();
    sc.observe(el, [{ item: still }]);
    await flush();

    const tile = el.querySelector('[data-vb-sc-tile]');
    expect(tile.querySelector('img').getAttribute('src')).toBe('blob:poster-s1');
    expect(tile.dataset.poster).toBe('done');
    expect(media.networkUrl).not.toHaveBeenCalled();
    sc.destroy();
  });

  it('faellt ohne Poster auf das Original zurueck', async () => {
    posterCache.getPoster.mockResolvedValue(null);
    media.networkUrl.mockResolvedValue('https://dropbox.test/s1.jpg');
    const el = grid([still]);
    const sc = createShowcaseMedia();
    sc.observe(el, [{ item: still }]);
    await flush();

    expect(media.networkUrl).toHaveBeenCalledTimes(1);
    expect(el.querySelector('img').getAttribute('src')).toBe('https://dropbox.test/s1.jpg');
    sc.destroy();
  });

  it('nimmt das Original, wenn das Poster nicht laedt', async () => {
    posterCache.getPoster.mockResolvedValue('blob:kaputt');
    media.networkUrl.mockResolvedValue('https://dropbox.test/s1.jpg');
    const el = grid([still]);
    const sc = createShowcaseMedia();
    sc.observe(el, [{ item: still }]);
    await flush();

    const imgs = el.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('src')).toBe('https://dropbox.test/s1.jpg');
    sc.destroy();
  });

  it('fragt alle sichtbaren Kacheln im selben Takt an', async () => {
    posterCache.getPoster.mockResolvedValue('blob:x');
    const items = [still, video, { ...video, id: 'v2', asset: { ...video.asset, id: 'v2' } }];
    const el = grid(items);
    const sc = createShowcaseMedia();
    sc.observe(el, items.map((item) => ({ item })));
    expect(posterCache.getPoster).toHaveBeenCalledTimes(3);
    await flush();
    sc.destroy();
  });
});

describe('Player im Ordner mit Poster', () => {
  function mount() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const player = mountPlayer(host, { item: video });
    return { host, player, video: () => host.querySelector('video') };
  }

  it('setzt ein bereits geladenes Poster sofort', async () => {
    posterCache.peekPoster.mockReturnValue('blob:poster-v1');
    media.resolveSource.mockResolvedValue({ url: 'https://dropbox.test/v1.mov', quelle: 'original' });
    const p = mount();
    await flush();
    expect(p.video().getAttribute('poster')).toBe('blob:poster-v1');
    expect(posterCache.getPoster).not.toHaveBeenCalled();
    p.player.destroy();
  });

  it('setzt das Poster nach, solange noch kein Bild der Datei da ist', async () => {
    posterCache.peekPoster.mockReturnValue(null);
    posterCache.getPoster.mockResolvedValue('blob:poster-spaet');
    media.resolveSource.mockResolvedValue({ url: 'https://dropbox.test/v1.mov', quelle: 'original' });
    const p = mount();
    await flush();
    expect(p.video().getAttribute('poster')).toBe('blob:poster-spaet');
    p.player.destroy();
  });
});
