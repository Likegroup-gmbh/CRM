import { describe, it, expect } from 'vitest';
import {
  matchingScore,
  matchingScoreTooltip,
  matchingBarColor,
  renderMatchingCell,
  normalizeInstagramUrl,
  normalizeTiktokUrl
} from '../modules/creator-auswahl/sourcingMatching.js';

describe('sourcingMatching – Score', () => {
  it('gewichtet Fit 80, Track 15, Fresh 5 (ADR 0014)', () => {
    expect(matchingScore({ fit: 100, track: 0, fresh: 0, castings: 5 })).toBe(80);
    expect(matchingScore({ fit: 0, track: 100, fresh: 0, castings: 5 })).toBe(15);
    expect(matchingScore({ fit: 0, track: 0, fresh: 100, castings: 5 })).toBe(5);
    expect(matchingScore({ fit: 58, track: 36, fresh: 100, castings: 5 })).toBe(57);
  });

  it('Cold-Start ohne Historie: Track-Gewicht geht auf Fit (Renorm)', () => {
    // (0.8*62 + 0.05*48) / 0.85 = 61.2 -> 61
    expect(matchingScore({ fit: 62, track: 0, fresh: 48, castings: 0 })).toBe(61);
  });

  it('gibt null ohne jeden Teilscore', () => {
    expect(matchingScore({})).toBeNull();
    expect(matchingScore()).toBeNull();
  });

  it('behandelt fehlende Teile als 0, sobald einer da ist', () => {
    expect(matchingScore({ fit: 80, castings: 2 })).toBe(64);
  });

  it('baut den Tooltip aus den Rohwerten', () => {
    expect(matchingScoreTooltip({ fit: 58, track: 36, fresh: 100, castings: 4 }))
      .toBe('Fit 58 · Track 36 · Fresh 100');
  });

  it('markiert Track im Tooltip als nicht verfuegbar bei Cold-Start', () => {
    expect(matchingScoreTooltip({ fit: 62, track: 0, fresh: 48, castings: 0 }))
      .toBe('Fit 62 · Track n. v. (neu) · Fresh 48');
  });
});

describe('sourcingMatching – Ampelfarbe', () => {
  function parseHsl(color) {
    const m = String(color).match(/hsl\((\d+) (\d+)% (\d+)%\)/);
    expect(m).not.toBeNull();
    return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
  }

  it('ist bei 0 rot, bei 50 orange, bei 100 gruen', () => {
    expect(parseHsl(matchingBarColor(0)).h).toBe(0);
    expect(parseHsl(matchingBarColor(50)).h).toBe(32);
    expect(parseHsl(matchingBarColor(100)).h).toBe(160);
  });

  it('liegt 68 zwischen Orange und Gruen, als einheitliche Farbe', () => {
    const { h } = parseHsl(matchingBarColor(68));
    expect(h).toBeGreaterThan(32);
    expect(h).toBeLessThan(160);
    expect(h).toBeGreaterThan(50);
  });

  it('schreibt genau eine Hintergrundfarbe in den Fill', () => {
    const html = renderMatchingCell(68, { fit: 70, track: 50, fresh: 90, castings: 3 });
    const fills = html.match(/background:[^;"]+/g) || [];

    expect(html).toContain('68/100');
    expect(html).toContain('width:68%');
    expect(fills).toHaveLength(1);
    expect(fills[0]).toMatch(/hsl\(\d+ \d+% \d+%\)/);
    expect(html).toContain('Fit 70 · Track 50 · Fresh 90');
  });

  it('zeigt einen Strich ohne Score', () => {
    expect(renderMatchingCell(null)).toContain('-');
    expect(renderMatchingCell(null)).not.toContain('sourcing-matching__fill');
  });
});

describe('sourcingMatching – Social-URLs', () => {
  it('macht aus dem Handle eine Instagram-URL', () => {
    expect(normalizeInstagramUrl('hierkochtjessie')).toBe('https://instagram.com/hierkochtjessie');
    expect(normalizeInstagramUrl('@eva.creen')).toBe('https://instagram.com/eva.creen');
    expect(normalizeInstagramUrl('https://instagram.com/x')).toBe('https://instagram.com/x');
    expect(normalizeInstagramUrl('')).toBeNull();
  });

  it('macht aus dem Handle eine TikTok-URL', () => {
    expect(normalizeTiktokUrl('anna')).toBe('https://tiktok.com/@anna');
    expect(normalizeTiktokUrl('@anna')).toBe('https://tiktok.com/@anna');
    expect(normalizeTiktokUrl('https://tiktok.com/@anna')).toBe('https://tiktok.com/@anna');
  });
});
