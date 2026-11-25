import { describe, it, expect } from 'vitest';
import { standardZugangsName } from '../modules/share/shareZugangsName.js';

const TAG = new Date(2026, 10, 16);

describe('standardZugangsName', () => {
  it('nimmt bei einer gemeinsamen Firmen-Domain den Firmennamen', () => {
    expect(standardZugangsName(['kunde@telekom.de'], TAG)).toBe('Telekom');
    expect(standardZugangsName(['a@mail.vhv-gruppe.de', 'b@mail.vhv-gruppe.de'], TAG)).toBe('Vhv-Gruppe');
    expect(standardZugangsName(['ceo@agentur.co.uk'], TAG)).toBe('Agentur');
  });

  it('nimmt bei einer einzelnen Freemail-Adresse den Personennamen', () => {
    expect(standardZugangsName(['lisa.berger@gmail.com'], TAG)).toBe('Lisa Berger');
    expect(standardZugangsName(['max_mueller92+crm@gmx.de'], TAG)).toBe('Max Mueller92');
  });

  it('fällt bei gemischten Domains, mehreren Freemail-Adressen oder ohne Adresse auf das Datum zurück', () => {
    expect(standardZugangsName(['a@telekom.de', 'b@vodafone.de'], TAG)).toBe('Gast-Zugang 16.11.');
    expect(standardZugangsName(['a@gmail.com', 'b@gmail.com'], TAG)).toBe('Gast-Zugang 16.11.');
    expect(standardZugangsName([], TAG)).toBe('Gast-Zugang 16.11.');
    expect(standardZugangsName(undefined, new Date(2026, 0, 5))).toBe('Gast-Zugang 05.01.');
  });
});
