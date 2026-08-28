import { describe, expect, it } from 'vitest';
import {
  HAUPTADRESSE_QUELLE,
  HAUPTADRESSE_QUELLE_OPTIONS,
  normalizeHauptadresseQuelle,
  hauptadresseQuelleLabel
} from '../modules/creator/hauptadresseQuelle.js';

describe('hauptadresseQuelle', () => {
  it('kennt genau die drei Adressquellen', () => {
    expect(HAUPTADRESSE_QUELLE_OPTIONS.map(o => o.value)).toEqual([
      HAUPTADRESSE_QUELLE.CREATOR,
      HAUPTADRESSE_QUELLE.MANAGEMENT,
      HAUPTADRESSE_QUELLE.FIRMA
    ]);
  });

  it('fällt unbekannte Werte auf Creator-Adresse zurück', () => {
    expect(normalizeHauptadresseQuelle(null)).toBe('creator');
    expect(normalizeHauptadresseQuelle('')).toBe('creator');
    expect(normalizeHauptadresseQuelle('sonstiges')).toBe('creator');
    expect(normalizeHauptadresseQuelle('firma')).toBe('firma');
    expect(normalizeHauptadresseQuelle('management')).toBe('management');
  });

  it('liefert die Anzeigebezeichnung zur Quelle', () => {
    expect(hauptadresseQuelleLabel('firma')).toBe('Firmenadresse');
    expect(hauptadresseQuelleLabel('management')).toBe('Management-Adresse');
    expect(hauptadresseQuelleLabel(undefined)).toBe('Creator-Adresse');
  });
});
