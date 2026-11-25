// auswertungGruppen.js
// Sortierung und Gruppen der Post-Tabelle (ADR 0081): je Creator eine Gruppe wie in der
// Kooperationstabelle, darin die bestätigten Posts nach der Sortierung und fürs Team danach alle
// Einheiten ohne bestätigte Zahlen (Prüfen, Fehlt, Paid ohne Post). Rein ohne DOM, damit Tabelle,
// Report-PDF und Tests dieselbe Reihenfolge sehen.

import { bestaetigtePosts, interaktionen } from './auswertungKennzahlen.js';
import { creatorWert, passtZumFilter } from './auswertungFilter.js';

export const STANDARD_SORT = { field: 'aufrufe', ascending: false };

// Sortierfeld der Tabelle → Feld am Post
const METRIK = {
  aufrufe: 'views',
  likes: 'likes',
  comments: 'comments',
  reach: 'reach',
  wiedergabe: 'avgWatchSec',
  linkClicks: 'linkClicks',
  stickerTaps: 'stickerTaps'
};

const zahl = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function sortWert(post, field) {
  if (field === 'gepostet') return post.postedAt ? zahl(Date.parse(post.postedAt)) : null;
  if (field === 'interaktionen') return interaktionen(post);
  return zahl(post.metrics?.[METRIK[field] || 'views']);
}

/** Werte ohne Grundlage immer ans Ende, egal in welche Richtung. */
function vergleiche(va, vb, richtung) {
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  return (va - vb) * richtung;
}

/** Bestätigte Posts nach `sort`. */
export function sortiertePosts(posts, sort = STANDARD_SORT) {
  const richtung = sort.ascending ? 1 : -1;
  return bestaetigtePosts(posts).slice().sort((a, b) => vergleiche(sortWert(a, sort.field), sortWert(b, sort.field), richtung));
}

/** Einheiten ohne bestätigte Zahlen in fester Reihenfolge: Prüfen, Fehlt, Paid ohne Post. */
export function offeneZeilen(modell) {
  return [
    ...modell.pruefen.map(p => ({ einheit: modell.einheitenById.get(p.einheitId), post: p, status: 'pruefen' })),
    ...modell.fehlend.map(e => ({ einheit: e, post: null, status: 'fehlt' })),
    ...(modell.optional || []).map(e => ({ einheit: e, post: null, status: 'optional' }))
  ];
}

/** Zeilen nach dem wirksamen Filter: bestätigte Posts sortiert, offene nur fürs Team. */
export function gefilterteZeilen(modell, { sort = STANDARD_SORT, team = false, filter } = {}) {
  const bestaetigt = sortiertePosts(modell.posts, sort)
    .filter(p => passtZumFilter({ einheit: modell.einheitenById.get(p.einheitId), post: p }, filter));
  const offen = team ? offeneZeilen(modell).filter(z => passtZumFilter(z, filter)) : [];
  return { bestaetigt, offen };
}

/** Summe bei Zählwerten, Mittel bei Ø Wiedergabe, bei Gepostet der erste Post der Gruppe. */
function gruppenWert(posts, field) {
  if (field === 'gepostet') return posts.length ? sortWert(posts[0], field) : null;
  const werte = posts.map(p => sortWert(p, field)).filter(v => v != null);
  if (!werte.length) return null;
  const summe = werte.reduce((a, b) => a + b, 0);
  return field === 'wiedergabe' ? summe / werte.length : summe;
}

function summeAufrufe(posts) {
  const werte = posts.map(p => zahl(p.metrics?.views)).filter(v => v != null);
  return werte.length ? werte.reduce((a, b) => a + b, 0) : null;
}

const ohneCreator = (creator) => !creator?.id && !creator?.name;

/**
 * Je Creator eine Gruppe mit ihren gezeigten Zeilen. Stand und Aufrufe beziehen sich auf diese
 * Zeilen, gelten also nach dem Filter. Gruppen nach dem Wert der Sortierung, ohne Wert ans Ende;
 * bei Gleichstand steht „Ohne Creator“ hinten, sonst entscheidet der Name.
 * @param {object} modell - baueModell
 * @param {{ sort?: object, team?: boolean, filter?: object }} opts - filter: der wirksame (filterLage)
 * @returns {{ key: string, creator: object|null, posts: object[], offen: object[],
 *   stand: { bestaetigt: number, pruefen: number, fehlt: number }, aufrufe: number|null }[]}
 */
export function creatorGruppen(modell, { sort = STANDARD_SORT, team = false, filter } = {}) {
  const { bestaetigt, offen } = gefilterteZeilen(modell, { sort, team, filter });
  const gruppen = new Map();
  const gruppeVon = (einheit) => {
    const key = creatorWert(einheit);
    if (!gruppen.has(key)) gruppen.set(key, { key, creator: einheit?.creator || null, posts: [], offen: [] });
    return gruppen.get(key);
  };
  bestaetigt.forEach(p => gruppeVon(modell.einheitenById.get(p.einheitId)).posts.push(p));
  offen.forEach(z => gruppeVon(z.einheit).offen.push(z));

  const richtung = sort.ascending ? 1 : -1;
  const name = (g) => g.creator?.name || '';
  return [...gruppen.values()]
    .map(g => ({
      ...g,
      stand: {
        bestaetigt: g.posts.length,
        pruefen: g.offen.filter(z => z.status === 'pruefen').length,
        fehlt: g.offen.filter(z => z.status === 'fehlt').length
      },
      aufrufe: summeAufrufe(g.posts),
      wert: gruppenWert(g.posts, sort.field)
    }))
    .sort((a, b) => vergleiche(a.wert, b.wert, richtung)
      || ohneCreator(a.creator) - ohneCreator(b.creator)
      || name(a).localeCompare(name(b), 'de'));
}

/**
 * Rang je Creator nach den Aufrufen aller bestätigten Posts der Ebene, unabhängig von Sortierung
 * und Filter. Creator ohne Aufrufe haben keinen Rang.
 * @returns {Map<string, number>} Gruppen-Schlüssel → Rang ab 1
 */
export function creatorRaenge(modell) {
  const summen = new Map();
  bestaetigtePosts(modell.posts).forEach((p) => {
    const views = zahl(p.metrics?.views);
    if (views == null) return;
    const key = creatorWert(modell.einheitenById.get(p.einheitId));
    summen.set(key, (summen.get(key) || 0) + views);
  });
  return new Map([...summen].sort((a, b) => b[1] - a[1]).map(([key], i) => [key, i + 1]));
}
