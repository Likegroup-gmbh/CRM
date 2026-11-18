import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderItemsTable } from '../modules/strategie/StrategieDetailRenderer.js';
import { handleSortUpdate } from '../modules/strategie/StrategieDetailTableEvents.js';
import { strategieService } from '../modules/strategie/StrategieService.js';
import {
  konzeptFilterDefs,
  konzeptSorts,
  creatorNameOf,
  syncKonzeptTableFilter
} from '../modules/strategie/strategieFilterSpalte.js';

const items = [
  { id: 'a', teilbereich: 'Hooks', prio_2: true, creator_name: 'Zoe', video_umgesetzt: true, created_at: '2026-01-01' },
  { id: 'b', teilbereich: 'Hooks', prio_1: true, creator_name: 'anna', created_at: '2026-03-01' },
  { id: 'c', teilbereich: null, nicht_umsetzen: true, created_at: '2026-02-01' }
];

function detailStub(overrides = {}) {
  return {
    isKunde: false,
    canEdit: true,
    hiddenColumns: [],
    customColumns: null,
    items: items.map((item) => ({ ...item })),
    getTeilbereicheFromStrategie: () => ['Hooks', 'Leer'],
    ...overrides
  };
}

const rowIds = (html) => [...new DOMParser().parseFromString(html, 'text/html')
  .querySelectorAll('tr.item-row')].map((row) => row.dataset.itemId);

beforeEach(() => {
  window.history.replaceState(null, '', '/produktion/1');
  window.isGastReadonly = () => false;
  window.isKunde = () => false;
  window.ActionsDropdown = { getHeroIcon: () => '' };
});

afterEach(() => {
  document.body.innerHTML = '';
  delete window.toastSystem;
  vi.restoreAllMocks();
});

describe('konzeptFilterDefs', () => {
  it('blendet Persona und Skript-Status für Kunden aus', () => {
    const team = konzeptFilterDefs({ items }).map((def) => def.id);
    const kunde = konzeptFilterDefs({ items, isKunde: true }).map((def) => def.id);
    expect(team).toEqual(expect.arrayContaining(['persona', 'status', 'kategorie', 'prio']));
    expect(kunde).not.toContain('persona');
    expect(kunde).not.toContain('status');
    expect(kunde).toContain('prio');
  });

  it('bietet keine Filter auf ausgeblendete Spalten an', () => {
    const ids = konzeptFilterDefs({ items, hiddenColumns: ['fixed:produkt'] }).map((def) => def.id);
    expect(ids).not.toContain('produkt');
  });

  it('liest Kategorien und Creator aus den Items', () => {
    const defs = konzeptFilterDefs({ items, teilbereiche: ['Hooks'] });
    const kategorie = defs.find((def) => def.id === 'kategorie');
    expect(kategorie.options.map((o) => o.value)).toEqual(['Hooks', 'Ohne Kategorie']);
    const creator = defs.find((def) => def.id === 'creator');
    expect(creator.options.map((o) => o.label)).toEqual(['anna', 'Zoe', 'Ohne Creator']);
    expect(creatorNameOf({ creator_auswahl_item_id: 'x', casting_eintrag: { name: 'Lea' } })).toBe('Lea');
  });

  it('sortiert Prio nach Rang', () => {
    expect(konzeptSorts().map((sort) => sort.id)).toEqual(['manuell', 'prio', 'creator', 'dauer', 'neu']);
  });
});

describe('Konzept-Tabelle mit Filterspalte', () => {
  it('filtert die Zeilen und blendet leere Kategorien aus', () => {
    const detail = detailStub();
    syncKonzeptTableFilter(detail);
    detail.tableFilter.setValues({ prio: ['prio_1', 'prio_2'] });
    const html = renderItemsTable(detail);
    expect(rowIds(html)).toEqual(['a', 'b']);
    expect(html).not.toContain('data-kategorie="Leer"');
  });

  it('zeigt einen eigenen Leerzustand, wenn kein Eintrag passt', () => {
    const detail = detailStub();
    syncKonzeptTableFilter(detail);
    detail.tableFilter.setValues({ creator: ['Niemand'] });
    expect(renderItemsTable(detail)).toContain('Keine Videoideen für die gewählten Filter');
  });

  it('sortiert innerhalb der Kategorie und sperrt dann das Ziehen', () => {
    const detail = detailStub();
    syncKonzeptTableFilter(detail);
    expect(renderItemsTable(detail)).toContain('drag-handle');
    detail.tableFilter.setSort('prio');
    const html = renderItemsTable(detail);
    expect(rowIds(html)).toEqual(['b', 'a', 'c']);
    expect(html).not.toContain('drag-handle');
    expect(html).not.toMatch(/class="[^"]*\bdraggable\b/);
  });

  it('Ziehen unter Filter lässt ausgeblendete Videoideen an ihrem Platz', async () => {
    window.toastSystem = { show: vi.fn() };
    const root = document.createElement('div');
    document.body.appendChild(root);
    const detail = detailStub({
      items: [
        { id: 'a', teilbereich: 'Hooks', prio_1: true },
        { id: 'x', teilbereich: 'Hooks' },
        { id: 'b', teilbereich: 'Hooks', prio_1: true }
      ],
      _getRoot: () => root,
      rerenderItemsTable: vi.fn()
    });
    syncKonzeptTableFilter(detail);
    detail.tableFilter.setValues({ prio: ['prio_1'] });
    root.innerHTML = renderItemsTable(detail);
    const tbody = root.querySelector('#items-table-body');
    tbody.insertBefore(tbody.querySelector('[data-item-id="b"]'), tbody.querySelector('[data-item-id="a"]'));
    vi.spyOn(strategieService, 'updateItemsSortierungWithTeilbereich').mockResolvedValue();

    await handleSortUpdate(detail);

    expect(detail.items.map((item) => item.id)).toEqual(['b', 'x', 'a']);
  });
});
