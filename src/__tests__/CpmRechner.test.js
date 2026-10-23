import { describe, expect, it } from 'vitest';
import { naechstesErgebnis, rechneCpmFeld } from '../modules/creator/CpmRechner.js';

function schritt(zuletzt, feld, werte) {
  const next = naechstesErgebnis(zuletzt, feld);
  return {
    zuletzt: next.zuletzt,
    ergebnis: next.ergebnis,
    wert: rechneCpmFeld(next.ergebnis, werte)
  };
}

describe('CPM-Rechner, drei Richtungen', () => {
  it('rechnet die vereinbarte Reihe', () => {
    let stand = schritt(['tkp'], 'views', { views: 80000, tkp: 25, preis: '' });
    expect(stand.ergebnis).toBe('preis');
    expect(stand.wert).toBe(2000);

    stand = schritt(stand.zuletzt, 'preis', { views: 80000, tkp: 25, preis: 4000 });
    expect(stand.ergebnis).toBe('tkp');
    expect(stand.wert).toBe(50);

    stand = schritt(stand.zuletzt, 'tkp', { views: 80000, tkp: 40, preis: 4000 });
    expect(stand.ergebnis).toBe('views');
    expect(stand.wert).toBe(100000);

    stand = schritt(stand.zuletzt, 'tkp', { views: 100000, tkp: 20, preis: 4000 });
    expect(stand.ergebnis).toBe('views');
    expect(stand.wert).toBe(200000);

    stand = schritt(stand.zuletzt, 'views', { views: 50000, tkp: 20, preis: 4000 });
    expect(stand.ergebnis).toBe('preis');
    expect(stand.wert).toBe(1000);
  });

  it('rundet die Reichweite auf ganze Views', () => {
    expect(rechneCpmFeld('views', { preis: 4000, tkp: 30 })).toBe(133333);
  });

  it('leert das Ergebnis bei leerer Eingabe und bei 0', () => {
    expect(rechneCpmFeld('preis', { views: 80000, tkp: '' })).toBeNull();
    expect(rechneCpmFeld('preis', { views: 80000, tkp: 0 })).toBeNull();
    expect(rechneCpmFeld('tkp', { views: 80000, preis: '' })).toBeNull();
    expect(rechneCpmFeld('views', { preis: 0, tkp: 25 })).toBeNull();
  });

  it('rechnet nach einer Creator-Quelle den Preis, der TKP bleibt die andere Eingabe', () => {
    const wert = rechneCpmFeld('preis', { views: 80000, tkp: 40, preis: 999 });
    expect(wert).toBe(3200);
    expect(naechstesErgebnis(['tkp', 'views'], 'tkp').ergebnis).toBe('preis');
  });
});
