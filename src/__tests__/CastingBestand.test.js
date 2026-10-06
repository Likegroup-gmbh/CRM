import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../core/filters/ModularFilterSystem.js', () => ({
  modularFilterSystem: {
    getFilters: vi.fn(() => ({})),
    applyFilters: vi.fn(),
    resetFilters: vi.fn()
  }
}));

import {
  buildCastingBestandFilters,
  castingBestandSort,
  defaultSortAscending
} from '../modules/creator-casting/castingBestandFilters.js';
import { FILTER_CONFIG_REGISTRY } from '../core/filters/FilterConfigRegistry.js';
import { CastingBestandList } from '../modules/creator-casting/CastingBestandList.js';

describe('buildCastingBestandFilters', () => {
  it('sendet ohne Suche keine Filter', () => {
    expect(buildCastingBestandFilters({})).toEqual({});
    expect(buildCastingBestandFilters({ feedback: ['prio_1'], kunde_id: 'x' }, '')).toEqual({});
  });

  it('setzt die Suche als Namensfilter', () => {
    expect(buildCastingBestandFilters({}, '  Lina ')).toEqual({ name: 'Lina' });
  });
});

describe('castingBestandSort', () => {
  it('reicht bekannte Felder 1:1 an die RPC durch', () => {
    for (const field of ['name', 'castings', 'prio_1', 'prio_2', 'abgelehnt', 'produktionen', 'zuletzt']) {
      expect(castingBestandSort({ field, ascending: true })).toEqual({ p_sort: field, p_ascending: true });
    }
  });

  it('fällt bei unbekanntem Feld auf Zuletzt zurück', () => {
    expect(castingBestandSort({ field: 'created_at', ascending: false })).toEqual({ p_sort: 'zuletzt', p_ascending: false });
    expect(castingBestandSort()).toEqual({ p_sort: 'zuletzt', p_ascending: false });
  });

  it('startet Namen aufsteigend, alles andere absteigend', () => {
    expect(defaultSortAscending('name')).toBe(true);
    expect(defaultSortAscending('prio_1')).toBe(false);
    expect(defaultSortAscending('zuletzt')).toBe(false);
  });
});

describe('Filter-Registry', () => {
  it('hat keine Filter-Config für Creator Casting und lässt /creator unverändert', () => {
    expect(FILTER_CONFIG_REGISTRY['creator-casting']).toBeUndefined();
    expect(FILTER_CONFIG_REGISTRY.creator.filters.some(f => f.id === 'kunde_id')).toBe(true);
  });
});

describe('CastingBestandList', () => {
  let list;

  beforeEach(() => {
    list = new CastingBestandList();
    window.supabase = {
      rpc: vi.fn(async () => ({
        data: { rows: [{ id: 'c1', vorname: 'Lina', nachname: 'Muster' }], total_count: '42' },
        error: null
      }))
    };
  });

  it('startet auf Zuletzt absteigend', () => {
    expect(list.currentSort).toEqual({ field: 'zuletzt', ascending: false });
  });

  it('ruft get_casting_bestand mit Seite, Sort und Suche auf', async () => {
    list.searchQuery = 'Lina';
    const result = await list.loadPageData(2, 25, { feedback: ['prio_1'] });
    expect(window.supabase.rpc).toHaveBeenCalledWith('get_casting_bestand', {
      p_page: 2,
      p_limit: 25,
      p_sort: 'zuletzt',
      p_ascending: false,
      p_filters: { name: 'Lina' }
    });
    expect(result.total).toBe(42);
    expect(result.data).toHaveLength(1);
  });

  it('sendet die gewählte Sortierung an die RPC', async () => {
    list.currentSort = { field: 'prio_1', ascending: false };
    await list.loadPageData(1, 25, {});
    expect(window.supabase.rpc.mock.calls[0][1]).toMatchObject({ p_sort: 'prio_1', p_ascending: false });
  });

  it('wirft RPC-Fehler weiter', async () => {
    window.supabase.rpc = vi.fn(async () => ({ data: null, error: new Error('boom') }));
    await expect(list.loadPageData(1, 25, {})).rejects.toThrow('boom');
  });

  const row = {
    id: 'c1',
    vorname: 'Lina',
    nachname: 'Muster',
    branchen: ['Food & Lifestyle', 'Beauty & Fashion'],
    creator_types: ['UGC Creator'],
    instagram_follower: 12000,
    tiktok_follower: null,
    lieferadresse_stadt: 'Berlin',
    castings: 8,
    prio_1: 1,
    prio_2: 0,
    abgelehnt: 2,
    produktionen: 3,
    zuletzt: '2026-09-30T14:21:19.071677+00:00'
  };

  it('rendert alle Zähler aus den RPC-Feldern', () => {
    const html = list.renderSingleRow(row);
    const cell = (col) => html.match(new RegExp(`data-col="${col}">([^<]*)<`))[1];
    expect(cell('castings')).toBe('8');
    expect(cell('prio_1')).toBe('1');
    expect(cell('prio_2')).toBe('0');
    expect(cell('abgelehnt')).toBe('2');
    expect(cell('produktionen')).toBe('3');
    expect(cell('zuletzt')).toBe('30.09.2026');
    expect(html).toContain('data-table="creator-casting"');
    expect(html).toContain('Lina Muster');
  });

  it('rendert Branchen als Tags zwischen Name und Typen', () => {
    const html = list.renderSingleRow(row);
    expect(html).toContain('tag--branche">Food & Lifestyle<');
    expect(html).toContain('tag--branche">Beauty & Fashion<');
    expect(html.indexOf('data-col="branchen"')).toBeGreaterThan(html.indexOf('Lina Muster'));
    expect(html.indexOf('data-col="branchen"')).toBeLessThan(html.indexOf('tag--type'));
  });

  it('zeigt 0 Produktionen und - ohne Branche', () => {
    const html = list.renderSingleRow({ ...row, produktionen: undefined, branchen: [] });
    expect(html).toMatch(/data-col="produktionen">0</);
    expect(html).toMatch(/data-col="branchen">-</);
  });

  it('öffnet den Creator im Detail', () => {
    expect(list.resolveDetailRoute('c1')).toBe('/creator/c1');
  });

  describe('Spaltenköpfe', () => {
    let controller;

    beforeEach(() => {
      document.body.innerHTML = list.renderShellContent();
      controller = new AbortController();
      list.loadDataDebounced = vi.fn();
      list.bindAdditionalEvents(controller.signal);
    });

    afterEach(() => {
      controller.abort();
      document.body.innerHTML = '';
    });

    const th = (field) => document.querySelector(`th[data-sort="${field}"]`);

    it('hat sortierbare Zähler-Köpfe und keinen Filter-Button', () => {
      ['name', 'castings', 'prio_1', 'prio_2', 'abgelehnt', 'produktionen', 'zuletzt']
        .forEach(field => expect(th(field)).not.toBeNull());
      expect(th('zuletzt').getAttribute('aria-sort')).toBe('descending');
      expect(document.getElementById('filter-dropdown-container')).toBeNull();
      expect(document.getElementById('sort-dropdown-container')).toBeNull();
    });

    it('sortiert beim ersten Klick absteigend und kehrt beim zweiten um', () => {
      th('prio_1').click();
      expect(list.currentSort).toEqual({ field: 'prio_1', ascending: false });
      expect(th('prio_1').getAttribute('aria-sort')).toBe('descending');
      expect(th('zuletzt').getAttribute('aria-sort')).toBe('none');

      th('prio_1').click();
      expect(list.currentSort).toEqual({ field: 'prio_1', ascending: true });
      expect(th('prio_1').getAttribute('aria-sort')).toBe('ascending');
      expect(list.loadDataDebounced).toHaveBeenCalledTimes(2);
    });

    it('startet den Namen aufsteigend', () => {
      th('name').click();
      expect(list.currentSort).toEqual({ field: 'name', ascending: true });
    });
  });
});
