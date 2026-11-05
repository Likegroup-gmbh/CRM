// highlightFarben.js
// Pastell-Palette fuer farbige Hervorhebungen (==Text== bzw. =={id}Text==).
// 20 Farbtoene mit gleicher Saettigung/Helligkeit (HSL 75 % / 88 %), nur der
// Farbton wandert - dadurch wirken sie auf der Seite wie aus einem Guss.
// Die id steht im Markdown, hex wird fuer Editor-Anzeige und PDF genutzt.

export const HIGHLIGHT_FARBEN = [
  { id: 'rose', label: 'Rosé', hex: '#f7c9d1' },
  { id: 'koralle', label: 'Koralle', hex: '#f7d0c9' },
  { id: 'pfirsich', label: 'Pfirsich', hex: '#f7dac9' },
  { id: 'aprikose', label: 'Aprikose', hex: '#f7e5c9' },
  { id: 'vanille', label: 'Vanille', hex: '#f7eec9' },
  { id: 'limette', label: 'Limette', hex: '#f1f7c9' },
  { id: 'pistazie', label: 'Pistazie', hex: '#dff7c9' },
  { id: 'salbei', label: 'Salbei', hex: '#c9f7c9' },
  { id: 'minze', label: 'Minze', hex: '#c9f7dd' },
  { id: 'jade', label: 'Jade', hex: '#c9f7ec' },
  { id: 'aqua', label: 'Aqua', hex: '#c9f6f7' },
  { id: 'himmel', label: 'Himmel', hex: '#c9eaf7' },
  { id: 'eisblau', label: 'Eisblau', hex: '#c9ddf7' },
  { id: 'kornblume', label: 'Kornblume', hex: '#c9d1f7' },
  { id: 'flieder', label: 'Flieder', hex: '#d1c9f7' },
  { id: 'lavendel', label: 'Lavendel', hex: '#dfc9f7' },
  { id: 'orchidee', label: 'Orchidee', hex: '#edc9f7' },
  { id: 'lila', label: 'Lila', hex: '#f7c9f4' },
  { id: 'magnolie', label: 'Magnolie', hex: '#f7c9e7' },
  { id: 'erdbeer', label: 'Erdbeer', hex: '#f7c9db' }
];

/** Hervorhebung ohne Farbwahl (==Text==): erster Palettenton, wie bisher "gelb" nur weicher. */
export const HIGHLIGHT_STANDARD_HEX = '#f7eec9';

const NACH_ID = new Map(HIGHLIGHT_FARBEN.map((f) => [f.id, f]));

export function istHighlightFarbe(id) {
  return NACH_ID.has(id);
}

/** Hex zur id; unbekannt oder leer = Standardton. */
export function highlightHex(id) {
  return NACH_ID.get(id)?.hex || HIGHLIGHT_STANDARD_HEX;
}

/** [r, g, b] (0-255) zur id, z.B. fuer das PDF. */
export function highlightRgb(id) {
  const hex = highlightHex(id).slice(1);
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
