import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  bindFilterSelects,
  matchesOptionSearch,
  renderFilterSelect,
  summarizeSelection
} from '../core/filters/FilterSelect.js';
import { overviewColumnFilters } from '../modules/creator/creatorFilterColumn.js';
import { CREATOR_FILTERS } from '../modules/creator/filters/CreatorFilterConfig.js';
import { processCreatorFilters } from '../modules/creator/filters/creatorFilterProcess.js';
import { CreatorFilterLogic } from '../modules/creator/filters/CreatorFilterLogic.js';
import CreatorDataModule from '../core/data/entities/CreatorDataModule.js';

const PERSONEN = [
  { value: 'u1', label: 'Anna Pfältzer' },
  { value: 'u2', label: 'Annika' },
  { value: 'u3', label: 'Oliver Brandt' },
  { value: 'u4', label: 'Elma Placo' }
];

describe('Suche im Dropdown', () => {
  it('trifft Wortanfänge, Buchstabe für Buchstabe', () => {
    const treffer = (term) => PERSONEN.filter((p) => matchesOptionSearch(p.label, term)).map((p) => p.label);
    expect(treffer('an')).toEqual(['Anna Pfältzer', 'Annika']);
    expect(treffer('Oli')).toEqual(['Oliver Brandt']);
    expect(treffer('pf')).toEqual(['Anna Pfältzer']);
    expect(treffer('nna')).toEqual([]);
    expect(treffer('anna pf')).toEqual(['Anna Pfältzer']);
    expect(treffer('')).toHaveLength(4);
    expect(matchesOptionSearch('Mid-Tier', 'tier')).toBe(true);
  });

  it('fasst die Auswahl im Auslöser zusammen', () => {
    expect(summarizeSelection([], 'Alle')).toBe('Alle');
    expect(summarizeSelection(['Anna', 'Oliver'], 'Alle')).toBe('Anna, Oliver');
    expect(summarizeSelection(['Anna', 'Oliver', 'Elma'], 'Alle')).toBe('Anna +2');
  });
});

describe('Dropdown mit Mehrfachauswahl', () => {
  let root;
  let controller;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    controller = new AbortController();
  });

  afterEach(() => {
    controller.abort();
    root.remove();
  });

  function mount(filter, value, options) {
    root.innerHTML = renderFilterSelect(filter, value, options);
    bindFilterSelects(root, { signal: controller.signal });
    return root.querySelector('[data-filter-select]');
  }

  it('bleibt beim Auswählen offen und schließt mit Fertig oder Klick daneben', () => {
    const wrapper = mount({ id: 'favorit_von', label: 'Favorit von', type: 'multiSelect', searchable: true, placeholder: 'Person suchen...' }, [], PERSONEN);
    const trigger = wrapper.querySelector('.filter-select__trigger');
    const panel = wrapper.querySelector('.filter-select__panel');
    const changes = vi.fn();
    root.addEventListener('change', changes);

    trigger.click();
    expect(panel.hidden).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const items = wrapper.querySelectorAll('.filter-select__item');
    items[0].querySelector('input').click();
    items[2].querySelector('input').click();
    expect(panel.hidden).toBe(false);
    expect(changes).toHaveBeenCalledTimes(2);
    expect(trigger.textContent.trim()).toBe('Anna Pfältzer, Oliver Brandt');
    expect([...wrapper.querySelectorAll('input[data-filter-id="favorit_von"]:checked')].map((box) => box.value)).toEqual(['u1', 'u3']);

    wrapper.querySelector('[data-select-done]').click();
    expect(panel.hidden).toBe(true);

    trigger.click();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(panel.hidden).toBe(true);
  });

  it('filtert die Optionen über die Suche oben', () => {
    const wrapper = mount({ id: 'favorit_von', type: 'multiSelect', searchable: true }, [], PERSONEN);
    wrapper.querySelector('.filter-select__trigger').click();
    const search = wrapper.querySelector('[data-select-search]');
    search.value = 'an';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const sichtbar = [...wrapper.querySelectorAll('.filter-select__item')].filter((item) => !item.hidden).map((item) => item.textContent.trim());
    expect(sichtbar).toEqual(['Anna Pfältzer', 'Annika']);

    search.value = 'xyz';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(wrapper.querySelector('.filter-select__empty').hidden).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(wrapper.querySelector('.filter-select__panel').hidden).toBe(true);
    expect(search.value).toBe('');
  });

  it('Leeren entfernt die Auswahl dieses Filters', () => {
    const wrapper = mount({ id: 'groesse', type: 'multiSelect' }, ['u1', 'u2'], PERSONEN);
    expect(wrapper.querySelector('[data-select-search]')).toBeNull();
    wrapper.querySelector('.filter-select__trigger').click();
    wrapper.querySelector('[data-select-clear]').click();
    expect(wrapper.querySelectorAll('input:checked')).toHaveLength(0);
    expect(wrapper.querySelector('.filter-select__trigger').classList.contains('is-empty')).toBe(true);
  });
});

describe('Dropdown mit Einzelauswahl', () => {
  it('setzt den Wert, schließt und meldet die Änderung', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new AbortController();
    root.innerHTML = renderFilterSelect({ id: 'hat_haustier', label: 'Hat Haustier', type: 'boolean' }, null);
    bindFilterSelects(root, { signal: controller.signal });
    const changes = vi.fn();
    root.addEventListener('change', changes);

    const wrapper = root.querySelector('[data-filter-select]');
    expect(wrapper.querySelector('.filter-select__trigger').textContent.trim()).toBe('Alle');
    wrapper.querySelector('.filter-select__trigger').click();
    wrapper.querySelector('[data-value="true"]').click();
    expect(root.querySelector('input[data-filter-id="hat_haustier"]').value).toBe('true');
    expect(wrapper.querySelector('.filter-select__panel').hidden).toBe(true);
    expect(wrapper.querySelector('.filter-select__trigger').textContent.trim()).toBe('Ja');
    expect(changes).toHaveBeenCalledTimes(1);

    controller.abort();
    root.remove();
  });
});

describe('Mehrfachauswahl in der Creator-Filterspalte', () => {
  it('macht Auswahl-Filter mehrfach wählbar, außer Ja/Nein und Mindest-Rezension', () => {
    const byId = new Map(overviewColumnFilters(CREATOR_FILTERS).map((filter) => [filter.id, filter.type]));
    for (const id of ['generation', 'creator_type_id', 'sprache_id', 'branche_id', 'kunde_id', 'geschlecht', 'lieferadresse_land', 'management_id', 'firma_id']) {
      expect(byId.get(id)).toBe('multiSelect');
    }
    expect(byId.get('rezension_min')).toBe('select');
    expect(byId.get('hat_haustier')).toBe('boolean');
  });

  it('filtert mehrere Werte als „einer davon“', () => {
    const processed = processCreatorFilters({ geschlecht: ['weiblich', 'maennlich'], lieferadresse_land: 'Deutschland' });
    expect(processed.geschlecht).toEqual({ type: 'in', value: ['weiblich', 'maennlich'] });
    expect(processed.lieferadresse_land).toEqual({ type: 'equals', value: 'Deutschland' });

    const calls = [];
    const query = new Proxy({}, { get: (_t, name) => (...args) => { calls.push([name, ...args]); return query; } });
    CreatorFilterLogic.buildSupabaseQuery(query, { geschlecht: ['weiblich', 'maennlich'], generation: ['Generation Z', 'Millennials'] });
    expect(calls).toContainEqual(['in', 'geschlecht', ['weiblich', 'maennlich']]);
    const or = calls.find((call) => call[0] === 'or')[1];
    expect(or).toContain('generation_override.eq."Generation Z"');
    expect(or).toContain('generation_override.eq.Millennials');

    expect(CreatorFilterLogic.matchesFilter({ geschlecht: 'weiblich' }, 'geschlecht', { type: 'in', value: ['weiblich'] })).toBe(true);
    expect(CreatorFilterLogic.matchesFilter({ geschlecht: 'divers' }, 'geschlecht', { type: 'in', value: ['weiblich'] })).toBe(false);
  });

  it('löst mehrere Sprachen über die Verknüpfung mit in() auf', async () => {
    const calls = [];
    const supabase = {
      from: (table) => {
        const q = {
          select: () => q,
          in: (column, ids) => { calls.push([table, column, ids]); return q; },
          eq: () => q,
          order: () => q,
          range: async () => ({ data: [{ creator_id: 'c1' }, { creator_id: 'c2' }], error: null })
        };
        return q;
      }
    };
    const outer = { in: vi.fn(() => outer) };
    const filters = { sprache_id: ['de', 'en'] };
    const result = await CreatorDataModule.applyJunctionFilters(outer, filters, supabase);
    expect(calls).toEqual([['creator_sprachen', 'sprache_id', ['de', 'en']]]);
    expect(outer.in).toHaveBeenCalledWith('id', ['c1', 'c2']);
    expect(filters.sprache_id).toBeUndefined();
    expect(result.shortCircuit).toBe(false);
  });
});
