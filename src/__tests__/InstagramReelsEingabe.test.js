import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createHandler } = require('../../netlify/functions/instagram-reels-scraper.js');
const { profilName, pruefeEingabe } = require('../../netlify/functions/_shared/instagram-reels/eingabe.js');

const RUN_ID = '3KH8gEpp4d8uQSe8T';
const run = (status, extra = {}) => ({ id: RUN_ID, status, defaultDatasetId: 'ds1', startedAt: '2026-11-27T12:00:00.000Z', finishedAt: null, usageTotalUsd: 0.02, ...extra });
const antwort = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });

function handler({ env = { APIFY_TOKEN: 'tok' }, antworten = [] } = {}) {
  const fetchImpl = vi.fn(async () => antworten.shift() || antwort(500, { error: { message: 'unerwartet' } }));
  const h = createHandler({
    serviceClient: () => ({}),
    aufrufer: async () => ({ ok: true, benutzer: { rolle: 'admin', freigeschaltet: true } }),
    env,
    fetchImpl,
  });
  const call = async (body) => {
    const res = await h({ httpMethod: 'POST', body: JSON.stringify(body), headers: {} });
    return { status: res.statusCode, body: JSON.parse(res.body) };
  };
  return { call, fetchImpl };
}

describe('Instagram-Reels-Eingabe', () => {
  it('liest @name, name und Profil-Links', () => {
    expect(profilName('@Lea.Muster')).toBe('lea.muster');
    expect(profilName('lea_m')).toBe('lea_m');
    expect(profilName('https://www.instagram.com/lea_m/?hl=de')).toBe('lea_m');
    expect(profilName('instagram.com/lea_m/reels/')).toBe('lea_m');
    expect(profilName('https://www.instagram.com/reel/DXSL4JKEzK1/')).toBeNull();
    expect(profilName('https://evil.com/lea')).toBeNull();
    expect(profilName('lea..m')).toBeNull();
  });

  it('setzt angepinnte und Trial-Reels aus und lädt nichts herunter', () => {
    const r = pruefeEingabe({ profil: '@lea', anzahl: 40 });
    expect(r.input).toEqual({
      username: ['lea'],
      resultsLimit: 40,
      skipPinnedPosts: true,
      skipTrialReels: true,
      includeSharesCount: false,
      includeTranscript: false,
      includeDownloadedVideo: false,
    });
  });

  it('Anzahl Standard 50, zwischen 12 und 60', () => {
    expect(pruefeEingabe({ profil: 'lea' }).anzahl).toBe(50);
    expect(pruefeEingabe({ profil: 'lea', anzahl: 5 }).anzahl).toBe(12);
    expect(pruefeEingabe({ profil: 'lea', anzahl: 500 }).anzahl).toBe(60);
  });

  it('meldet leere und ungültige Profile', () => {
    expect(pruefeEingabe({}).fehler).toMatch(/Ein Instagram-Profil/);
    expect(pruefeEingabe({ profil: 'https://instagram.com/p/abc' }).fehler).toMatch(/Kein Instagram-Profil/);
  });
});

describe('Function instagram-reels-scraper', () => {
  it('startet apify~instagram-reel-scraper mit demselben Token', async () => {
    const { call, fetchImpl } = handler({ antworten: [antwort(201, { data: run('RUNNING') })] });
    const res = await call({ aktion: 'starten', profil: '@lea', anzahl: 50 });
    expect(res.status).toBe(200);
    expect(res.body.lauf).toMatchObject({ runId: RUN_ID, fertig: false });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.apify.com/v2/actors/apify~instagram-reel-scraper/runs?waitForFinish=15&maxTotalChargeUsd=0.5');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toMatchObject({ username: ['lea'], skipTrialReels: true });
  });

  it('Actor lässt sich über APIFY_INSTAGRAM_ACTOR tauschen', async () => {
    const { call, fetchImpl } = handler({
      env: { APIFY_TOKEN: 'tok', APIFY_INSTAGRAM_ACTOR: 'acme/reels', APIFY_TIKTOK_ACTOR: 'falsch/x' },
      antworten: [antwort(201, { data: run('RUNNING') })],
    });
    await call({ aktion: 'starten', profil: 'lea' });
    expect(fetchImpl.mock.calls[0][0]).toContain('/actors/acme~reels/runs');
  });

  it('liefert bei fertigem Lauf vorgefilterte Reels und Roh-Items', async () => {
    const reel = { id: '1', shortCode: 'A1', type: 'Video', productType: 'clips', ownerUsername: 'lea', timestamp: '2026-11-26T10:00:00.000Z', videoPlayCount: 1000, commentsCount: 3, caption: 'Hallo' };
    const { call } = handler({
      antworten: [antwort(200, { data: run('SUCCEEDED') }), antwort(200, [reel, { ...reel, id: '2', isPinned: true }])],
    });
    const res = await call({ aktion: 'stand', runId: RUN_ID });
    expect(res.body.ergebnis.reels.map((r) => r.id)).toEqual(['1']);
    expect(res.body.ergebnis.gefiltert[0].filter).toBe('angepinnt');
    expect(res.body.ergebnis.profil.name).toBe('lea');
    expect(res.body.ergebnis.roh).toHaveLength(2);
  });

  it('prüft die Eingabe, bevor Apify etwas kostet', async () => {
    const { call, fetchImpl } = handler();
    expect((await call({ aktion: 'starten', profil: '' })).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
