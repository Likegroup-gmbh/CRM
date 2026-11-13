// sourcingSpaltenKatalog.js
// Standardspalten der Casting-Tabelle: Reihenfolge, Anker, Labels, abgeschaltete und TikTok-Spalten

/**
 * Spalten, die projektweit abgeschaltet sind: sie werden weder gerendert noch
 * im Sichtbarkeits-Drawer angeboten. Zell-Markup und DB-Felder bleiben
 * erhalten - einen Eintrag hier entfernen und die Spalte ist wieder da.
 */
export const DEAKTIVIERTE_SPALTEN = ['cp-col-ek', 'cp-col-vk'];

/** TikTok-Spalten, in reinen Instagram- und UGC-Listen ausgeblendet */
export const TIKTOK_SPALTEN = [
  'cp-col-link-tt', 'cp-col-follower-tt', 'cp-col-preis-tt-video', 'cp-col-preis-tt-story'
];

/**
 * Gemeinsame Spalten mit gestapelten Plattformzeilen (Instagram oben, TikTok
 * darunter). Der Schluessel der Spalte steht fuer Reihenfolge, Anker eigener
 * Spalten und den Spalten-Toggle. Die Zeilen-Schluessel sind die alten
 * Plattform-Spalten: sie stehen weiter in hidden_columns und werden von den
 * Presets (sourcingSpaltenPreset) gesetzt, ein Eintrag blendet nur diese Zeile aus.
 */
export const PLATTFORM_ZEILEN = {
  'cp-col-link': [
    { plattform: 'instagram', key: 'cp-col-link-ig' },
    { plattform: 'tiktok', key: 'cp-col-link-tt' }
  ],
  'cp-col-follower': [
    { plattform: 'instagram', key: 'cp-col-follower-ig' },
    { plattform: 'tiktok', key: 'cp-col-follower-tt' }
  ],
  'cp-col-preis-video': [
    { plattform: 'instagram', key: 'cp-col-preis-reels' },
    { plattform: 'tiktok', key: 'cp-col-preis-tt-video' }
  ],
  'cp-col-story-preis': [
    { plattform: 'instagram', key: 'cp-col-preis-story' },
    { plattform: 'tiktok', key: 'cp-col-preis-tt-story' }
  ]
};

/**
 * Reine Instagram-Spalten. Schluessel der Spalte und der Zeile sind dieselben;
 * in Listen mit TikTok steht darunter eine leere TikTok-Zeile, damit die
 * Hoehe zu den gestapelten Spalten passt.
 */
export const INSTAGRAM_SPALTEN = [
  'cp-col-engagement-ig', 'cp-col-cpm-ig-8', 'cp-col-cpm-ig-30', 'cp-col-reichweite-story'
];

/**
 * Alte Anker eigener Spalten auf die gemeinsame Spalte, in der sie aufgegangen
 * sind. Gespeicherte custom_column_order-Eintraege nennen noch die alten Namen.
 */
export const ANKER_ALIASE = {
  'cp-col-link-ig': 'cp-col-link',
  'cp-col-link-tt': 'cp-col-link',
  'cp-col-follower-ig': 'cp-col-follower',
  'cp-col-follower-tt': 'cp-col-follower',
  'cp-col-preis-reels': 'cp-col-preis-video',
  'cp-col-preis-tt-video': 'cp-col-preis-video',
  'cp-col-preis-story': 'cp-col-story-preis',
  'cp-col-preis-tt-story': 'cp-col-story-preis'
};

/**
 * Alle Standardspalten in Renderreihenfolge. Link, Follower, Preis Video und
 * Preis Story fassen Instagram und TikTok als Plattformzeilen zusammen.
 *
 * Der Status steht direkt hinter der Creator Art: er entscheidet, wie es mit
 * einem Creator weitergeht, und war hinten in der Tabelle nur mit Querscrollen
 * erreichbar.
 *
 * Die Kurzbeschreibung steht direkt hinter dem Namen: sie sagt, wer der
 * Creator ueberhaupt ist, und gehoert damit neben den Namen statt ans Ende
 * hinter alle Preisspalten. Matching folgt direkt danach (Briefing-Fit).
 */
export const SOURCING_SPALTEN = [
  'cp-col-drag', 'cp-col-bild', 'cp-col-name', 'cp-col-notiz', 'cp-col-matching',
  'cp-col-typ', 'cp-col-status', 'cp-col-kunden-feedback',
  'cp-col-location', 'cp-col-mail', 'cp-col-telefon',
  'cp-col-link', 'cp-col-follower', 'cp-col-engagement-ig',
  'cp-col-cpm-ig-8', 'cp-col-cpm-ig-30', 'cp-col-preis-video',
  'cp-col-reichweite-story', 'cp-col-story-preis',
  'cp-col-pricing', 'cp-col-nutzungsrechte', 'cp-col-reichweite-garantie',
  'cp-col-ek', 'cp-col-vk',
  'cp-col-feedback',
  'cp-col-actions'
];

/**
 * Standardspalten, hinter denen eine eigene Spalte verankert werden darf.
 * Die drei linken Sticky-Spalten fehlen bewusst: dort wuerden die festen
 * left-Offsets aus dem CSS brechen. Die Aktionen bleiben immer ganz rechts.
 */
export const SOURCING_ANKER_SPALTEN = SOURCING_SPALTEN.filter(
  col => !['cp-col-drag', 'cp-col-bild', 'cp-col-name', 'cp-col-actions'].includes(col)
);

/**
 * Anzeigenamen der Standardspalten. Eine Quelle fuer Drawer, Positionsmenue
 * und Tooltips – Reihenfolge kommt aus SOURCING_SPALTEN.
 * Drag, Name und Aktionen fehlen bewusst: die sind immer sichtbar bzw. nicht
 * als Anker nutzbar.
 */
export const SOURCING_SPALTEN_LABELS = {
  'cp-col-bild': 'Bild',
  'cp-col-notiz': 'Kurzbeschreibung',
  'cp-col-matching': 'Matching',
  'cp-col-typ': 'Creator Art',
  'cp-col-status': 'Status',
  'cp-col-kunden-feedback': 'Kundenfeedback',
  'cp-col-nutzungsrechte': 'Nutzungsrechte',
  'cp-col-location': 'Location',
  'cp-col-mail': 'Mail (nur intern)',
  'cp-col-telefon': 'Telefon (nur intern)',
  'cp-col-link': 'Link',
  'cp-col-follower': 'Follower',
  'cp-col-engagement-ig': 'Engagement (Instagram)',
  'cp-col-cpm-ig-8': 'Preis 8 Videos (Instagram)',
  'cp-col-cpm-ig-30': 'Preis 30 Videos (Instagram)',
  'cp-col-preis-video': 'Preis Video',
  'cp-col-reichweite-story': 'Reichweite Story (Instagram)',
  'cp-col-story-preis': 'Preis Story',
  'cp-col-pricing': 'Gesamtpreis',
  'cp-col-reichweite-garantie': 'Reichweitengarantie',
  'cp-col-ek': 'EK (Einkaufspreis)',
  'cp-col-vk': 'VK (Verkaufspreis)',
  'cp-col-feedback': 'Rückmeldung Kunde'
};
