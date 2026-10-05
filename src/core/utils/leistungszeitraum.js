// leistungszeitraum.js
// Einheitliche Anzeige des Leistungszeitraums (Start/Ende) in Listen.

function toParts(value) {
  if (!value) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) };
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}

const pad = (n) => String(n).padStart(2, '0');
const kurz = (p) => `${pad(p.d)}.${pad(p.m)}.`;
const voll = (p) => `${pad(p.d)}.${pad(p.m)}.${p.y}`;

/** "01.03. – 31.05.2026", über Jahreswechsel voll ausgeschrieben, "-" ohne Datum. */
export function formatLeistungszeitraum(start, ende) {
  const s = toParts(start);
  const e = toParts(ende);
  if (!s && !e) return '-';
  if (s && !e) return voll(s);
  if (!s && e) return voll(e);
  return s.y === e.y ? `${kurz(s)} – ${voll(e)}` : `${voll(s)} – ${voll(e)}`;
}

/**
 * Leistungszeitraum einer Kampagne: Quelle ist der Auftrag (start/ende),
 * Fallback sind Start/Deadline der Kampagne selbst (der Wizard schreibt dort denselben Zeitraum).
 */
export function kampagneLeistungszeitraum(kampagne) {
  const auftrag = Array.isArray(kampagne?.auftrag) ? kampagne.auftrag[0] : kampagne?.auftrag;
  const start = auftrag?.start || kampagne?.start || null;
  const ende = auftrag?.ende || kampagne?.deadline || kampagne?.deadline_post_produktion || null;
  return formatLeistungszeitraum(start, ende);
}

/** Zelle für Listen. */
export function renderLeistungszeitraumCell(kampagne) {
  return `<td class="col-leistungszeitraum">${kampagneLeistungszeitraum(kampagne)}</td>`;
}
