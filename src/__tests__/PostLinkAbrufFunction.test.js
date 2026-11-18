import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createHandler, abrufSperre, apiPatch } = require('../../netlify/functions/post-link-abruf.js');
const { extractShortcode, findMediaByShortcode, kennzahlenAusMedia } = require('../../netlify/functions/_shared/instagram-post-abruf.js');

const POST_ID = '11111111-2222-3333-4444-555555555555';
const REEL = 'https://www.instagram.com/reel/DABC123/?igsh=xyz';

const post = (extra = {}) => ({
  id: POST_ID,
  kooperation_id: 'ko1',
  plattform: 'ig_reel',
  link: REEL,
  account_handle: null,
  posted_at: null,
  metrics: {},
  confidence: null,
  source: 'api',
  status: 'draft',
  ...extra
});

const media = { id: 'm1', media_type: 'VIDEO', view_count: 5000, like_count: 120, comments_count: 9, timestamp: '2026-11-03T18:00:00+0000', permalink: 'https://www.instagram.com/reel/DABC123/' };

describe('Shortcode und Sperren', () => {
  it('liest Reel, /p/, /tv/ und Profil-Permalinks', () => {
    expect(extractShortcode(REEL)).toBe('DABC123');
    expect(extractShortcode('https://instagram.com/p/XYZ_9')).toBe('XYZ_9');
    expect(extractShortcode('https://www.instagram.com/lea/reel/QQ1/')).toBe('QQ1');
    expect(extractShortcode('https://instagram.com/lea')).toBeNull();
  });

  it('Story, TikTok und fehlender Link werden nicht abgerufen', () => {
    expect(abrufSperre(post({ link: 'https://instagram.com/stories/lea/123' }))).toMatch(/Stories/);
    expect(abrufSperre(post({ plattform: 'ig_story' }))).toMatch(/Stories/);
    expect(abrufSperre(post({ link: 'https://www.tiktok.com/@lea/video/1', plattform: 'tiktok' }))).toMatch(/TikTok/);
    expect(abrufSperre(post({ link: '' }))).toMatch(/kein Link/);
    expect(abrufSperre(post({ link: 'https://instagram.com/lea' }))).toMatch(/gültiger/);
    expect(abrufSperre(post())).toBeNull();
  });
});

describe('Zahlen zusammenführen', () => {
  const jetzt = new Date('2026-11-18T10:00:00Z');

  it('übernimmt Aufrufe, Likes, Kommentare und bestätigt', () => {
    const patch = apiPatch(post({ metrics: { reach: 800 } }), media, { username: 'lea', shortcode: 'DABC123', userId: 'u1', jetzt });
    expect(patch.metrics).toEqual({ reach: 800, views: 5000, likes: 120, comments: 9 });
    expect(patch).toMatchObject({
      status: 'confirmed', confirmed_by: 'u1', source: 'api', posted_at: '2026-11-03', measured_at: '2026-11-18', plattform: 'ig_reel'
    });
  });

  it('Werte aus dem Screenshot gewinnen, ein Entwurf mit KI-Werten bleibt Entwurf', () => {
    const vonKi = post({ metrics: { views: 6100, reach: 900 }, confidence: { views: 0.95, reach: 0.9 }, source: 'ki' });
    const patch = apiPatch(vonKi, media, { username: 'lea', shortcode: 'DABC123', userId: 'u1', jetzt });
    expect(patch.metrics).toEqual({ views: 6100, reach: 900, likes: 120, comments: 9 });
    expect(patch.source).toBe('ki');
    expect(patch).not.toHaveProperty('status');
  });

  it('Bild und Karussell werden zum Post', () => {
    expect(apiPatch(post(), { ...media, media_type: 'CAROUSEL_ALBUM' }, { username: 'lea', jetzt }).plattform).toBe('ig_post');
  });

  it('was Meta nicht liefert, fehlt statt 0', () => {
    expect(kennzahlenAusMedia({ like_count: 3 })).toEqual({ likes: 3 });
  });
});

describe('Suche in der Media-Liste', () => {
  beforeEach(() => { process.env.META_IG_USER_ID = 'ig1'; });

  it('blättert weiter, bis der Shortcode auftaucht', async () => {
    const graph = vi.fn()
      .mockResolvedValueOnce({ business_discovery: { media: { data: [{ permalink: 'https://instagram.com/reel/ANDERS/' }], paging: { cursors: { after: 'c1' } } } } })
      .mockResolvedValueOnce({ business_discovery: { media: { data: [media] } } });
    const res = await findMediaByShortcode('lea', 'DABC123', graph);
    expect(res.ok).toBe(true);
    expect(graph).toHaveBeenCalledTimes(2);
    expect(graph.mock.calls[1][1].fields).toContain('.after(c1)');
  });

  it('meldet Rate-Limit', async () => {
    const err = Object.assign(new Error('limit'), { meta: { code: 4, message: 'limit' } });
    const res = await findMediaByShortcode('lea', 'DABC123', vi.fn().mockRejectedValue(err));
    expect(res).toMatchObject({ ok: false, rate_limited: true });
  });
});

describe('Handler', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  function setup({ zeile = post(), creator = 'lea', findMedia = vi.fn().mockResolvedValue({ ok: true, media }) } = {}) {
    process.env.META_ACCESS_TOKEN = 't';
    process.env.META_IG_USER_ID = 'ig1';
    const updates = [];
    const caller = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: zeile, error: null }) }) }) })
    };
    const service = {
      from: (table) => table === 'kooperationen'
        ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { creator: { instagram: creator } } }) }) }) }
        : {
          update: (patch) => {
            updates.push(patch);
            return { eq: () => ({ select: () => ({ single: async () => ({ data: { ...zeile, ...patch }, error: null }) }) }) };
          }
        }
    };
    const handler = createHandler({
      verifyAuth: async () => ({ user: { id: 'u1' } }),
      callerClient: () => caller,
      serviceClient: () => service,
      findMedia
    });
    const call = (body = { postId: POST_ID }) => handler({ httpMethod: 'POST', headers: { authorization: 'Bearer jwt' }, body: JSON.stringify(body) });
    return { call, updates, findMedia };
  }

  it('ruft ab und gibt den Post zurück', async () => {
    const { call, updates, findMedia } = setup();
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(findMedia).toHaveBeenCalledWith('lea', 'DABC123');
    expect(updates[0].metrics.views).toBe(5000);
    expect(JSON.parse(res.body).post.status).toBe('confirmed');
  });

  it('Account am Post schlägt den Creator (Collab)', async () => {
    const { call, findMedia } = setup({ zeile: post({ account_handle: '@marke' }) });
    await call();
    expect(findMedia).toHaveBeenCalledWith('marke', 'DABC123');
  });

  it('Story-Link: 400 mit Grund, kein Abruf', async () => {
    const { call, findMedia } = setup({ zeile: post({ link: 'https://instagram.com/stories/lea/1', plattform: 'ig_story' }) });
    const res = await call();
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).hint).toMatch(/Screenshot/);
    expect(findMedia).not.toHaveBeenCalled();
  });

  it('Rate-Limit wird 429', async () => {
    const { call } = setup({ findMedia: vi.fn().mockResolvedValue({ ok: false, rate_limited: true, error: 'limit' }) });
    expect((await call()).statusCode).toBe(429);
  });

  it('ohne gültige postId 400', async () => {
    const { call } = setup();
    expect((await call({ postId: 'x' })).statusCode).toBe(400);
  });
});
