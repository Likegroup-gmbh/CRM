// auswertungKennzahlen.js
// Kennzahlen der Auswertung aus Posts und Einheiten (Kooperationsvideo, Story, Still). Reine
// Funktionen ohne DOM, damit Report, CSV und Report-Freigabe serverseitig dieselben Zahlen
// rechnen (Muster ADR 0040). Gerechnet wird nur über bestätigte Posts.
// Hat eine Kennzahl keine Grundlage, ist sie null und wird nicht als 0 gezeigt.

import { INTERAKTIONEN, PLATTFORMEN } from './auswertungKonfig.js';

const TAG_MS = 24 * 60 * 60 * 1000;

const zahl = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export const istBestaetigt = (post) => post?.status === 'confirmed';

export function bestaetigtePosts(posts) {
  return (posts || []).filter(istBestaetigt);
}

/** Summe der Interaktionen eines Posts. Fehlende Felder zählen 0. */
export function interaktionen(post) {
  return INTERAKTIONEN.reduce((sum, key) => sum + (zahl(post?.metrics?.[key]) ?? 0), 0);
}

/** Bezugsgröße der Engagement-Rate: Reichweite bei Instagram, Aufrufe bei TikTok. */
export function engagementBasis(post) {
  const key = PLATTFORMEN[post?.plattform]?.basis;
  const wert = key ? zahl(post?.metrics?.[key]) : null;
  return wert && wert > 0 ? wert : null;
}

/** Gewichtet über die Summen, nicht als Durchschnitt der einzelnen Raten. */
export function engagementRate(posts) {
  let zaehler = 0;
  let nenner = 0;
  (posts || []).forEach((p) => {
    const basis = engagementBasis(p);
    if (basis == null) return;
    zaehler += interaktionen(p);
    nenner += basis;
  });
  return nenner > 0 ? zaehler / nenner : null;
}

function summeUeber(posts, key) {
  let summe = 0;
  let anzahl = 0;
  posts.forEach((p) => {
    const wert = zahl(p.metrics?.[key]);
    if (wert == null) return;
    summe += wert;
    anzahl += 1;
  });
  return { summe: anzahl ? summe : null, anzahl };
}

function mittelUeber(posts, key) {
  const { summe, anzahl } = summeUeber(posts, key);
  return { wert: anzahl ? summe / anzahl : null, anzahl };
}

/** Tage zwischen Post und Messung, null ohne beide Daten. */
export function messTage(post) {
  if (!post?.postedAt || !post?.measuredAt) return null;
  const diff = new Date(post.measuredAt) - new Date(post.postedAt);
  return Number.isFinite(diff) ? Math.max(0, Math.round(diff / TAG_MS)) : null;
}

/**
 * Die Kennzahlen des Reports plus Unterzeilen-Werte.
 * @param {object[]} posts - alle Posts der Ebene; gezählt werden nur bestätigte
 * @param {{ verbrauch?: number|null, zielAufrufe?: number|null }} [kontext]
 */
export function berechneKennzahlen(posts, { verbrauch = null, zielAufrufe = null } = {}) {
  const liste = bestaetigtePosts(posts);
  const anzahl = liste.length;
  const aufrufe = summeUeber(liste, 'views').summe;
  const reach = summeUeber(liste, 'reach');
  const watch = mittelUeber(liste, 'avgWatchSec');
  const stories = liste.filter(p => p.plattform === 'ig_story');
  const klicks = summeUeber(stories, 'linkClicks');
  const sticker = summeUeber(stories, 'stickerTaps');
  const ziel = zahl(zielAufrufe);
  const kosten = zahl(verbrauch);
  return {
    anzahl,
    aufrufe,
    aufrufeProPost: anzahl && aufrufe != null ? aufrufe / anzahl : null,
    zielAufrufe: ziel && ziel > 0 ? ziel : null,
    zielQuote: ziel && ziel > 0 && aufrufe != null ? aufrufe / ziel : null,
    reach: reach.summe,
    reachPosts: reach.anzahl,
    interaktionen: anzahl ? liste.reduce((sum, p) => sum + interaktionen(p), 0) : null,
    engagementRate: engagementRate(liste),
    wiedergabe: watch.wert,
    wiedergabePosts: watch.anzahl,
    linkKlicks: klicks.summe,
    linkKlicksStories: klicks.anzahl,
    stickerTaps: sticker.summe,
    stickerTapsStories: sticker.anzahl,
    verbrauch: kosten && kosten > 0 ? kosten : null,
    kostenPro1000: kosten && kosten > 0 && aufrufe > 0 ? (kosten / aufrufe) * 1000 : null
  };
}

/* ------------------------------------------------------------------ */
/* Status der Einheiten (ADR 0076: „Fehlt“ zählt pro Einheit)          */
/* ------------------------------------------------------------------ */

/** Posts je Einheit, in Eingabereihenfolge. */
export function postsJeEinheit(posts) {
  const map = new Map();
  (posts || []).forEach((p) => {
    if (!map.has(p.einheitId)) map.set(p.einheitId, []);
    map.get(p.einheitId).push(p);
  });
  return map;
}

/**
 * erfasst: mindestens ein bestätigter Post. pruefen: nur Entwürfe. fehlt: kein Post, aber erwartet.
 * optional: kein Post und nicht erwartet (Paid-Linie).
 */
export function einheitStatus(einheit, posts = []) {
  if (posts.some(istBestaetigt)) return 'erfasst';
  if (posts.length) return 'pruefen';
  return einheit?.erwartet === false ? 'optional' : 'fehlt';
}

/**
 * Fortschritt der Ebene: wie viele Posts bestätigt sind und wie viele noch offen.
 * Eine Einheit auf „Fehlt“ zählt als ein offener Post.
 */
export function fortschritt(einheiten, posts) {
  const jeEinheit = postsJeEinheit(posts);
  let fehlt = 0;
  (einheiten || []).forEach((e) => {
    if (einheitStatus(e, jeEinheit.get(e.id) || []) === 'fehlt') fehlt += 1;
  });
  const bestaetigt = bestaetigtePosts(posts).length;
  const pruefen = (posts || []).filter(p => !istBestaetigt(p)).length;
  return { bestaetigt, pruefen, fehlt, offen: pruefen + fehlt, gesamt: bestaetigt + pruefen + fehlt };
}

/** IDs der drei Posts mit den meisten Aufrufen, unabhängig von der Sortierung der Tabelle. */
export function topPosts(posts, anzahl = 3) {
  return bestaetigtePosts(posts)
    .filter(p => zahl(p.metrics?.views) != null)
    .sort((a, b) => b.metrics.views - a.metrics.views)
    .slice(0, anzahl)
    .map(p => p.id);
}
