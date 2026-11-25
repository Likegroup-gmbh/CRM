// Gemeinsame Fakes fuer die Tests der Instagram-CPM-Rechnung (instagram-cpm*.js).

export const NOW = Date.parse('2026-07-28T12:00:00.000Z');
export const DAY = 24 * 60 * 60 * 1000;

/** Video vor `daysAgo` Tagen hochgeladen */
export function video(daysAgo, views, extra = {}) {
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

export function image(daysAgo, extra = {}) {
  return {
    id: `i-${daysAgo}`,
    media_type: 'IMAGE',
    timestamp: new Date(NOW - daysAgo * DAY).toISOString(),
    permalink: `https://instagram.com/p/${daysAgo}`,
    ...extra
  };
}

/** n Videos mit konstanter View-Zahl, beginnend bei `startDaysAgo` */
export function videoSeries(n, views, startDaysAgo = 5) {
  return Array.from({ length: n }, (_, i) => video(startDaysAgo + i, views));
}

/** Videos aus einer View-Liste, neuestes zuerst */
export function videosAus(viewsListe, startDaysAgo = 5) {
  return viewsListe.map((views, i) => video(startDaysAgo + i, views));
}

/**
 * Genau 12 Reels: oben ein 1M-Ausreisser (1M / 60K = 16,7), darunter 11 Reels mit
 * zusammen 550K, also 50K im Schnitt. Ungefiltert waeren es 1,55M / 12 = 129.167.
 */
export const AUSREISSER_12 = [
  1000000, 60000, 58000, 56000, 55000, 52000, 50000, 48000, 46000, 45000, 44000, 36000
];

/** Nachruecker fuer AUSREISSER_12: 550K + 62K = 612K / 12 = 51.000 */
export const NACHRUECKER = 62000;

/** 5 Trials (~3K) + 12 regulaere Reels (~500K, zusammen 6,012M), neueste zuerst */
export function bimodal() {
  return [
    ...videosAus([3000, 3200, 2800, 3100, 2900], 5),
    ...videosAus([
      500000, 520000, 480000, 510000, 490000, 505000,
      495000, 515000, 485000, 498000, 507000, 507000
    ], 10)
  ];
}

/**
 * Echte carodaur-Verteilung aus dem Abruf vom 08.09.2026: 26 Trials mit
 * 825-11K Views, dahinter Mittelfeld-Stufen (90K/150K/300K) und regulaere
 * Reels bis 1,5M. Die 62x-Luecke (11K -> 688K) ist durch die Stufen in
 * kleine Nachbarschritte zerlegt - der alte Scan (erster Sprung >= 5x)
 * blieb hier stumm, obwohl der Boden klar getrennt ist.
 */
export function carodaur() {
  const trials = [11067, 9933, 9716, 9551, 6932, 6810, 5813, 5417, 4131, 3692,
    3669, 3505, 3090, 2992, 2700, 2672, 2436, 2039, 1971, 1890, 1868, 1835,
    1829, 1558, 1061, 825];
  const regulaer = [90000, 150000, 300000, 400000, 450000, 520000, 600000,
    688062, 700000, 763151, 769336, 850000, 900000, 950000, 1000000, 1050000,
    1100000, 1150000, 1224731, 1250000, 1300000, 1350000, 1400000, 1450000,
    1500000, 480000, 550000, 620000, 650000, 720000, 780000, 820000, 880000,
    920000, 980000, 1020000, 1080000, 1120000];
  return [...videosAus(trials, 5), ...videosAus(regulaer, 31)];
}
