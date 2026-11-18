import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ankerAus, bereinigeMetrics, einheitIdVon, ladePosts, postAusZeile, spaltenAus
} from '../modules/auswertung/auswertungPostsDaten.js';

const zeile = (extra = {}) => ({
  id: 'p1',
  kampagne_id: 'k1',
  produktion_id: 'pr1',
  kooperation_id: 'ko1',
  video_id: 'v1',
  story_id: null,
  still_id: null,
  video_asset_id: 'a1',
  story_asset_id: null,
  plattform: 'ig_reel',
  account_handle: 'lea',
  link: 'https://instagram.com/reel/X',
  posted_at: '2026-11-01',
  measured_at: '2026-11-08',
  metrics: { views: 1200, likes: 80 },
  confidence: null,
  source: 'api',
  status: 'confirmed',
  ki_status: null,
  ki_fehler: null,
  screenshot_pfade: [],
  confirmed_by: 'u1',
  ...extra
});

describe('Einheit-Schlüssel', () => {
  it('folgt dem Anker wie einheitenAusBaum', () => {
    expect(einheitIdVon({ video_id: 'v1' })).toBe('video:v1');
    expect(einheitIdVon({ story_id: 's1' })).toBe('story:s1');
    expect(einheitIdVon({ still_id: 'b1' })).toBe('still:b1');
    expect(einheitIdVon({})).toBeNull();
  });

  it('ankerAus ist die Umkehrung, Unbekanntes ergibt null', () => {
    expect(ankerAus('video:v1')).toEqual({ video_id: 'v1' });
    expect(ankerAus('story:s1')).toEqual({ story_id: 's1' });
    expect(ankerAus('still:b1')).toEqual({ still_id: 'b1' });
    expect(ankerAus('koop:x')).toBeNull();
    expect(ankerAus('video:')).toBeNull();
  });
});

describe('Zeile → Post', () => {
  it('setzt Felder, Datei und Bestätiger', () => {
    const post = postAusZeile(zeile(), new Map([['u1', 'Mara']]));
    expect(post).toMatchObject({
      id: 'p1', einheitId: 'video:v1', dateiId: 'a1', plattform: 'ig_reel', accountHandle: 'lea',
      postedAt: '2026-11-01', measuredAt: '2026-11-08', metrics: { views: 1200, likes: 80 },
      source: 'api', status: 'confirmed', confirmedBy: 'Mara', screenshots: 0, kiStatus: null
    });
  });

  it('beim Still ist der Anker die Datei', () => {
    const post = postAusZeile(zeile({ video_id: null, video_asset_id: null, still_id: 'b1', plattform: 'ig_post' }));
    expect(post.einheitId).toBe('still:b1');
    expect(post.dateiId).toBe('b1');
  });

  it('nur endliche Zahlen bleiben in metrics', () => {
    expect(bereinigeMetrics({ views: 5, likes: '7', reach: null, saves: NaN, shares: 0 })).toEqual({ views: 5, shares: 0 });
  });

  it('zählt Screenshots und trägt den KI-Stand', () => {
    const post = postAusZeile(zeile({ screenshot_pfade: ['k1/p1/a.png', 'k1/p1/b.png'], ki_status: 'fehler', ki_fehler: 'unlesbar' }));
    expect(post).toMatchObject({ screenshots: 2, kiStatus: 'fehler', kiFehler: 'unlesbar' });
  });

  it('ein KI-Lauf ohne Antwort nach drei Minuten gilt als Fehler, gezählt ab ki_gestartet_at', () => {
    const jetzt = Date.parse('2026-11-18T10:00:00Z');
    const vor = (min) => new Date(jetzt - min * 60000).toISOString();
    const laeuft = (extra) => postAusZeile(zeile({ ki_status: 'laeuft', ki_schritt: 'ki', ...extra }), new Map(), jetzt);
    expect(laeuft({ ki_gestartet_at: vor(2), updated_at: vor(0) })).toMatchObject({ kiStatus: 'laeuft', kiSchritt: 'ki', kiGestartetAt: vor(2) });
    expect(laeuft({ ki_gestartet_at: vor(4), updated_at: vor(0) })).toMatchObject({ kiStatus: 'fehler', kiSchritt: 'ki', kiFehler: expect.stringMatching(/nicht geantwortet/) });
    expect(laeuft({ ki_gestartet_at: null, updated_at: vor(4) }).kiStatus).toBe('fehler');
  });
});

describe('Post → Spalten', () => {
  it('schreibt nur übergebene Schlüssel, nie den Scope', () => {
    const spalten = spaltenAus({ postedAt: '2026-11-02', metrics: { views: 9, x: 'a' }, kooperationId: 'fremd' }, 'video:v1');
    expect(spalten).toEqual({ posted_at: '2026-11-02', metrics: { views: 9 } });
  });

  it('die Datei landet in der Spalte des Ankers', () => {
    expect(spaltenAus({ dateiId: 'a2' }, 'video:v1')).toEqual({ video_asset_id: 'a2' });
    expect(spaltenAus({ dateiId: 'sa1' }, 'story:s1')).toEqual({ story_asset_id: 'sa1' });
    expect(spaltenAus({ dateiId: 'b1' }, 'still:b1')).toEqual({});
  });

  it('leerer Link wird null', () => {
    expect(spaltenAus({ link: '  ' }, 'video:v1')).toEqual({ link: null });
  });
});

describe('ladePosts', () => {
  afterEach(() => { delete window.supabase; });

  function fakeSupabase({ posts, benutzer = [] }) {
    const calls = [];
    const builder = (table) => {
      const q = {
        filters: [],
        select() { return q; },
        eq(col, val) { q.filters.push([col, val]); return q; },
        in(col, vals) { q.filters.push([col, vals]); return q; },
        order() { return Promise.resolve({ data: posts, error: null }); },
        then(resolve) { return Promise.resolve({ data: table === 'benutzer' ? benutzer : posts, error: null }).then(resolve); }
      };
      calls.push({ table, q });
      return q;
    };
    window.supabase = { from: vi.fn(builder) };
    return calls;
  }

  it('filtert nach Kampagne und Produktion und löst Namen auf', async () => {
    const calls = fakeSupabase({ posts: [zeile()], benutzer: [{ auth_user_id: 'u1', name: 'Mara' }] });
    const posts = await ladePosts({ kampagneId: 'k1', produktionId: 'pr1' });
    expect(calls[0].table).toBe('kooperation_post');
    expect(calls[0].q.filters).toEqual([['kampagne_id', 'k1'], ['produktion_id', 'pr1']]);
    expect(posts[0].confirmedBy).toBe('Mara');
  });

  it('Kampagnenebene ohne Produktionsfilter', async () => {
    const calls = fakeSupabase({ posts: [] });
    await ladePosts({ kampagneId: 'k1' });
    expect(calls[0].q.filters).toEqual([['kampagne_id', 'k1']]);
  });
});
