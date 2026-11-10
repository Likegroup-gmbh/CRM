import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(),
}));

import { authorizedFetch } from '../core/auth/getAccessToken.js';
import { ablageLink, istSharePoint, _clearAblageLinkCache } from '../core/ablage/ablageLink.js';

const T0 = Date.parse('2026-11-09T10:00:00Z');
const inEinerStunde = new Date(T0 + 60 * 60 * 1000).toISOString();

/** Antwortet fuer jede angefragte id mit einem Link, ausser fuer `fehlend`. */
function antwortet({ fehlend = [], laeuft_ab = inEinerStunde } = {}) {
  authorizedFetch.mockImplementation(async (_url, opts) => {
    const { items } = JSON.parse(opts.body);
    const links = {};
    for (const { id } of items) {
      if (!fehlend.includes(id)) links[id] = { url: `https://contoso.sharepoint.com/dl/${id}`, laeuft_ab };
    }
    return { ok: true, json: async () => ({ links, fehlend }) };
  });
}

const gesendet = (call) => JSON.parse(authorizedFetch.mock.calls[call][1].body).items;

describe('ablageLink', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    authorizedFetch.mockReset();
    _clearAblageLinkCache();
  });
  afterEach(() => vi.useRealTimers());

  it('sammelt gleichzeitige Aufrufe zu einem Call und fragt doppelte Dateien einmal an', async () => {
    antwortet();
    const ps = [
      ablageLink({ typ: 'video', id: 'v1', etag: 'e1' }),
      ablageLink({ typ: 'story', id: 's1' }),
      ablageLink({ typ: 'video', id: 'v1', etag: 'e1' }),
    ];
    expect(authorizedFetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(25);
    const [v1, s1, v1b] = await Promise.all(ps);

    expect(authorizedFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = authorizedFetch.mock.calls[0];
    expect(url).toBe('/.netlify/functions/ablage-link');
    expect(opts.method).toBe('POST');
    expect(gesendet(0)).toEqual([{ typ: 'video', id: 'v1' }, { typ: 'story', id: 's1' }]);
    expect(v1).toEqual({ url: 'https://contoso.sharepoint.com/dl/v1', laeuft_ab: inEinerStunde });
    expect(v1b).toEqual(v1);
    expect(s1.url).toBe('https://contoso.sharepoint.com/dl/s1');
  });

  it('schickt hoechstens 100 Dateien je Call', async () => {
    antwortet();
    const ps = Array.from({ length: 150 }, (_, i) => ablageLink({ typ: 'still', id: `b${i}` }));
    await vi.advanceTimersByTimeAsync(25);
    const links = await Promise.all(ps);

    expect(authorizedFetch).toHaveBeenCalledTimes(2);
    expect(gesendet(0)).toHaveLength(100);
    expect(gesendet(1)).toHaveLength(50);
    expect(links.every((l) => l?.url)).toBe(true);
  });

  it('cacht bis 5 Minuten vor Ablauf', async () => {
    antwortet();
    const erst = ablageLink({ typ: 'video', id: 'v1', etag: 'e1' });
    await vi.advanceTimersByTimeAsync(25);
    await erst;

    vi.setSystemTime(T0 + 54 * 60 * 1000);
    await ablageLink({ typ: 'video', id: 'v1', etag: 'e1' });
    expect(authorizedFetch).toHaveBeenCalledTimes(1);

    vi.setSystemTime(T0 + 56 * 60 * 1000);
    const neu = ablageLink({ typ: 'video', id: 'v1', etag: 'e1' });
    await vi.advanceTimersByTimeAsync(25);
    await neu;
    expect(authorizedFetch).toHaveBeenCalledTimes(2);
  });

  it('neues etag fragt neu an', async () => {
    antwortet();
    const a = ablageLink({ typ: 'video', id: 'v1', etag: 'e1' });
    await vi.advanceTimersByTimeAsync(25);
    await a;
    const b = ablageLink({ typ: 'video', id: 'v1', etag: 'e2' });
    await vi.advanceTimersByTimeAsync(25);
    await b;
    expect(authorizedFetch).toHaveBeenCalledTimes(2);
  });

  it('fehlende Dateien liefern null und werden nicht gecacht', async () => {
    antwortet({ fehlend: ['v9'] });
    const p = ablageLink({ typ: 'video', id: 'v9' });
    await vi.advanceTimersByTimeAsync(25);
    expect(await p).toBeNull();

    const q = ablageLink({ typ: 'video', id: 'v9' });
    await vi.advanceTimersByTimeAsync(25);
    await q;
    expect(authorizedFetch).toHaveBeenCalledTimes(2);
  });

  it('ohne typ/id oder fuer optimistische tmp-Zeilen: null ohne Anfrage', async () => {
    expect(await ablageLink({ typ: 'video', id: null })).toBeNull();
    expect(await ablageLink({ typ: null, id: 'v1' })).toBeNull();
    expect(await ablageLink({ typ: 'video', id: 'tmp-a1-9:16' })).toBeNull();
    await vi.advanceTimersByTimeAsync(25);
    expect(authorizedFetch).not.toHaveBeenCalled();
  });

  it('Serverfehler lehnt alle Aufrufe des Calls ab, der naechste Aufruf fragt neu', async () => {
    authorizedFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    const p = ablageLink({ typ: 'video', id: 'v1' });
    const q = ablageLink({ typ: 'roh', id: 'r1' });
    const fehler = Promise.allSettled([p, q]);
    await vi.advanceTimersByTimeAsync(25);
    const [a, b] = await fehler;
    expect(a.status).toBe('rejected');
    expect(b.status).toBe('rejected');

    antwortet();
    const r = ablageLink({ typ: 'video', id: 'v1' });
    await vi.advanceTimersByTimeAsync(25);
    expect((await r).url).toBe('https://contoso.sharepoint.com/dl/v1');
  });
});

describe('istSharePoint', () => {
  it('nur ablage = sharepoint', () => {
    expect(istSharePoint({ ablage: 'sharepoint' })).toBe(true);
    expect(istSharePoint({ ablage: 'dropbox' })).toBe(false);
    expect(istSharePoint({})).toBe(false);
    expect(istSharePoint(null)).toBe(false);
  });
});
