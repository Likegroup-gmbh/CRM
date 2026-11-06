// videoBrowserFormat.js
// Konstanten, Namen und Anzeige-Formate des Videos-Tabs. Kein DOM, kein Supabase.

export const MAX_SCHLEIFEN = 3;
export const FORMATE = ['9:16', '1:1', '4:5'];

export const ROHMATERIAL_ID = 'raw';
export const FINAL_ID = 'final';

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

export const videoName = (n) => `Video ${n}`;
export const storyName = (n) => `Story ${n}`;
export const schleifeName = (n) => `Feedbackschleife ${n}`;
export const ROHMATERIAL_NAME = 'Rohmaterial';
export const FINAL_NAME = 'Finale Version';

export function plural(n, einzahl, mehrzahl) {
  return `${n} ${n === 1 ? einzahl : mehrzahl}`;
}

export function formatDatum(d) {
  if (!d) return '';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('de-DE');
}

export function formatBytes(bytes) {
  const b = Number(bytes) || 0;
  if (!b) return '';
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  if (b < 1024 * 1024 * 1024) return `${Math.round(b / (1024 * 1024))} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** @handle aus Instagram-Wert (Handle oder URL). */
export function toHandle(value) {
  if (!value) return '';
  const cleaned = String(value)
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@/, '');
  return cleaned ? `@${cleaned}` : '';
}

/* ------------------------------------------------------------------ */
/* Vorschau                                                            */
/* ------------------------------------------------------------------ */

export function ratioOf(asset) {
  return FORMATE.includes(asset?.variant_name) ? asset.variant_name : '9:16';
}

/** Formate, in denen eine Datei als Finale Version vorliegen kann (Reihenfolge = Anzeige). */
export const FINAL_FORMATE = ['9:16', '4:5', '1:1'];
const FORMAT_WERT = { '9:16': 9 / 16, '4:5': 4 / 5, '1:1': 1 };

/**
 * Standardformat aus den Pixelmaßen einer Datei, `null` wenn keines passt (z. B. 16:9).
 * Toleranz 3 %, damit 1080x1920 und leicht abweichende Exporte (1080x1918) gleich behandelt werden.
 * @returns {'9:16'|'4:5'|'1:1'|null}
 */
export function detectRatio(width, height, toleranz = 0.03) {
  const w = Number(width);
  const h = Number(height);
  if (!w || !h) return null;
  const r = w / h;
  return FINAL_FORMATE.find(f => Math.abs(r - FORMAT_WERT[f]) / FORMAT_WERT[f] <= toleranz) || null;
}

/** Rahmengröße im Seitenverhältnis, passend in maxW x maxH. */
export function fitFrame(ratio, maxW, maxH = 360) {
  const [rw, rh] = String(ratio).split(':').map(Number);
  if (!rw || !rh) return { w: Math.round(maxW), h: Math.round(maxH) };
  const s = Math.min(maxW / rw, maxH / rh);
  return { w: Math.round(rw * s), h: Math.round(rh * s) };
}

/** Position eines Markers auf der Zeitleiste in Prozent. */
export function markerProzent(timecodeSec, dauerSec) {
  if (!dauerSec || dauerSec <= 0) return 0;
  return Math.max(0, Math.min(100, (timecodeSec / dauerSec) * 100));
}

/** Marker nahe an der aktuellen Zeit (±0,6 s) bekommen den Aktiv-Zustand. */
export function markerNah(timecodeSec, aktuelleSec, toleranz = 0.6) {
  return Math.abs(timecodeSec - aktuelleSec) <= toleranz;
}

/** Wert für Attribut-Selektoren (`[data-x="…"]`) absichern; kommt ohne CSS.escape aus. */
export function cssEscape(value) {
  return String(value ?? '').replace(/["\\]/g, '\\$&');
}
