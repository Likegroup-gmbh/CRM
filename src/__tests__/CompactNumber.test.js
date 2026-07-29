import { describe, it, expect } from 'vitest';
import {
  formatCompactNumber,
  formatExactNumber,
  parseCompactNumber
} from '../core/format/compactNumber.js';

describe('formatCompactNumber', () => {
  it('zeigt Werte unter 1.000 ungekuerzt', () => {
    expect(formatCompactNumber(0)).toBe('0');
    expect(formatCompactNumber(42)).toBe('42');
    expect(formatCompactNumber(999)).toBe('999');
  });

  it('kuerzt ab 1.000 auf eine Nachkommastelle mit K', () => {
    expect(formatCompactNumber(1000)).toBe('1,0K');
    expect(formatCompactNumber(5547)).toBe('5,5K');
    expect(formatCompactNumber(21569)).toBe('21,6K');
    expect(formatCompactNumber(999999)).toBe('1.000,0K');
  });

  it('kuerzt ab einer Million auf zwei Nachkommastellen mit M', () => {
    expect(formatCompactNumber(1000000)).toBe('1,00M');
    expect(formatCompactNumber(1391836)).toBe('1,39M');
    expect(formatCompactNumber(12500000)).toBe('12,50M');
  });

  it('liefert fuer leere und ungueltige Werte einen leeren String', () => {
    expect(formatCompactNumber(null)).toBe('');
    expect(formatCompactNumber(undefined)).toBe('');
    expect(formatCompactNumber('')).toBe('');
    expect(formatCompactNumber('keine Zahl')).toBe('');
  });

  it('behaelt das Vorzeichen', () => {
    expect(formatCompactNumber(-5547)).toBe('-5,5K');
  });
});

describe('formatExactNumber', () => {
  it('schreibt die Zahl mit Tausenderpunkten aus', () => {
    expect(formatExactNumber(1391836)).toBe('1.391.836');
    expect(formatExactNumber(42)).toBe('42');
    expect(formatExactNumber(null)).toBe('');
  });
});

describe('parseCompactNumber', () => {
  it('liest reine Zahlen', () => {
    expect(parseCompactNumber('21569')).toBe(21569);
    expect(parseCompactNumber('0')).toBe(0);
    expect(parseCompactNumber(1391836)).toBe(1391836);
  });

  it('ignoriert Tausenderpunkte und Leerzeichen', () => {
    expect(parseCompactNumber('21.569')).toBe(21569);
    expect(parseCompactNumber('1.391.836')).toBe(1391836);
    expect(parseCompactNumber(' 5 547 ')).toBe(5547);
  });

  it('versteht die K- und M-Kurzform', () => {
    expect(parseCompactNumber('21,6K')).toBe(21600);
    expect(parseCompactNumber('5,5k')).toBe(5500);
    expect(parseCompactNumber('1,39M')).toBe(1390000);
    expect(parseCompactNumber('2m')).toBe(2000000);
    expect(parseCompactNumber('1,39 M')).toBe(1390000);
  });

  it('liefert null fuer leere und ungueltige Eingaben', () => {
    expect(parseCompactNumber('')).toBeNull();
    expect(parseCompactNumber('   ')).toBeNull();
    expect(parseCompactNumber(null)).toBeNull();
    expect(parseCompactNumber(undefined)).toBeNull();
    expect(parseCompactNumber('abc')).toBeNull();
    expect(parseCompactNumber('12X')).toBeNull();
  });

  it('rundet auf ganze Zahlen', () => {
    expect(parseCompactNumber('1,2345K')).toBe(1235);
  });

  it('macht die eigene Kurzform wieder lesbar', () => {
    for (const value of [999, 5547, 21569, 1391836]) {
      const roundTrip = parseCompactNumber(formatCompactNumber(value));
      expect(roundTrip).not.toBeNull();
      // Kurzform rundet bewusst, daher nur die Groessenordnung pruefen
      expect(Math.abs(roundTrip - value) / value).toBeLessThan(0.01);
    }
  });
});
