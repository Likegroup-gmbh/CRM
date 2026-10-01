import { describe, it, expect } from 'vitest';
import {
  isColumnPreferredVisible,
  isColumnVisible,
  setColumnPreferredVisible
} from '../modules/kampagne/columns/ColumnRegistry.js';

describe('Video-Spalten Sichtbarkeit', () => {
  it('blendet Idee, Skript, Tags, Thema und Link Skript ohne Eintrag aus', () => {
    for (const id of ['col-idee-strategie', 'col-skript', 'col-tags', 'col-thema', 'col-link-skript']) {
      expect(isColumnPreferredVisible(id, [])).toBe(false);
      expect(isColumnPreferredVisible(id, [id])).toBe(false);
      expect(isColumnVisible(id, [], false)).toBe(false);
      expect(isColumnVisible(id, null, false)).toBe(false);
    }
  });

  it('zeigt ausgeblendete Defaults nur mit show-Marker', () => {
    expect(isColumnPreferredVisible('col-skript', ['show:col-skript'])).toBe(true);
    expect(isColumnVisible('col-idee-strategie', ['show:col-idee-strategie'], false)).toBe(true);
    expect(isColumnVisible('col-tags', ['show:col-tags'], false)).toBe(true);
    expect(isColumnVisible('col-thema', ['show:col-thema'], false)).toBe(true);
    expect(isColumnVisible('col-link-skript', ['show:col-link-skript'], false)).toBe(true);
  });

  it('lässt andere Spalten beim leeren Array sichtbar und versteckt sie über die ID', () => {
    expect(isColumnPreferredVisible('col-organic-paid', [])).toBe(true);
    expect(isColumnPreferredVisible('col-organic-paid', ['col-organic-paid'])).toBe(false);
    expect(isColumnVisible('col-organic-paid', [], false)).toBe(true);
    expect(isColumnVisible('custom:abc', ['custom:abc'], false)).toBe(false);
  });

  it('schreibt beim Einschalten den show-Marker und entfernt die Spalten-ID', () => {
    expect(setColumnPreferredVisible(['col-skript'], 'col-skript', true)).toEqual(['show:col-skript']);
    expect(setColumnPreferredVisible(['show:col-skript', 'col-organic-paid'], 'col-skript', false)).toEqual([
      'col-organic-paid',
      'col-skript'
    ]);
  });

  it('blendet normale Spalten ohne show-Marker', () => {
    expect(setColumnPreferredVisible([], 'col-organic-paid', false)).toEqual(['col-organic-paid']);
    expect(setColumnPreferredVisible(['col-organic-paid', 'show:col-organic-paid'], 'col-organic-paid', true)).toEqual([]);
  });
});
