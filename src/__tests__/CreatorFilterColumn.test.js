import { describe, it, expect } from 'vitest';
import { CREATOR_FILTERS, CREATOR_FILTER_GROUPS } from '../modules/creator/filters/CreatorFilterConfig.js';
import {
  queryToSelection,
  selectionToQuery,
  formatCreatorSumme
} from '../modules/creator/creatorFilterQuery.js';
import {
  renderColumnBody,
  readFiltersFromColumn,
  paintFilterValues,
  groupColumnFilters
} from '../modules/creator/creatorFilterColumn.js';
import { GROESSEN, GENERATIONEN } from '../modules/creator/creatorProfil.js';

const generationen = GENERATIONEN.map((entry) => entry.label);

function selection(search) {
  return queryToSelection(search, {
    filters: CREATOR_FILTERS,
    groessen: GROESSEN,
    generationen
  });
}

describe('Creator-Filter als Query', () => {
  it('rundet Suche, Größe, Generation und Spaltenfilter', () => {
    const params = selectionToQuery({
      search: 'Anna',
      groesse: ['Micro', 'Mid-Tier'],
      generation: 'Generation Z',
      filters: {
        lieferadresse_stadt: 'Berlin',
        alter: { min: '18', max: '30' },
        hat_haustier: true,
        besitz_id: ['a', 'b']
      }
    });

    const back = selection(params);
    expect(back.search).toBe('Anna');
    expect(back.groesse).toEqual(['Micro', 'Mid-Tier']);
    expect(back.generation).toBe('Generation Z');
    expect(back.filters.lieferadresse_stadt).toBe('Berlin');
    expect(back.filters.alter).toEqual({ min: '18', max: '30' });
    expect(back.filters.hat_haustier).toBe(true);
    expect(back.filters.besitz_id).toEqual(['a', 'b']);
  });

  it('lässt unbekannte Größe und Generation fallen', () => {
    const back = selection('?groesse=Micro,Riese&generation=Zukunft');
    expect(back.groesse).toEqual(['Micro']);
    expect(back.generation).toBe('');
  });

  it('Mindestwert gewinnt gegen Ohne Bewertung', () => {
    const back = selection('?rezension_min=4&rezension_ohne=1');
    expect(back.filters.rezension_min).toBe('4');
    expect(back.filters.rezension_ohne).toBeUndefined();

    const written = selectionToQuery({
      filters: { rezension_min: '4', rezension_ohne: true }
    });
    expect(written.get('rezension_min')).toBe('4');
    expect(written.has('rezension_ohne')).toBe(false);
  });

  it('formatiert die Summe', () => {
    expect(formatCreatorSumme(1)).toBe('1 Creator');
    expect(formatCreatorSumme(128)).toBe('128 Creator');
    expect(formatCreatorSumme(1234)).toBe('1.234 Creator');
    expect(formatCreatorSumme(null)).toBe('');
  });
});

describe('Filterspalte', () => {
  it('zeigt die Gruppen, Grundlagen offen, ohne Mehr anzeigen', () => {
    const html = renderColumnBody(CREATOR_FILTERS, CREATOR_FILTER_GROUPS, {});
    const root = document.createElement('div');
    root.innerHTML = html;

    const groups = [...root.querySelectorAll('.creator-filter-group')];
    expect(groups.map((group) => group.querySelector('summary').textContent)).toEqual([
      'Grundlagen', 'Social Media', 'Standort', 'Kontakt', 'Beziehungen', 'Zeit'
    ]);
    expect(groups[0].open).toBe(true);
    expect(groups[1].open).toBe(false);
    expect(root.textContent).toContain('Spielt Instrument');
    expect(root.textContent).not.toContain('Mehr anzeigen');
    expect(root.querySelector('.creator-filter-reset').textContent).toBe('Zurücksetzen');
    expect(root.querySelector('.creator-sort legend').textContent).toBe('Sortierung');
    expect(root.querySelector('input[name="creator-sort"][value="name"]').checked).toBe(true);
    const sorted = document.createElement('div');
    sorted.innerHTML = renderColumnBody(CREATOR_FILTERS, CREATOR_FILTER_GROUPS, {}, 'rezension');
    expect(sorted.querySelector('input[name="creator-sort"][value="rezension"]').checked).toBe(true);
    expect(sorted.querySelector('.creator-sort').nextElementSibling.classList.contains('creator-filter-group')).toBe(true);
  });

  it('liest gesetzte Steuerungen und schreibt sie zurück', () => {
    const filters = CREATOR_FILTERS.filter((filter) =>
      ['lieferadresse_stadt', 'geschlecht', 'hat_haustier', 'alter', 'besitz_id'].includes(filter.id)
    );
    const withOptions = filters.map((filter) => filter.id === 'besitz_id'
      ? { ...filter, options: [{ value: 'p1', label: 'Kamera' }, { value: 'p2', label: 'Licht' }] }
      : filter.id === 'geschlecht'
        ? { ...filter, options: [{ value: 'weiblich', label: 'Weiblich' }] }
        : filter);

    const root = document.createElement('div');
    root.innerHTML = renderColumnBody(withOptions, [{
      id: 'basic',
      label: 'Grundlagen',
      expanded: true,
      filters: withOptions.map((filter) => filter.id)
    }], {
      lieferadresse_stadt: 'Hamburg',
      geschlecht: 'weiblich',
      hat_haustier: true,
      alter: { min: '20' },
      besitz_id: ['p2']
    });

    expect(readFiltersFromColumn(root, withOptions)).toEqual({
      lieferadresse_stadt: 'Hamburg',
      geschlecht: 'weiblich',
      hat_haustier: true,
      alter: { min: '20' },
      besitz_id: ['p2']
    });

    paintFilterValues(root, withOptions, { lieferadresse_stadt: 'Köln' });
    expect(root.querySelector('[data-filter-id="lieferadresse_stadt"]').value).toBe('Köln');
    expect(root.querySelector('[data-filter-id="geschlecht"]').value).toBe('');
    expect(root.querySelector('[data-filter-id="hat_haustier"]').value).toBe('');
    expect(root.querySelector('[data-filter-id="besitz_id"][value="p2"]').checked).toBe(false);
  });

  it('ordnet fehlende Filter den Grundlagen zu', () => {
    const sections = groupColumnFilters(
      [{ id: 'extra', label: 'Extra', type: 'text' }],
      [{ id: 'basic', label: 'Grundlagen', expanded: true, filters: [] }]
    );
    expect(sections[0].items.map((filter) => filter.id)).toEqual(['extra']);
  });
});
