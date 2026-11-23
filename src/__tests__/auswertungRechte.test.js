import { afterEach, describe, expect, it } from 'vitest';
import { darfKostenSehen } from '../modules/auswertung/auswertungPane.js';

describe('Preis-Sicht in der Auswertung', () => {
  afterEach(() => {
    delete window.canSeePricing;
  });

  it('zeigt die Kostenkarte nur mit Preis-Sicht', () => {
    window.canSeePricing = () => false;
    expect(darfKostenSehen()).toBe(false);

    window.canSeePricing = () => true;
    expect(darfKostenSehen()).toBe(true);
  });

  it('blendet die Kostenkarte aus, wenn die Preis-Sicht fehlt', () => {
    expect(darfKostenSehen()).toBe(false);
  });
});
