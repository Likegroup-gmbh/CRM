// Ob die KI-Beschreibung ins Item darf. Nur wenn dort noch nichts steht —
// vorhandene Worte (User oder Altbestand) bleiben.

function shouldApplyKiBeschreibung(existing) {
  return !String(existing || '').trim();
}

module.exports = { shouldApplyKiBeschreibung };
