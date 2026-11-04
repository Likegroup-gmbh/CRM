import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../core/media/mediaSrc.js', () => ({
  resolveStreamUrl: vi.fn(async (a) => `https://cdn.test/${a.file_path || 'raw'}`),
  prefetchStreamUrl: vi.fn()
}));
vi.mock('../core/auth/getAccessToken.js', () => ({ authorizedFetch: vi.fn() }));

const MediaCache = await import('../core/media/MediaCache.js');
const { prefetchStreamUrl } = await import('../core/media/mediaSrc.js');
const { authorizedFetch } = await import('../core/auth/getAccessToken.js');
const {
  mediaOf, cachedUrl, prefetchLinks, warmNeighbors, stopWarming,
  resolveSource, dropVorschauLink, _resetVorschauLinks
} = await import('../modules/video-browser/videoBrowserMedia.js');

const linkAntwort = (links, ttlSec = 4 * 3600) => ({ ok: true, json: async () => ({ links, ttlSec }) });
const angefragteIds = (call) => JSON.parse(call[1].body).assetIds;

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
  afterEach(() => { stopWarming(); _resetVorschauLinks(); MediaCache._clearMediaCache(); vi.clearAllMocks(); });

  describe('Vorschaudatei', () => {
    const bereit = (over = {}) => video({ vorschau_bereit: true, ...over });

    it('spielt die Vorschaudatei nur mit vorschau_bereit, sonst das Original', async () => {
      authorizedFetch.mockResolvedValue(linkAntwort({ a1: 'https://cf.test/a1.mp4' }));
      expect(await resolveSource(bereit())).toEqual({ url: 'https://cf.test/a1.mp4', quelle: 'vorschau' });
      expect(angefragteIds(authorizedFetch.mock.calls[0])).toEqual(['a1']);

      authorizedFetch.mockClear();
      expect(await resolveSource(video({ id: 'a9' }))).toEqual({ url: 'https://cdn.test//x/clip.mp4', quelle: 'original' });
      expect(authorizedFetch).not.toHaveBeenCalled();
    });

    it('fällt aufs Original zurück, wenn kein Link kommt oder der Call scheitert', async () => {
      authorizedFetch.mockResolvedValueOnce(linkAntwort({}));
      expect((await resolveSource(bereit())).quelle).toBe('original');
      authorizedFetch.mockRejectedValueOnce(new Error('offline'));
      expect((await resolveSource(bereit({ id: 'a2' }))).quelle).toBe('original');
    });

    it('holt die Links eines Ordners in einem Call und nutzt sie für die Token-Laufzeit', async () => {
      authorizedFetch.mockResolvedValue(linkAntwort({ a1: 'https://cf.test/a1.mp4', a2: 'https://cf.test/a2.mp4' }));
      prefetchLinks([bereit(), bereit({ id: 'a2' }), video({ id: 'a3', file_path: '/x/c.mov' })]);
      expect(authorizedFetch).toHaveBeenCalledTimes(1);
      expect(angefragteIds(authorizedFetch.mock.calls[0])).toEqual(['a1', 'a2']);
      // Dropbox-Link nur für die Datei ohne Vorschaudatei
      expect(prefetchStreamUrl).toHaveBeenCalledTimes(1);
      expect((await resolveSource(bereit({ id: 'a2' }))).url).toBe('https://cf.test/a2.mp4');
      expect((await resolveSource(bereit())).url).toBe('https://cf.test/a1.mp4');
      expect(authorizedFetch).toHaveBeenCalledTimes(1);
    });

    it('holt Links rechtzeitig vor Ablauf des Tokens neu', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        authorizedFetch.mockResolvedValue(linkAntwort({ a1: 'https://cf.test/a1.mp4' }, 60));
        expect((await resolveSource(bereit())).quelle).toBe('vorschau');
        vi.setSystemTime(Date.now() + 29_000);
        await resolveSource(bereit());
        expect(authorizedFetch).toHaveBeenCalledTimes(1);
        vi.setSystemTime(Date.now() + 2_000);
        await resolveSource(bereit());
        expect(authorizedFetch).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('nimmt nach einem Abspielfehler eine Weile nur das Original', async () => {
      authorizedFetch.mockResolvedValue(linkAntwort({ a1: 'https://cf.test/a1.mp4' }));
      await resolveSource(bereit());
      dropVorschauLink(bereit());
      expect((await resolveSource(bereit())).quelle).toBe('original');
      expect(authorizedFetch).toHaveBeenCalledTimes(1);
    });

    it('eigener Content-Key; .mov ist mit Vorschau nicht riskant', () => {
      const m = mediaOf(bereit({ file_path: '/x/clip.mov' }));
      expect(m.vorschauKey).toBe('video:a1:2026-01-01:vorschau');
      expect(m.risky).toBe(false);
      expect(mediaOf(video({ file_path: '/x/clip.mov' })).risky).toBe(true);
    });

    it('wärmt Nachbarn über dieselbe Quelle wie der Player (Vorschau)', async () => {
      authorizedFetch.mockResolvedValue(linkAntwort({ a1: 'https://cf.test/a1.mp4' }));
      warmNeighbors([bereit()]);
      await flush();
      await flush();
      expect(warmVideos()[0].getAttribute('src')).toBe('https://cf.test/a1.mp4#t=0.001');
    });
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
