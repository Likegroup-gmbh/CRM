import { describe, it, expect } from 'vitest';
import {
  comparePrefixedNumbersDesc,
  sortRowsByPrefixedNumberDesc
} from '../modules/auftrag/logic/PrefixedNumberSort.js';

describe('PrefixedNumberSort', () => {
  it('sortiert nach Nummer absteigend innerhalb desselben Praefix', () => {
    const rows = [
      { id: 1, angebotsnummer: 'AN-9' },
      { id: 2, angebotsnummer: 'AN-100' },
      { id: 3, angebotsnummer: 'AN-50' }
    ];
    const sorted = sortRowsByPrefixedNumberDesc(rows, 'angebotsnummer');
    expect(sorted.map(r => r.angebotsnummer)).toEqual(['AN-100', 'AN-50', 'AN-9']);
  });

  it('stellt Praefix-Format vor Eintraegen ohne Bindestrich-Muster', () => {
    expect(comparePrefixedNumbersDesc('AN-1', 'ohne-format')).toBeLessThan(0);
    expect(comparePrefixedNumbersDesc('ohne-format', 'A-2')).toBeGreaterThan(0);
  });

  it('sortiert RE-Nummern mit mehreren Segmenten numerisch absteigend', () => {
    const rows = [
      { id: 1, re_nr: 'RE-2025-001' },
      { id: 2, re_nr: 'RE-2025-010' },
      { id: 3, re_nr: 'RE-2024-099' }
    ];
    const sorted = sortRowsByPrefixedNumberDesc(rows, 're_nr');
    expect(sorted.map(r => r.re_nr)).toEqual(['RE-2025-010', 'RE-2025-001', 'RE-2024-099']);
  });

  it('setzt leere Werte ans Ende', () => {
    const rows = [
      { id: 1, re_nr: '' },
      { id: 2, re_nr: 'RE-10' },
      { id: 3, re_nr: null }
    ];
    const sorted = sortRowsByPrefixedNumberDesc(rows, 're_nr');
    expect(sorted[0].re_nr).toBe('RE-10');
    expect(sorted.slice(1).every(r => !r.re_nr)).toBe(true);
  });
});
