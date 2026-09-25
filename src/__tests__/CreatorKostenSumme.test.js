import { describe, it, expect } from 'vitest';
import { sumKooperationCreatorKosten } from '../modules/rechnung/creatorKostenSumme.js';

describe('sumKooperationCreatorKosten', () => {
  it('summiert den Kooperations-EK, auch ohne Rechnung', () => {
    expect(sumKooperationCreatorKosten([
      { id: 'k1', einkaufspreis_netto: 1000 },
      { id: 'k2', einkaufspreis_netto: '250.5', ksk_selbstzahler: false, ksk_betrag: 99 }
    ], [])).toBe(1250.5);
  });

  it('nimmt den Video-EK, sobald Videos gepflegt sind, und addiert Selbstzahler-KSK', () => {
    expect(sumKooperationCreatorKosten([
      { id: 'k1', einkaufspreis_netto: 9999, ksk_selbstzahler: true, ksk_betrag: 49 }
    ], [
      { kooperation_id: 'k1', einkaufspreis_netto: 400 },
      { kooperation_id: 'k1', einkaufspreis_netto: 600 }
    ])).toBe(1049);
  });

  it('leere Listen ergeben 0', () => {
    expect(sumKooperationCreatorKosten()).toBe(0);
    expect(sumKooperationCreatorKosten([], [])).toBe(0);
  });
});
