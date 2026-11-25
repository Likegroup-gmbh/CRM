// auswertungKacheln.js
// Die Kennzahl-Kacheln der Auswertung in der Reihenfolge der Post-Tabelle. Report und Report-PDF
// lesen beide von hier, damit dieselben Kennzahlen mit denselben Texten dastehen. Jede Kachel
// steht immer da; ohne Wert zeigt sie „–“ und ihren Leertext.
// `preis`: nur mit Preis-Sicht, nie im Report-PDF.

import { euro, kompakt, plural } from './auswertungFormat.js';

export const KACHELN = [
  {
    key: 'aufrufe', label: 'Aufrufe', art: 'zahl', wert: k => k.aufrufe,
    sub: k => `Ø ${kompakt(k.aufrufeProPost)} pro Post`,
    leer: () => 'Summe der bestätigten Posts',
    hint: { formula: 'Σ Aufrufe der bestätigten Posts', hint: 'Ziel-Erreichung = Aufrufe ÷ Ziel' }
  },
  {
    key: 'likes', label: 'Likes', art: 'zahl', wert: k => k.likes,
    sub: k => `aus ${plural(k.likesPosts, 'Post', 'Posts')}`,
    leer: () => 'Summe der bestätigten Posts',
    hint: { formula: 'Σ Likes', hint: 'nur Posts, die den Wert ausweisen' }
  },
  {
    key: 'kommentare', label: 'Kommentare', art: 'zahl', wert: k => k.kommentare,
    sub: k => `aus ${plural(k.kommentarePosts, 'Post', 'Posts')}`,
    leer: () => 'Reels, Posts & TikToks',
    hint: { formula: 'Σ Kommentare', hint: 'Stories haben Antworten statt Kommentare, die zählen bei den Interaktionen' }
  },
  {
    key: 'reach', label: 'Betrachter', art: 'zahl', wert: k => k.reach,
    sub: k => `aus ${plural(k.reachPosts, 'Instagram-Post', 'Instagram-Posts')}`,
    leer: () => 'nur Instagram',
    hint: { formula: 'Σ Betrachter', hint: 'Konten, die den Post gesehen haben, jedes einmal (Aufrufe zählen jede Wiedergabe). Nur Instagram – TikTok weist das nicht aus' }
  },
  {
    key: 'interaktionen', label: 'Interaktionen', art: 'zahl', wert: k => k.interaktionen,
    sub: k => `Ø ${kompakt(k.interaktionenProPost)} pro Post`,
    leer: () => 'über alle bestätigten Posts',
    hint: { formula: 'Σ Likes, Kommentare, Geteilt, Gespeichert, Antworten', hint: 'fehlt ein Feld am Post, zählt es 0' }
  },
  {
    key: 'wiedergabe', label: 'Ø Wiedergabe', art: 'sekunden', wert: k => k.wiedergabe,
    sub: k => `über ${plural(k.wiedergabePosts, 'Reel oder TikTok', 'Reels & TikToks')}`,
    leer: () => 'Reels & TikToks',
    hint: { formula: 'Mittel der Ø Wiedergabe je Post', hint: 'nur Posts, die den Wert ausweisen' }
  },
  {
    key: 'klicks', label: 'Link-Klicks', art: 'zahl', wert: k => k.linkKlicks,
    sub: k => `aus ${plural(k.linkKlicksStories, 'Story', 'Stories')}`,
    leer: () => 'nur Instagram-Stories',
    hint: { formula: 'Σ Link-Klicks', hint: 'nur Instagram-Stories' }
  },
  {
    key: 'sticker', label: 'Sticker-Taps', art: 'zahl', wert: k => k.stickerTaps,
    sub: k => `aus ${plural(k.stickerTapsStories, 'Story', 'Stories')}`,
    leer: () => 'nur Instagram-Stories',
    hint: { formula: 'Σ „Auf Sticker getippt“', hint: 'nur Instagram-Stories, alle Sticker zusammen (Erwähnung, Hashtag, Ort …). Der Link-Sticker zählt bei den Link-Klicks' }
  },
  {
    key: 'kosten', label: 'Kosten pro 1.000 Aufrufe', art: 'euro', wert: k => k.kostenPro1000, preis: true,
    sub: k => `${euro(k.verbrauch)} Verbrauch`,
    leer: k => (k.verbrauch ? `${euro(k.verbrauch)} Verbrauch` : 'noch kein Verbrauch'),
    hint: { formula: 'Verbrauch ÷ Aufrufe × 1.000', hint: 'Verbrauch: VK netto der Videos plus Zusatzkosten der Kooperationen' }
  }
];

const zahl = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Wert der Kachel oder null, wenn sie keine Grundlage hat. */
export const kachelWert = (kachel, k) => zahl(kachel.wert(k || {}));

/** Unterzeile: mit Wert die Herkunft, ohne Wert der Leertext. */
export const kachelSub = (kachel, k) => (kachelWert(kachel, k) == null ? kachel.leer(k || {}) : kachel.sub(k || {}));
