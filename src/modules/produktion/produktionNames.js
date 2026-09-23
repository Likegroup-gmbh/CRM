// produktionNames.js
// Namenskette: Briefing-Titel ist der Name der Linie, Casting und Konzept hängen den Anhang an.

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
