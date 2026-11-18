// auswertungFakten.js
// Fakten für die Zusammenfassung (Spec Abschnitt 6): der Server rechnet sie, das Sprachmodell
// formuliert nur aus und fügt keine Zahlen hinzu. Eine Aussage entsteht nur mit genug
// Grundlage: mindestens drei bestätigte Posts und mindestens zwei vergleichbare Gruppen.

import { bestaetigtePosts, engagementRate, gruppiere } from './auswertungKennzahlen.js';

const MIN_POSTS = 3;
const MIN_GRUPPEN = 2;

function staerksterPost(liste, einheitenById) {
  const mitAufrufen = liste.filter(p => Number.isFinite(p.metrics?.views));
  const gesamt = mitAufrufen.reduce((sum, p) => sum + p.metrics.views, 0);
  if (!gesamt) return null;
  const top = mitAufrufen.reduce((a, b) => (b.metrics.views > a.metrics.views ? b : a));
  const einheit = einheitenById.get(top.einheitId);
  return {
    art: 'staerksterPost',
    postId: top.id,
    creator: einheit?.creator?.name || '',
    einheit: einheit?.label || '',
    plattform: top.plattform,
    aufrufe: top.metrics.views,
    anteil: top.metrics.views / gesamt
  };
}

function bestePersona(liste, einheitenById) {
  const gruppen = gruppiere(liste, einheitenById, 'persona', 'engagement').filter(g => !g.leer);
  const schnitt = engagementRate(liste);
  if (gruppen.length < MIN_GRUPPEN || schnitt == null) return null;
  const [beste] = gruppen;
  return { art: 'persona', label: beste.label, rate: beste.wert, schnitt, posts: beste.posts };
}

function plattformVergleich(liste, einheitenById) {
  const gruppen = gruppiere(liste, einheitenById, 'plattform', 'aufrufe');
  const tiktok = gruppen.find(g => g.key === 'tiktok');
  const reel = gruppen.find(g => g.key === 'ig_reel');
  if (!tiktok || !reel) return null;
  return {
    art: 'plattformVergleich',
    tiktokProPost: tiktok.wert / tiktok.posts,
    reelProPost: reel.wert / reel.posts,
    tiktokPosts: tiktok.posts,
    reelPosts: reel.posts
  };
}

function laengsteWiedergabe(liste, einheitenById) {
  const gruppen = gruppiere(liste, einheitenById, 'ansatz', 'wiedergabe').filter(g => !g.leer);
  if (gruppen.length < MIN_GRUPPEN) return null;
  const [beste] = gruppen;
  const letzte = gruppen[gruppen.length - 1];
  return { art: 'ansatzWiedergabe', label: beste.label, sekunden: beste.wert, vergleichLabel: letzte.label, vergleichSekunden: letzte.wert };
}

function storyKlicks(liste) {
  const stories = liste.filter(p => p.plattform === 'ig_story' && Number.isFinite(p.metrics?.linkClicks));
  if (!stories.length) return null;
  return { art: 'storyKlicks', klicks: stories.reduce((sum, p) => sum + p.metrics.linkClicks, 0), stories: stories.length };
}

/**
 * @param {object[]} posts - alle Posts der Ebene
 * @param {Map<string, object>} einheitenById
 * @returns {object[]} höchstens fünf Fakten in fester Reihenfolge
 */
export function zusammenfassungsFakten(posts, einheitenById) {
  const liste = bestaetigtePosts(posts);
  if (liste.length < MIN_POSTS) return [];
  return [
    staerksterPost(liste, einheitenById),
    bestePersona(liste, einheitenById),
    plattformVergleich(liste, einheitenById),
    laengsteWiedergabe(liste, einheitenById),
    storyKlicks(liste)
  ].filter(Boolean).slice(0, 5);
}
