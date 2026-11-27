import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createHandler } = require('../../netlify/functions/instagram-bild.js');
const { bildPfad, signaturOk } = require('../../netlify/functions/_shared/instagram-reels/bildSignatur.js');

const ENV = { APIFY_TOKEN: 'tok' };
const CDN = 'https://scontent-lax3-1.cdninstagram.com/v/t51/abc.jpg?stp=x&oe=6A38';

const query = (pfad) => Object.fromEntries(new URL(pfad, 'https://crm.test').searchParams);
const bildAntwort = (extra = {}) => ({
  ok: true, status: 200, url: CDN,
  headers: { get: () => 'image/jpeg' },
  arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  ...extra,
});

describe('Bild-Signatur', () => {
  it('signiert nur Instagram-CDN-URLs', () => {
    const pfad = bildPfad(CDN, ENV);
    expect(pfad).toMatch(/^\/\.netlify\/functions\/instagram-bild\?u=/);
    const { u, s } = query(pfad);
    expect(u).toBe(CDN);
    expect(signaturOk(u, s, ENV)).toBe(true);
    expect(signaturOk(`${u}x`, s, ENV)).toBe(false);
    expect(signaturOk(u, s, { APIFY_TOKEN: 'anders' })).toBe(false);
    expect(bildPfad('https://evil.com/a.jpg', ENV)).toBeNull();
    expect(bildPfad('http://scontent.cdninstagram.com/a.jpg', ENV)).toBeNull();
    expect(bildPfad(CDN, {})).toBeNull();
  });
});

describe('Function instagram-bild', () => {
  it('liefert ein signiertes Bild als Base64 mit Cache', async () => {
    const fetchImpl = vi.fn(async () => bildAntwort());
    const res = await createHandler({ env: ENV, fetchImpl })({ httpMethod: 'GET', queryStringParameters: query(bildPfad(CDN, ENV)) });
    expect(res.statusCode).toBe(200);
    expect(res.isBase64Encoded).toBe(true);
    expect(res.body).toBe(Buffer.from([1, 2, 3]).toString('base64'));
    expect(res.headers['Content-Type']).toBe('image/jpeg');
    expect(res.headers['Cache-Control']).toContain('max-age=86400');
    expect(fetchImpl.mock.calls[0][0]).toBe(CDN);
  });

  it('lehnt unsignierte und fremde URLs ab, ohne etwas zu laden', async () => {
    const fetchImpl = vi.fn();
    const h = createHandler({ env: ENV, fetchImpl });
    expect((await h({ httpMethod: 'GET', queryStringParameters: { u: CDN, s: 'falsch' } })).statusCode).toBe(403);
    expect((await h({ httpMethod: 'GET', queryStringParameters: { u: 'https://evil.com/a.jpg', s: 'x' } })).statusCode).toBe(403);
    expect((await h({ httpMethod: 'POST', queryStringParameters: query(bildPfad(CDN, ENV)) })).statusCode).toBe(405);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('gibt keine Nicht-Bilder und keine Weiterleitungen auf fremde Hosts aus', async () => {
    const params = query(bildPfad(CDN, ENV));
    const html = await createHandler({ env: ENV, fetchImpl: async () => bildAntwort({ headers: { get: () => 'text/html' } }) })({ httpMethod: 'GET', queryStringParameters: params });
    expect(html.statusCode).toBe(502);
    const weiter = await createHandler({ env: ENV, fetchImpl: async () => bildAntwort({ url: 'https://evil.com/x.jpg' }) })({ httpMethod: 'GET', queryStringParameters: params });
    expect(weiter.statusCode).toBe(502);
  });
});
