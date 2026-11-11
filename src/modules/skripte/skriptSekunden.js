// skriptSekunden.js
// ESM-Spiegel von entferneZeitmarker aus netlify/functions/_shared/skript-context/formatter.js.
// „Was zu sehen ist“ traegt keine Sekunden. Altbestand mit Zeitmarkern verliert
// sie bei der naechsten Aenderung am gesprochenen Text, in allen Visual-Zellen.
// Paritaet sichert SkriptSekunden.test.js.

export const WOERTER_PRO_SEKUNDE = 2.3;

export const VISUELL_PAARE = [
  ['hook', 'hook_visuell'],
  ['hauptteil', 'hauptteil_visuell'],
  ['cta', 'cta_visuell']
];

export function zaehleWoerter(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

export function beats(text) {
  return String(text || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
}

const MARKER_SEK = /^(Sek\.\s*)?\d+\s*[–-]\s*\d+\s*:\s*/i;
const MARKER_UHR = /^\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}\s*/;

export function ohneZeitmarker(beat) {
  return String(beat || '')
    .replace(MARKER_SEK, '')
    .replace(MARKER_UHR, '')
    .trim();
}

export function visuellOhneZeitmarker(text) {
  if (!(text || '').trim()) return text || null;
  return beats(text).map(ohneZeitmarker).filter(Boolean).join('\n\n') || null;
}

/** Die Visual-Zellen ohne Zeitmarker. */
export function entferneZeitmarker(felder) {
  const out = {};
  for (const [, visuellKey] of VISUELL_PAARE) out[visuellKey] = visuellOhneZeitmarker(felder?.[visuellKey]);
  return out;
}

export function hatZeitmarker(felder) {
  return VISUELL_PAARE.some(([, visuellKey]) =>
    beats(felder?.[visuellKey]).some((beat) => MARKER_SEK.test(beat) || MARKER_UHR.test(beat)));
}

/**
 * Patch der Visual-Zellen, die noch Zeitmarker tragen: ohne die Marker.
 * ausser: Zellen, die gerade bearbeitet werden (Fokus) - die bleiben, wie sie sind.
 */
export function zeitmarkerPatch(stand, { ausser = [] } = {}) {
  if (!stand || !hatZeitmarker(stand)) return {};
  const gestempelt = entferneZeitmarker(stand);
  const patch = {};
  for (const [, visuellKey] of VISUELL_PAARE) {
    if (ausser.includes(visuellKey)) continue;
    const alt = stand[visuellKey] || null;
    const neu = gestempelt[visuellKey] || null;
    if (neu !== alt) patch[visuellKey] = neu;
  }
  return patch;
}
