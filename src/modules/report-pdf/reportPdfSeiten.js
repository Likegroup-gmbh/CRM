// reportPdfSeiten.js
// Aufteilung der Kacheln des Report-PDF auf Seiten: höchstens `max` je Seite, gleichmäßig
// verteilt (8 bei max 5 → 4 + 4, 11 → 4 + 4 + 3), die vorderen Seiten nehmen den Rest.
// Die Kachelbreite folgt der vollsten Seite und gilt für das ganze Dokument.

export const MAX_JE_SEITE = 5;
// Auch bei ein oder zwei Posts wird eine Kachel nie breiter als ein Drittel der Seite
export const MIN_SPALTEN = 3;

const ganz = (v, fallback) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : fallback;
};

/** Kacheln je Seite, z. B. [4, 4, 3]. Ohne Kacheln eine leere Liste. */
export function verteileAufSeiten(anzahl, max = MAX_JE_SEITE) {
  const n = Math.max(0, ganz(anzahl, 0));
  const m = Math.max(1, ganz(max, MAX_JE_SEITE));
  if (!n) return [];
  const seiten = Math.ceil(n / m);
  const basis = Math.floor(n / seiten);
  const rest = n % seiten;
  return Array.from({ length: seiten }, (_, i) => basis + (i < rest ? 1 : 0));
}

/** Die Kacheln in Seiten geschnitten, Reihenfolge bleibt. */
export function seitenAus(kacheln, max = MAX_JE_SEITE) {
  let start = 0;
  return verteileAufSeiten(kacheln.length, max).map((anzahl) => {
    const seite = kacheln.slice(start, start + anzahl);
    start += anzahl;
    return seite;
  });
}

/** Spalten der Kachelreihe: die vollste Seite, mindestens MIN_SPALTEN. */
export function spaltenFuer(anzahl, max = MAX_JE_SEITE) {
  return Math.max(MIN_SPALTEN, verteileAufSeiten(anzahl, max)[0] || 0);
}
