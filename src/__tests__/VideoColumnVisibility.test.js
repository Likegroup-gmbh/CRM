import { describe, it, expect } from 'vitest';
import {
  isColumnPreferredVisible,
  isColumnVisible,
  setColumnPreferredVisible
} from '../modules/kampagne/columns/ColumnRegistry.js';

describe('Video-Spalten Sichtbarkeit', () => {
  it('blendet Idee und Skript ohne Eintrag aus', () => {
    expect(isColumnPreferredVisible('col-idee-strategie', [])).toBe(false);
    expect(isColumnPreferredVisible('col-skript', [])).toBe(false);
    expect(isColumnPreferredVisible('col-skript', ['col-skript'])).toBe(false);
    expect(isColumnVisible('col-skript', [], false)).toBe(false);
    expect(isColumnVisible('col-idee-strategie', null, false)).toBe(false);
  });

  it('zeigt Skript nur mit show-Marker', () => {
    expect(isColumnPreferredVisible('col-skript', ['show:col-skript'])).toBe(true);
    expect(isColumnVisible('col-idee-strategie', ['show:col-idee-strategie'], false)).toBe(true);
  });

  it('lässt andere Spalten beim leeren Array sichtbar und versteckt sie über die ID', () => {
    expect(isColumnPreferredVisible('col-thema', [])).toBe(true);
    expect(isColumnPreferredVisible('col-thema', ['col-thema'])).toBe(false);
    expect(isColumnVisible('col-thema', [], false)).toBe(true);
    expect(isColumnVisible('custom:abc', ['custom:abc'], false)).toBe(false);
  });

  it('schreibt beim Einschalten den show-Marker und entfernt die Spalten-ID', () => {
    expect(setColumnPreferredVisible(['col-skript'], 'col-skript', true)).toEqual(['show:col-skript']);
    expect(setColumnPreferredVisible(['show:col-skript', 'col-thema'], 'col-skript', false)).toEqual([
      'col-thema',
      'col-skript'
    ]);
  });

  it('blendet normale Spalten ohne show-Marker', () => {
    expect(setColumnPreferredVisible([], 'col-thema', false)).toEqual(['col-thema']);
    expect(setColumnPreferredVisible(['col-thema', 'show:col-thema'], 'col-thema', true)).toEqual([]);
  });
});
