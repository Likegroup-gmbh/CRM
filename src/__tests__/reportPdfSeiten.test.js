import { describe, it, expect } from 'vitest';
import { MAX_JE_SEITE, seitenAus, spaltenFuer, verteileAufSeiten } from '../modules/report-pdf/reportPdfSeiten.js';

describe('Report-PDF: Verteilung der Kacheln auf Seiten', () => {
  it('startet mit 5 Kacheln je Seite', () => {
    expect(MAX_JE_SEITE).toBe(5);
  });

  it.each([
    [0, []],
    [1, [1]],
    [5, [5]],
    [8, [4, 4]],
    [10, [5, 5]],
    [11, [4, 4, 3]],
  ])('%i Posts bei max 5 → %j', (anzahl, erwartet) => {
    expect(verteileAufSeiten(anzahl)).toEqual(erwartet);
  });

  it.each([
    [3, [3]],
    [4, [2, 2]],
    [7, [3, 2, 2]],
    [10, [3, 3, 2, 2]],
  ])('%i Posts bei max 3 → %j', (anzahl, erwartet) => {
    expect(verteileAufSeiten(anzahl, 3)).toEqual(erwartet);
  });

  it('nie mehr als max je Seite, nie mehr als eine Kachel Unterschied', () => {
    for (let max = 3; max <= 6; max += 1) {
      for (let n = 1; n <= 40; n += 1) {
        const seiten = verteileAufSeiten(n, max);
        expect(seiten.reduce((a, b) => a + b, 0)).toBe(n);
        expect(Math.max(...seiten)).toBeLessThanOrEqual(max);
        expect(Math.max(...seiten) - Math.min(...seiten)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('schneidet die Kacheln in dieser Verteilung und in Reihenfolge', () => {
    const kacheln = Array.from({ length: 11 }, (_, i) => i + 1);
    expect(seitenAus(kacheln)).toEqual([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11]]);
    expect(seitenAus([])).toEqual([]);
  });

  it('Spalten folgen der vollsten Seite, mindestens 3 gegen überbreite Kacheln', () => {
    expect(spaltenFuer(11)).toBe(4);
    expect(spaltenFuer(10)).toBe(5);
    expect(spaltenFuer(12, 6)).toBe(6);
    expect(spaltenFuer(1)).toBe(3);
    expect(spaltenFuer(0)).toBe(3);
  });
});
