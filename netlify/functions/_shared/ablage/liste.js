// _shared/ablage/liste.js
// Seitengroesse fuer .range() und Stuecke fuer .in()-Filter (die IDs landen in der URL).

const SEITE = 1000;
const IN_CHUNK = 200;

function stuecke(liste, n = IN_CHUNK) {
  const out = [];
  for (let i = 0; i < liste.length; i += n) out.push(liste.slice(i, i + n));
  return out;
}

module.exports = { SEITE, IN_CHUNK, stuecke };
