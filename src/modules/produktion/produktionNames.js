// produktionNames.js
// Namenskette: Der Projektname (= Kampagnenname) ist die Basis. Briefing-Titel ist
// Basis oder Basis + Zusatz, Produktion folgt dem Briefing, Casting und Konzept hängen den Anhang an.

const TRENNER = ' – ';

export function lineNames(titel) {
  const base = String(titel || '').trim();
  if (!base) {
    return { produktion: '', casting: '', konzept: '' };
  }
  return {
    produktion: base,
    casting: `${base} Casting`,
    konzept: `${base} Konzept`
  };
}

/** Basisname einer Kampagne: immer der Kampagnenname (Projektname), nie der eigene Name. */
export function basisName(kampagne) {
  return String(kampagne?.kampagnenname || kampagne?.eigener_name || '').trim();
}

/** Briefing-Titel: Basis, bei Zusatz `Basis – Zusatz`. */
export function briefingTitel(basis, zusatz = '') {
  const base = String(basis || '').trim();
  const extra = String(zusatz || '').trim();
  if (!base) return extra;
  return extra ? `${base}${TRENNER}${extra}` : base;
}

/** Produktion ohne Briefing: `Basis – Produktion N`. */
export function geistProduktionName(basis, n = 1) {
  const base = String(basis || '').trim();
  const label = `Produktion ${n}`;
  return base ? `${base}${TRENNER}${label}` : label;
}
