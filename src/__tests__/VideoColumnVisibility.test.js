import { describe, it, expect } from 'vitest';
import {
  isColumnPreferredVisible,
  isColumnVisible,
  setColumnPreferredVisible,
  showColumnKey,
  orderWithMovableSequence,
  getOrderedColumns,
  getConfigurableColumns,
  getDefaultColumnIds
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

describe('Stillgelegte Spalten', () => {
  const STILLGELEGT = [
    'col-tags', 'col-thema', 'col-idee-strategie', 'col-link-skript',
    'col-link-content', 'col-caption', 'col-finale-version',
    'col-feedback-cj-1', 'col-feedback-kunde-1',
    'col-feedback-cj-2', 'col-feedback-kunde-2',
    'col-feedback-cj-3', 'col-feedback-kunde-3'
  ];

  it('fehlen in Tabelle, Standard-Reihenfolge und „Tabelle anpassen“', () => {
    const store = { columnOrder: null, customColumns: [] };
    const ids = [
      ...getOrderedColumns(store).map(c => c.id),
      ...getConfigurableColumns(store).map(c => c.id),
      ...getDefaultColumnIds()
    ];
    for (const id of STILLGELEGT) expect(ids, id).not.toContain(id);
    for (const id of ['col-skript', 'col-stills', 'col-freigabe']) expect(ids, id).toContain(id);
  });

  it('fehlen auch, wenn eine gespeicherte Reihenfolge sie noch enthält', () => {
    const store = { columnOrder: ['col-nr', 'col-creator', 'col-caption', 'col-stills', 'col-actions'], customColumns: [] };
    const ids = getOrderedColumns(store).map(c => c.id);
    expect(ids).not.toContain('col-caption');
    expect(ids).toContain('col-stills');
    expect(orderWithMovableSequence(store, ['col-stills'])).not.toContain('col-caption');
  });

  it('bleiben unsichtbar, selbst mit altem show-Marker', () => {
    for (const id of STILLGELEGT) {
      expect(isColumnVisible(id, [], false), id).toBe(false);
      expect(isColumnVisible(id, [showColumnKey(id)], false), id).toBe(false);
    }
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
