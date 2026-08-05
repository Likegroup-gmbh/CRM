import { describe, it, expect } from 'vitest';
import {
  computeInstagramCpm,
  formatCpmDebug,
  detectOutliers,
  istWerbePost,
  toCpm,
  CPM_RATE,
  MIN_AGE_HOURS,
  OUTLIER_RATIO,
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
    // mit ihr rueckt das aelteste Video mit 8000 Views nach.
    const media = [
      video(1, 500000),
      ...videoSeries(7, 10000, 5),
      video(20, 8000)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });

    // 7x 10000 + 1x 8000 = 78000 / 8 = 9750; das Verhaeltnis unten ist nur
    // 1,25, der 8000er-Reel bleibt also drin
    expect(stats.sample_8).toBe(8);
    expect(stats.views_8).toBe(9750);
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
    expect(stats.cpm_8).toBeNull();
    expect(stats.views_30).toBeNull();
    expect(stats.cpm_30).toBeNull();
  });

  it('gibt die 30er-Werte erst bei 30 auswertbaren Videos aus', () => {
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
  it('liefert den 8er-Schnitt bereits ohne den Ausreißer', () => {
    const media = videosAus([1000000, 60000, 55000, 52000, 50000, 48000, 45000, 40000]);
    const stats = computeInstagramCpm(media, { now: NOW });

    // 350000 / 7 = 50000 - ungefiltert waeren es 168750 gewesen
    expect(stats.views_8).toBe(50000);
    expect(stats.outliers_8).toHaveLength(1);
    expect(stats.outliers_8[0]).toMatchObject({ views: 1000000, side: 'high' });
    expect(stats.outliers_8[0].permalink).toBe('https://instagram.com/reel/5-1000000');
  });

  it('nimmt ohne Ausreißer alle Reels des Fensters', () => {
    const media = videosAus([90000, 70000, 62000, 55000, 51000, 45000, 38000, 30000]);
    const stats = computeInstagramCpm(media, { now: NOW });

    // 441000 / 8
    expect(stats.views_8).toBe(55125);
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
    expect(stats.views_8).toBe(50000);
    expect(stats.views_30).toBe(50000);
  });

  it('speichert das Verhältnis statt eines Z-Scores und ersetzt Infinity durch null', () => {
    const stats = computeInstagramCpm(videosAus([0, 48000, 50000, 52000, 55000, 56000, 58000, 60000]), { now: NOW });

    expect(stats.outliers_8[0]).toMatchObject({ views: 0, side: 'low', ratio: null });
  });
});

describe('computeInstagramCpm – Ausreißer werden ersetzt, nicht abgezogen', () => {
  it('zieht den nächsten Reel nach, damit das 8er-Fenster bei 8 bleibt', () => {
    // Erste 8: [1M, 60k, 55k, 52k, 50k, 48k, 45k, 40k] -> 1M/60k = 16,7 faellt.
    // Nachruecker ist der 9. Reel mit 42k, danach ist das Fenster stabil.
    const media = videosAus([1000000, 60000, 55000, 52000, 50000, 48000, 45000, 40000, 42000]);

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.sample_8).toBe(8);
    expect(stats.outliers_8.map(o => o.views)).toEqual([1000000]);
    // 60+55+52+50+48+45+40+42 = 392k / 8 = 49000
    // Ohne Nachruecken waeren es 350k / 7 = 50000 gewesen
    expect(stats.views_8).toBe(49000);
  });

  it('nimmt den Nachrücker in used_8 auf und lässt den Ausreißer draußen', () => {
    const media = videosAus([1000000, 60000, 55000, 52000, 50000, 48000, 45000, 40000, 42000]);

    const stats = computeInstagramCpm(media, { now: NOW });

    // Index 0 ist der Ausreisser, Index 8 der Nachruecker
    expect(stats.used_8).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('prüft erneut, wenn der Nachrücker selbst ein Ausreißer ist', () => {
    // Runde 1: 1M faellt oben. Nachruecker ist 2000 -> Runde 2: 40k/2000 = 20
    // faellt unten. Nachruecker ist 44k -> Runde 3 ist stabil.
    const media = videosAus([
      1000000, 60000, 55000, 52000, 50000, 48000, 45000, 40000, 2000, 44000
    ]);

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.sample_8).toBe(8);
    // Beide Runden landen in der Liste, absteigend nach Views
    expect(stats.outliers_8.map(o => o.views)).toEqual([1000000, 2000]);
    expect(stats.used_8).toEqual([1, 2, 3, 4, 5, 6, 7, 9]);
    // 60+55+52+50+48+45+40+44 = 394k / 8 = 49250
    expect(stats.views_8).toBe(49250);
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
    // Genau 8 Reels, oben und unten je ein Ausreisser, kein Nachschub
    const media = videosAus([1000000, 60000, 55000, 52000, 50000, 48000, 45000, 2000]);

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.outliers_8.map(o => o.views)).toEqual([1000000, 2000]);
    expect(stats.sample_8).toBe(6);
    // 60+55+52+50+48+45 = 310k / 6 = 51666,67
    expect(stats.views_8).toBe(51667);
  });

  it('liefert keinen Wert, wenn von Anfang an zu wenige Reels vorliegen', () => {
    const stats = computeInstagramCpm(videoSeries(7, 50000), { now: NOW });

    expect(stats.views_8).toBeNull();
    expect(stats.sample_8).toBe(0);
    expect(stats.used_8).toEqual([]);
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

describe('istWerbePost', () => {
  it('erkennt die gängigen Werbe-Hashtags und gibt den Treffer zurück', () => {
    const faelle = [
      ['Neues Video #werbung', '#werbung'],
      ['#anzeige – mein Alltag', '#anzeige'],
      ['Schaut mal #ad', '#ad'],
      ['#sponsored by someone', '#sponsored'],
      ['#paidpartnership mit XY', '#paidpartnership'],
      ['#bezahltepartnerschaft', '#bezahltepartnerschaft'],
      ['Danke fürs #kooperation', '#kooperation'],
      ['#collab mit @marke', '#collab'],
      ['Link in Bio #affiliate', '#affiliate']
    ];
    for (const [caption, marker] of faelle) {
      expect(istWerbePost(caption), caption).toBe(marker);
    }
  });

  it('erkennt Werbe-Phrasen im Freitext und gibt die Phrase zurück', () => {
    const faelle = [
      ['Paid partnership with Nike', 'paid partnership'],
      ['Bezahlte Partnerschaft mit XY', 'bezahlte partnerschaft'],
      ['In Kooperation mit meinem Lieblingsladen', 'in kooperation mit'],
      ['Anzeige | Meine Routine', 'anzeige |'],
      ['Werbung | Neues Produkt', 'werbung |']
    ];
    for (const [caption, marker] of faelle) {
      expect(istWerbePost(caption), caption).toBe(marker);
    }
  });

  it('löst bei Hashtags nicht aus, die nur mit einem Marker anfangen', () => {
    for (const caption of [
      'Neue Schuhe #adidas', 'Tag 3 #adventskalender', '#adventure time',
      '#kooperationsanfrage bitte per Mail', '#advent'
    ]) {
      expect(istWerbePost(caption), caption).toBeNull();
    }
  });

  it('lässt organische Captions und leere Werte durch', () => {
    for (const caption of ['Schöner Tag am See', '', null, undefined]) {
      expect(istWerbePost(caption)).toBeNull();
    }
  });

  it('ignoriert Groß- und Kleinschreibung, gibt den Marker normalisiert zurück', () => {
    expect(istWerbePost('#WERBUNG')).toBe('#werbung');
    expect(istWerbePost('#Anzeige')).toBe('#anzeige');
  });
});

describe('computeInstagramCpm – Werbe-Reels', () => {
  it('sortiert Werbe-Reels als ad_post aus und zählt sie', () => {
    const media = [
      video(5, 900000, { caption: 'Neue Kollektion #werbung' }),
      ...videoSeries(8, 50000, 6)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.skipped_ads).toBe(1);
    const werbe = stats.skipped_videos.filter(v => v.reason === 'ad_post');
    expect(werbe).toHaveLength(1);
    expect(werbe[0].ad_marker).toBe('#werbung');
    expect(stats.videos_available).toBe(8);
    expect(stats.views_8).toBe(50000);
  });

  it('speichert den Werbe-Marker auch für Phrasen', () => {
    const stats = computeInstagramCpm([
      video(5, 800000, { caption: 'In Kooperation mit @marke' }),
      ...videoSeries(8, 30000, 6)
    ], { now: NOW });

    const werbe = stats.skipped_videos.find(v => v.reason === 'ad_post');
    expect(werbe.ad_marker).toBe('in kooperation mit');
  });

  it('setzt ad_marker bei zu frischen Reels auf null', () => {
    const stats = computeInstagramCpm([
      video(1, 700000),
      ...videoSeries(8, 30000, 6)
    ], { now: NOW });

    const frisch = stats.skipped_videos.find(v => v.reason === 'too_recent');
    expect(frisch.ad_marker).toBeNull();
  });

  it('lässt ein älteres Reel nachrücken, wenn ein Werbe-Reel wegfällt', () => {
    // Ohne den Filter waere das Fenster [900000, 7x 50000], mit ihm rueckt das
    // aelteste Reel mit 10000 Views nach
    const media = [
      video(5, 900000, { caption: 'Anzeige | Neue Kollektion' }),
      ...videoSeries(7, 50000, 6),
      video(40, 10000)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });

    // Das 10000er-Reel ist nach dem Werbe-Filter im Fenster, faellt dort aber
    // als Ausreisser unten durch (50000 / 10000 = 5). Ersatz gibt es nicht mehr,
    // also bleibt das Fenster bei 7 Reels.
    expect(stats.outliers_8.map(o => o.views)).toEqual([10000]);
    expect(stats.sample_8).toBe(7);
    expect(stats.views_8).toBe(50000);
  });

  it('zählt Werbe-Reels getrennt von zu frischen Reels', () => {
    const media = [
      video(1, 700000),
      video(5, 800000, { caption: '#sponsored' }),
      ...videoSeries(8, 50000, 6)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.skipped_too_recent).toBe(1);
    expect(stats.skipped_ads).toBe(1);
  });

  it('führt ein zu frisches Werbe-Reel als Werbung, nicht als zu frisch', () => {
    const stats = computeInstagramCpm(
      [video(1, 700000, { caption: '#werbung' })],
      { now: NOW }
    );

    expect(stats.skipped_ads).toBe(1);
    expect(stats.skipped_too_recent).toBe(0);
  });

  it('rechnet Reels ohne caption normal mit', () => {
    const stats = computeInstagramCpm(videoSeries(8, 50000), { now: NOW });

    expect(stats.skipped_ads).toBe(0);
    expect(stats.views_8).toBe(50000);
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

    expect(stats.cpm_8).toBe(500);
    expect(stats.cpm_30).toBe(500);
  });

  it('rechnet den Preis aus dem bereinigten Schnitt', () => {
    const media = videosAus([1000000, 60000, 55000, 52000, 50000, 48000, 45000, 40000]);
    const stats = computeInstagramCpm(media, { now: NOW });

    // Der ungefilterte Schnitt waere 168750 gewesen
    expect(stats.cpm_8).toBe(toCpm(50000));
  });
});

describe('computeInstagramCpm – Randfälle', () => {
  it('kommt mit leerer oder fehlender Media-Liste klar', () => {
    for (const input of [[], null, undefined]) {
      const stats = computeInstagramCpm(input, { now: NOW });
      expect(stats.views_8).toBeNull();
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
    expect(debug.rules.OUTLIER_RATIO).toBe(OUTLIER_RATIO);
    expect(debug.rules.AD_HASHTAGS).toContain('werbung');
    expect(debug.skipped).toHaveLength(1);
    expect(debug.skipped[0].views).toBe(500000);
    expect(debug.included_8).toHaveLength(8);
    // Nur 8 organische Reels -> kein 30er-Fenster
    expect(debug.included_30).toEqual([]);
    expect(debug.summary.views_8).toBe(10000);
    expect(debug.summary.formula).toContain(String(CPM_RATE));
  });

  it('weist die aussortierten Werbe-Reels in summary aus und zeigt den Marker', () => {
    const stats = computeInstagramCpm([
      video(5, 900000, { caption: '#werbung' }),
      ...videoSeries(8, 50000, 6)
    ], { now: NOW });

    const debug = formatCpmDebug('demo_user', stats, { source: 'meta' });

    expect(debug.summary.skipped_ads).toBe(1);
    expect(debug.skipped[0].reason).toBe('ad_post');
    expect(debug.skipped[0].ad_marker).toBe('#werbung');
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

  it('zeigt in included_8 das aufgefüllte Fenster ohne den Ausreißer', () => {
    const stats = computeInstagramCpm(
      videosAus([1000000, 60000, 55000, 52000, 50000, 48000, 45000, 40000, 42000]),
      { now: NOW }
    );

    const debug = formatCpmDebug('demo_user', stats, { source: 'meta' });
    const ausreisserPermalink = debug.outliers.window_8[0].permalink;

    expect(debug.included_8).toHaveLength(8);
    expect(debug.included_8.map((v) => v.permalink)).not.toContain(ausreisserPermalink);
    // Der Nachruecker mit 42000 Views ist stattdessen dabei
    expect(debug.included_8.map((v) => v.views)).toContain(42000);
  });

  it('laesst included_30 leer, wenn kein 30er-Fenster zustande kommt', () => {
    const stats = computeInstagramCpm(videoSeries(8, 50000), { now: NOW });

    const debug = formatCpmDebug('demo_user', stats, { source: 'meta' });

    expect(debug.included_8).toHaveLength(8);
    expect(debug.included_30).toEqual([]);
  });

  it('loest Nachruecker jenseits von Index 30 in included_30 auf', () => {
    const stats = computeInstagramCpm(
      [video(5, 1000000), ...videoSeries(30, 50000, 6)],
      { now: NOW }
    );

    const debug = formatCpmDebug('demo_user', stats, { source: 'meta' });

    expect(debug.included_30).toHaveLength(30);
    expect(debug.included_30.every((v) => v.views === 50000)).toBe(true);
  });

  it('faellt fuer alte Pool-Eintraege ohne used_* auf die permalink-Logik zurueck', () => {
    const stats = computeInstagramCpm(
      videosAus([1000000, 60000, 55000, 52000, 50000, 48000, 45000, 40000, 42000]),
      { now: NOW }
    );
    // Pool-Spiegel aus einer Zeit vor used_8 / used_30
    delete stats.used_8;
    delete stats.used_30;

    const debug = formatCpmDebug('demo_user', stats, { source: 'pool' });
    const ausreisserPermalink = debug.outliers.window_8[0].permalink;

    // Ohne used_8 kein Nachruecker, aber der Ausreisser bleibt draussen
    expect(debug.included_8).toHaveLength(7);
    expect(debug.included_8.map((v) => v.permalink)).not.toContain(ausreisserPermalink);
  });

});
