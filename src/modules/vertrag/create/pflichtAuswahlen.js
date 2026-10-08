// Pflicht-Auswahlen im UGC-Vertragsgenerator und Normalisierung der Korrekturschleife.
// Formulardaten liefern die Auswahl als Text ("1"), die Datenbank als Zahl (1).
// Beide Formen sind dieselbe Auswahl.

export function isKorrekturschleife(value, expected) {
  return Number(value) === expected && (expected === 1 || expected === 2);
}

export function normalizeKorrekturschleifen(value) {
  const n = Number(value);
  return n === 1 || n === 2 ? n : null;
}

export function isEmptyAuswahl(value) {
  return value == null || String(value).trim() === '';
}

export function auswahlFeldZustand(value) {
  const missing = isEmptyAuswahl(value);
  return {
    missing,
    selectAttr: missing ? ' class="is-invalid"' : '',
    hintClass: missing ? 'form-hint form-hint--error' : 'form-hint form-hint--error hidden'
  };
}

export const UGC_PFLICHT_AUSWAHLEN = [
  { field: 'nutzungsdauer', step: 4 },
  { field: 'zahlungsziel', step: 5 },
  { field: 'korrekturschleifen', step: 5 }
];

export function missingUgcPflichtAuswahlen(formData = {}) {
  return UGC_PFLICHT_AUSWAHLEN.filter((item) => {
    if (item.field === 'korrekturschleifen') {
      return normalizeKorrekturschleifen(formData.korrekturschleifen) == null;
    }
    return isEmptyAuswahl(formData[item.field]);
  });
}
