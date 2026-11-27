import { describe, it, expect } from 'vitest';
import {
  computeInstagramCpm,
  toCpm,
  CPM_RATE,
  MIN_AGE_HOURS,
  CALC_VERSION
} from '../../netlify/functions/_shared/instagram-cpm.js';
import { NOW, DAY, AUSREISSER_12, video, image, videoSeries, videosAus } from './instagramCpmTestKit.js';

describe('computeInstagramCpm – 4-Tage-Regel', () => {
  it('ignoriert Videos die jünger als 4 Tage sind', () => {
    const media = [
      video(1, 999999),   // zu frisch, Views noch nicht ausgereift
      video(2, 888888),   // zu frisch
      ...videoSeries(12, 10000, 5)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.skipped_too_recent).toBe(2);
    expect(stats.skipped_videos).toHaveLength(2);
    expect(stats.skipped_videos.every((v) => v.reason === 'too_recent')).toBe(true);
    expect(stats.skipped_videos.map((v) => v.views).sort((a, b) => b - a)).toEqual([999999, 888888]);
    expect(stats.skipped_videos[0].age_hours).toBeLessThan(MIN_AGE_HOURS);
    expect(stats.sample_12).toBe(12);
    expect(stats.views_12).toBe(10000);
  });

  it('lässt das 13. Video ins 12er-Fenster nachrücken, wenn das neueste zu frisch ist', () => {
    // Ohne die 4-Tage-Regel waere das Fenster [500000, 11x 10000],
    // mit ihr rueckt das aelteste Video mit 8000 Views nach.
    const media = [
      video(1, 500000),
      ...videoSeries(11, 10000, 5),
      video(20, 8000)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });

    // 11x 10000 + 1x 8000 = 118000 / 12 = 9833; das Verhaeltnis unten ist nur
    // 1,25, der 8000er-Reel bleibt also drin
    expect(stats.sample_12).toBe(12);
    expect(stats.views_12).toBe(9833);
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
      ...videoSeries(12, 4000, 7)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.videos_available).toBe(12);
    expect(stats.views_12).toBe(4000);
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
  it('gibt null zurück, wenn das 12er-Fenster nicht voll ist', () => {
    const stats = computeInstagramCpm(videoSeries(11, 10000), { now: NOW });

    expect(stats.views_12).toBeNull();
    expect(stats.cpm_12).toBeNull();
    expect(stats.views_30).toBeNull();
    expect(stats.cpm_30).toBeNull();
  });

  it('rechnet 8 Reels nicht mehr als kurzes Fenster', () => {
    const stats = computeInstagramCpm(videoSeries(8, 10000), { now: NOW });

    expect(stats.views_12).toBeNull();
    expect(stats).not.toHaveProperty('views_8');
  });

  it('gibt die 30er-Werte erst bei 30 auswertbaren Videos aus', () => {
    const knapp = computeInstagramCpm(videoSeries(29, 10000), { now: NOW });
    expect(knapp.views_30).toBeNull();
    expect(knapp.views_12).toBe(10000);

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

describe('CPM-Preis', () => {
  it('rechnet Views / 1000 * 25 EUR', () => {
    expect(toCpm(10000)).toBe(250);
    expect(toCpm(1000)).toBe(CPM_RATE);
    expect(toCpm(0)).toBe(0);
  });

  it('rundet auf Cent', () => {
    expect(toCpm(1234)).toBe(30.85);
  });

  it('leitet beide CPM-Werte aus den Views ab', () => {
    const stats = computeInstagramCpm(videoSeries(30, 20000), { now: NOW });

    expect(stats.cpm_12).toBe(500);
    expect(stats.cpm_30).toBe(500);
  });

  it('rechnet den Preis aus dem bereinigten Schnitt', () => {
    const stats = computeInstagramCpm(videosAus(AUSREISSER_12), { now: NOW });

    // Der ungefilterte Schnitt waere 129167 gewesen
    expect(stats.cpm_12).toBe(toCpm(50000));
  });
});

describe('computeInstagramCpm – Randfälle', () => {
  it('kommt mit leerer oder fehlender Media-Liste klar', () => {
    for (const input of [[], null, undefined]) {
      const stats = computeInstagramCpm(input, { now: NOW });
      expect(stats.views_12).toBeNull();
      expect(stats.views_30).toBeNull();
      expect(stats.videos_available).toBe(0);
      expect(stats.skipped_ads).toBe(0);
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
    const stats = computeInstagramCpm(videoSeries(12, 10000), { now: NOW });
    expect(stats.calc_version).toBe(CALC_VERSION);
  });
});
