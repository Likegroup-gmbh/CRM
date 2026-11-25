import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { JETZT, autor, videoItem, profilItems } from './TikTokProfilTestKit.js';

const require = createRequire(import.meta.url);
const { alsMedia, profilKennzahlen, WERBE_MARKER } = require('../../netlify/functions/_shared/tiktok/kennzahlen.js');
const { auswerten } = require('../../netlify/functions/_shared/tiktok/ergebnis.js');
const { CALC_VERSION } = require('../../netlify/functions/_shared/instagram-cpm.js');
const { poolReicht, bauePoolRecord, itemUpdateAusPool } = require('../../netlify/functions/_shared/tiktok/pool.js');
const { profilInput, profilAusItems, PROFIL_VIDEOS } = require('../../netlify/functions/_shared/tiktok/profil-abruf.js');

const videosAus = (items) => auswerten(items).videos;

describe('TikTok-Kennzahlen', () => {
  it('bildet Videos auf die Media-Form der Instagram-Rechnung ab', () => {
    const [video] = videosAus([videoItem(1, { isSponsored: true, playCount: null })]);
    expect(alsMedia(video)).toMatchObject({
      id: 'v1', media_type: 'VIDEO', like_count: 50, comments_count: 10,
      permalink: 'https://www.tiktok.com/@lea.m/video/1', ad_marker: WERBE_MARKER,
    });
    expect(alsMedia(video).view_count).toBeUndefined();
    expect(alsMedia({ ...video, werbung: false }).ad_marker).toBeNull();
  });

  it('rechnet Schnitt 12/30 und Engagement ohne Angepinnte, Werbung und zu frische Videos', () => {
    const items = [
      videoItem(90, { alterTage: 1, views: 999999 }),
      videoItem(91, { alterTage: 3, views: 5000000, isPinned: true }),
      videoItem(92, { alterTage: 4, views: 1000000, isAd: true }),
      ...profilItems(35),
    ];
    const k = profilKennzahlen(videosAus(items), 50000, JETZT);
    expect(k.views_12).toBe(1000);
    expect(k.views_30).toBe(1000);
    expect(k.engagement_rate).toBe(6);
    expect(k.stats).toMatchObject({
      calc_version: CALC_VERSION, engagement_rate: 6, skipped_too_recent: 1, skipped_ads: 1, skipped_pinned: 1,
    });
    expect(k.stats.used_12).toHaveLength(12);
    expect(k.stats.used_30).toHaveLength(30);
    expect(k.stats).not.toHaveProperty('ohne_trials');
    expect(k.stats.skipped_videos.every((s) => s.reason !== 'trial_views')).toBe(true);
  });

  it('rechnet das Engagement auf Views, unabhängig von den Followern und ohne viralen Ausreißer', () => {
    const items = [videoItem(1, { views: 900000, diggCount: 90000, commentCount: 0 }), ...profilItems(10).slice(1)];
    const mitWenig = profilKennzahlen(videosAus(items), 1000, JETZT);
    const mitViel = profilKennzahlen(videosAus(items), 1000000, JETZT);

    expect(mitWenig.engagement_rate).toBe(6);
    expect(mitViel.engagement_rate).toBe(6);
  });

  it('liefert null statt Preisen, wenn keine Videos oder Follower da sind', () => {
    const k = profilKennzahlen([], null, JETZT);
    expect(k.views_12).toBeNull();
    expect(k.views_30).toBeNull();
    expect(k.engagement_rate).toBeNull();
  });
});

describe('TikTok-Profillauf', () => {
  it('fragt 40 Videos ohne Angepinnte an', () => {
    expect(profilInput('lea.m')).toMatchObject({
      profiles: ['lea.m'], resultsPerPage: PROFIL_VIDEOS, excludePinnedPosts: true, postURLs: [],
    });
  });

  it('nimmt nur Profil und Videos des angefragten Handles', () => {
    const r = profilAusItems(profilItems(3), 'lea.m');
    expect(r.ok).toBe(true);
    expect(r.profil.follower).toBe(50000);
    expect(r.videos).toHaveLength(3);

    const fremd = profilAusItems(profilItems(3, autor({ name: 'andere' })), 'lea.m');
    expect(fremd).toEqual({ ok: false, fehler: 'Das Ergebnis gehört zu @andere, nicht zu @lea.m' });
  });

  it('übersetzt Fehler-Items und leere Ergebnisse', () => {
    const privat = [{ input: 'lea.m', error: 'Profile is private', errorCode: 'PROFILE_PRIVATE' }];
    expect(profilAusItems(privat, 'lea.m').fehler).toBe('Profil ist privat');
    const weg = [{ input: 'lea.m', error: 'User not found' }];
    expect(profilAusItems(weg, 'lea.m').fehler).toBe('Profil nicht gefunden');
    expect(profilAusItems([], 'lea.m', { status: 'FAILED' }).fehler).toBe('Apify-Lauf endete mit FAILED');
    expect(profilAusItems([], 'lea.m', { status: 'SUCCEEDED' }).fehler).toMatch(/keine Videos/);
  });
});

describe('TikTok-Pool', () => {
  const kennzahlen = { views_12: 1200, views_30: 1100, engagement_rate: 0.5, stats: { calc_version: CALC_VERSION, engagement_rate: 0.5 } };
  const profil = { name: 'lea.m', nickName: 'Lea M', follower: 50000, videos: 120, likes: 900000, verifiziert: true, bio: 'Mail: lea@example.com', bioLink: null };
  const jetzt = '2026-11-25T12:00:00.000Z';

  it('reicht nur mit Abrufdatum, aktueller Rechenversion und ohne force', () => {
    const pool = { tt_fetched_at: jetzt, tt_stats: { calc_version: CALC_VERSION } };
    expect(poolReicht(pool)).toBe(true);
    expect(poolReicht(pool, true)).toBe(false);
    expect(poolReicht({ ...pool, tt_stats: { calc_version: CALC_VERSION - 1 } })).toBe(false);
    expect(poolReicht({ tt_stats: { calc_version: CALC_VERSION } })).toBe(false);
    expect(poolReicht(null)).toBe(false);
  });

  it('baut den Pool-Eintrag und nimmt Kontakt aus der Bio nur ohne vorhandene Werte', () => {
    const bild = { url: 'https://s/a.avif', thumbUrl: 'https://s/a-t.avif' };
    const neu = bauePoolRecord({ username: 'lea.m', profil, kennzahlen, bild, pool: null, jetzt });
    expect(neu).toMatchObject({
      tt_username: 'lea.m', link_tiktok: 'https://www.tiktok.com/@lea.m', name: 'Lea M',
      follower_tiktok: 50000, tt_views_12: 1200, tt_views_30: 1100, email: 'lea@example.com',
      profile_image_url: bild.url, profile_image_thumb_url: bild.thumbUrl, tt_fetched_at: jetzt, tt_fetch_error: null,
    });
    expect(neu.tt_stats).toMatchObject({ username: 'lea.m', biography: profil.bio, verifiziert: true, calc_version: CALC_VERSION });

    const vonHand = bauePoolRecord({ username: 'lea.m', profil, kennzahlen, bild: null, pool: { email: 'hand@x.de', profile_image_url: 'https://s/alt.avif' }, jetzt });
    expect(vonHand.email).toBe('hand@x.de');
    expect(vonHand.profile_image_url).toBe('https://s/alt.avif');
  });

  it('schreibt TikTok-Werte immer, Name, Bild und Kontakt nur in leere Felder', () => {
    const pool = bauePoolRecord({ username: 'lea.m', profil, kennzahlen, bild: { url: 'https://s/a.avif' }, pool: null, jetzt });
    const leer = itemUpdateAusPool(pool, { name: '', notiz: '' });
    expect(leer).toMatchObject({ name: 'Lea M', email: 'lea@example.com', profile_image_url: 'https://s/a.avif', notiz: profil.bio, tt_views_12: 1200 });

    const gefuellt = itemUpdateAusPool(pool, { name: 'Lea', email: 'x@y.de', profile_image_url: 'https://ig/bild.avif', notiz: 'steht schon' });
    expect(gefuellt).toMatchObject({ follower_tiktok: 50000, tt_views_30: 1100, tt_fetch_error: null });
    expect(gefuellt).not.toHaveProperty('name');
    expect(gefuellt).not.toHaveProperty('email');
    expect(gefuellt).not.toHaveProperty('profile_image_url');
    expect(gefuellt).not.toHaveProperty('notiz');
  });
});
