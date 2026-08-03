import { describe, it, expect } from 'vitest';
import {
  computeInstagramCpm,
  formatCpmDebug,
  detectOutliers,
  toCpm,
  CPM_RATE,
  MIN_AGE_HOURS,
  CALC_VERSION
} from '../../netlify/functions/_shared/instagram-cpm.js';

const NOW = Date.parse('2026-07-28T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

/** Video vor `daysAgo` Tagen hochgeladen */
function video(daysAgo, views, extra = {}) {
  return {
    id: `v-${daysAgo}-${views}`,
    media_type: 'VIDEO',
    media_product_type: 'REELS',
    view_count: views,
    timestamp: new Date(NOW - daysAgo * DAY).toISOString(),
    permalink: `https://instagram.com/reel/${daysAgo}-${views}`,
    ...extra
  };
}

function image(daysAgo, extra = {}) {
  return {
    id: `i-${daysAgo}`,
    media_type: 'IMAGE',
    timestamp: new Date(NOW - daysAgo * DAY).toISOString(),
    permalink: `https://instagram.com/p/${daysAgo}`,
    ...extra
  };
}

/** n Videos mit konstanter View-Zahl, beginnend bei `startDaysAgo` */
function videoSeries(n, views, startDaysAgo = 5) {
  return Array.from({ length: n }, (_, i) => video(startDaysAgo + i, views));
}

/** Videos aus einer View-Liste, neuestes zuerst */
function videosAus(viewsListe, startDaysAgo = 5) {
  return viewsListe.map((views, i) => video(startDaysAgo + i, views));
}

describe('computeInstagramCpm – 4-Tage-Regel', () => {
  it('ignoriert Videos die jünger als 4 Tage sind', () => {
    const media = [
      video(1, 999999),   // zu frisch, Views noch nicht ausgereift
      video(2, 888888),   // zu frisch
      ...videoSeries(8, 10000, 5)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.skipped_too_recent).toBe(2);
    expect(stats.skipped_videos).toHaveLength(2);
    expect(stats.skipped_videos.every((v) => v.reason === 'too_recent')).toBe(true);
    expect(stats.skipped_videos.map((v) => v.views).sort((a, b) => b - a)).toEqual([999999, 888888]);
    expect(stats.skipped_videos[0].age_hours).toBeLessThan(MIN_AGE_HOURS);
    expect(stats.sample_8).toBe(8);
    expect(stats.views_8).toBe(10000);
  });

  it('lässt das 9. Video ins 8er-Fenster nachrücken, wenn das neueste zu frisch ist', () => {
    // Ohne die 4-Tage-Regel waere das Fenster [500000, 7x 10000],
    // mit ihr rueckt das aelteste Video mit 2000 Views nach.
    const media = [
      video(1, 500000),
      ...videoSeries(7, 10000, 5),
      video(20, 2000)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });

    // 7x 10000 + 1x 2000 = 72000 / 8 = 9000
    expect(stats.sample_8).toBe(8);
    expect(stats.views_8).toBe(9000);
  });

  it('behandelt exakt 4 Tage alte Videos als auswertbar', () => {
    const stats = computeInstagramCpm([video(4, 5000)], { now: NOW });
    expect(stats.videos_available).toBe(1);
    expect(stats.skipped_too_recent).toBe(0);
  });
});

describe('computeInstagramCpm – Medientypen', () => {
  it('ignoriert Bild-Posts und Karussells', () => {
    const media = [
      image(5),
      { id: 'c1', media_type: 'CAROUSEL_ALBUM', timestamp: new Date(NOW - 6 * DAY).toISOString() },
      ...videoSeries(8, 4000, 7)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.videos_available).toBe(8);
    expect(stats.views_8).toBe(4000);
  });

  it('ignoriert Videos ohne view_count', () => {
    const media = [
      video(5, 10000),
      { ...video(6, 0), view_count: undefined },
      video(7, 20000)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });
    expect(stats.videos_available).toBe(2);
  });

  it('zählt Videos mit 0 Views mit', () => {
    const stats = computeInstagramCpm([video(5, 0), video(6, 1000)], { now: NOW });
    expect(stats.videos_available).toBe(2);
  });
});

describe('computeInstagramCpm – Fenster', () => {
  it('gibt null zurück, wenn das 8er-Fenster nicht voll ist', () => {
    const stats = computeInstagramCpm(videoSeries(7, 10000), { now: NOW });

    expect(stats.views_8).toBeNull();
    expect(stats.views_8_clean).toBeNull();
    expect(stats.cpm_8).toBeNull();
    expect(stats.cpm_8_clean).toBeNull();
    expect(stats.views_30).toBeNull();
    expect(stats.views_30_clean).toBeNull();
  });

  it('gibt die 30er-Werte erst bei 30 auswertbaren Videos aus', () => {
    const knapp = computeInstagramCpm(videoSeries(29, 10000), { now: NOW });
    expect(knapp.views_30).toBeNull();
    expect(knapp.views_30_clean).toBeNull();
    expect(knapp.views_8).toBe(10000);

    const voll = computeInstagramCpm(videoSeries(30, 10000), { now: NOW });
    expect(voll.views_30).toBe(10000);
    expect(voll.views_30_clean).toBe(10000);
  });

  it('begrenzt das 30er-Fenster auf die 30 neuesten Videos', () => {
    const media = [...videoSeries(30, 10000, 5), ...videoSeries(10, 1, 40)];
    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.sample_30).toBe(30);
    expect(stats.views_30).toBe(10000);
    expect(stats.videos_available).toBe(40);
    expect(stats.videos).toHaveLength(30);
  });

  it('sortiert unsortierte Media neueste zuerst', () => {
    const media = [video(30, 1000), video(5, 9000), video(12, 5000)];
    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.videos.map(v => v.views)).toEqual([9000, 5000, 1000]);
  });
});

describe('detectOutliers', () => {
  it('erkennt einen Ausreißer nach oben', () => {
    const { indices, details } = detectOutliers([40000, 45000, 48000, 50000, 52000, 55000, 60000, 1000000]);

    expect([...indices]).toEqual([7]);
    expect(details[0].side).toBe('high');
    expect(details[0].views).toBe(1000000);
  });

  it('erkennt einen Ausreißer nach unten', () => {
    const { indices, details } = detectOutliers([40000, 45000, 48000, 50000, 52000, 55000, 60000, 10]);

    expect([...indices]).toEqual([7]);
    expect(details[0].side).toBe('low');
  });

  it('lässt eine normale Streuung unangetastet', () => {
    const values = [30000, 38000, 45000, 51000, 55000, 62000, 70000, 90000];
    expect(detectOutliers(values).indices.size).toBe(0);
  });

  it('greift bei einem engen Account nicht, solange der Faktor zum Median klein bleibt', () => {
    // MAD ist hier winzig, der Z-Score allein wuerde 80000 kippen - der
    // Mindestabstand von Faktor 2.5 zum Median (~50000) haelt dagegen
    const values = [48000, 49000, 49500, 50000, 50500, 51000, 52000, 80000];
    expect(detectOutliers(values).indices.size).toBe(0);
  });

  it('erkennt unterhalb von 5 Werten keine Ausreißer', () => {
    expect(detectOutliers([10, 20, 30, 1000000]).indices.size).toBe(0);
  });

  it('bleibt bei identischen Werten ruhig', () => {
    expect(detectOutliers(Array(30).fill(1000)).indices.size).toBe(0);
  });

  it('erkennt Ausreißer nach oben und unten gleichzeitig', () => {
    const values = [10, 40000, 45000, 48000, 50000, 52000, 55000, 1000000];
    const { indices, details } = detectOutliers(values);

    expect(indices.size).toBe(2);
    expect(details.find(d => d.side === 'high').views).toBe(1000000);
    expect(details.find(d => d.side === 'low').views).toBe(10);
  });

  it('entfernt im 8er-Fenster höchstens einen Wert je Seite', () => {
    const values = [50000, 50000, 50000, 50000, 50000, 500000, 900000, 1000000];
    const { indices, details } = detectOutliers(values);

    expect(indices.size).toBe(1);
    expect(details[0].views).toBe(1000000);
  });

  it('lässt einen zweigipfligen Account in Ruhe', () => {
    // Die Haelfte der Reels liegt oben, die andere unten - das ist keine
    // Reihe mit Ausreissern mehr, sondern schlicht ein anderes Profil
    const values = [5, 10, 20, 40000, 50000, 55000, 900000, 1000000];
    expect(detectOutliers(values).indices.size).toBe(0);
  });

  it('entfernt im 30er-Fenster höchstens drei Werte je Seite', () => {
    const values = [
      ...Array(24).fill(50000),
      2000000, 3000000, 4000000, 5000000, 6000000, 7000000
    ];
    const { indices, details } = detectOutliers(values);

    expect(indices.size).toBe(3);
    expect(details.every(d => d.side === 'high')).toBe(true);
    expect(details.map(d => d.views)).toEqual([7000000, 6000000, 5000000]);
  });

  it('kommt mit leeren Eingaben klar', () => {
    expect(detectOutliers([]).indices.size).toBe(0);
    expect(detectOutliers(null).indices.size).toBe(0);
  });
});

describe('computeInstagramCpm – Ausreißer im Fenster', () => {
  it('liefert 8er-Schnitt mit und ohne Ausreißer', () => {
    const media = videosAus([1000000, 60000, 55000, 52000, 50000, 48000, 45000, 40000]);
    const stats = computeInstagramCpm(media, { now: NOW });

    // mit: (1000000 + 350000) / 8 = 168750
    expect(stats.views_8).toBe(168750);
    // ohne: 350000 / 7 = 50000
    expect(stats.views_8_clean).toBe(50000);
    expect(stats.outliers_8).toHaveLength(1);
    expect(stats.outliers_8[0]).toMatchObject({ views: 1000000, side: 'high' });
    expect(stats.outliers_8[0].permalink).toBe('https://instagram.com/reel/5-1000000');
  });

  it('gibt ohne erkannte Ausreißer denselben Wert wie mit zurück', () => {
    const media = videosAus([90000, 70000, 62000, 55000, 51000, 45000, 38000, 30000]);
    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.views_8_clean).toBe(stats.views_8);
    expect(stats.outliers_8).toEqual([]);
  });

  it('erkennt Ausreißer im 8er- und 30er-Fenster getrennt', () => {
    // Der 1M-Reel liegt im 8er-Fenster, der 10-Views-Reel weiter hinten nur im 30er
    const media = videosAus([
      1000000, ...Array(7).fill(50000),
      ...Array(21).fill(50000), 10
    ]);
    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.outliers_8.map(o => o.views)).toEqual([1000000]);
    expect(stats.outliers_30.map(o => o.views).sort((a, b) => b - a)).toEqual([1000000, 10]);
    expect(stats.views_30_clean).toBe(50000);
  });

});

describe('CPM-Preis', () => {
  it('rechnet Views / 1000 * 25 EUR', () => {
    expect(toCpm(10000)).toBe(250);
    expect(toCpm(1000)).toBe(CPM_RATE);
    expect(toCpm(0)).toBe(0);
  });

  it('rundet auf Cent', () => {
    expect(toCpm(1234)).toBe(30.85);
  });

  it('leitet alle vier CPM-Werte aus den Views ab', () => {
    const stats = computeInstagramCpm(videoSeries(30, 20000), { now: NOW });

    expect(stats.cpm_8).toBe(500);
    expect(stats.cpm_8_clean).toBe(500);
    expect(stats.cpm_30).toBe(500);
    expect(stats.cpm_30_clean).toBe(500);
  });

  it('rechnet den bereinigten Preis aus dem bereinigten Schnitt', () => {
    const media = videosAus([1000000, 60000, 55000, 52000, 50000, 48000, 45000, 40000]);
    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.cpm_8_clean).toBe(toCpm(50000));
    expect(stats.cpm_8).toBe(toCpm(168750));
  });
});

describe('computeInstagramCpm – Randfälle', () => {
  it('kommt mit leerer oder fehlender Media-Liste klar', () => {
    for (const input of [[], null, undefined]) {
      const stats = computeInstagramCpm(input, { now: NOW });
      expect(stats.views_8).toBeNull();
      expect(stats.views_8_clean).toBeNull();
      expect(stats.views_30).toBeNull();
      expect(stats.views_30_clean).toBeNull();
      expect(stats.videos_available).toBe(0);
    }
  });

  it('gibt die verwendeten Videos für den Tooltip zurück', () => {
    const stats = computeInstagramCpm([video(5, 7000)], { now: NOW });

    expect(stats.videos[0]).toEqual({
      permalink: 'https://instagram.com/reel/5-7000',
      views: 7000,
      timestamp: new Date(NOW - 5 * DAY).toISOString()
    });
  });

  it('stempelt die Version der Rechenlogik mit', () => {
    const stats = computeInstagramCpm(videoSeries(8, 10000), { now: NOW });
    expect(stats.calc_version).toBe(CALC_VERSION);
  });
});

describe('formatCpmDebug', () => {
  it('baut skipped/included/summary fuer die Konsole', () => {
    const stats = computeInstagramCpm([
      video(1, 500000),
      ...videoSeries(8, 10000, 5)
    ], { now: NOW });

    const debug = formatCpmDebug('demo_user', stats, { source: 'meta' });

    expect(debug.username).toBe('demo_user');
    expect(debug.source).toBe('meta');
    expect(debug.rules.MIN_AGE_HOURS).toBe(MIN_AGE_HOURS);
    expect(debug.rules.CALC_VERSION).toBe(CALC_VERSION);
    expect(debug.skipped).toHaveLength(1);
    expect(debug.skipped[0].views).toBe(500000);
    expect(debug.included).toHaveLength(8);
    expect(debug.summary.views_8).toBe(10000);
    expect(debug.summary.views_8_clean).toBe(10000);
    expect(debug.summary.formula).toContain(String(CPM_RATE));
  });

  it('führt die erkannten Ausreißer je Fenster auf', () => {
    const stats = computeInstagramCpm(
      videosAus([1000000, 60000, 55000, 52000, 50000, 48000, 45000, 40000]),
      { now: NOW }
    );

    const debug = formatCpmDebug('demo_user', stats, { source: 'meta' });

    expect(debug.outliers.window_8).toHaveLength(1);
    expect(debug.outliers.window_30).toEqual([]);
  });

});
