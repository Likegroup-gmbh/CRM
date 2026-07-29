export const CREATOR_TYP_OPTIONS = Object.freeze([
  'UGC Pro Paid',
  'UGC Pro Organic',
  'UGC Video Paid',
  'UGC Video Organic',
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

export function normalizeCreatorTyp(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

export function isAllowedCreatorTyp(value) {
  const normalized = normalizeCreatorTyp(value);
  return normalized === null || CREATOR_TYP_OPTIONS.includes(normalized);
}
