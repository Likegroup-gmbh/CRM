import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../core/media/mediaSrc.js', () => ({
  resolveStreamUrl: vi.fn(async (a) => `https://cdn.test/${a.file_path || 'raw'}`),
  prefetchStreamUrl: vi.fn()
}));

const MediaCache = await import('../core/media/MediaCache.js');
const { prefetchStreamUrl } = await import('../core/media/mediaSrc.js');
const {
  mediaOf, cachedUrl, prefetchLinks, warmNeighbors, stopWarming, resolveSource
} = await import('../modules/video-browser/videoBrowserMedia.js');

const video = (over = {}) => ({
  type: 'video',
  asset: { id: 'a1', file_path: '/x/clip.mp4', created_at: '2026-01-01', ...over }
});
const still = (over = {}) => ({
  type: 'still',
  asset: { id: 's1', file_path: '/x/bild.jpg', created_at: '2026-01-01', ...over }
});
const warmVideos = () => [...document.querySelectorAll('video')];
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('videoBrowserMedia', () => {
  beforeAll(() => { HTMLMediaElement.prototype.load = () => {}; });
  afterEach(() => { stopWarming(); MediaCache._clearMediaCache(); vi.clearAllMocks(); });

  it('spielt immer das Original über den Temp-Link', async () => {
    expect(await resolveSource(video())).toEqual({ url: 'https://cdn.test//x/clip.mp4', quelle: 'original' });
    expect(mediaOf(video({ file_path: '/x/clip.mov' })).risky).toBe(true);
  });

  it('baut denselben Cache-Key wie der Medien-Player', () => {
    expect(mediaOf(video()).key).toBe('video:a1:2026-01-01');
    expect(mediaOf({ type: 'still', asset: { id: 's', created_at: 'c', file_path: '/a.jpg' } }).key).toBe('bild:s:c');
    expect(mediaOf({ type: 'roh', asset: { id: 'r', file_path: '/a.mov' } }).key).toBeNull();
  });

  it('legt Standbilder der Nachbarn in den Blob-Cache', async () => {
    const item = still();
    expect(cachedUrl(item)).toBeNull();
    globalThis.fetch = vi.fn(async () => ({ ok: true, headers: new Headers(), blob: async () => new Blob(['x']) }));
    URL.createObjectURL = vi.fn(() => 'blob:abc');
    await warmNeighbors([item]);
    expect(cachedUrl(item)).toBe('blob:abc');
  });

  it('lädt Nachbar-Videos nur bis zu den Metadaten, nicht als Blob', async () => {
    globalThis.fetch = vi.fn();
    const done = warmNeighbors([video()]);
    await flush();
    const [el] = warmVideos();
    expect(el.preload).toBe('metadata');
    expect(el.getAttribute('src')).toBe('https://cdn.test//x/clip.mp4#t=0.001');
    el.dispatchEvent(new Event('loadedmetadata'));
    await done;
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(cachedUrl(video())).toBeNull();
  });

  it('wärmt höchstens eine Datei gleichzeitig', async () => {
    const done = warmNeighbors([video(), video({ id: 'a2', file_path: '/x/b.mp4' })]);
    await flush();
    expect(warmVideos()).toHaveLength(1);
    warmVideos()[0].dispatchEvent(new Event('loadedmetadata'));
    await flush();
    expect(warmVideos()).toHaveLength(2);
    warmVideos()[1].dispatchEvent(new Event('error'));
    await done;
  });

  it('gibt Elemente frei, die nicht mehr Nachbar sind', async () => {
    warmNeighbors([video()]);
    await flush();
    warmVideos()[0].dispatchEvent(new Event('loadedmetadata'));
    await flush();
    const next = warmNeighbors([video({ id: 'a2', file_path: '/x/b.mp4' })]);
    await flush();
    expect(warmVideos().map((el) => el.getAttribute('src'))).toEqual(['https://cdn.test//x/b.mp4#t=0.001']);
    warmVideos()[0].dispatchEvent(new Event('loadedmetadata'));
    await next;
    stopWarming();
    expect(warmVideos()).toHaveLength(0);
  });

  it('löst Links nur für abspielbare Dateien mit Quelle vorab auf', () => {
    prefetchLinks([video(), { type: 'roh', asset: { id: 'r', file_path: '/a.zip' } }, video({ id: 'a2', file_path: null, file_url: null })]);
    expect(prefetchStreamUrl).toHaveBeenCalledTimes(1);
  });
});
