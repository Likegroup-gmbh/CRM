// skriptPdfLayout.js
// Gemeinsame Masse, Farben und Helfer fuer das Skript-PDF (Tabelle, Karte, Freie Bloecke).

export const MARGIN_X = 14;
export const TABLE_W = 182;
export const MAX_CONTENT_Y = 272;
export const CELL_PAD = 3;
export const RULE = [227, 224, 230];
export const HEADER_FILL = [246, 244, 247];
export const MUTED = [122, 117, 128];

export function ascentMm(pt) {
  return pt * 0.352778 * 0.73;
}

export function descentMm(pt) {
  return pt * 0.352778 * 0.21;
}

export function httpUrl(raw) {
  const value = String(raw || '').trim();
  if (!value || /\s/.test(value)) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
  return `https://${value.replace(/^\/\//, '')}`;
}
