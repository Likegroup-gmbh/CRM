import { describe, it, expect } from 'vitest';
import {
  computeInstagramCpm,
  detectOutliers,
  OUTLIER_RATIO
} from '../../netlify/functions/_shared/instagram-cpm.js';
import { NOW, AUSREISSER_12, NACHRUECKER, video, videoSeries, videosAus } from './instagramCpmTestKit.js';

describe('detectOutliers', () => {
  it('erkennt einen Ausreißer nach oben', () => {
    const { indices, details } = detectOutliers([40000, 45000, 48000, 50000, 52000, 55000, 60000, 1000000]);

    expect([...indices]).toEqual([7]);
    expect(details[0].side).toBe('high');
    expect(details[0].views).toBe(1000000);
    // 1000000 / 60000 - das Verhaeltnis zum zweithoechsten Wert, nicht zum Median
    expect(details[0].ratio).toBeCloseTo(1000000 / 60000, 5);
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

  it('lässt bei einem engen Account auch den besten Reel stehen', () => {
    // 80000 ist der beste Reel eines sehr gleichmaessigen Accounts, aber nur
    // Faktor 1,54 zum zweitbesten - ein guter Lauf ist kein Ausreisser
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

  it('entfernt nie mehr als einen Wert je Seite', () => {
    // Beide Extreme sind doppelt besetzt: nur der aeussere Wert faellt, der
    // zweite bleibt drin und stuetzt danach den Schnitt
    const values = [10, 5, 50000, 50000, 50000, 50000, 2000000, 4000000];
    const { indices, details } = detectOutliers(values);

    expect(indices.size).toBe(2);
    expect(details.find(d => d.side === 'high').views).toBe(4000000);
    expect(details.find(d => d.side === 'low').views).toBe(5);
  });

  it('lässt zwei fast gleich hohe Spitzen stehen, weil sie sich gegenseitig decken', () => {
    // 1000000 / 900000 = 1,11 - die Regel vergleicht nur Nachbarn, deshalb
    // maskiert die zweite Spitze die erste. Bewusst so: mehrere hohe Reels sind
    // Performance, kein Einzelausreisser
    const values = [50000, 50000, 50000, 50000, 50000, 500000, 900000, 1000000];
    expect(detectOutliers(values).indices.size).toBe(0);
  });

  it('greift bei einem Verhältnis von genau 2,0', () => {
    const values = [50000, 50000, 50000, 50000, 50000, 50000, 50000, 100000];
    const { indices, details } = detectOutliers(values);

    expect(indices.size).toBe(1);
    expect(details[0].views).toBe(100000);
    expect(details[0].ratio).toBe(OUTLIER_RATIO);
  });

  it('behandelt einen Reel mit 0 Views als Ausreißer nach unten', () => {
    const { indices, details } = detectOutliers([0, 48000, 50000, 52000, 55000]);

    expect([...indices]).toEqual([0]);
    expect(details[0]).toMatchObject({ side: 'low', views: 0, ratio: Infinity });
  });

  it('kommt mit leeren Eingaben klar', () => {
    expect(detectOutliers([]).indices.size).toBe(0);
    expect(detectOutliers(null).indices.size).toBe(0);
  });
});

describe('computeInstagramCpm – Ausreißer im Fenster', () => {
  it('liefert den 12er-Schnitt bereits ohne den Ausreißer', () => {
    const stats = computeInstagramCpm(videosAus(AUSREISSER_12), { now: NOW });

    // 550000 / 11 = 50000 - ungefiltert waeren es 129167 gewesen
    expect(stats.views_12).toBe(50000);
    expect(stats.outliers_12).toHaveLength(1);
    expect(stats.outliers_12[0]).toMatchObject({ views: 1000000, side: 'high' });
    expect(stats.outliers_12[0].permalink).toBe('https://instagram.com/reel/5-1000000');
  });

  it('nimmt ohne Ausreißer alle Reels des Fensters', () => {
    const media = videosAus([
      90000, 80000, 70000, 62000, 58000, 55000, 51000, 48000, 45000, 40000, 38000, 29000
    ]);
    const stats = computeInstagramCpm(media, { now: NOW });

    // 666000 / 12
    expect(stats.views_12).toBe(55500);
    expect(stats.outliers_12).toEqual([]);
  });

  it('erkennt Ausreißer im 12er- und 30er-Fenster getrennt', () => {
    // Der 1M-Reel liegt im 12er-Fenster, der 10-Views-Reel weiter hinten nur im 30er
    const media = videosAus([
      1000000, ...Array(11).fill(50000),
      ...Array(17).fill(50000), 10
    ]);
    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.outliers_12.map(o => o.views)).toEqual([1000000]);
    expect(stats.outliers_30.map(o => o.views).sort((a, b) => b - a)).toEqual([1000000, 10]);
    expect(stats.views_12).toBe(50000);
    expect(stats.views_30).toBe(50000);
  });

  it('speichert das Verhältnis statt eines Z-Scores und ersetzt Infinity durch null', () => {
    const stats = computeInstagramCpm(videosAus([
      0, 48000, 50000, 52000, 54000, 55000, 56000, 57000, 58000, 59000, 60000, 61000
    ]), { now: NOW });

    expect(stats.outliers_12[0]).toMatchObject({ views: 0, side: 'low', ratio: null });
  });
});

describe('computeInstagramCpm – Ausreißer werden ersetzt, nicht abgezogen', () => {
  it('zieht den nächsten Reel nach, damit das 12er-Fenster bei 12 bleibt', () => {
    // Erste 12: der 1M-Reel faellt (1M / 60K = 16,7), Nachruecker ist der
    // 13. Reel mit 62K, danach ist das Fenster stabil.
    const stats = computeInstagramCpm(videosAus([...AUSREISSER_12, NACHRUECKER]), { now: NOW });

    expect(stats.sample_12).toBe(12);
    expect(stats.outliers_12.map(o => o.views)).toEqual([1000000]);
    // 550K + 62K = 612K / 12 = 51000, ohne Nachruecken waeren es 550K / 11 = 50000
    expect(stats.views_12).toBe(51000);
  });

  it('nimmt den Nachrücker in used_12 auf und lässt den Ausreißer draußen', () => {
    const stats = computeInstagramCpm(videosAus([...AUSREISSER_12, NACHRUECKER]), { now: NOW });

    // Index 0 ist der Ausreisser, Index 12 der Nachruecker
    expect(stats.used_12).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('prüft erneut, wenn der Nachrücker selbst ein Ausreißer ist', () => {
    // Runde 1: 1M faellt oben. Nachruecker ist 2000 -> Runde 2: 36K / 2000 = 18
    // faellt unten. Nachruecker ist 62K -> Runde 3 ist stabil.
    const stats = computeInstagramCpm(videosAus([...AUSREISSER_12, 2000, NACHRUECKER]), { now: NOW });

    expect(stats.sample_12).toBe(12);
    // Beide Runden landen in der Liste, absteigend nach Views
    expect(stats.outliers_12.map(o => o.views)).toEqual([1000000, 2000]);
    expect(stats.used_12).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13]);
    expect(stats.views_12).toBe(51000);
  });

  it('füllt auch das 30er-Fenster auf', () => {
    // 31 Reels: der neueste ist ein 1M-Ausreisser, der Rest liegt bei 50k
    const media = [video(5, 1000000), ...videoSeries(30, 50000, 6)];

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.sample_30).toBe(30);
    expect(stats.outliers_30.map(o => o.views)).toEqual([1000000]);
    expect(stats.views_30).toBe(50000);
    // Der Ausreisser an Index 0 ist raus, dafuer ist Index 30 dabei
    expect(stats.used_30).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1)
    );
  });

  it('rechnet mit kleinerem Fenster, wenn keine Nachrücker mehr da sind', () => {
    // Genau 12 Reels, oben und unten je ein Ausreisser, kein Nachschub
    const media = videosAus([...AUSREISSER_12.slice(0, 11), 2000]);

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.outliers_12.map(o => o.views)).toEqual([1000000, 2000]);
    expect(stats.sample_12).toBe(10);
    // 60+58+56+55+52+50+48+46+45+44 = 514K / 10
    expect(stats.views_12).toBe(51400);
  });

  it('liefert keinen Wert, wenn von Anfang an zu wenige Reels vorliegen', () => {
    const stats = computeInstagramCpm(videoSeries(11, 50000), { now: NOW });

    expect(stats.views_12).toBeNull();
    expect(stats.sample_12).toBe(0);
    expect(stats.used_12).toEqual([]);
  });

  it('nimmt Nachrücker jenseits des 30er-Fensters in die Debug-Liste auf', () => {
    // 31 Reels, der Nachruecker fuer das 30er-Fenster liegt auf Index 30 und
    // waere in einer auf 30 begrenzten videos-Liste nicht auffindbar
    const media = [video(5, 1000000), ...videoSeries(30, 50000, 6)];

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.videos).toHaveLength(31);
    expect(stats.videos[30]).toBeDefined();
  });
});
