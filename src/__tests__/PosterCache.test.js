import { describe, expect, it, vi } from 'vitest';
import { createPosterCache, memoryStore } from '../core/media/PosterCache.js';

// PosterCache (ADR 0064): Bytes in IndexedDB statt URLs, fehlende Poster gesammelt in einem
// Call, kurze Sperre fuer ausstehende, lange fuer fehlende, einmal neu bei abgelaufener URL.

const video = (id, extra = {}) => ({
  id, type: 'video', asset: { id, file_path: `/K/${id}.mp4`, created_at: '2026-11-01T10:00:00Z', ...extra }
});
const blob = (name) => new Blob([name], { type: 'image/webp' });

function setup({ antwort, download, store = memoryStore(), clock = { t: 1_000_000 } } = {}) {
  const requestUrls = vi.fn(async (items) => (typeof antwort === 'function' ? antwort(items) : antwort));
  const dl = vi.fn(download || (async (url) => blob(url)));
  let n = 0;
  const cache = createPosterCache({
    store,
    requestUrls,
    download: dl,
    toObjectUrl: () => `blob:poster-${++n}`,
    now: () => clock.t
  });
  return { cache, requestUrls, download: dl, store, clock };
}

describe('PosterCache', () => {
  it('holt fehlende Poster gesammelt in einem Call und speichert die Bytes', async () => {
    const { cache, requestUrls, download, store } = setup({
      antwort: { posters: { a1: 'https://s/a1', a2: 'https://s/a2' }, ausstehend: ['a3'], ohne: [] }
    });

    const [u1, u2, u3] = await Promise.all([cache.get(video('a1')), cache.get(video('a2')), cache.get(video('a3'))]);

    expect(requestUrls).toHaveBeenCalledTimes(1);
    expect(requestUrls.mock.calls[0][0]).toEqual([
      { typ: 'video', id: 'a1' }, { typ: 'video', id: 'a2' }, { typ: 'video', id: 'a3' }
    ]);
    expect(download.mock.calls.map((c) => c[0])).toEqual(['https://s/a1', 'https://s/a2']);
    expect(u1).toMatch(/^blob:poster-/);
    expect(u2).toMatch(/^blob:poster-/);
    expect(u3).toBeNull();
    // Gespeichert wird der Blob unter dem Content-Key, keine URL
    const eintrag = store.map.get('video:a1:2026-11-01T10:00:00Z');
    expect(eintrag.blob).toBeInstanceOf(Blob);
    expect(JSON.stringify(eintrag)).not.toContain('https://s/a1');

    expect(await cache.get(video('a1'))).toBe(u1);
    expect(cache.peek(video('a1'))).toBe(u1);
    expect(requestUrls).toHaveBeenCalledTimes(1);
  });

  it('liefert gespeicherte Poster ohne Netz und frischt lastAccess nur selten auf', async () => {
    const store = memoryStore();
    const tag = 24 * 60 * 60 * 1000;
    const clock = { t: 100 * tag };
    const frisch = 'video:a1:2026-11-01T10:00:00Z';
    const alt = 'video:a2:2026-11-01T10:00:00Z';
    store.map.set(frisch, { key: frisch, blob: blob('a1'), lastAccess: clock.t - 1000 });
    store.map.set(alt, { key: alt, blob: blob('a2'), lastAccess: clock.t - 2 * tag });
    const { cache, requestUrls } = setup({ store, clock, antwort: { posters: {} } });

    expect(await cache.get(video('a1'))).toMatch(/^blob:poster-/);
    expect(await cache.get(video('a2'))).toMatch(/^blob:poster-/);
    expect(requestUrls).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(store.map.get(frisch).lastAccess).toBe(clock.t - 1000);
    expect(store.map.get(alt).lastAccess).toBe(clock.t);
  });

  it('fragt ausstehende Poster erst nach der Sperrfrist erneut', async () => {
    let fertig = false;
    const { cache, requestUrls, clock } = setup({
      antwort: () => (fertig ? { posters: { a1: 'https://s/a1' } } : { posters: {}, ausstehend: ['a1'] })
    });

    expect(await cache.get(video('a1'))).toBeNull();
    expect(await cache.get(video('a1'))).toBeNull();
    expect(requestUrls).toHaveBeenCalledTimes(1);

    fertig = true;
    clock.t += 31_000;
    expect(await cache.get(video('a1'))).toMatch(/^blob:poster-/);
    expect(requestUrls).toHaveBeenCalledTimes(2);
  });

  it('sperrt Dateien ohne Poster oder ohne Zugriff deutlich laenger', async () => {
    const { cache, requestUrls, clock } = setup({ antwort: { posters: {}, ausstehend: [], ohne: ['a1'] } });
    await cache.get(video('a1'));
    clock.t += 5 * 60 * 1000;
    await cache.get(video('a1'));
    expect(requestUrls).toHaveBeenCalledTimes(1);
    clock.t += 6 * 60 * 1000;
    await cache.get(video('a1'));
    expect(requestUrls).toHaveBeenCalledTimes(2);
  });

  it('holt bei abgelaufener Signed URL einmal einen frischen Link', async () => {
    let call = 0;
    const { cache, requestUrls, download } = setup({
      antwort: () => ({ posters: { a1: `https://s/a1?token=${++call}` } }),
      download: async (url) => {
        if (url.endsWith('token=1')) throw new Error('Poster 400');
        return blob(url);
      }
    });

    expect(await cache.get(video('a1'))).toMatch(/^blob:poster-/);
    expect(requestUrls).toHaveBeenCalledTimes(2);
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('gibt nach zwei gescheiterten Downloads auf und liefert null', async () => {
    const { cache, requestUrls } = setup({
      antwort: { posters: { a1: 'https://s/a1' } },
      download: async () => { throw new Error('weg'); }
    });
    expect(await cache.get(video('a1'))).toBeNull();
    expect(requestUrls).toHaveBeenCalledTimes(2);
  });

  it('schaltet sich ab, wenn poster-urls fehlt (404)', async () => {
    const { cache, requestUrls, clock } = setup({
      antwort: () => { throw Object.assign(new Error('weg'), { status: 404 }); }
    });
    expect(await cache.get(video('a1'))).toBeNull();
    clock.t += 60 * 60 * 1000;
    expect(await cache.get(video('a2'))).toBeNull();
    expect(requestUrls).toHaveBeenCalledTimes(1);
  });

  it('fragt nichts an fuer Dateien ohne Pfad oder unbekannte Typen', async () => {
    const { cache, requestUrls } = setup({ antwort: { posters: {} } });
    expect(await cache.get({ id: 'x', type: 'video', asset: { id: 'x', file_url: 'https://dropbox/x' } })).toBeNull();
    expect(await cache.get({ id: 'y', type: 'ordner', asset: { id: 'y', file_path: '/y.mp4' } })).toBeNull();
    expect(requestUrls).not.toHaveBeenCalled();
  });

  it('nimmt nach einem Replace (neues created_at) nie die alten Bytes', async () => {
    const { cache, requestUrls } = setup({ antwort: { posters: { a1: 'https://s/a1' } } });
    const alt = await cache.get(video('a1'));
    const neu = await cache.get(video('a1', { created_at: '2026-11-05T08:00:00Z' }));
    expect(requestUrls).toHaveBeenCalledTimes(2);
    expect(neu).not.toBe(alt);
  });

  it('bildet Stills und Rohmaterial auf ihre Typen ab', async () => {
    const { cache, requestUrls } = setup({ antwort: { posters: {} } });
    await Promise.all([
      cache.get({ id: 's1', type: 'still', asset: { id: 's1', file_path: '/s1.jpg', created_at: 'c' } }),
      cache.get({ id: 'r1', type: 'roh', asset: { id: 'r1', file_path: '/r1.mov', created_at: 'c' } })
    ]);
    expect(requestUrls.mock.calls[0][0]).toEqual([{ typ: 'still', id: 's1' }, { typ: 'roh', id: 'r1' }]);
  });

  it('SharePoint-Dateien bekommen dieselbe Identitaet ueber id und lesbaren Pfad', async () => {
    const { cache, requestUrls, store } = setup({ antwort: { posters: { sp1: 'https://s/sp1' } } });
    const item = video('sp1', {
      file_url: 'https://contoso.sharepoint.com/sites/x/clip.mp4', ablage: 'sharepoint', drive_id: 'd', item_id: 'i', etag: 'e1'
    });
    expect(await cache.get(item)).toMatch(/^blob:poster-/);
    expect(requestUrls.mock.calls[0][0]).toEqual([{ typ: 'video', id: 'sp1' }]);
    expect(store.map.has('video:sp1:2026-11-01T10:00:00Z')).toBe(true);
  });
});
