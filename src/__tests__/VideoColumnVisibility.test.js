import { describe, it, expect } from 'vitest';
import {
  isColumnPreferredVisible,
  isColumnVisible,
  setColumnPreferredVisible,
  showColumnKey,
  orderWithMovableSequence,
  getOrderedColumns,
  getConfigurableColumns,
  getDefaultColumnIds,
  TEAM_ONLY_COLUMNS
} from '../modules/kampagne/columns/ColumnRegistry.js';

describe('Video-Spalten Sichtbarkeit', () => {
  it('blendet Skript ohne Eintrag aus', () => {
    expect(isColumnPreferredVisible('col-skript', [])).toBe(false);
    expect(isColumnPreferredVisible('col-skript', ['col-skript'])).toBe(false);
    expect(isColumnVisible('col-skript', [], false)).toBe(false);
    expect(isColumnVisible('col-skript', null, false)).toBe(false);
  });

  it('zeigt Skript nur mit show-Marker', () => {
    expect(isColumnPreferredVisible('col-skript', ['show:col-skript'])).toBe(true);
    expect(isColumnVisible('col-skript', ['show:col-skript'], false)).toBe(true);
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

describe('Zurückgeholte Spalten', () => {
  const STANDARD_AUS = ['col-tags', 'col-thema', 'col-idee-strategie', 'col-link-skript'];
  const STANDARD_AN = [
    'col-start-datum', 'col-videoanzahl',
    'col-link-content', 'col-caption', 'col-finale-version',
    'col-feedback-cj-1', 'col-feedback-kunde-1',
    'col-feedback-cj-2', 'col-feedback-kunde-2',
    'col-feedback-cj-3', 'col-feedback-kunde-3',
    'col-link-live', 'col-stats-views', 'col-stats-likes', 'col-stats-comments'
  ];
  const ALLE = [...STANDARD_AUS, ...STANDARD_AN];

  it('stehen in Tabelle, Standard-Reihenfolge und „Tabelle anpassen“', () => {
    const store = { columnOrder: null, customColumns: [] };
    for (const ids of [
      getOrderedColumns(store).map(c => c.id),
      getConfigurableColumns(store).map(c => c.id),
      getDefaultColumnIds()
    ]) {
      for (const id of ALLE) expect(ids, id).toContain(id);
    }
  });

  it('kommen an ihre Default-Position, wenn eine gespeicherte Reihenfolge sie nicht kennt', () => {
    const gespeichert = ['col-nr', 'col-creator', 'col-vertrag', 'col-status', 'col-nutzungsrechte',
      'col-video-name', 'col-stills', 'col-freigabe', 'col-posting-datum', 'col-actions'];
    const store = { columnOrder: gespeichert, customColumns: [] };
    const ids = getOrderedColumns(store).map(c => c.id);

    for (const id of ALLE) expect(ids, id).toContain(id);
    expect(ids.filter(id => gespeichert.includes(id))).toEqual(gespeichert);
    expect(ids.indexOf('col-start-datum')).toBe(ids.indexOf('col-nutzungsrechte') + 1);
    expect(ids.indexOf('col-link-content')).toBe(ids.indexOf('col-video-name') + 1);
    expect(ids.indexOf('col-feedback-cj-1')).toBe(ids.indexOf('col-stills') + 1);
    expect(ids.indexOf('col-link-live')).toBe(ids.indexOf('col-posting-datum') + 1);
    expect(ids.at(-1)).toBe('col-actions');
  });

  it('Upload-, Feedback- und Auswertungs-Spalten sind ohne Eintrag sichtbar', () => {
    for (const id of STANDARD_AN) {
      expect(isColumnVisible(id, [], false), id).toBe(true);
      expect(isColumnVisible(id, [id], false), id).toBe(false);
    }
  });

  it('Tags, Thema, Idee und Link Skript nur mit show-Marker', () => {
    for (const id of STANDARD_AUS) {
      expect(isColumnPreferredVisible(id, []), id).toBe(false);
      expect(isColumnPreferredVisible(id, [id]), id).toBe(false);
      expect(isColumnVisible(id, null, false), id).toBe(false);
      expect(isColumnVisible(id, [showColumnKey(id)], false), id).toBe(true);
    }
  });

  it('Live Link und Zahlen nur fürs Team, Kunden lesen kooperation_post nicht', () => {
    expect([...TEAM_ONLY_COLUMNS].sort()).toEqual(['col-link-live', 'col-stats-comments', 'col-stats-likes', 'col-stats-views']);
    for (const id of TEAM_ONLY_COLUMNS) {
      expect(isColumnVisible(id, [], false), id).toBe(true);
      expect(isColumnVisible(id, [], true), id).toBe(false);
    }
    expect(isColumnVisible('col-start-datum', [], true)).toBe(true);
  });
});

describe('orderWithMovableSequence', () => {
  it('lässt Nr und Creator vorne und Aktionen hinten', () => {
    const store = { columnOrder: null, customColumns: [] };
    const order = orderWithMovableSequence(store, ['col-vertrag', 'col-status']);

    expect(order.slice(0, 4)).toEqual(['col-nr', 'col-creator', 'col-vertrag', 'col-status']);
    expect(order.at(-1)).toBe('col-actions');
    expect(order.filter(id => id === 'col-status')).toHaveLength(1);
  });
});
