// skript-edit-prompt/zeitstempel.js
// Zeitstempel in Visual-Texten lesen und als M:SS formatieren.

/** Wandelt "0:03", "1:30", "0,5", "3" in Sekunden. */
function parseZeitSekunden(token) {
  const trimmed = String(token || '').trim();
  if (!trimmed) return null;
  const mmss = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (mmss) {
    const min = parseInt(mmss[1], 10);
    const sec = parseInt(mmss[2], 10);
    if (sec > 59) return null;
    return min * 60 + sec;
  }
  const n = parseFloat(trimmed.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function formatZeitstempel(sekunden) {
  if (sekunden == null || !Number.isFinite(sekunden)) return null;
  const total = Math.max(0, Math.round(sekunden));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/**
 * Letzter Zeitstempel in einem Visual-Text (Maximum aller gefundenen Endzeiten).
 * Versteht M:SS, deutsche [0–0,5 Sek]-Ranges und Dezimal-Sekunden.
 * Rueckgabe: formatiert als M:SS oder null.
 */
function letzterZeitstempel(text) {
  if (!text) return null;
  const s = String(text);
  let max = null;
  const consider = (n) => {
    if (n != null && (max == null || n > max)) max = n;
  };

  const rangeRe = /(\d+(?::\d{1,2}|[,.]\d+)?)\s*[–\-—]\s*(\d+(?::\d{1,2}|[,.]\d+)?)/g;
  for (const m of s.matchAll(rangeRe)) {
    consider(parseZeitSekunden(m[2]));
  }

  const mmssRe = /\b(\d+):(\d{2})\b/g;
  for (const m of s.matchAll(mmssRe)) {
    consider(parseZeitSekunden(`${m[1]}:${m[2]}`));
  }

  return formatZeitstempel(max);
}

module.exports = {
  formatZeitstempel,
  letzterZeitstempel
};
