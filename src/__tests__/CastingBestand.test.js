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
import { CastingBestandList, socialProfilUrl } from '../modules/creator-casting/CastingBestandList.js';
import { creatorUtils } from '../modules/creator/CreatorUtils.js';

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
    for (const field of ['name', 'castings', 'prio_1', 'prio_2', 'abgelehnt', 'produktionen', 'marken', 'zuletzt']) {
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

  it('startet auf Produktion absteigend (meistgebuchte zuerst)', () => {
    expect(list.currentSort).toEqual({ field: 'produktionen', ascending: false });
  });

  it('ruft get_casting_bestand mit Seite, Sort und Suche auf', async () => {
    list.searchQuery = 'Lina';
    const result = await list.loadPageData(2, 25, { feedback: ['prio_1'] });
    expect(window.supabase.rpc).toHaveBeenCalledWith('get_casting_bestand', {
      p_page: 2,
      p_limit: 25,
      p_sort: 'produktionen',
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
    alter_min: 20,
    alter_max: 25,
    instagram: 'lina.muster',
    tiktok: '@linamuster',
    marken: [
      { id: 'm1', markenname: 'Ninja', logo_url: null, logo_thumb_url: 'https://cdn.test/ninja.avif' },
      { id: 'm2', markenname: 'Ferrero Rocher', logo_url: null, logo_thumb_url: null }
    ],
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

  it('kürzt Follower-Spannen auf k/M und zeigt leere Werte als -', () => {
    const html = list.renderSingleRow(row);
    expect(html).toContain('<td>10k bis 25k</td>');
    expect(html).not.toContain('10.000');
    expect(html).toMatch(/<td>10k bis 25k<\/td>[\s\S]*?data-col="tiktok_link">[\s\S]*?<\/td>\s*<td>-<\/td>/);
    const gross = list.renderSingleRow({ ...row, instagram_follower: 750000, tiktok_follower: 2000000 });
    expect(gross).toContain('<td>500k bis 1M</td>');
    expect(gross).toContain('<td>+ 1M</td>');
  });

  it('formatFollowerRange bleibt ohne compact ausgeschrieben', () => {
    expect(creatorUtils.formatFollowerRange(12000)).toBe('10.000 - 25.000');
    expect(creatorUtils.formatFollowerRange(12000, { compact: true })).toBe('10k bis 25k');
  });

  describe('Alter', () => {
    const alter = (data) => {
      const doc = document.createElement('table');
      doc.innerHTML = `<tbody>${list.renderSingleRow(data)}</tbody>`;
      return doc.querySelector('[data-col="alter"]').textContent.trim();
    };

    it('zeigt die Spanne, einen Einzelwert, das alte Feld oder -', () => {
      expect(alter(row)).toBe('20-25');
      expect(alter({ ...row, alter_min: 30, alter_max: 30 })).toBe('30');
      expect(alter({ ...row, alter_min: null, alter_max: 28 })).toBe('28');
      expect(alter({ ...row, alter_min: null, alter_max: null, alter_jahre: 33 })).toBe('33');
      expect(alter({ ...row, alter_min: null, alter_max: null })).toBe('-');
    });

    it('steht nach den Typen und vor Instagram', () => {
      const html = list.renderSingleRow(row);
      expect(html.indexOf('data-col="alter"')).toBeGreaterThan(html.indexOf('tag--type'));
      expect(html.indexOf('data-col="alter"')).toBeLessThan(html.indexOf('data-col="instagram_link"'));
      document.body.innerHTML = list.renderShellContent();
      const heads = [...document.querySelectorAll('thead th')].map(h => h.textContent.trim());
      document.body.innerHTML = '';
      expect(heads.slice(heads.indexOf('Typen'), heads.indexOf('Typen') + 3)).toEqual(['Typen', 'Alter', 'Insta']);
    });
  });

  describe('Social-Links', () => {
    const rowEl = (data) => {
      const doc = document.createElement('table');
      doc.innerHTML = `<tbody>${list.renderSingleRow(data)}</tbody>`;
      return doc.querySelector('tr');
    };

    it('zeigt Instagram und TikTok als Icon-Link ohne URL-Text', () => {
      const tr = rowEl(row);
      const ig = tr.querySelector('[data-col="instagram_link"] a');
      const tt = tr.querySelector('[data-col="tiktok_link"] a');
      expect(ig.getAttribute('href')).toBe('https://instagram.com/lina.muster');
      expect(tt.getAttribute('href')).toBe('https://tiktok.com/@linamuster');
      expect(ig.getAttribute('target')).toBe('_blank');
      expect(ig.querySelector('svg')).not.toBeNull();
      expect(tt.querySelector('svg')).not.toBeNull();
      expect(ig.textContent.trim()).toBe('');
      expect(tt.textContent.trim()).toBe('');
    });

    it('übernimmt vollständige Links und zeigt leere Werte als -', () => {
      const tr = rowEl({ ...row, instagram: ' ', tiktok: 'https://www.tiktok.com/@abc' });
      expect(tr.querySelector('[data-col="instagram_link"]').textContent.trim()).toBe('-');
      expect(tr.querySelector('[data-col="tiktok_link"] a').getAttribute('href')).toBe('https://www.tiktok.com/@abc');
    });

    it('baut Profil-URLs aus Handle mit Leerzeichen, @ und Domain ohne Schema', () => {
      expect(socialProfilUrl(' verena_cooks', 'tiktok')).toBe('https://tiktok.com/@verena_cooks');
      expect(socialProfilUrl('@lukas', 'instagram')).toBe('https://instagram.com/lukas');
      expect(socialProfilUrl('instagram.com/lukas', 'instagram')).toBe('https://instagram.com/lukas');
      expect(socialProfilUrl('', 'instagram')).toBeNull();
      expect(socialProfilUrl('@', 'instagram')).toBeNull();
    });
  });

  describe('Brands', () => {
    const rowEl = (data) => {
      const doc = document.createElement('table');
      doc.innerHTML = `<tbody>${list.renderSingleRow(data)}</tbody>`;
      return doc.querySelector('tr');
    };

    it('zeigt pro Marke eine klickbare Bubble nach der Produktion und vor Zuletzt', () => {
      const html = list.renderSingleRow(row);
      const tr = rowEl(row);
      const bubbles = tr.querySelectorAll('[data-col="brands"] .avatar-bubble');
      expect(bubbles).toHaveLength(2);
      expect(bubbles[0].dataset.entity).toBe('marke');
      expect(bubbles[0].dataset.id).toBe('m1');
      expect(bubbles[0].getAttribute('title')).toBe('Ninja');
      expect(html.indexOf('data-col="brands"')).toBeGreaterThan(html.indexOf('data-col="produktionen"'));
      expect(html.indexOf('data-col="brands"')).toBeLessThan(html.indexOf('data-col="zuletzt"'));
    });

    it('sortiert die Brands-Spalte nach Anzahl, erst absteigend, dann aufsteigend', () => {
      document.body.innerHTML = list.renderShellContent();
      const controller = new AbortController();
      list.loadDataDebounced = vi.fn();
      list.bindAdditionalEvents(controller.signal);
      const th = document.querySelector('th[data-sort="marken"]');
      expect(th).not.toBeNull();
      const heads = [...document.querySelectorAll('thead th')].map(h => h.textContent.trim());
      expect(heads.indexOf('Brands')).toBe(heads.indexOf('Produktion') + 1);
      expect(heads.indexOf('Zuletzt')).toBe(heads.indexOf('Brands') + 1);
      expect(heads).toEqual(expect.arrayContaining(['Insta', 'TikTok']));
      th.click();
      expect(list.currentSort).toEqual({ field: 'marken', ascending: false });
      th.click();
      expect(list.currentSort).toEqual({ field: 'marken', ascending: true });
      controller.abort();
      document.body.innerHTML = '';
    });

    it('zeigt - ohne Marken', () => {
      expect(rowEl({ ...row, marken: [] }).querySelector('[data-col="brands"]').textContent.trim()).toBe('-');
      expect(rowEl({ ...row, marken: undefined }).querySelector('[data-col="brands"]').textContent.trim()).toBe('-');
    });

    it('hat so viele Zellen wie Spaltenköpfe', () => {
      document.body.innerHTML = list.renderShellContent();
      const heads = document.querySelectorAll('thead th').length;
      document.body.innerHTML = '';
      expect(rowEl(row).querySelectorAll('td')).toHaveLength(heads);
    });
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

  describe('Avatar-Punkt', () => {
    const rowEl = (data) => {
      const doc = document.createElement('table');
      doc.innerHTML = `<tbody>${list.renderSingleRow(data)}</tbody>`;
      return doc.querySelector('tr');
    };

    it('setzt bei vorhandenem Creator den grünen Punkt und den Link', () => {
      const tr = rowEl({ ...row, hat_creator: true });
      const dot = tr.querySelector('.sourcing-avatar .sourcing-avatar__dot');
      expect(dot.classList.contains('status-dot--active')).toBe(true);
      expect(dot.getAttribute('title')).toBe('Als Creator angelegt');
      expect(tr.querySelector('a.table-link').dataset.id).toBe('c1');
      expect(tr.getAttribute('data-id')).toBe('c1');
    });

    it('setzt ohne Creator-Datensatz den roten Punkt und keinen Link', () => {
      const tr = rowEl({ ...row, id: null, hat_creator: false, vorname: null, nachname: 'Polina' });
      const dot = tr.querySelector('.sourcing-avatar .sourcing-avatar__dot');
      expect(dot.classList.contains('status-dot--inactive')).toBe(true);
      expect(dot.getAttribute('title')).toBe('Noch kein Creator');
      expect(tr.querySelector('a.table-link')).toBeNull();
      expect(tr.hasAttribute('data-id')).toBe(false);
      expect(tr.querySelector('.col-name').textContent).toContain('Polina');
      expect(tr.querySelector('.table-avatar').textContent.trim()).toBe('P');
    });

    it('behandelt id null auch ohne hat_creator als fehlenden Creator', () => {
      const tr = rowEl({ ...row, id: null });
      expect(tr.querySelector('.sourcing-avatar__dot').classList.contains('status-dot--inactive')).toBe(true);
      expect(tr.querySelector('a.table-link')).toBeNull();
    });

    it('zeigt das Bild der Zeile ohne Creator mit Punkt', () => {
      window.validatorSystem = { sanitizeUrl: (url) => url, sanitizeHtml: (text) => text };
      const tr = rowEl({ ...row, id: null, hat_creator: false, profilbild_thumb_url: 'https://cdn.test/p.avif' });
      expect(tr.querySelector('img.table-avatar-img')).not.toBeNull();
      expect(tr.querySelector('.sourcing-avatar__dot')).not.toBeNull();
      delete window.validatorSystem;
    });
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
      ['name', 'castings', 'prio_1', 'prio_2', 'abgelehnt', 'produktionen', 'marken', 'zuletzt']
        .forEach(field => expect(th(field)).not.toBeNull());
      expect(th('produktionen').getAttribute('aria-sort')).toBe('descending');
      expect(document.getElementById('filter-dropdown-container')).toBeNull();
      expect(document.getElementById('sort-dropdown-container')).toBeNull();
    });

    it('sortiert beim ersten Klick absteigend und kehrt beim zweiten um', () => {
      th('prio_1').click();
      expect(list.currentSort).toEqual({ field: 'prio_1', ascending: false });
      expect(th('prio_1').getAttribute('aria-sort')).toBe('descending');
      expect(th('produktionen').getAttribute('aria-sort')).toBe('none');

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
