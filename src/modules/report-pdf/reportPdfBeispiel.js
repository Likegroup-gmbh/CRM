// reportPdfBeispiel.js
// Beispieldaten für PDF-Vorlagen: eine Basis wie ladeAuswertung sie liefert (Einheiten, Posts,
// Produktion), damit Sortierung, Kennzahlen und Formatierung durch dieselben Funktionen laufen
// wie bei einer echten Produktion. Gemischt sind Plattformen, Stories, ein langer Name, fehlende
// Werte, 4:5-Poster und Posts ohne Poster. Die Werte sind fest (kein Zufall), damit die Vorschau
// beim Verschieben der Regler ruhig bleibt.

import { PLATTFORM_FELDER } from '../auswertung/auswertungKonfig.js';

export const BEISPIEL_PRODUKTION = { id: 'beispiel-produktion', name: 'Herbst-Kampagne – Produktion 1', linien: [] };

const CREATOR = [
  { name: 'Lena Hoffmann', handle: 'lena.hoffmann' },
  { name: 'Maximilian von Eschenbach-Rothenburg', handle: 'max.vom.eschenbach.official' },
  { name: 'Aylin Demir', handle: 'aylin.dmr' },
  { name: 'Jonas Becker', handle: 'jonasbecker' },
  { name: 'Sophie Wagner', handle: 'sophie.wagnr' },
  { name: 'Nico Schulz', handle: 'nicoschulz' },
  { name: 'Mara Klein', handle: 'mara.klein' }
];

const PLATTFORM_FOLGE = ['ig_reel', 'tiktok', 'ig_story', 'ig_reel', 'ig_post', 'tiktok', 'ig_reel'];

const GRUNDWERTE = {
  views: 52000, reach: 31000, likes: 2400, comments: 140, shares: 90, saves: 160, replies: 12,
  linkClicks: 310, stickerTaps: 85, exits: 400, avgWatchSec: 9.4, completionPct: 32
};

const FARBEN = [
  ['#f30b61', '#7c3aed'], ['#0ea5e9', '#22c55e'], ['#f59e0b', '#ef4444'],
  ['#14b8a6', '#6366f1'], ['#111827', '#f30b61'], ['#84cc16', '#0ea5e9']
];

// Jeder siebte Post hat kein Poster, jeder fünfte ist 4:5
const ohnePoster = (i) => i % 7 === 5;
const ratioVon = (i) => (i % 5 === 3 ? '4:5' : '9:16');

function wert(i, key) {
  if (key === 'comments' && i % 6 === 4) return undefined;
  const faktor = 0.25 + (((i + 3) * 37) % 100) / 40;
  if (key === 'avgWatchSec') return Math.round((GRUNDWERTE.avgWatchSec * faktor * 0.5 + 2) * 10) / 10;
  if (key === 'completionPct') return Math.round(GRUNDWERTE.completionPct * Math.min(faktor, 2.5));
  const viral = key === 'views' && i === 2 ? 25 : 1;
  return Math.round((GRUNDWERTE[key] || 0) * faktor * viral);
}

function metrics(i, plattform) {
  const out = {};
  (PLATTFORM_FELDER[plattform] || []).forEach((key) => {
    const v = wert(i, key);
    if (v !== undefined) out[key] = v;
  });
  return out;
}

function posterSvg(i, ratio, name) {
  const [w, h] = ratio === '4:5' ? [400, 500] : [360, 640];
  const [a, b] = FARBEN[i % FARBEN.length];
  const initialen = name.split(/\s+/).map(t => t[0]).slice(0, 2).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`
    + '<rect width="100%" height="100%" fill="url(#g)"/>'
    + `<text x="50%" y="50%" fill="rgba(255,255,255,0.9)" font-family="Arial, sans-serif" font-size="${Math.round(w / 5)}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${initialen}</text>`
    + `<text x="50%" y="${h - 28}" fill="rgba(255,255,255,0.75)" font-family="Arial, sans-serif" font-size="${Math.round(w / 15)}" text-anchor="middle">${ratio}</text>`
    + '</svg>';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function postDatum(i) {
  return new Date(Date.UTC(2026, 9, 5 + i * 3)).toISOString().slice(0, 10);
}

/**
 * @param {number} anzahl - bestätigte Posts
 * @returns {{ basis: object, produktionId: string, kontext: { titel: string, untertitel: string,
 *   kunde: { name: string, logoUrl: null }, posterUrls: Map<string, string> } }}
 */
export function beispielDaten(anzahl) {
  const n = Math.max(0, Math.floor(Number(anzahl) || 0));
  const einheiten = [];
  const posts = [];
  const posterUrls = new Map();
  for (let i = 0; i < n; i += 1) {
    const creator = CREATOR[i % CREATOR.length];
    const plattform = PLATTFORM_FOLGE[i % PLATTFORM_FOLGE.length];
    const art = plattform === 'ig_story' ? 'story' : 'video';
    const dateiId = `beispiel-datei-${i}`;
    const ratio = ratioVon(i);
    einheiten.push({
      id: `${art}:beispiel-${i}`,
      art,
      label: art === 'story' ? 'Story 1' : `Video ${i + 1}`,
      titel: '',
      creator: { id: `beispiel-creator-${i % CREATOR.length}`, name: creator.name, handle: creator.handle },
      produktion: { id: BEISPIEL_PRODUKTION.id, name: BEISPIEL_PRODUKTION.name },
      linie: null,
      erwartet: true,
      dateien: [{ id: dateiId, ratio, name: `Finale Version ${ratio}`, item: { id: dateiId, type: art } }]
    });
    posts.push({
      id: `beispiel-post-${i}`,
      einheitId: `${art}:beispiel-${i}`,
      dateiId,
      plattform,
      accountHandle: creator.handle,
      postedAt: postDatum(i),
      metrics: metrics(i, plattform),
      status: 'confirmed'
    });
    if (!ohnePoster(i)) posterUrls.set(dateiId, posterSvg(i, ratio, creator.name));
  }
  return {
    basis: { einheiten, posts, verbrauch: [], produktionen: [BEISPIEL_PRODUKTION], zielFuer: () => null },
    produktionId: BEISPIEL_PRODUKTION.id,
    kontext: {
      titel: BEISPIEL_PRODUKTION.name,
      untertitel: 'Herbst-Kampagne 2026',
      kunde: { name: 'Beispielkunde', logoUrl: null },
      posterUrls
    }
  };
}
