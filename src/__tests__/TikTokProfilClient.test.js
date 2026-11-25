import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(),
}));

const { authorizedFetch } = await import('../core/auth/getAccessToken.js');
const { tiktokProfilAbrufen, TIKTOK_PROFIL_ENDPOINT } = await import('../core/tiktok/tiktokProfil.js');
const { laufBisFertig } = await import('../core/tiktok/apifyLauf.js');

const RUN_ID = '3KH8gEpp4d8uQSe8T';
const antwort = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const bodies = () => authorizedFetch.mock.calls.map(([, init]) => JSON.parse(init.body));

describe('TikTok-Profilabruf (Client)', () => {
  beforeEach(() => authorizedFetch.mockReset());

  it('nimmt einen Pool-Treffer ohne Abfrage des Stands', async () => {
    authorizedFetch.mockResolvedValueOnce(antwort(200, { ok: true, fertig: true, source: 'pool', username: 'lea.m', item: { id: 'i1' }, pool_fetched_at: '2026-11-20' }));
    const r = await tiktokProfilAbrufen({ itemId: 'i1' });

    expect(authorizedFetch.mock.calls[0][0]).toBe(TIKTOK_PROFIL_ENDPOINT);
    expect(bodies()).toEqual([{ aktion: 'starten', item_id: 'i1', force: false }]);
    expect(r).toEqual({ item: { id: 'i1' }, fields: null, source: 'pool', username: 'lea.m', poolFetchedAt: '2026-11-20' });
  });

  it('fragt den Stand mit runId und Ziel ab, bis der Lauf fertig ist', async () => {
    authorizedFetch
      .mockResolvedValueOnce(antwort(200, { ok: true, fertig: false, runId: RUN_ID }))
      .mockResolvedValueOnce(antwort(200, { ok: true, fertig: false, runId: RUN_ID }))
      .mockResolvedValueOnce(antwort(200, { ok: true, fertig: true, source: 'apify', fields: { follower_tiktok: 5 } }));
    const beimWarten = vi.fn();
    const r = await tiktokProfilAbrufen({ link: 'https://www.tiktok.com/@lea.m', force: true, pauseMs: 0, beimWarten });

    expect(beimWarten).toHaveBeenCalledTimes(1);
    expect(bodies()).toEqual([
      { aktion: 'starten', link: 'https://www.tiktok.com/@lea.m', force: true },
      { aktion: 'stand', runId: RUN_ID, link: 'https://www.tiktok.com/@lea.m' },
      { aktion: 'stand', runId: RUN_ID, link: 'https://www.tiktok.com/@lea.m' },
    ]);
    expect(r).toMatchObject({ item: null, fields: { follower_tiktok: 5 }, source: 'apify' });
  });

  it('wirft mit Meldung, Status und Hinweis der Function', async () => {
    authorizedFetch.mockResolvedValueOnce(antwort(422, { error: 'Profil ist privat', hint: 'Link prüfen' }));
    const err = await tiktokProfilAbrufen({ itemId: 'i1' }).catch((e) => e);
    expect(err.message).toBe('Profil ist privat');
    expect(err.status).toBe(422);
    expect(err.hint).toBe('Link prüfen');
  });

  it('endet still, wenn der Aufrufer abbricht', async () => {
    authorizedFetch.mockResolvedValue(antwort(200, { ok: true, fertig: false, runId: RUN_ID }));
    let weg = false;
    const p = tiktokProfilAbrufen({ itemId: 'i1', pauseMs: 0, istAbgebrochen: () => weg });
    await vi.waitFor(() => expect(authorizedFetch.mock.calls.length).toBeGreaterThanOrEqual(2));
    weg = true;
    expect(await p).toBeNull();
  });

  it('gibt nach der Höchstdauer mit eigener Meldung auf', async () => {
    const post = vi.fn(async () => ({ fertig: false }));
    await expect(laufBisFertig(post, {}, {
      istFertig: (a) => a.fertig, standBody: () => ({}), pauseMs: 0, maxMs: -1, zeitText: 'zu lange',
    })).rejects.toThrow('zu lange');
    expect(post).toHaveBeenCalledTimes(1);
  });
});
