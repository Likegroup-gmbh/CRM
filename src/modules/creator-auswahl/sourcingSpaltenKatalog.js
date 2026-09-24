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
 * Alle Standardspalten in Renderreihenfolge. Nach Plattform gebuendelt: erst
 * der komplette Instagram-Block (Reels, dann Story), danach TikTok - vorher
 * wechselten sich IG und TT spaltenweise ab.
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
  'cp-col-link-ig', 'cp-col-follower-ig',
  'cp-col-cpm-ig-8', 'cp-col-cpm-ig-30', 'cp-col-preis-reels',
  'cp-col-reichweite-story', 'cp-col-preis-story',
  'cp-col-link-tt', 'cp-col-follower-tt',
  'cp-col-preis-tt-video', 'cp-col-preis-tt-story',
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
  'cp-col-link-ig': 'Link Instagram',
  'cp-col-follower-ig': 'Follower Instagram',
  'cp-col-cpm-ig-8': 'Preis 8 Reels (Instagram)',
  'cp-col-cpm-ig-30': 'Preis 30 Reels (Instagram)',
  'cp-col-preis-reels': 'Preis Reels (Instagram)',
  'cp-col-reichweite-story': 'Reichweite Story (Instagram)',
  'cp-col-preis-story': 'Preis Story (Instagram)',
  'cp-col-link-tt': 'Link TikTok',
  'cp-col-follower-tt': 'Follower TikTok',
  'cp-col-preis-tt-video': 'Preis Video (TikTok)',
  'cp-col-preis-tt-story': 'Preis Story (TikTok)',
  'cp-col-pricing': 'Gesamtpreis',
  'cp-col-reichweite-garantie': 'Reichweitengarantie',
  'cp-col-ek': 'EK (Einkaufspreis)',
  'cp-col-vk': 'VK (Verkaufspreis)',
  'cp-col-feedback': 'Rückmeldung Kunde'
};
