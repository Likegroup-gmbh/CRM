import { describe, it, expect, beforeEach, vi } from 'vitest';

// authorizedFetch holt sonst einen echten Supabase-Token; hier reicht der globale fetch-Mock.
vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: (...args) => globalThis.fetch(...args),
  getAccessToken: vi.fn(async () => 'tok'),
  setGuestJwt: vi.fn(),
}));

import { resolveStreamUrl, prefetchStreamUrl } from '../core/media/mediaSrc.js';
import { _clearAblageLinkCache } from '../core/ablage/ablageLink.js';

describe('resolveStreamUrl – Altbestand ausserhalb von SharePoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('liefert den gespeicherten Link unveraendert, ohne Netz', async () => {
    const url = 'https://www.dropbox.com/scl/fi/z/v.mp4?rlkey=k&raw=1';
    expect(await resolveStreamUrl({ file_path: '/x/v.mp4', file_url: url, ablage: 'dropbox', typ: 'video', id: 'a1' })).toBe(url);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('nur ein Pfad ohne Link: null', async () => {
    expect(await resolveStreamUrl({ file_path: '/x/a.mp4', file_url: null })).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('prefetchStreamUrl braucht fuer externe Links nichts', () => {
    prefetchStreamUrl({ file_path: '/x/a.mp4', file_url: 'https://example.com/a.mp4' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('resolveStreamUrl – SharePoint ueber ablage-link', () => {
  const sp = {
    file_path: '/Kampagne/clip.mp4',
    file_url: 'https://contoso.sharepoint.com/sites/x/Shared%20Documents/clip.mp4',
    typ: 'video', id: 'a1', ablage: 'sharepoint', etag: 'e1',
  };
  const linkAntwort = (links, fehlend = []) => vi.fn(async () => ({
    ok: true,
    json: async () => ({ links, fehlend }),
  }));
  const inEinerStunde = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

  beforeEach(() => {
    vi.restoreAllMocks();
    _clearAblageLinkCache();
  });

  it('holt den Lese-Link ueber ablage-link und cacht ihn', async () => {
    const fetchMock = linkAntwort({ a1: { url: 'https://contoso.sharepoint.com/dl/a1', laeuft_ab: inEinerStunde() } });
    global.fetch = fetchMock;

    expect(await resolveStreamUrl(sp)).toBe('https://contoso.sharepoint.com/dl/a1');
    expect(await resolveStreamUrl(sp)).toBe('https://contoso.sharepoint.com/dl/a1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/.netlify/functions/ablage-link');
    expect(JSON.parse(opts.body)).toEqual({ items: [{ typ: 'video', id: 'a1' }] });
  });

  it('fehlender Link: null statt der webUrl', async () => {
    const fetchMock = linkAntwort({}, ['a1']);
    global.fetch = fetchMock;

    expect(await resolveStreamUrl(sp)).toBeNull();
    expect(fetchMock.mock.calls.map(c => c[0])).toEqual(['/.netlify/functions/ablage-link']);
  });

  it('Netzfehler wirft nicht, sondern liefert null; mit werfen kommt der Fehler durch', async () => {
    global.fetch = vi.fn(async () => { throw new Error('offline'); });
    expect(await resolveStreamUrl(sp)).toBeNull();
    _clearAblageLinkCache();
    await expect(resolveStreamUrl(sp, { werfen: true })).rejects.toThrow('offline');
  });

  it('ohne typ kein Aufruf (Lookup ohne Medientyp)', async () => {
    global.fetch = vi.fn();
    expect(await resolveStreamUrl({ ...sp, typ: null })).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('prefetchStreamUrl waermt den Lese-Link vor, gleichzeitige Aufrufe gehen in einen Call', async () => {
    const fetchMock = linkAntwort({
      a1: { url: 'https://contoso.sharepoint.com/dl/a1', laeuft_ab: inEinerStunde() },
      s1: { url: 'https://contoso.sharepoint.com/dl/s1', laeuft_ab: inEinerStunde() },
    });
    global.fetch = fetchMock;

    prefetchStreamUrl(sp);
    prefetchStreamUrl({ ...sp, typ: 'story', id: 's1' });
    const url = await resolveStreamUrl(sp);

    expect(url).toBe('https://contoso.sharepoint.com/dl/a1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).items).toEqual([
      { typ: 'video', id: 'a1' }, { typ: 'story', id: 's1' },
    ]);
  });
});
