// compactNumber.js
// Kompakte Darstellung grosser Zahlen fuer Tabellenzellen (Follower, Reichweiten):
// 5547 -> "5,5K", 21569 -> "21,6K", 1391836 -> "1,39M".
// Millionen bekommen bewusst zwei Nachkommastellen, weil eine einzelne dort zu
// grob waere (1,4M statt 1,39M).

const THOUSAND = 1000;
const MILLION = 1000000;

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Kompakte Anzeige. Liefert '' fuer leere oder ungueltige Werte. */
export function formatCompactNumber(value) {
  const n = toNumber(value);
  if (n === null) return '';

  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (abs >= MILLION) {
    const millions = (abs / MILLION).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${sign}${millions}M`;
  }

  if (abs >= THOUSAND) {
    const thousands = (abs / THOUSAND).toLocaleString('de-DE', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
    return `${sign}${thousands}K`;
  }

  return `${sign}${Math.round(abs).toLocaleString('de-DE')}`;
}

/** Ausgeschriebene Zahl fuer Tooltips: 1391836 -> "1.391.836" */
export function formatExactNumber(value) {
  const n = toNumber(value);
  return n === null ? '' : Math.round(n).toLocaleString('de-DE');
}

/**
 * Gegenstueck zu formatCompactNumber: versteht "21569", "21.569", "21,6K" und
 * "1,39M". Punkte gelten als Tausendertrennzeichen, Komma als Dezimaltrenner.
 */
export function parseCompactNumber(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input) : null;
  if (input === null || input === undefined) return null;

  const raw = String(input).trim().toUpperCase();
  if (!raw) return null;

  const match = raw.match(/^(-?[\d.,\s]+)\s*([KM])?$/);
  if (!match) return null;

  const digits = match[1].replace(/[\s.]/g, '').replace(',', '.');
  const parsed = Number.parseFloat(digits);
  if (!Number.isFinite(parsed)) return null;

  const factor = match[2] === 'M' ? MILLION : match[2] === 'K' ? THOUSAND : 1;
  return Math.round(parsed * factor);
}
