import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import {
  RUN_ID, ITEM_ID, JETZT, autor, run, antwort, profilItems, fakeSupabase, itemZeile,
} from './TikTokProfilTestKit.js';

const require = createRequire(import.meta.url);
const { createHandler } = require('../../netlify/functions/tiktok-profil.js');
const { CALC_VERSION } = require('../../netlify/functions/_shared/instagram-cpm.js');

const poolZeile = (extra = {}) => ({
  id: 'pool-1', tt_username: 'lea.m', link_tiktok: 'https://www.tiktok.com/@lea.m', name: 'Lea M',
  follower_tiktok: 48000, tt_views_12: 900, tt_views_30: 800, tt_stats: { calc_version: CALC_VERSION, engagement_rate: 1.5 },
  profile_image_url: 'https://s/pool.avif', profile_image_thumb_url: 'https://s/pool-t.avif',
  email: null, telefon: null, wohnort: null, tt_fetched_at: '2026-11-20T10:00:00.000Z', ...extra,
});

function handler({
  rolle = 'mitarbeiter',
  db = fakeSupabase({ creator_auswahl_items: [itemZeile()] }),
  antworten = [],
  sichtbar = async () => ({ id: ITEM_ID }),
  env = { APIFY_TOKEN: 'tok' },
} = {}) {
  const fetchImpl = vi.fn(async () => antworten.shift() || antwort(500, { error: { message: 'unerwartet' } }));
  const storeImagePair = vi.fn(async () => ({ url: 'https://s/neu.avif', thumbUrl: 'https://s/neu-t.avif' }));
  const h = createHandler({
    serviceClient: () => db,
    aufrufer: async () => ({ ok: true, benutzer: { id: 'ben-1', rolle, freigeschaltet: true }, caller: {} }),
    sichtbar,
    storeImagePair,
    env,
    fetchImpl,
    now: () => JETZT,
  });
  const call = async (body, method = 'POST') => {
    const res = await h({ httpMethod: method, body: JSON.stringify(body), headers: {} });
    return { status: res.statusCode, body: JSON.parse(res.body) };
  };
  return { call, fetchImpl, storeImagePair, db };
}

const item = (db) => db.tabellen.creator_auswahl_items[0];

describe('tiktok-profil Function', () => {
  it('lässt nur POST, bekannte Aktionen und Staff zu', async () => {
    const { call, fetchImpl } = handler({ rolle: 'kunde' });
    expect((await call({}, 'GET')).status).toBe(405);
    expect((await call({ aktion: 'loeschen' })).status).toBe(400);
    expect((await call({ aktion: 'stand', runId: 'x' })).status).toBe(400);
    expect((await call({ aktion: 'starten', item_id: ITEM_ID })).status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('meldet 404, wenn der Aufrufer die Zeile nicht sieht, und 400 ohne gültigen Link', async () => {
    const { call } = handler({ sichtbar: async () => null });
    expect((await call({ aktion: 'starten', item_id: ITEM_ID })).status).toBe(404);
    expect((await call({ aktion: 'starten', item_id: 'kein-uuid' })).status).toBe(400);

    const ohneLink = handler({ db: fakeSupabase({ creator_auswahl_items: [itemZeile({ link_tiktok: null })] }) });
    const r = await ohneLink.call({ aktion: 'starten', item_id: ITEM_ID });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/TikTok-Profil-Link/);
  });

  it('nimmt einen aktuellen Pool-Eintrag ohne Apify-Lauf', async () => {
    const db = fakeSupabase({ creator_auswahl_items: [itemZeile()], sourcing_creator_tiktok: [poolZeile()] });
    const { call, fetchImpl } = handler({ db, env: {} });
    const r = await call({ aktion: 'starten', item_id: ITEM_ID });

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, fertig: true, source: 'pool', username: 'lea.m', pool_fetched_at: '2026-11-20T10:00:00.000Z' });
    expect(r.body.item).toMatchObject({ follower_tiktok: 48000, tt_views_12: 900, name: 'Lea M', profile_image_url: 'https://s/pool.avif' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('startet bei force trotz Pool einen Lauf und meldet den laufenden Stand', async () => {
    const db = fakeSupabase({ creator_auswahl_items: [itemZeile()], sourcing_creator_tiktok: [poolZeile()] });
    const { call, fetchImpl } = handler({ db, antworten: [antwort(201, { data: run('RUNNING') })] });
    const r = await call({ aktion: 'starten', item_id: ITEM_ID, force: true });

    expect(r.body).toEqual({ ok: true, fertig: false, runId: RUN_ID, username: 'lea.m' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/actors/clockworks~tiktok-scraper/runs');
    expect(new URL(url).searchParams.get('waitForFinish')).toBe('10');
    expect(JSON.parse(init.body)).toMatchObject({ profiles: ['lea.m'], resultsPerPage: 40, excludePinnedPosts: true });
  });

  it('übernimmt einen fertigen Lauf in Pool und Zeile', async () => {
    const { call, db, storeImagePair, fetchImpl } = handler({
      antworten: [antwort(200, { data: run('SUCCEEDED') }), antwort(200, profilItems(35))],
    });
    const r = await call({ aktion: 'stand', runId: RUN_ID, item_id: ITEM_ID });

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, fertig: true, source: 'apify', username: 'lea.m' });
    expect(fetchImpl.mock.calls[1][0]).toContain('/datasets/ds1/items');
    expect(storeImagePair).toHaveBeenCalledWith(db, 'https://p16.tiktokcdn.com/a.jpeg', 'sourcing/pool-tiktok/lea.m/profil');

    const [pool] = db.tabellen.sourcing_creator_tiktok;
    expect(pool).toMatchObject({ tt_username: 'lea.m', follower_tiktok: 50000, tt_views_12: 1000, created_by: 'ben-1', email: 'lea@example.com' });
    expect(item(db)).toMatchObject({
      follower_tiktok: 50000, tt_views_12: 1000, tt_views_30: 1000, name: 'Lea M',
      profile_image_url: 'https://s/neu.avif', email: 'lea@example.com', tt_fetch_error: null,
    });
    expect(item(db).tt_stats).toMatchObject({ engagement_rate: 6, calc_version: CALC_VERSION });
  });

  it('schreibt nichts, wenn das Ergebnis zu einem anderen Handle gehört', async () => {
    const { call, db } = handler({
      antworten: [antwort(200, { data: run('SUCCEEDED') }), antwort(200, profilItems(5, autor({ name: 'andere' })))],
    });
    const r = await call({ aktion: 'stand', runId: RUN_ID, item_id: ITEM_ID });

    expect(r.status).toBe(422);
    expect(r.body.error).toBe('Das Ergebnis gehört zu @andere, nicht zu @lea.m');
    expect(r.body.hint).toMatch(/öffentlich/);
    expect(db.tabellen.sourcing_creator_tiktok).toHaveLength(0);
    expect(item(db).tt_fetch_error).toBe(r.body.error);
    expect(item(db).follower_tiktok).toBeUndefined();
  });

  it('meldet private Profile als 422 und Apify-Fehler als 502', async () => {
    const privat = handler({
      antworten: [antwort(200, { data: run('SUCCEEDED') }), antwort(200, [{ input: 'lea.m', error: 'Profile is private', errorCode: 'PROFILE_PRIVATE' }])],
    });
    const r = await privat.call({ aktion: 'stand', runId: RUN_ID, item_id: ITEM_ID });
    expect(r.status).toBe(422);
    expect(r.body.error).toBe('Profil ist privat');

    const kaputt = handler({ antworten: [antwort(401, { error: { message: 'bad token' } })] });
    const k = await kaputt.call({ aktion: 'starten', item_id: ITEM_ID });
    expect(k.status).toBe(502);
    expect(k.body.error).toMatch(/Token/);
    expect(item(kaputt.db).tt_fetch_error).toBeUndefined();
  });

  it('liefert ohne item_id nur die Felder als Vorschau', async () => {
    const { call, db } = handler({
      antworten: [antwort(201, { data: run('SUCCEEDED') }), antwort(200, profilItems(35))],
    });
    const r = await call({ aktion: 'starten', link: 'https://www.tiktok.com/@Lea.M?lang=de' });

    expect(r.status).toBe(200);
    expect(r.body.fields).toMatchObject({ link_tiktok: 'https://www.tiktok.com/@lea.m', follower_tiktok: 50000, tt_views_12: 1000 });
    expect(r.body).not.toHaveProperty('item');
    expect(db.log.filter((l) => l.tabelle === 'creator_auswahl_items')).toHaveLength(0);
    expect(db.tabellen.sourcing_creator_tiktok).toHaveLength(1);
  });

  it('braucht für einen Lauf den Apify-Token', async () => {
    const { call } = handler({ env: {} });
    const r = await call({ aktion: 'starten', item_id: ITEM_ID });
    expect(r.status).toBe(500);
    expect(r.body.error).toMatch(/APIFY_TOKEN/);
  });
});
