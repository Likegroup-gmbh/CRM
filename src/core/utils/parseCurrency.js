/**
 * Parst einen Währungswert aus einem String im DE- oder EN-Format.
 * Beispiele:
 *   "203.030,20 €" → 203030.20
 *   "1,234.56"     → 1234.56
 *   "1.234"         → 1234   (Tausenderpunkt erkannt)
 *   "12.34"         → 12.34  (Dezimalpunkt erkannt)
 *   1234.5           → 1234.5 (Number passthrough)
 */
export function parseCurrencyInput(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  let str = String(value).trim();
  if (!str) return null;

  str = str.replace(/\s+/g, '').replace(/[€$]/g, '');

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandSep = decimalSep === ',' ? '.' : ',';
    str = str.split(thousandSep).join('');
    str = decimalSep === ',' ? str.replace(',', '.') : str;
  } else if (hasComma) {
    const parts = str.split(',');
    if (parts.length > 2) {
      str = parts.join('');
    } else {
      const decimalPart = parts[1] || '';
      const likelyThousands = decimalPart.length === 3 && parts[0].length > 0;
      str = likelyThousands ? parts.join('') : `${parts[0]}.${decimalPart}`;
    }
  } else if (hasDot) {
    const parts = str.split('.');
    if (parts.length > 2) {
      str = parts.join('');
    } else {
      const decimalPart = parts[1] || '';
      const likelyThousands = decimalPart.length === 3 && parts[0].length > 0;
      str = likelyThousands ? parts.join('') : `${parts[0]}.${decimalPart}`;
    }
  }

  str = str.replace(/[^0-9.\-]/g, '');
  if (!str || str === '-' || str === '.') return null;

  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed : null;
}
