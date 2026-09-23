// Vornamen, die im Deutschen für Männer und Frauen funktionieren.
// Nur der Startrun und der Karten-Ersatz (modus initial / karte) dürfen
// daraus wählen. modus weitere bleibt frei.

const UNISEX_VORNMEN = Object.freeze([
  'Luca', 'Luka', 'Alex', 'Kim', 'Lou', 'Robin', 'Toni', 'Mika',
  'Sascha', 'Eike', 'Dominique', 'Elia', 'Sam', 'Jamie', 'Kris',
  'Charly', 'Micha', 'Noa', 'Lio'
]);

function nameKey(name) {
  return String(name || '').trim().toLowerCase();
}

function nameIstUnisex(name) {
  const key = nameKey(name);
  return UNISEX_VORNMEN.some((n) => nameKey(n) === key);
}

function kanonischerUnisexName(name) {
  const key = nameKey(name);
  return UNISEX_VORNMEN.find((n) => nameKey(n) === key) || null;
}

/**
 * Pool-Namen und der verworfene Vorname fliegen raus.
 * Ist danach nichts übrig, volle Liste ohne den verworfenen Namen.
 */
function gefilterteUnisexNamen({ poolNamen = [], verworfenerName = null } = {}) {
  const belegt = new Set(
    (Array.isArray(poolNamen) ? poolNamen : []).map(nameKey).filter(Boolean)
  );
  const verworfen = nameKey(verworfenerName);
  const frei = UNISEX_VORNMEN.filter((n) => !belegt.has(nameKey(n)) && nameKey(n) !== verworfen);
  if (frei.length) return frei;
  const rest = UNISEX_VORNMEN.filter((n) => nameKey(n) !== verworfen);
  return rest.length ? rest : [...UNISEX_VORNMEN];
}

module.exports = {
  UNISEX_VORNMEN,
  nameIstUnisex,
  kanonischerUnisexName,
  gefilterteUnisexNamen
};
