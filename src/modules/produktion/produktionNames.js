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

/** Automatikname einer Produktion ohne eigenen Namen: `... Produktion N`. */
export const AUTOMATIK_PRODUKTION_NAME = /Produktion \d+\s*$/;

/**
 * Basis für neue Briefings in einer Produktion: deren eigener Name, sonst der Projektname.
 * Ein Automatikname (`Basis – Produktion 1`) gilt nicht als eigener Name.
 */
export function briefingBasis(kampagne, produktionName = '') {
  const eigener = String(produktionName || '').trim();
  if (eigener && !AUTOMATIK_PRODUKTION_NAME.test(eigener)) return eigener;
  return basisName(kampagne);
}

/** Briefing-Titel: Basis, bei Zusatz `Basis – Zusatz`. */
export function briefingTitel(basis, zusatz = '') {
  const base = String(basis || '').trim();
  const extra = String(zusatz || '').trim();
  if (!base) return extra;
  return extra ? `${base}${TRENNER}${extra}` : base;
}

const KOPIE = 'Kopie';
const KOPIE_ENDUNG = new RegExp(`${TRENNER}${KOPIE}(?: \\d+)?\\s*$`);

const normTitel = (t) => String(t || '').trim().toLocaleLowerCase('de');

/**
 * Titel einer Briefing-Kopie: `Titel – Kopie`, bei Belegung `Titel – Kopie 2`, `… 3`.
 * Eine Kopie der Kopie zählt weiter, statt `– Kopie – Kopie` zu stapeln.
 * @param {string} titel - Titel des Quell-Briefings
 * @param {string[]} vorhandene - Titel der Briefings, gegen die der neue frei sein muss
 */
export function kopieTitel(titel, vorhandene = []) {
  const base = String(titel || '').replace(KOPIE_ENDUNG, '').trim();
  const belegt = new Set((vorhandene || []).map(normTitel));
  let n = 1;
  let kandidat = briefingTitel(base, KOPIE);
  while (belegt.has(normTitel(kandidat))) {
    n += 1;
    kandidat = briefingTitel(base, `${KOPIE} ${n}`);
  }
  return kandidat;
}

/**
 * Gewünschter Titel, notfalls mit Zähler (`Titel 2`, `Titel 3`), wenn er schon vergeben ist.
 * @param {string} titel
 * @param {string[]} vorhandene
 */
export function freierTitel(titel, vorhandene = []) {
  const base = String(titel || '').trim();
  const belegt = new Set((vorhandene || []).map(normTitel));
  if (!belegt.has(normTitel(base))) return base;
  let n = 2;
  while (belegt.has(normTitel(`${base} ${n}`))) n += 1;
  return `${base} ${n}`;
}

/** Produktion ohne Briefing: `Basis – Produktion N`. */
export function geistProduktionName(basis, n = 1) {
  const base = String(basis || '').trim();
  const label = `Produktion ${n}`;
  return base ? `${base}${TRENNER}${label}` : label;
}
