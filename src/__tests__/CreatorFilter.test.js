import { describe, it, expect } from 'vitest';
import CreatorFilterLogic from '../modules/creator/filters/CreatorFilterLogic.js';
import { CREATOR_FILTERS, CREATOR_FILTER_GROUPS } from '../modules/creator/filters/CreatorFilterConfig.js';
import { renderFilterOptions } from '../core/filters/FilterDropdownRender.js';

function parse(html) {
  return new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
}

function optionIds(root, selector) {
  return Array.from(root.querySelectorAll(selector)).map(el => el.dataset.filterId);
}

describe('CreatorFilterLogic.processFilters', () => {
  it('behaelt Boolean-Filter mit Wert false', () => {
    const processed = CreatorFilterLogic.processFilters({ hat_haustier: false });

    expect(processed.hat_haustier).toEqual({ type: 'equals', value: false });
  });

  it('verarbeitet Boolean-Filter mit Wert true', () => {
    const processed = CreatorFilterLogic.processFilters({ hat_kinder: true });

    expect(processed.hat_kinder).toEqual({ type: 'equals', value: true });
  });

  it('verwirft leere Werte, aber nicht false', () => {
    const processed = CreatorFilterLogic.processFilters({
      hat_haustier: false,
      lieferadresse_stadt: '',
      geschlecht: null,
      spielt_instrument: undefined
    });

    expect(Object.keys(processed)).toEqual(['hat_haustier']);
  });

  it('mappt virtuelle Vorhanden-Filter auf ihre Spalten', () => {
    const processed = CreatorFilterLogic.processFilters({
      has_email: true,
      has_instagram: true,
      has_tiktok: false
    });

    expect(processed.mail).toEqual({ type: 'not_null', value: true });
    expect(processed.instagram).toEqual({ type: 'not_null', value: true });
    expect(processed.tiktok).toEqual({ type: 'not_null', value: false });
    expect(processed.has_instagram).toBeUndefined();
  });

  it('macht aus created_at und updated_at einen date_range', () => {
    const processed = CreatorFilterLogic.processFilters({
      created_at: { from: '2026-01-01', to: '2026-06-30' },
      updated_at: { from: '2026-08-01' }
    });

    expect(processed.created_at).toEqual({
      type: 'date_range',
      from: '2026-01-01',
      to: '2026-06-30'
    });
    expect(processed.updated_at).toEqual({
      type: 'date_range',
      from: '2026-08-01',
      to: null
    });
  });

  it('sucht PLZ und Stadt per Teilstring', () => {
    const processed = CreatorFilterLogic.processFilters({
      lieferadresse_plz: '10',
      lieferadresse_stadt: 'Berl'
    });

    expect(processed.lieferadresse_plz).toEqual({ type: 'text_search', value: '10' });
    expect(processed.lieferadresse_stadt).toEqual({ type: 'text_search', value: 'Berl' });
  });

  it('behandelt Engagement Rate und Budget als numerische Range', () => {
    const processed = CreatorFilterLogic.processFilters({
      ig_engagement_rate: { min: '1.5', max: '10' },
      budget_letzte_buchung: { min: '500' }
    });

    expect(processed.ig_engagement_rate).toEqual({ type: 'number_range', min: '1.5', max: '10' });
    expect(processed.budget_letzte_buchung).toEqual({ type: 'number_range', min: '500', max: null });
  });

  it('erzeugt fuer M:N-Filter keinen Spalten-Filter (Aufloesung im DataModule)', () => {
    const processed = CreatorFilterLogic.processFilters({
      management_id: '11111111-1111-1111-1111-111111111111',
      firma_id: '22222222-2222-2222-2222-222222222222',
      kunde_id: '33333333-3333-3333-3333-333333333333',
      branche_id: '44444444-4444-4444-4444-444444444444'
    });

    expect(processed).toEqual({});
  });
});

describe('CREATOR_FILTERS', () => {
  it('bietet die Creator-Attribute aus dem Formular als Filter an', () => {
    const ids = CREATOR_FILTERS.map(f => f.id);

    expect(ids).toContain('hat_haustier');
    expect(ids).toContain('hat_kinder');
    expect(ids).toContain('spielt_instrument');
    expect(ids).toContain('management_id');
    expect(ids).toContain('firma_id');
    expect(ids).toContain('lieferadresse_plz');
    expect(ids).toContain('created_at');
  });

  it('versteckt selten genutzte Filter hinter "Mehr anzeigen"', () => {
    const advanced = CREATOR_FILTERS.filter(f => f.advanced).map(f => f.id);

    expect(advanced.sort()).toEqual([
      'created_at', 'firma_id', 'has_instagram', 'has_tiktok', 'management_id', 'spielt_instrument', 'updated_at'
    ]);
  });

  it('nutzt fuer Datums-Filter den Typ dateRange, den das Submenu-Rendering erwartet', () => {
    const dateFilters = CREATOR_FILTERS.filter(f => f.id === 'created_at' || f.id === 'updated_at');

    expect(dateFilters).toHaveLength(2);
    dateFilters.forEach(f => expect(f.type).toBe('dateRange'));
  });

  it('ordnet jeden Filter genau einer Gruppe zu', () => {
    const grouped = CREATOR_FILTER_GROUPS.flatMap(g => g.filters);

    expect(new Set(grouped).size).toBe(grouped.length);
    CREATOR_FILTERS.forEach(f => expect(grouped).toContain(f.id));
  });
});

describe('renderFilterOptions', () => {
  const filters = [
    { id: 'name', label: 'Creator Name', type: 'text' },
    { id: 'management_id', label: 'Management', type: 'select', advanced: true },
    { id: 'created_at', label: 'Angelegt am', type: 'dateRange', advanced: true }
  ];

  it('trennt erweiterte Filter ab und klappt sie standardmaessig zu', () => {
    const doc = parse(renderFilterOptions(filters));

    const toggle = doc.querySelector('.filter-advanced-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toContain('Mehr anzeigen');

    const advancedBlock = doc.querySelector('.filter-advanced-options');
    expect(advancedBlock.classList.contains('show')).toBe(false);
    expect(optionIds(advancedBlock, '.filter-option')).toEqual(['management_id', 'created_at']);
  });

  it('haelt die haeufig genutzten Filter ausserhalb des Umschalters', () => {
    const doc = parse(renderFilterOptions(filters));
    const body = doc.querySelector('div');

    const primary = Array.from(body.children).filter(el => el.classList.contains('filter-option'));
    expect(primary.map(el => el.dataset.filterId)).toEqual(['name']);
  });

  it('klappt auf, wenn ein erweiterter Filter aktiv ist', () => {
    const doc = parse(renderFilterOptions(filters, new Set(['created_at'])));

    expect(doc.querySelector('.filter-advanced-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(doc.querySelector('.filter-advanced-toggle').textContent).toContain('Weniger anzeigen');
    expect(doc.querySelector('.filter-advanced-options').classList.contains('show')).toBe(true);
  });

  it('rendert ohne erweiterte Filter keinen Umschalter', () => {
    const doc = parse(renderFilterOptions([{ id: 'name', label: 'Name', type: 'text' }]));

    expect(doc.querySelector('.filter-advanced-toggle')).toBeNull();
    expect(doc.querySelector('.filter-advanced-options')).toBeNull();
  });
});
