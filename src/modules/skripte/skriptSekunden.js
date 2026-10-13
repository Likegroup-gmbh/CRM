// skriptSekunden.js
// ESM-Spiegel von stempelSekunden aus netlify/functions/_shared/skript-context/formatter.js.
// Zeitmarker sind abgeleitete Daten (ADR 0035): nach jeder Aenderung am
// gesprochenen Text werden alle Visual-Zellen aus dem Gesamtstand neu
// gestempelt, nie nur die geaenderte. Paritaet sichert SkriptSekunden.test.js.

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

/** Setzt Sekunden aus den gesprochenen Woertern auf die Visual-Beats; die Uhr laeuft durch. */
export function stempelSekunden(felder) {
  let sek = 0;
  const out = {};
  for (const [gesprochenKey, visuellKey] of VISUELL_PAARE) {
    const visuell = felder?.[visuellKey];
    if (!(visuell || '').trim()) {
      out[visuellKey] = visuell || null;
      sek += Math.round(zaehleWoerter(felder?.[gesprochenKey]) / WOERTER_PRO_SEKUNDE);
      continue;
    }
    const spoken = beats(felder?.[gesprochenKey]);
    const seen = beats(visuell);
    const gestempelt = seen.map((beat, i) => {
      const n = zaehleWoerter(spoken[i] || '') || Math.max(1, zaehleWoerter(ohneZeitmarker(beat)));
      const dauer = Math.max(1, Math.round(n / WOERTER_PRO_SEKUNDE));
      const von = sek;
      const bis = sek + dauer;
      sek = bis;
      return `Sek. ${von}–${bis}: ${ohneZeitmarker(beat)}`;
    });
    out[visuellKey] = gestempelt.join('\n\n');
  }
  return out;
}

/** Nur Skripte, deren Visuals schon Zeitmarker tragen, werden gestempelt (Altbestand bleibt unberuehrt). */
export function hatZeitmarker(felder) {
  return VISUELL_PAARE.some(([, visuellKey]) =>
    beats(felder?.[visuellKey]).some((beat) => MARKER_SEK.test(beat) || MARKER_UHR.test(beat)));
}

/**
 * Patch der Visual-Zellen, deren Zeitmarker sich aus dem Stand aendern.
 * ausser: Zellen, die gerade bearbeitet werden (Fokus) - die bleiben, wie sie sind.
 */
export function zeitmarkerPatch(stand, { ausser = [] } = {}) {
  if (!stand || !hatZeitmarker(stand)) return {};
  const gestempelt = stempelSekunden(stand);
  const patch = {};
  for (const [, visuellKey] of VISUELL_PAARE) {
    if (ausser.includes(visuellKey)) continue;
    const alt = stand[visuellKey] || null;
    const neu = gestempelt[visuellKey] || null;
    if (neu !== alt) patch[visuellKey] = neu;
  }
  return patch;
}
