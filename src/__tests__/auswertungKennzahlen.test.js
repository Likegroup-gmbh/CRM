import { describe, it, expect } from 'vitest';
import {
  berechneKennzahlen,
  einheitStatus,
  engagementRate,
  fortschritt,
  interaktionen,
  messTage,
  topPosts
} from '../modules/auswertung/auswertungKennzahlen.js';

const post = (id, plattform, metrics, extra = {}) => ({
  id, einheitId: extra.einheitId || `e-${id}`, plattform, metrics, status: 'confirmed', ...extra
});

describe('Kennzahlen', () => {
  it('rechnet die Engagement-Rate gewichtet über die Summen', () => {
    const posts = [
      post('a', 'ig_reel', { views: 1000, reach: 100, likes: 50 }),
      post('b', 'ig_reel', { views: 10000, reach: 10000, likes: 100 })
    ];
    // gewichtet: 150 / 10100, Durchschnitt der Raten wäre (0,5 + 0,01) / 2
    expect(engagementRate(posts)).toBeCloseTo(150 / 10100, 6);
  });

  it('nimmt bei TikTok die Aufrufe als Basis', () => {
    expect(engagementRate([post('t', 'tiktok', { views: 2000, likes: 100, shares: 100 })])).toBeCloseTo(0.1, 6);
  });

  it('zählt fehlende Interaktionsfelder als 0', () => {
    expect(interaktionen({ metrics: { likes: 3, replies: 2 } })).toBe(5);
  });

  it('zählt nur bestätigte Posts', () => {
    const k = berechneKennzahlen([
      post('a', 'tiktok', { views: 100 }),
      post('b', 'tiktok', { views: 900 }, { status: 'draft' })
    ]);
    expect(k.anzahl).toBe(1);
    expect(k.aufrufe).toBe(100);
  });

  it('liefert null statt 0, wenn eine Kennzahl keine Grundlage hat', () => {
    const k = berechneKennzahlen([post('t', 'tiktok', { views: 500, likes: 10 })]);
    expect(k.reach).toBeNull();
    expect(k.linkKlicks).toBeNull();
    expect(k.wiedergabe).toBeNull();
    expect(k.zielQuote).toBeNull();
  });

  it('rechnet Kosten pro 1.000 Aufrufe nur mit Verbrauch', () => {
    const posts = [post('a', 'tiktok', { views: 20000 })];
    expect(berechneKennzahlen(posts).kostenPro1000).toBeNull();
    expect(berechneKennzahlen(posts, { verbrauch: 0 }).kostenPro1000).toBeNull();
    expect(berechneKennzahlen(posts, { verbrauch: 1000 }).kostenPro1000).toBeCloseTo(50, 6);
  });

  it('zählt Link-Klicks nur aus Stories', () => {
    const k = berechneKennzahlen([
      post('s', 'ig_story', { views: 100, linkClicks: 7 }),
      post('r', 'ig_reel', { views: 100, linkClicks: 99 })
    ]);
    expect(k.linkKlicks).toBe(7);
    expect(k.linkKlicksStories).toBe(1);
  });

  it('zählt Sticker-Taps getrennt von Link-Klicks, nur aus Stories', () => {
    const k = berechneKennzahlen([
      post('s1', 'ig_story', { views: 89826, linkClicks: 3063, stickerTaps: 136 }),
      post('s2', 'ig_story', { views: 500, linkClicks: 10 })
    ]);
    expect(k.linkKlicks).toBe(3073);
    expect(k.stickerTaps).toBe(136);
    expect(k.stickerTapsStories).toBe(1);
    expect(berechneKennzahlen([post('t', 'tiktok', { views: 1 })]).stickerTaps).toBeNull();
  });

  it('Story-Likes zählen zu den Interaktionen, Sticker-Taps nicht', () => {
    expect(interaktionen({ metrics: { likes: 468, replies: 18, stickerTaps: 136, linkClicks: 3063 } })).toBe(486);
  });

  it('nennt die Tage zwischen Post und Messung', () => {
    expect(messTage({ postedAt: '2026-10-01', measuredAt: '2026-10-08' })).toBe(7);
    expect(messTage({ postedAt: '2026-10-01' })).toBeNull();
  });

  it('hebt die drei Posts mit den meisten Aufrufen hervor', () => {
    const posts = [10, 50, 30, 40].map((v, i) => post(`p${i}`, 'tiktok', { views: v }));
    expect(topPosts(posts)).toEqual(['p1', 'p3', 'p2']);
  });
});

describe('Status der Einheiten', () => {
  it('zählt „Fehlt“ pro Einheit, nicht pro Datei', () => {
    const einheiten = [
      { id: 'v1', erwartet: true },
      { id: 'v2', erwartet: true },
      { id: 'v3', erwartet: false }
    ];
    const posts = [
      post('a', 'ig_reel', { views: 1 }, { einheitId: 'v1', dateiId: 'f-916' }),
      post('b', 'tiktok', { views: 1 }, { einheitId: 'v1', dateiId: 'f-45' })
    ];
    expect(fortschritt(einheiten, posts)).toEqual({ bestaetigt: 2, pruefen: 0, fehlt: 1, offen: 1, gesamt: 3 });
  });

  it('erwartet von Paid-Linien keinen Post', () => {
    expect(einheitStatus({ erwartet: false }, [])).toBe('optional');
    expect(einheitStatus({ erwartet: true }, [])).toBe('fehlt');
    expect(einheitStatus({ erwartet: true }, [{ status: 'draft' }])).toBe('pruefen');
  });
});
