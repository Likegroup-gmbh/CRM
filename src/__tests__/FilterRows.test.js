import { describe, it, expect, beforeEach } from 'vitest';
import { filterRows, matchesFilter, optionsFromRows, sortRows, isManualSort } from '../core/filterColumn/filterRows.js';
import { readPrefixedSelection, writePrefixedSelection } from '../core/filterColumn/filterQueryCodec.js';
import { createTableFilter } from '../core/filterColumn/tableFilterColumn.js';
import { customColumnFilterDefs, customColumnFilterGroup } from '../core/filterColumn/customColumnFilters.js';

const rows = [
  { id: 1, name: 'Zoe', status: 'Gebucht', tags: ['Food'], follower: 1200, datum: '2026-03-02', aktiv: true },
  { id: 2, name: 'anna', status: 'Offen', tags: ['Beauty', 'Food'], follower: null, datum: '2026-01-15T10:00:00Z', aktiv: false },
  { id: 3, name: 'Ärger', status: 'Gebucht', tags: [], follower: 50000, datum: null, aktiv: true }
];

const filters = [
  { id: 'status', type: 'multiSelect' },
  { id: 'tags', type: 'multiSelect' },
  { id: 'follower', type: 'numberRange' },
  { id: 'datum', type: 'dateRange' },
  { id: 'aktiv', type: 'boolean' },
  { id: 'name', type: 'text' }
];

const ids = (list) => list.map((row) => row.id);

describe('filterRows', () => {
  it('lässt ohne aktive Filter alle Zeilen durch', () => {
    expect(ids(filterRows(rows, filters, {}))).toEqual([1, 2, 3]);
    expect(ids(filterRows(rows, filters, { status: [], name: '' }))).toEqual([1, 2, 3]);
  });

  it('Mehrfachauswahl heißt einer davon, auch bei Listen an der Zeile', () => {
    expect(ids(filterRows(rows, filters, { status: ['Offen', 'Gebucht'] }))).toEqual([1, 2, 3]);
    expect(ids(filterRows(rows, filters, { tags: ['Beauty'] }))).toEqual([2]);
    expect(ids(filterRows(rows, filters, { tags: ['Food'] }))).toEqual([1, 2]);
  });

  it('Spannen schließen leere Werte aus', () => {
    expect(ids(filterRows(rows, filters, { follower: { min: '1000' } }))).toEqual([1, 3]);
    expect(ids(filterRows(rows, filters, { follower: { max: '2000' } }))).toEqual([1]);
    expect(ids(filterRows(rows, filters, { datum: { from: '2026-02-01' } }))).toEqual([1]);
    expect(ids(filterRows(rows, filters, { datum: { to: '2026-01-15' } }))).toEqual([2]);
  });

  it('Spannen treffen bei Listen, wenn einer der Werte passt', () => {
    const termine = { id: 'termine', type: 'dateRange', get: (row) => row.termine };
    const preise = { id: 'preise', type: 'numberRange', get: (row) => row.preise };
    const list = [
      { id: 1, termine: ['2026-01-10', '2026-06-01'], preise: [100, 900] },
      { id: 2, termine: [], preise: [] }
    ];
    expect(ids(filterRows(list, [termine], { termine: { from: '2026-05-01' } }))).toEqual([1]);
    expect(ids(filterRows(list, [preise], { preise: { min: '500' } }))).toEqual([1]);
    expect(ids(filterRows(list, [preise], { preise: { min: '1000' } }))).toEqual([]);
  });

  it('verknüpft mehrere Filter mit und', () => {
    expect(ids(filterRows(rows, filters, { status: ['Gebucht'], aktiv: true, name: 'zo' }))).toEqual([1]);
    expect(ids(filterRows(rows, filters, { aktiv: false }))).toEqual([2]);
  });

  it('nutzt get und match der Definition', () => {
    const viaGet = { id: 'x', type: 'multiSelect', get: (row) => row.status.toUpperCase() };
    expect(matchesFilter(viaGet, rows[0], ['GEBUCHT'])).toBe(true);
    const viaMatch = { id: 'y', type: 'multiSelect', match: (row, value) => value.includes(String(row.id)) };
    expect(ids(filterRows(rows, [viaMatch], { y: ['3'] }))).toEqual([3]);
  });
});

describe('sortRows', () => {
  it('Manuell lässt die Reihenfolge stehen', () => {
    expect(isManualSort({ id: 'manuell' })).toBe(true);
    expect(ids(sortRows(rows, { id: 'manuell' }))).toEqual([1, 2, 3]);
  });

  it('sortiert deutsch, ohne Groß- und Kleinschreibung', () => {
    expect(ids(sortRows(rows, { get: (row) => row.name }))).toEqual([2, 3, 1]);
  });

  it('leere Werte stehen in beiden Richtungen am Ende', () => {
    expect(ids(sortRows(rows, { get: (row) => row.follower, type: 'number' }))).toEqual([1, 3, 2]);
    expect(ids(sortRows(rows, { get: (row) => row.follower, type: 'number', direction: 'desc' }))).toEqual([3, 1, 2]);
    expect(ids(sortRows(rows, { get: (row) => row.datum, type: 'date', direction: 'desc' }))).toEqual([1, 2, 3]);
  });

  it('bleibt bei Gleichstand stabil', () => {
    expect(ids(sortRows(rows, { get: (row) => row.status }))).toEqual([1, 3, 2]);
  });
});

describe('optionsFromRows', () => {
  it('sammelt eindeutige Werte alphabetisch', () => {
    expect(optionsFromRows(rows, (row) => row.tags)).toEqual([
      { value: 'Beauty', label: 'Beauty' },
      { value: 'Food', label: 'Food' }
    ]);
  });
});

describe('Auswahl mit Präfix in der URL', () => {
  it('schreibt und liest nur die eigenen Schlüssel', () => {
    const params = new URLSearchParams('tab=casting&linie=abc&konzept.prio=1&casting.alt=1');
    writePrefixedSelection(params, {
      prefix: 'casting',
      values: { status: ['Gebucht', 'Offen'], follower: { min: '1000' }, aktiv: true },
      sort: 'name',
      defaultSort: 'manuell'
    });
    expect(params.get('tab')).toBe('casting');
    expect(params.get('konzept.prio')).toBe('1');
    expect(params.has('casting.alt')).toBe(false);
    expect(params.get('casting.status')).toBe('Gebucht,Offen');
    expect(params.get('casting.sort')).toBe('name');

    const back = readPrefixedSelection(params, {
      prefix: 'casting',
      filters,
      sorts: [{ id: 'manuell' }, { id: 'name' }],
      defaultSort: 'manuell'
    });
    expect(back.values).toEqual({ status: ['Gebucht', 'Offen'], follower: { min: '1000' }, aktiv: true });
    expect(back.sort).toBe('name');
  });

  it('lässt Standardsortierung und unbekannte Sortierung weg', () => {
    const params = writePrefixedSelection(new URLSearchParams(), { prefix: 'koop', sort: 'manuell', defaultSort: 'manuell' });
    expect(params.has('koop.sort')).toBe(false);
    expect(readPrefixedSelection('?koop.sort=quatsch', { prefix: 'koop', sorts: [{ id: 'a' }], defaultSort: 'a' }).sort).toBe('a');
  });
});

describe('createTableFilter', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/produktion/1?tab=casting');
    localStorage.clear();
  });

  it('startet eingeklappt, filtert, sortiert und schreibt die URL', () => {
    const table = createTableFilter({
      key: 'casting',
      filters: [{ id: 'status', label: 'Status', type: 'multiSelect', options: [{ value: 'Gebucht', label: 'Gebucht' }] }],
      sorts: [{ id: 'manuell', label: 'Manuell' }, { id: 'name', label: 'Name', get: (row) => row.name }]
    });
    const root = document.createElement('div');
    root.innerHTML = `${table.renderToggle()}${table.renderLayout('<table></table>')}`;
    expect(root.querySelector('[data-filter-layout="casting"]').classList.contains('is-column-collapsed')).toBe(true);
    expect(table.isManualSort()).toBe(true);

    table.setValues({ status: ['Gebucht'] });
    table.setSort('name');
    expect(ids(table.apply(rows))).toEqual([3, 1]);
    expect(table.isManualSort()).toBe(false);
    expect(window.location.search).toContain('casting.status=Gebucht');
    expect(window.location.search).toContain('casting.sort=name');
    expect(window.location.search).toContain('tab=casting');

    const again = createTableFilter({
      key: 'casting',
      filters: [{ id: 'status', label: 'Status', type: 'multiSelect' }],
      sorts: [{ id: 'manuell', label: 'Manuell' }, { id: 'name', label: 'Name', get: (row) => row.name }]
    });
    expect(again.getValues()).toEqual({ status: ['Gebucht'] });
    expect(again.getSort()).toBe('name');
  });

  it('füllt die Spalte beim Mount und meldet Sortierwechsel', () => {
    const changes = [];
    const table = createTableFilter({
      key: 'konzept',
      filters: [{ id: 'prio', label: 'Prio', type: 'multiSelect', options: [{ value: '1', label: 'Prio 1' }] }],
      sorts: [{ id: 'manuell', label: 'Manuell' }, { id: 'prio', label: 'Prio', get: (row) => row.prio }]
    });
    const root = document.createElement('div');
    root.innerHTML = `${table.renderToggle()}${table.renderLayout('<table></table>')}`;
    document.body.appendChild(root);
    table.mount({ root, onChange: (state) => changes.push(state) });

    expect(root.querySelector('.filter-column-sort input[name="konzept-sort"]').value).toBe('manuell');
    expect(root.querySelector('.filter-column-group')).not.toBeNull();

    const input = root.querySelector('input[name="konzept-sort"]');
    input.value = 'prio';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(changes.at(-1).sort).toBe('prio');

    root.querySelector('#konzept-filter-toggle').click();
    expect(root.querySelector('[data-filter-layout="konzept"]').classList.contains('is-column-collapsed')).toBe(false);
    table.destroy();
    root.remove();
  });
});

describe('customColumnFilterDefs', () => {
  const columns = [
    { id: 'd1', name: 'Plattform', field_type: 'dropdown', visible_for_kunden: true, _dropdownOptions: [{ label: 'TikTok', position: 2 }, { label: 'Instagram', position: 1 }] },
    { id: 'b1', name: 'Briefing gelesen', field_type: 'boolean', visible_for_kunden: false },
    { id: 'n1', name: 'Budget', field_type: 'number', visible_for_kunden: true },
    { id: 't1', name: 'Notiz', field_type: 'text', visible_for_kunden: true }
  ];
  const values = { r1: { d1: 'TikTok', b1: 'true', n1: '1200' }, r2: { d1: 'Instagram', n1: '300' } };
  const getValue = (row, col) => values[row.id]?.[col.id] ?? '';
  const list = [{ id: 'r1' }, { id: 'r2' }];

  it('bietet Dropdown, Ja/Nein, Zahl und Datum an, Text nicht', () => {
    const defs = customColumnFilterDefs(columns, getValue);
    expect(defs.map((def) => [def.id, def.type])).toEqual([
      ['custom_d1', 'multiSelect'], ['custom_b1', 'boolean'], ['custom_n1', 'numberRange']
    ]);
    expect(defs[0].options.map((o) => o.value)).toEqual(['Instagram', 'TikTok']);
    expect(customColumnFilterGroup(defs)[0].filters).toEqual(['custom_d1', 'custom_b1', 'custom_n1']);
  });

  it('blendet für Kunden unsichtbare und ausgeblendete Spalten aus', () => {
    const ids = customColumnFilterDefs(columns, getValue, { isKunde: true, hiddenColumns: ['custom:n1'] }).map((def) => def.id);
    expect(ids).toEqual(['custom_d1']);
    expect(customColumnFilterGroup([])).toEqual([]);
  });

  it('filtert über die Werte, leer zählt als Nein', () => {
    const defs = customColumnFilterDefs(columns, getValue);
    expect(ids(filterRows(list, defs, { custom_d1: ['TikTok'] }))).toEqual(['r1']);
    expect(ids(filterRows(list, defs, { custom_b1: false }))).toEqual(['r2']);
    expect(ids(filterRows(list, defs, { custom_n1: { min: '500' } }))).toEqual(['r1']);
  });
});
