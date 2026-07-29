import { describe, it, expect } from 'vitest';
import {
  computeInstagramCpm,
  trimmedAverage,
  toCpm,
  CPM_RATE
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

describe('computeInstagramCpm – 4-Tage-Regel', () => {
  it('ignoriert Videos die jünger als 4 Tage sind', () => {
    const media = [
      video(1, 999999),   // zu frisch, Views noch nicht ausgereift
      video(2, 888888),   // zu frisch
      ...videoSeries(8, 10000, 5)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.skipped_too_recent).toBe(2);
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
    expect(stats.views_trimmed).toBe(500);
  });
});

describe('computeInstagramCpm – Fenster', () => {
  it('gibt null zurück, wenn das 8er-Fenster nicht voll ist', () => {
    const stats = computeInstagramCpm(videoSeries(7, 10000), { now: NOW });

    expect(stats.views_8).toBeNull();
    expect(stats.cpm_8).toBeNull();
    expect(stats.views_30).toBeNull();
    // Der getrimmte Wert braucht kein volles Fenster
    expect(stats.views_trimmed).toBe(10000);
  });

  it('gibt cpm_30 erst bei 30 auswertbaren Videos aus', () => {
    const knapp = computeInstagramCpm(videoSeries(29, 10000), { now: NOW });
    expect(knapp.views_30).toBeNull();
    expect(knapp.views_8).toBe(10000);

    const voll = computeInstagramCpm(videoSeries(30, 10000), { now: NOW });
    expect(voll.views_30).toBe(10000);
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

describe('trimmedAverage – Ausreißer', () => {
  it('kappt bei 30 Werten je 3 oben und unten', () => {
    // 27x 1000 plus drei extreme Ausreisser nach oben
    const values = [...Array(27).fill(1000), 5000000, 6000000, 7000000];
    expect(trimmedAverage(values)).toBe(1000);
  });

  it('kappt bei kleinen Stichproben mindestens einen Wert je Seite', () => {
    // 5 Werte: floor(5 * 0.1) = 0 -> Minimum 1 greift
    expect(trimmedAverage([1, 10, 20, 30, 1000])).toBe(20);
  });

  it('kappt unterhalb von 5 Werten nicht', () => {
    expect(trimmedAverage([10, 20, 1000, 30])).toBe(265);
  });

  it('gibt null für eine leere Liste zurück', () => {
    expect(trimmedAverage([])).toBeNull();
  });

  it('meldet die tatsächlich verwendete Stichprobengröße', () => {
    const stats = computeInstagramCpm(videoSeries(30, 10000), { now: NOW });
    expect(stats.trimmed_count).toBe(24); // 30 - 2 * 3
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

  it('leitet alle drei CPM-Werte aus den Views ab', () => {
    const stats = computeInstagramCpm(videoSeries(30, 20000), { now: NOW });

    expect(stats.cpm_8).toBe(500);
    expect(stats.cpm_30).toBe(500);
    expect(stats.cpm_trimmed).toBe(500);
  });
});

describe('computeInstagramCpm – Randfälle', () => {
  it('kommt mit leerer oder fehlender Media-Liste klar', () => {
    for (const input of [[], null, undefined]) {
      const stats = computeInstagramCpm(input, { now: NOW });
      expect(stats.views_8).toBeNull();
      expect(stats.views_30).toBeNull();
      expect(stats.views_trimmed).toBeNull();
      expect(stats.cpm_trimmed).toBeNull();
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
});
