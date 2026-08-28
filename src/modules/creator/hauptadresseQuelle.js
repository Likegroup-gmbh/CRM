// Gemeinsame Quelle der Vertrags-Hauptadresse am Creator:
// Creator-Adresse, Management-Adresse oder Firmenadresse.

export const HAUPTADRESSE_QUELLE = {
  CREATOR: 'creator',
  MANAGEMENT: 'management',
  FIRMA: 'firma'
};

export const HAUPTADRESSE_QUELLE_OPTIONS = [
  { value: HAUPTADRESSE_QUELLE.CREATOR, label: 'Creator-Adresse' },
  { value: HAUPTADRESSE_QUELLE.MANAGEMENT, label: 'Management-Adresse' },
  { value: HAUPTADRESSE_QUELLE.FIRMA, label: 'Firmenadresse' }
];

export function normalizeHauptadresseQuelle(value) {
  if (value === HAUPTADRESSE_QUELLE.MANAGEMENT || value === HAUPTADRESSE_QUELLE.FIRMA) {
    return value;
  }
  return HAUPTADRESSE_QUELLE.CREATOR;
}

export function hauptadresseQuelleLabel(value) {
  const match = HAUPTADRESSE_QUELLE_OPTIONS.find(o => o.value === normalizeHauptadresseQuelle(value));
  return match ? match.label : 'Creator-Adresse';
}
