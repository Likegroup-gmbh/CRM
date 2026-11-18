import { describe, it, expect, beforeEach } from 'vitest';
import { renderItemRow } from '../modules/creator-auswahl/castingItemRow.js';
import {
  castingFilterDefs,
  castingSorts,
  createCastingTableFilter,
  parsePreis
} from '../modules/creator-auswahl/castingFilterSpalte.js';
import { getBaseFilteredItems, getFilteredItems } from '../modules/creator-auswahl/CastingDetailFilter.js';

const items = [
  { id: 'a', name: 'Zoe', angefragt: true, follower_instagram: 1200, preis_reels: '1.500 €', created_at: '2026-01-01' },
  { id: 'b', name: 'anna', gebucht: true, follower_tiktok: 90000, preis_reels: '800', created_at: '2026-03-01' },
  { id: 'c', name: 'Ben', angefragt: true, prio_1: true, created_at: '2026-02-01' }
];

function detailStub(tableFilter, overrides = {}) {
  return {
    activeTab: 'alle',
    searchQuery: '',
    tableFilter,
    getSearchFilteredItems() { return [...(this.vorschlaege || []), ...items]; },
    getBaseFilteredItems,
    getFilteredItems,
    ...overrides
  };
}

const ids = (list) => list.map((item) => item.id);

beforeEach(() => {
  window.history.replaceState(null, '', '/produktion/p1?tab=casting');
});

describe('castingFilterDefs', () => {
  it('blendet Preise und Datensatz für Kunden aus', () => {
    const team = castingFilterDefs({ items }).map((def) => def.id);
    const kunde = castingFilterDefs({ items, isKunde: true }).map((def) => def.id);
    expect(team).toEqual(expect.arrayContaining(['preis_video', 'datensatz', 'status', 'follower']));
    expect(kunde).not.toContain('preis_video');
    expect(kunde).not.toContain('datensatz');
    expect(kunde).toContain('status');
  });

  it('bietet Kunden keine Filter auf ausgeblendete Spalten an', () => {
    const kunde = castingFilterDefs({ items, isKunde: true, hiddenColumns: ['cp-col-follower'] }).map((def) => def.id);
    expect(kunde).not.toContain('follower');
  });

  it('hängt eigene Spalten als eigene Gruppe an', () => {
    const customManager = {
      getOrderedColumns: () => [{ id: 'x1', name: 'Shooting', field_type: 'date', visible_for_kunden: false }],
      getValue: (id) => (id === 'b' ? '2026-04-02' : '')
    };
    const filter = createCastingTableFilter({ items, customManager });
    filter.setValues({ custom_x1: { from: '2026-04-01' } });
    expect(ids(filter.filter(items))).toEqual(['b']);
    expect(castingFilterDefs({ items, customManager, isKunde: true }).some((def) => def.id === 'custom_x1')).toBe(false);
  });

  it('versteckt Matching und Preis als Sortierung vor Kunden', () => {
    expect(castingSorts().map((sort) => sort.id)).toContain('matching');
    expect(castingSorts({ isKunde: true }).map((sort) => sort.id)).toEqual(['manuell', 'name', 'follower', 'neu']);
  });

  it('liest Freitext-Preise mit Tausenderpunkt', () => {
    expect(parsePreis('1.500 €')).toBe(1500);
    expect(parsePreis('800,50')).toBe(800.5);
    expect(parsePreis('auf Anfrage')).toBeNull();
  });
});

describe('Casting-Liste mit Filterspalte', () => {
  it('filtert reiterübergreifend und sortiert nur unter den Vorschlägen', () => {
    const filter = createCastingTableFilter({ items });
    const detail = detailStub(filter, { vorschlaege: [{ id: 'v1', name: 'KI', isVorschlag: true, angefragt: true }] });

    filter.setValues({ status: ['Angefragt'] });
    expect(ids(detail.getBaseFilteredItems())).toEqual(['v1', 'a', 'c']);
    expect(ids(detail.getFilteredItems())).toEqual(['v1', 'a', 'c']);

    filter.setSort('name');
    expect(ids(detail.getFilteredItems())).toEqual(['v1', 'c', 'a']);
  });

  it('sortiert nach Follower und Preis', () => {
    const filter = createCastingTableFilter({ items });
    const detail = detailStub(filter);
    filter.setSort('follower');
    expect(ids(detail.getFilteredItems())).toEqual(['b', 'a', 'c']);
    filter.setSort('preis_video');
    expect(ids(detail.getFilteredItems())).toEqual(['b', 'a', 'c']);
  });

  it('sperrt das Ziehen, solange nicht manuell sortiert wird', () => {
    const row = (dragDisabled) => new DOMParser().parseFromString(
      `<table><tbody>${renderItemRow({ isKunde: false, hiddenColumns: [], dragDisabled }, items[0], 0)}</tbody></table>`,
      'text/html'
    ).querySelector('tr.item-row');
    expect(row(false).classList.contains('draggable')).toBe(true);
    expect(row(false).querySelector('.drag-handle')).not.toBeNull();
    expect(row(true).classList.contains('draggable')).toBe(false);
    expect(row(true).querySelector('.drag-handle')).toBeNull();
  });
});
