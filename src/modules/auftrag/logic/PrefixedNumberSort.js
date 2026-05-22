// PrefixedNumberSort.js
// Sortiert Nummern wie "AN-100", "A-5", "RE-2025-001":
// 1) Eintraege mit Buchstaben-Praefix + Bindestrich zuerst
// 2) Innerhalb desselben Praefix: hoechste Nummer oben (neueste zuerst)
// 3) Ohne dieses Format unten

/**
 * @param {string|null|undefined} value
 * @returns {{ hasPattern: boolean, isEmpty: boolean, prefix: string, numericKey: number, raw: string }}
 */
export function parsePrefixedNumber(value) {
  const raw = (value == null ? '' : String(value)).trim();
  if (!raw) {
    return { hasPattern: false, isEmpty: true, prefix: '', numericKey: -1, raw: '' };
  }

  const match = raw.match(/^([A-Za-z]+)-(.+)$/);
  if (!match) {
    return { hasPattern: false, isEmpty: false, prefix: '', numericKey: -1, raw };
  }

  const prefix = match[1].toUpperCase();
  const suffix = match[2];
  const digitsOnly = suffix.replace(/\D/g, '');
  const numericKey = digitsOnly ? parseInt(digitsOnly, 10) : 0;

  return { hasPattern: true, isEmpty: false, prefix, numericKey, raw };
}

/** Neueste/hoechste Nummer zuerst; Praefix-Format vor allen anderen */
export function comparePrefixedNumbersDesc(a, b) {
  const pa = parsePrefixedNumber(a);
  const pb = parsePrefixedNumber(b);

  if (pa.isEmpty && pb.isEmpty) return 0;
  if (pa.isEmpty) return 1;
  if (pb.isEmpty) return -1;

  if (pa.hasPattern !== pb.hasPattern) {
    return pa.hasPattern ? -1 : 1;
  }

  if (!pa.hasPattern) {
    return pa.raw.localeCompare(pb.raw, 'de');
  }

  const prefixCmp = pa.prefix.localeCompare(pb.prefix, 'de');
  if (prefixCmp !== 0) return prefixCmp;

  return pb.numericKey - pa.numericKey;
}

export function sortRowsByPrefixedNumberDesc(rows, field) {
  return [...(rows || [])].sort((a, b) =>
    comparePrefixedNumbersDesc(a?.[field], b?.[field])
  );
}
