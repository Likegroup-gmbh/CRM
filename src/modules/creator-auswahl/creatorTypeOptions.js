export const CREATOR_TYP_OPTIONS = Object.freeze([
  'UGC Paid',
  'UGC Organic',
  'Influencer',
  'Vor-Ort-Produktion',
  'Videograf',
  'Model'
]);

/** Optionsliste fuer das TableSelect in der Sourcing-Tabelle */
export const CREATOR_TYP_SELECT_OPTIONS = Object.freeze([
  { value: '', label: '–' },
  ...CREATOR_TYP_OPTIONS.map(typ => ({ value: typ, label: typ }))
]);

// Legacy-Typen aus der Zeit vor dem Kampagnenarten-Merge (2026-08-17).
// Werden beim Schreiben auf die kanonischen Werte gemappt, damit ein
// veraltetes Frontend-Bundle nicht gegen den DB-Check laeuft.
export const CREATOR_TYP_LEGACY_ALIASES = Object.freeze({
  'UGC Pro Paid': 'UGC Paid',
  'UGC Video Paid': 'UGC Paid',
  'UGC Pro Organic': 'UGC Organic',
  'UGC Video Organic': 'UGC Organic',
  'UGC': 'UGC Organic',
  'IGC': 'UGC Organic'
});

export function normalizeCreatorTyp(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

export function canonicalizeCreatorTyp(value) {
  const normalized = normalizeCreatorTyp(value);
  if (normalized === null) return null;
  return CREATOR_TYP_LEGACY_ALIASES[normalized] || normalized;
}

export function isAllowedCreatorTyp(value) {
  const normalized = normalizeCreatorTyp(value);
  return normalized === null || CREATOR_TYP_OPTIONS.includes(normalized);
}
