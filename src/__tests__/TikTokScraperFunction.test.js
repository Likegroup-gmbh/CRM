import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createHandler } = require('../../netlify/functions/tiktok-scraper.js');
const { videoLink, profilName, pruefeEingabe } = require('../../netlify/functions/_shared/tiktok/eingabe.js');
const { auswerten } = require('../../netlify/functions/_shared/tiktok/ergebnis.js');
const { apifyKonfig } = require('../../netlify/functions/_shared/tiktok/apify.js');

const VIDEO = 'https://www.tiktok.com/@shaiie_foeva/video/7533731959172861206';
const RUN_ID = '3KH8gEpp4d8uQSe8T';

const autor = { name: 'shaiie_foeva', nickName: 'Shaiie', fans: 2200000, heart: 126000000, video: 1036, following: 0, verified: false, avatar: 'https://p16.tiktokcdn.com/a.jpeg', signature: 'SHOP' };
const videoItem = (extra = {}) => ({
  id: '7533731959172861206', text: 'Hallo', createTimeISO: '2025-08-01T21:27:45.000Z',
  authorMeta: autor, webVideoUrl: VIDEO, videoMeta: { duration: 74, coverUrl: 'https://p16.tiktokcdn.com/c.jpeg' },
  playCount: 573900, diggCount: 25900, commentCount: 346, shareCount: 352, collectCount: 1356,
  isAd: false, isSponsored: false, isPinned: false, ...extra,
});
const fehlerItem = { url: 'https://www.tiktok.com/@privat', input: 'privat', error: 'Profile is private', errorCode: 'PROFILE_PRIVATE' };

const run = (status, extra = {}) => ({ id: RUN_ID, status, defaultDatasetId: 'ds1', startedAt: '2026-11-25T12:00:00.000Z', finishedAt: null, usageTotalUsd: 0.01, ...extra });
const antwort = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });

function handler({ rolle = 'admin', env = { APIFY_TOKEN: 'tok' }, antworten = [] } = {}) {
  const fetchImpl = vi.fn(async () => antworten.shift() || antwort(500, { error: { message: 'unerwartet' } }));
  const h = createHandler({
    serviceClient: () => ({}),
    aufrufer: async () => ({ ok: true, benutzer: { rolle, freigeschaltet: true } }),
    env,
    fetchImpl,
  });
  const call = async (body, method = 'POST') => {
    const res = await h({ httpMethod: method, body: JSON.stringify(body), headers: {} });
    return { status: res.statusCode, body: JSON.parse(res.body) };
  };
  return { call, fetchImpl };
}

describe('TikTok-Eingabe', () => {
  it('normalisiert Video-Links und lässt Kurzlinks stehen', () => {
    expect(videoLink(`${VIDEO}?is_from_webapp=1&sender_device=pc`)).toBe(VIDEO);
    expect(videoLink('www.tiktok.com/@lea.m/video/7533731959172861206/')).toBe('https://www.tiktok.com/@lea.m/video/7533731959172861206');
    expect(videoLink('https://vm.tiktok.com/ZMabc123/')).toBe('https://vm.tiktok.com/ZMabc123/');
    expect(videoLink('https://www.tiktok.com/@lea')).toBeNull();
    expect(videoLink('https://evil.com/@lea/video/7533731959172861206')).toBeNull();
  });

  it('liest Profile aus @name, name und Profil-Link', () => {
    expect(profilName('@Lea.Muster')).toBe('lea.muster');
    expect(profilName('lea_m')).toBe('lea_m');
    expect(profilName('https://www.tiktok.com/@lea_m?lang=de')).toBe('lea_m');
    expect(profilName(VIDEO)).toBeNull();
    expect(profilName('a')).toBeNull();
  });

  it('baut den Actor-Input ohne kostenpflichtige Filter und ohne Downloads', () => {
    const r = pruefeEingabe({ videos: `${VIDEO}\n\n${VIDEO}?x=1`, profile: '@lea\nlea', anzahl: 5 });
    expect(r.ok).toBe(true);
    expect(r.input).toMatchObject({
      postURLs: [VIDEO], profiles: ['lea'], resultsPerPage: 5,
      profileScrapeSections: ['videos'], profileSorting: 'latest',
      shouldDownloadVideos: false, shouldDownloadCovers: false, scrapeRelatedVideos: false,
    });
    expect(r.input).not.toHaveProperty('oldestPostDateUnified');
    expect(r.input).not.toHaveProperty('newestPostDate');
  });

  it('blockiert ungültige Zeilen, leere Eingaben und zu viele Profile', () => {
    expect(pruefeEingabe({ videos: 'https://instagram.com/reel/x' }).fehler).toMatch(/Kein TikTok-Video-Link: „https:\/\/instagram/);
    expect(pruefeEingabe({ profile: VIDEO }).fehler).toMatch(/Kein TikTok-Profil/);
    expect(pruefeEingabe({}).fehler).toMatch(/Mindestens/);
    expect(pruefeEingabe({ profile: 'aa\nbb\ncc\ndd\nee\nff' }).fehler).toMatch(/Höchstens 5 Profile/);
  });

  it('begrenzt die Anzahl auf 1 bis 30, Standard 10', () => {
    expect(pruefeEingabe({ profile: 'lea', anzahl: 0 }).anzahl).toBe(10);
    expect(pruefeEingabe({ profile: 'lea', anzahl: 99 }).anzahl).toBe(30);
    expect(pruefeEingabe({ profile: 'lea', anzahl: '7' }).anzahl).toBe(7);
  });
});

describe('TikTok-Ergebnis', () => {
  it('trennt Videos, Profile und Fehler-Items', () => {
    const r = auswerten([videoItem(), videoItem({ id: '2', isAd: true }), fehlerItem, null]);
    expect(r.videos).toHaveLength(2);
    expect(r.videos[0]).toMatchObject({
      url: VIDEO, autor: 'shaiie_foeva', aufrufe: 573900, likes: 25900, kommentare: 346,
      shares: 352, gespeichert: 1356, dauer: 74, werbung: false, quelle: 'link',
    });
    expect(r.videos[1].werbung).toBe(true);
    expect(r.profile).toEqual([expect.objectContaining({ name: 'shaiie_foeva', follower: 2200000, likes: 126000000, videos: 1036 })]);
    expect(r.fehler).toEqual([{ eingabe: 'privat', url: 'https://www.tiktok.com/@privat', code: 'PROFILE_PRIVATE', text: 'Profile is private' }]);
  });
});

describe('Function tiktok-scraper', () => {
  it('nur POST, nur Admins, nur mit Token', async () => {
    expect((await handler().call({}, 'GET')).status).toBe(405);

    const mitarbeiter = handler({ rolle: 'mitarbeiter' });
    expect((await mitarbeiter.call({ aktion: 'starten', profile: 'lea' })).status).toBe(403);
    expect(mitarbeiter.fetchImpl).not.toHaveBeenCalled();

    const ohneToken = await handler({ env: {} }).call({ aktion: 'starten', profile: 'lea' });
    expect(ohneToken).toEqual({ status: 500, body: { error: 'APIFY_TOKEN fehlt in der Netlify-Umgebung' } });
  });

  it('startet den Actor mit Wartezeit, Kostendeckel und Bearer-Token', async () => {
    const { call, fetchImpl } = handler({ antworten: [antwort(201, { data: run('RUNNING') })] });
    const res = await call({ aktion: 'starten', videos: VIDEO, profile: '@lea', anzahl: 3 });

    expect(res.status).toBe(200);
    expect(res.body.lauf).toMatchObject({ runId: RUN_ID, status: 'RUNNING', fertig: false, konsoleUrl: `https://console.apify.com/view/runs/${RUN_ID}` });
    expect(res.body.ergebnis).toBeUndefined();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.apify.com/v2/actors/clockworks~tiktok-scraper/runs?waitForFinish=15&maxTotalChargeUsd=0.5');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toMatchObject({ postURLs: [VIDEO], profiles: ['lea'], resultsPerPage: 3 });
  });

  it('prüft die Eingabe, bevor Apify etwas kostet', async () => {
    const { call, fetchImpl } = handler();
    const res = await call({ aktion: 'starten', videos: 'kein link' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Kein TikTok-Video-Link/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('stand lädt bei fertigem Lauf die Dataset-Items', async () => {
    const { call, fetchImpl } = handler({
      antworten: [
        antwort(200, { data: run('SUCCEEDED', { finishedAt: '2026-11-25T12:00:40.000Z' }) }),
        antwort(200, [videoItem(), fehlerItem]),
      ],
    });
    const res = await call({ aktion: 'stand', runId: RUN_ID });

    expect(res.status).toBe(200);
    expect(res.body.lauf.fertig).toBe(true);
    expect(res.body.ergebnis.videos).toHaveLength(1);
    expect(res.body.ergebnis.fehler).toHaveLength(1);
    expect(res.body.ergebnis.roh).toHaveLength(2);
    expect(fetchImpl.mock.calls[0][0]).toBe(`https://api.apify.com/v2/actor-runs/${RUN_ID}?waitForFinish=15`);
    expect(fetchImpl.mock.calls[1][0]).toBe('https://api.apify.com/v2/datasets/ds1/items?format=json&clean=true&limit=200');
  });

  it('auch ein fehlgeschlagener Lauf liefert seine Fehler-Items', async () => {
    const { call } = handler({
      antworten: [antwort(200, { data: run('FAILED', { statusMessage: 'Invalid input' }) }), antwort(200, [fehlerItem])],
    });
    const res = await call({ aktion: 'stand', runId: RUN_ID });
    expect(res.body.lauf).toMatchObject({ status: 'FAILED', statusText: 'Invalid input', fertig: true });
    expect(res.body.ergebnis.fehler[0].code).toBe('PROFILE_PRIVATE');
  });

  it('lehnt ungültige Lauf-IDs und unbekannte Aktionen ab', async () => {
    const { call, fetchImpl } = handler();
    expect((await call({ aktion: 'stand', runId: '../acts' })).status).toBe(400);
    expect((await call({ aktion: 'stand' })).status).toBe(400);
    expect((await call({ aktion: 'loeschen', runId: RUN_ID })).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('meldet Apify-Fehler verständlich', async () => {
    const { call } = handler({ antworten: [antwort(401, { error: { type: 'token-not-valid', message: 'Authentication token is not valid' } })] });
    const res = await call({ aktion: 'starten', profile: 'lea' });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Apify lehnt den Token ab (401): Authentication token is not valid');
  });

  it('bricht einen Lauf ab', async () => {
    const { call, fetchImpl } = handler({ antworten: [antwort(200, { data: run('ABORTING') })] });
    const res = await call({ aktion: 'abbrechen', runId: RUN_ID });
    expect(res.body.lauf.status).toBe('ABORTING');
    expect(fetchImpl.mock.calls[0][0]).toBe(`https://api.apify.com/v2/actor-runs/${RUN_ID}/abort`);
    expect(fetchImpl.mock.calls[0][1].method).toBe('POST');
  });

  it('Actor und Kostendeckel kommen aus der Umgebung', () => {
    expect(apifyKonfig({ APIFY_TOKEN: ' t ', APIFY_TIKTOK_ACTOR: 'clockworks/free-tiktok-scraper', APIFY_MAX_USD: '2' }))
      .toEqual({ token: 't', actor: 'clockworks~free-tiktok-scraper', maxUsd: 2 });
    expect(apifyKonfig({ APIFY_MAX_USD: '' }).maxUsd).toBe(0.5);
  });
});
