// Characterization-Tests für BasePaginatedList.
// Pinnt das bestehende Verhalten (Race-Condition, Destroy-Guard, Debounce,
// Selection, init()-Pfade, permissionsChanged), bevor die Klasse zerlegt wird.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BasePaginatedList } from '../core/BasePaginatedList.js';
import { modularFilterSystem as filterSystem } from '../core/filters/ModularFilterSystem.js';

const ENTITY = 'testent';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const ROWS = [{ id: '1' }, { id: '2' }, { id: '3' }];

class TestList extends BasePaginatedList {
  constructor(opts = {}) {
    super(ENTITY, { itemsPerPage: 10, ...opts });
    this.calls = [];
    this.manual = false;
    this.dataLoadedSpy = vi.fn();
  }

  async loadPageData(page, limit, filters) {
    const call = { page, limit, filters, d: deferred() };
    this.calls.push(call);
    if (!this.manual) {
      call.d.resolve({ data: ROWS, total: ROWS.length });
    }
    return call.d.promise;
  }

  renderSingleRow(item) {
    return `<tr data-id="${item.id}"><td><input type="checkbox" class="${ENTITY}-check" data-id="${item.id}"></td><td>${item.id}</td></tr>`;
  }

  renderShellContent() {
    return `
      <button id="btn-select-all">Alle</button>
      <button id="btn-deselect-all" style="display:none">Keine</button>
      <button id="btn-delete-selected" style="display:none">Löschen</button>
      <span id="selected-count" style="display:none">0 ausgewählt</span>
      <table class="data-table">
        <thead><tr><th><input type="checkbox" id="select-all-${ENTITY}"></th><th>ID</th></tr></thead>
        <tbody></tbody>
      </table>
      <div id="pagination-${ENTITY}"></div>
    `;
  }

  onDataLoaded(data) {
    this.dataLoadedSpy(data);
  }
}

const savedWindow = {};
const WINDOW_KEYS = [
  'isAdmin', 'canBulkDelete', 'canViewPage', 'checkUserPermission', 'setHeadline',
  'bulkActionSystem', 'navigateTo', 'ErrorHandler', 'content', 'setContentSafely'
];

function rowIds() {
  return Array.from(document.querySelectorAll('.data-table tbody tr[data-id]')).map(tr => tr.dataset.id);
}

function checks() {
  return Array.from(document.querySelectorAll(`.${ENTITY}-check`));
}

function fire(el, type) {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

describe('BasePaginatedList', () => {
  let list;

  beforeEach(() => {
    WINDOW_KEYS.forEach(k => { savedWindow[k] = window[k]; });
    document.body.innerHTML = '<div id="dashboard-content"></div>';

    window.content = null;
    window.setContentSafely = undefined;
    window.isAdmin = () => true;
    window.canBulkDelete = () => true;
    window.canViewPage = undefined;
    window.checkUserPermission = undefined;
    window.setHeadline = vi.fn();
    window.bulkActionSystem = { registerList: vi.fn() };
    window.navigateTo = vi.fn();
    window.ErrorHandler = undefined;

    filterSystem.activeFilters[ENTITY] = {};

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    list = new TestList();
  });

  afterEach(() => {
    list?.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
    WINDOW_KEYS.forEach(k => {
      if (savedWindow[k] === undefined) delete window[k];
      else window[k] = savedWindow[k];
    });
    document.body.innerHTML = '';
  });

  describe('Instanziierung', () => {
    it('ist abstrakt', () => {
      expect(() => new BasePaginatedList('x')).toThrow(TypeError);
    });

    it('setzt Defaults aus entityType', () => {
      expect(list.entityType).toBe(ENTITY);
      expect(list.options.paginationContainerId).toBe(`pagination-${ENTITY}`);
      expect(list.options.checkboxClass).toBe(`${ENTITY}-check`);
      expect(list.options.selectAllId).toBe(`select-all-${ENTITY}`);
      expect(list.options.permissionEntity).toBe(ENTITY);
      expect(list.options.itemsPerPage).toBe(10);
      expect(list.options.debounceDelay).toBe(50);
      expect(list.options.searchDebounceDelay).toBe(250);
      expect(list.currentSort).toEqual({ field: 'name', ascending: true });
      expect(list.selectedItems).toBeInstanceOf(Set);
    });

    it('übernimmt Sortier-Optionen', () => {
      const l = new TestList({ sortField: 'nachname', sortAscending: false });
      expect(l.currentSort).toEqual({ field: 'nachname', ascending: false });
      l.destroy();
    });

    it('abstrakte Methoden werfen in der Basis', async () => {
      class Bare extends BasePaginatedList {}
      const b = new Bare('bare');
      await expect(b.loadPageData(1, 10, {})).rejects.toThrow('loadPageData()');
      expect(() => b.renderSingleRow({})).toThrow('renderSingleRow()');
      expect(() => b.renderShellContent()).toThrow('renderShellContent()');
    });
  });

  describe('DOM-Scoping', () => {
    it('byId/query/queryAll arbeiten global ohne mountRoot', () => {
      document.body.innerHTML = '<div id="a"><span class="x"></span></div><span class="x"></span>';
      expect(list.byId('a')).toBe(document.getElementById('a'));
      expect(list.byId(null)).toBeNull();
      expect(list.queryAll('.x').length).toBe(2);
      expect(list.eventRoot()).toBe(document);
    });

    it('byId/query/queryAll arbeiten mit mountRoot nur darin', () => {
      document.body.innerHTML = '<div id="root"><span id="in" class="x"></span></div><span id="out" class="x"></span>';
      list.mountRoot = document.getElementById('root');
      expect(list.byId('in')).not.toBeNull();
      expect(list.byId('out')).toBeNull();
      expect(list.queryAll('.x').length).toBe(1);
      expect(list.eventRoot()).toBe(list.mountRoot);
      expect(list.contentTarget()).toBe(list.mountRoot);
    });

    it('writeContent nutzt innerHTML ohne setContentSafely', () => {
      list.writeContent('<p id="w">hi</p>');
      expect(document.getElementById('w')).not.toBeNull();
    });

    it('writeContent nutzt setContentSafely, wenn nicht gemountet', () => {
      window.setContentSafely = vi.fn();
      list.writeContent('<p>hi</p>');
      expect(window.setContentSafely).toHaveBeenCalledWith(document.getElementById('dashboard-content'), '<p>hi</p>');
    });

    it('writeContent ignoriert setContentSafely mit mountRoot', () => {
      window.setContentSafely = vi.fn();
      document.body.innerHTML = '<div id="root"></div>';
      list.mountRoot = document.getElementById('root');
      list.writeContent('<p id="w">hi</p>');
      expect(window.setContentSafely).not.toHaveBeenCalled();
      expect(list.mountRoot.querySelector('#w')).not.toBeNull();
    });
  });

  describe('init()', () => {
    it('rendert Shell, lädt Daten, registriert Bulk-System', async () => {
      await list.init();

      expect(window.setHeadline).toHaveBeenCalledWith(`${ENTITY} Übersicht`);
      expect(document.querySelector('.data-table')).not.toBeNull();
      expect(rowIds()).toEqual(['1', '2', '3']);
      expect(window.bulkActionSystem.registerList).toHaveBeenCalledWith(ENTITY, list);
      expect(list.dataLoadedSpy).toHaveBeenCalledWith(ROWS);
      expect(list.pagination.getState().totalCount).toBe(3);
    });

    it('ohne View-Berechtigung: Meldung, kein Laden', async () => {
      window.isAdmin = () => false;
      window.canViewPage = () => false;
      window.checkUserPermission = async () => false;

      await list.init();

      expect(document.body.textContent).toContain('keine Berechtigung');
      expect(list.calls.length).toBe(0);
      expect(document.querySelector('.data-table')).toBeNull();
    });

    it('checkViewPermission: canViewPage reicht', async () => {
      window.isAdmin = () => false;
      window.canViewPage = (entity) => entity === ENTITY;
      expect(await list.checkViewPermission()).toBe(true);
    });

    it('checkViewPermission: Fallback auf currentUser.permissions', async () => {
      window.isAdmin = () => false;
      window.canViewPage = undefined;
      window.checkUserPermission = undefined;
      const prev = window.currentUser;
      Object.defineProperty(window, 'currentUser', { value: { permissions: { [ENTITY]: { can_view: true } } }, configurable: true, writable: true });
      expect(await list.checkViewPermission()).toBe(true);
      Object.defineProperty(window, 'currentUser', { value: prev, configurable: true, writable: true });
    });

    it('checkAdditionalPermissions false: stilles return, keine Meldung', async () => {
      list.checkAdditionalPermissions = async () => false;

      await list.init();

      expect(document.getElementById('dashboard-content').innerHTML).toBe('');
      expect(document.body.textContent).not.toContain('keine Berechtigung');
      expect(list.calls.length).toBe(0);
    });

    it('setzt _destroyed bei init() zurück', async () => {
      list.destroy();
      expect(list._destroyed).toBe(true);
      await list.init();
      expect(list._destroyed).toBe(false);
    });

    it('rendert Shell nur einmal', async () => {
      await list.init();
      const spy = vi.spyOn(list, 'renderShellContent');
      await list.renderShell();
      expect(spy).not.toHaveBeenCalled();
    });

    it('loadAndRender rendert Shell nach und lädt', async () => {
      await list.loadAndRender();
      expect(document.querySelector('.data-table')).not.toBeNull();
      expect(list.calls.length).toBe(1);
    });
  });

  describe('loadData()', () => {
    beforeEach(async () => {
      await list.init();
      list.calls.length = 0;
      list.dataLoadedSpy.mockClear();
      list.manual = true;
    });

    it('übergibt Seite, Limit und Filter an loadPageData', async () => {
      list.pagination.currentPage = 2;
      const p = list.loadData();
      expect(list.calls.length).toBe(1);
      expect(list.calls[0].page).toBe(2);
      expect(list.calls[0].limit).toBe(10);
      expect(list.calls[0].filters._sortBy).toBe('name');
      expect(list.calls[0].filters._sortOrder).toBe('asc');
      list.calls[0].d.resolve({ data: [], total: 0 });
      await p;
    });

    it('zeigt Loading-Overlay und entfernt es danach', async () => {
      const tbody = document.querySelector('.data-table tbody');
      const p = list.loadData();
      expect(tbody.classList.contains('table-loading-overlay')).toBe(true);
      list.calls[0].d.resolve({ data: ROWS, total: 3 });
      await p;
      expect(tbody.classList.contains('table-loading-overlay')).toBe(false);
    });

    it('Race: veraltetes Ergebnis wird verworfen', async () => {
      const p1 = list.loadData();
      const p2 = list.loadData();
      expect(list.calls.length).toBe(2);

      list.calls[1].d.resolve({ data: [{ id: 'B' }], total: 1 });
      await p2;
      list.calls[0].d.resolve({ data: [{ id: 'A' }], total: 1 });
      await p1;

      expect(rowIds()).toEqual(['B']);
      expect(list.dataLoadedSpy).toHaveBeenCalledTimes(1);
      expect(list.dataLoadedSpy).toHaveBeenCalledWith([{ id: 'B' }]);
    });

    it('Race: Overlay bleibt, bis der neueste Request fertig ist', async () => {
      const tbody = document.querySelector('.data-table tbody');
      const p1 = list.loadData();
      const p2 = list.loadData();

      list.calls[0].d.resolve({ data: [{ id: 'A' }], total: 1 });
      await p1;
      expect(tbody.classList.contains('table-loading-overlay')).toBe(true);

      list.calls[1].d.resolve({ data: [{ id: 'B' }], total: 1 });
      await p2;
      expect(tbody.classList.contains('table-loading-overlay')).toBe(false);
    });

    it('Destroy-Guard: Ergebnis nach destroy() wird verworfen', async () => {
      const updateSpy = vi.spyOn(list, 'updateTable');
      const p = list.loadData();
      list.destroy();
      list.calls[0].d.resolve({ data: ROWS, total: 3 });
      await p;

      expect(updateSpy).not.toHaveBeenCalled();
      expect(list.dataLoadedSpy).not.toHaveBeenCalled();
    });

    it('Fehler: zeigt Fehlerzeile und ruft ErrorHandler', async () => {
      window.ErrorHandler = { handle: vi.fn() };
      const p = list.loadData();
      list.calls[0].d.reject(new Error('Kaputt'));
      await p;

      const cell = document.querySelector('.table-state-cell--error');
      expect(cell).not.toBeNull();
      expect(cell.textContent).toContain('Kaputt');
      expect(cell.getAttribute('colspan')).toBe(String(list.options.tableColspan));
      expect(window.ErrorHandler.handle).toHaveBeenCalledTimes(1);
      expect(document.querySelector('.data-table tbody').classList.contains('table-loading-overlay')).toBe(false);
    });

    it('Fehler eines veralteten Requests wird ignoriert', async () => {
      const p1 = list.loadData();
      const p2 = list.loadData();

      list.calls[0].d.reject(new Error('Alt'));
      await p1;
      expect(document.querySelector('.table-state-cell--error')).toBeNull();

      list.calls[1].d.resolve({ data: ROWS, total: 3 });
      await p2;
      expect(rowIds()).toEqual(['1', '2', '3']);
    });

    it('leeres Ergebnis rendert Empty-State', async () => {
      const p = list.loadData();
      list.calls[0].d.resolve({ data: [], total: 0 });
      await p;

      const cell = document.querySelector('.empty-state-cell');
      expect(cell).not.toBeNull();
      expect(cell.getAttribute('colspan')).toBe(String(list.options.tableColspan));
      expect(cell.textContent).toContain(`Keine ${ENTITY} vorhanden`);
    });

    it('leeres Ergebnis mit aktiver Suche rendert gefilterten Empty-State', async () => {
      list.searchQuery = 'abc';
      expect(list.hasActiveFilters()).toBe(true);
      const p = list.loadData();
      list.calls[0].d.resolve({ data: [], total: 0 });
      await p;
      expect(document.querySelector('.empty-state-cell')).not.toBeNull();
      expect(document.querySelector('.empty-state-cell').textContent).not.toContain(`Keine ${ENTITY} vorhanden`);
    });
  });

  describe('Debounce', () => {
    beforeEach(async () => {
      await list.init();
      vi.useFakeTimers();
    });

    it('loadDataDebounced bündelt mehrere Aufrufe', async () => {
      const spy = vi.spyOn(list, 'loadData').mockResolvedValue();
      list.loadDataDebounced();
      list.loadDataDebounced();
      list.loadDataDebounced();
      await vi.advanceTimersByTimeAsync(49);
      expect(spy).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('loadDataDebounced nutzt übergebene Verzögerung', async () => {
      const spy = vi.spyOn(list, 'loadData').mockResolvedValue();
      list.loadDataDebounced(100);
      await vi.advanceTimersByTimeAsync(99);
      expect(spy).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('enableDebounce=false lädt sofort', () => {
      list.options.enableDebounce = false;
      const spy = vi.spyOn(list, 'loadData').mockResolvedValue();
      list.loadDataDebounced();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('handleSearch: debounced, trimmt, setzt Seite 1 und lädt', async () => {
      const spy = vi.spyOn(list, 'loadData').mockResolvedValue();
      list.pagination.currentPage = 3;

      list.handleSearch('  fo ');
      list.handleSearch('  foo ');

      await vi.advanceTimersByTimeAsync(249);
      expect(list.searchQuery).toBe('');
      expect(list.pagination.currentPage).toBe(3);

      await vi.advanceTimersByTimeAsync(1);
      expect(list.searchQuery).toBe('foo');
      expect(list.pagination.currentPage).toBe(1);
      expect(spy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(50);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('destroy() verwirft ausstehende Timer', async () => {
      const spy = vi.spyOn(list, 'loadData').mockResolvedValue();
      list.loadDataDebounced();
      list.handleSearch('foo');
      list.destroy();
      await vi.advanceTimersByTimeAsync(1000);
      expect(spy).not.toHaveBeenCalled();
      expect(list.searchQuery).toBe('');
    });

    it('Pagination-Callbacks setzen Seite und laden debounced', async () => {
      const spy = vi.spyOn(list, 'loadData').mockResolvedValue();
      list.handlePageChange(4);
      expect(list.pagination.currentPage).toBe(4);
      list.handleItemsPerPageChange(25, 2);
      expect(list.pagination.currentPage).toBe(2);
      await vi.advanceTimersByTimeAsync(50);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Callbacks Sort/Filter', () => {
    beforeEach(async () => {
      await list.init();
      vi.useFakeTimers();
    });

    it('onSortChange', async () => {
      const spy = vi.spyOn(list, 'loadData').mockResolvedValue();
      list.pagination.currentPage = 3;
      list.onSortChange({ field: 'x', ascending: false });
      expect(list.currentSort).toEqual({ field: 'x', ascending: false });
      expect(list.pagination.currentPage).toBe(1);
      await vi.advanceTimersByTimeAsync(50);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('onFiltersApplied und onFiltersReset', async () => {
      const spy = vi.spyOn(list, 'loadData').mockResolvedValue();
      list.pagination.currentPage = 3;
      list.onFiltersApplied({ status: 'a' });
      expect(filterSystem.getFilters(ENTITY)).toEqual({ status: 'a' });
      expect(list.pagination.currentPage).toBe(1);
      await vi.advanceTimersByTimeAsync(100);
      expect(spy).toHaveBeenCalledTimes(1);

      list.pagination.currentPage = 2;
      list.onFiltersReset();
      expect(list.pagination.currentPage).toBe(1);
      await vi.advanceTimersByTimeAsync(50);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('buildFilters()', () => {
    it('enthält Sortierung und aktive Filter', () => {
      filterSystem.activeFilters[ENTITY] = { status: 'x' };
      list.currentSort = { field: 'foo', ascending: false };
      const f = list.buildFilters();
      expect(f).toMatchObject({ status: 'x', _sortBy: 'foo', _sortOrder: 'desc' });
      expect(f._search).toBeUndefined();
      expect(f.name).toBeUndefined();
    });

    it('baut _search und name aus searchQuery', () => {
      list.searchQuery = '  hallo ';
      const f = list.buildFilters();
      expect(f.name).toBe('hallo');
      expect(f._search.query).toBe('hallo');
      expect(f._search.fields).toEqual(['name']);
      expect(f._search.relations).toEqual([]);
    });

    it('verändert die globalen Filter nicht', () => {
      filterSystem.activeFilters[ENTITY] = { status: 'x' };
      list.buildFilters();
      expect(filterSystem.getFilters(ENTITY)).toEqual({ status: 'x' });
    });
  });

  describe('Selection', () => {
    beforeEach(async () => {
      await list.init();
    });

    it('Einzel-Checkbox füllt Set und UI', () => {
      const [first] = checks();
      first.checked = true;
      fire(first, 'change');

      expect(Array.from(list.selectedItems)).toEqual(['1']);
      const count = document.getElementById('selected-count');
      expect(count.textContent).toBe('1 ausgewählt');
      expect(count.style.display).toBe('inline');
      expect(document.getElementById('btn-select-all').style.display).toBe('none');
      expect(document.getElementById('btn-deselect-all').style.display).toBe('inline-block');
      expect(document.getElementById('btn-delete-selected').style.display).toBe('inline-block');
    });

    it('Abwählen entfernt aus dem Set und versteckt die UI', () => {
      const [first] = checks();
      first.checked = true;
      fire(first, 'change');
      first.checked = false;
      fire(first, 'change');

      expect(list.selectedItems.size).toBe(0);
      expect(document.getElementById('selected-count').style.display).toBe('none');
      expect(document.getElementById('btn-select-all').style.display).toBe('inline-block');
      expect(document.getElementById('btn-deselect-all').style.display).toBe('none');
      expect(document.getElementById('btn-delete-selected').style.display).toBe('none');
    });

    it('teilweise Auswahl setzt Select-All auf indeterminate', () => {
      const [first] = checks();
      first.checked = true;
      fire(first, 'change');

      const header = document.getElementById(`select-all-${ENTITY}`);
      expect(header.indeterminate).toBe(true);
      expect(header.checked).toBe(false);
    });

    it('vollständige Auswahl setzt Select-All auf checked', () => {
      checks().forEach(cb => { cb.checked = true; fire(cb, 'change'); });

      const header = document.getElementById(`select-all-${ENTITY}`);
      expect(header.checked).toBe(true);
      expect(header.indeterminate).toBe(false);
    });

    it('Select-All-Header wählt alle und ruft updateSelection genau einmal', () => {
      const spy = vi.spyOn(list, 'updateSelection');
      const header = document.getElementById(`select-all-${ENTITY}`);
      header.checked = true;
      fire(header, 'change');

      expect(Array.from(list.selectedItems).sort()).toEqual(['1', '2', '3']);
      expect(checks().every(cb => cb.checked)).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(document.getElementById('selected-count').textContent).toBe('3 ausgewählt');
    });

    it('Select-All-Header abwählen leert das Set', () => {
      const header = document.getElementById(`select-all-${ENTITY}`);
      header.checked = true;
      fire(header, 'change');
      header.checked = false;
      fire(header, 'change');

      expect(list.selectedItems.size).toBe(0);
      expect(checks().every(cb => !cb.checked)).toBe(true);
    });

    it('Einzel-Checkbox ruft updateSelection und updateSelectAllCheckbox', () => {
      const selSpy = vi.spyOn(list, 'updateSelection');
      const allSpy = vi.spyOn(list, 'updateSelectAllCheckbox');
      const [first] = checks();
      first.checked = true;
      fire(first, 'change');
      expect(selSpy).toHaveBeenCalledTimes(1);
      expect(allSpy).toHaveBeenCalledTimes(1);
    });

    it('Button "Alle auswählen"', () => {
      document.getElementById('btn-select-all').click();

      expect(list.selectedItems.size).toBe(3);
      expect(checks().every(cb => cb.checked)).toBe(true);
      const header = document.getElementById(`select-all-${ENTITY}`);
      expect(header.checked).toBe(true);
      expect(header.indeterminate).toBe(false);
    });

    it('Button "Auswahl aufheben" ruft deselectAll', () => {
      document.getElementById('btn-select-all').click();
      const spy = vi.spyOn(list, 'deselectAll');
      document.getElementById('btn-deselect-all').click();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(list.selectedItems.size).toBe(0);
      expect(checks().every(cb => !cb.checked)).toBe(true);
      expect(document.getElementById('selected-count').style.display).toBe('none');
    });

    it('deselectAll behält die Set-Identität (Aliase in Unterklassen)', () => {
      const alias = list.selectedItems;
      document.getElementById('btn-select-all').click();
      list.deselectAll();
      expect(list.selectedItems).toBe(alias);
      expect(alias.size).toBe(0);
    });

    it('Nach Re-Render greift Select-All nur auf vorhandene Checkboxen', () => {
      document.getElementById('btn-select-all').click();
      list.deselectAll();
      document.querySelector('.data-table tbody').innerHTML = list.renderSingleRow({ id: '9' });
      document.getElementById('btn-select-all').click();
      expect(Array.from(list.selectedItems)).toEqual(['9']);
    });
  });

  describe('Event-Delegation', () => {
    beforeEach(async () => {
      await list.init();
    });

    it('table-link navigiert zur Detailroute', () => {
      document.body.insertAdjacentHTML('beforeend', `<a class="table-link" data-table="${ENTITY}" data-id="5">x</a>`);
      document.querySelector('a.table-link').click();
      expect(window.navigateTo).toHaveBeenCalledWith(`/${ENTITY}/5`);
    });

    it('table-link anderer Entität wird ignoriert', () => {
      document.body.insertAdjacentHTML('beforeend', '<a class="table-link" data-table="andere" data-id="5">x</a>');
      document.querySelector('a.table-link').click();
      expect(window.navigateTo).not.toHaveBeenCalled();
    });

    it('resolveDetailRoute ist überschreibbar', () => {
      list.resolveDetailRoute = (id) => `/custom/${id}`;
      document.body.insertAdjacentHTML('beforeend', `<a class="table-link" data-table="${ENTITY}" data-id="7">x</a>`);
      document.querySelector('a.table-link').click();
      expect(window.navigateTo).toHaveBeenCalledWith('/custom/7');
    });

    it('entityUpdated der eigenen Entität lädt debounced neu', async () => {
      vi.useFakeTimers();
      const spy = vi.spyOn(list, 'loadData').mockResolvedValue();
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: ENTITY } }));
      await vi.advanceTimersByTimeAsync(99);
      expect(spy).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('entityUpdated anderer Entität wird ignoriert', async () => {
      vi.useFakeTimers();
      const spy = vi.spyOn(list, 'loadData').mockResolvedValue();
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'andere' } }));
      await vi.advanceTimersByTimeAsync(500);
      expect(spy).not.toHaveBeenCalled();
    });

    it('handleEntityUpdated=true unterdrückt den Full-Reload', async () => {
      vi.useFakeTimers();
      const spy = vi.spyOn(list, 'loadData').mockResolvedValue();
      list.handleEntityUpdated = vi.fn().mockResolvedValue(true);
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: ENTITY, id: '1' } }));
      await vi.advanceTimersByTimeAsync(500);
      expect(list.handleEntityUpdated).toHaveBeenCalledWith({ entity: ENTITY, id: '1' });
      expect(spy).not.toHaveBeenCalled();
    });

    it('handleEntityUpdated=false oder Fehler lädt trotzdem neu', async () => {
      vi.useFakeTimers();
      const spy = vi.spyOn(list, 'loadData').mockResolvedValue();
      list.handleEntityUpdated = vi.fn().mockRejectedValue(new Error('x'));
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: ENTITY } }));
      await vi.advanceTimersByTimeAsync(100);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('Filter-Tag X entfernt den Filter und lädt neu', async () => {
      vi.useFakeTimers();
      filterSystem.activeFilters[ENTITY] = { a: '1', b: '2' };
      list.pagination.currentPage = 4;
      const spy = vi.spyOn(list, 'loadData').mockResolvedValue();
      document.body.insertAdjacentHTML('beforeend', '<span class="filter-tag" data-key="a"><span class="tag-x">x</span></span>');

      document.querySelector('.tag-x').click();

      expect(filterSystem.getFilters(ENTITY)).toEqual({ b: '2' });
      expect(list.pagination.currentPage).toBe(1);
      await vi.advanceTimersByTimeAsync(50);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('Empty-State "Filter zurücksetzen" ruft onFiltersReset', () => {
      const spy = vi.spyOn(list, 'onFiltersReset').mockImplementation(() => {});
      document.body.insertAdjacentHTML('beforeend', '<button data-empty-action="reset-filters">r</button>');
      document.querySelector('[data-empty-action]').click();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('bindAdditionalEvents bekommt ein AbortSignal', () => {
      const spy = vi.spyOn(list, 'bindAdditionalEvents');
      list.bindEvents();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
    });

    it('erneutes bindEvents entfernt alte Listener (kein Doppel-Handling)', () => {
      list.bindEvents();
      list.bindEvents();
      document.body.insertAdjacentHTML('beforeend', `<a class="table-link" data-table="${ENTITY}" data-id="5">x</a>`);
      document.querySelector('a.table-link').click();
      expect(window.navigateTo).toHaveBeenCalledTimes(1);
    });

    it('bindEvents nach destroy bindet nichts', () => {
      list.destroy();
      list.bindEvents();
      document.body.insertAdjacentHTML('beforeend', `<a class="table-link" data-table="${ENTITY}" data-id="5">x</a>`);
      document.querySelector('a.table-link').click();
      expect(window.navigateTo).not.toHaveBeenCalled();
    });

    it('mit mountRoot hören DOM-Events nur auf dem Root', async () => {
      list.destroy();
      document.body.innerHTML = '<div id="root"></div><a class="table-link" data-table="testent" data-id="1">out</a>';
      list.mountRoot = document.getElementById('root');
      list._destroyed = false;
      list.bindEvents();

      document.querySelector('a.table-link').click();
      expect(window.navigateTo).not.toHaveBeenCalled();

      list.mountRoot.insertAdjacentHTML('beforeend', '<a class="table-link inner" data-table="testent" data-id="2">in</a>');
      list.mountRoot.querySelector('.inner').click();
      expect(window.navigateTo).toHaveBeenCalledWith('/testent/2');
    });

    it('nach destroy reagiert die Liste nicht mehr auf Window-Events', async () => {
      vi.useFakeTimers();
      list.destroy();
      const spy = vi.spyOn(list, 'loadData').mockResolvedValue();
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: ENTITY } }));
      window.dispatchEvent(new CustomEvent('permissionsChanged', { detail: { type: 'x' } }));
      await vi.advanceTimersByTimeAsync(500);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Permissions', () => {
    it('isAdmin wird gecacht und per invalidatePermissionCache zurückgesetzt', () => {
      const spy = vi.fn(() => true);
      window.isAdmin = spy;
      expect(list.isAdmin).toBe(true);
      expect(list.isAdmin).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);

      window.isAdmin = () => false;
      expect(list.isAdmin).toBe(true);
      list.invalidatePermissionCache();
      expect(list.isAdmin).toBe(false);
    });

    it('canEdit: Admin oder Entity-Permission, gecacht', () => {
      window.isAdmin = () => false;
      const prev = window.currentUser;
      Object.defineProperty(window, 'currentUser', { value: { permissions: { [ENTITY]: { can_edit: true } } }, configurable: true, writable: true });
      expect(list.canEdit).toBe(true);

      Object.defineProperty(window, 'currentUser', { value: { permissions: { [ENTITY]: { can_edit: false } } }, configurable: true, writable: true });
      expect(list.canEdit).toBe(true);
      list.invalidatePermissionCache();
      expect(list.canEdit).toBe(false);
      Object.defineProperty(window, 'currentUser', { value: prev, configurable: true, writable: true });
    });

    it('canBulkDelete ist nicht gecacht', () => {
      window.canBulkDelete = vi.fn(() => true);
      expect(list.canBulkDelete).toBe(true);
      window.canBulkDelete = vi.fn(() => false);
      expect(list.canBulkDelete).toBe(false);
    });

    it('permissionEntity-Option steuert den Check', () => {
      const l = new TestList({ permissionEntity: 'anderes' });
      window.isAdmin = () => false;
      const prev = window.currentUser;
      Object.defineProperty(window, 'currentUser', { value: { permissions: { anderes: { can_edit: true } } }, configurable: true, writable: true });
      expect(l.canEdit).toBe(true);
      Object.defineProperty(window, 'currentUser', { value: prev, configurable: true, writable: true });
      l.destroy();
    });
  });

  describe('handlePermissionsChanged()', () => {
    beforeEach(async () => {
      await list.init();
    });

    it('invalidiert Caches, versteckt Tabelle, lädt neu und blendet wieder ein', async () => {
      vi.useFakeTimers();
      const resetSpy = vi.spyOn(list, 'resetEntityCaches');
      const loadSpy = vi.spyOn(list, 'loadData').mockResolvedValue();
      expect(list.isAdmin).toBe(true);
      window.isAdmin = () => false;

      list.handlePermissionsChanged({ type: 'zuordnung' });

      const tbody = document.querySelector('.data-table tbody');
      expect(resetSpy).toHaveBeenCalledTimes(1);
      expect(list.isAdmin).toBe(false);
      expect(tbody.classList.contains('table-permission-loading')).toBe(true);
      expect(tbody.classList.contains('table-loading-overlay')).toBe(false);
      expect(loadSpy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(50);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(tbody.classList.contains('table-permission-loading')).toBe(false);
    });

    it('permissionsChanged-Event löst handlePermissionsChanged aus', () => {
      const spy = vi.spyOn(list, 'handlePermissionsChanged').mockImplementation(() => {});
      window.dispatchEvent(new CustomEvent('permissionsChanged', { detail: { type: 'x' } }));
      expect(spy).toHaveBeenCalledWith({ type: 'x' });
    });
  });

  describe('destroy()', () => {
    it('ist idempotent', async () => {
      await list.init();
      const spy = vi.spyOn(list.pagination, 'destroy');
      list.destroy();
      list.destroy();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(list._destroyed).toBe(true);
    });

    it('leert das Selection-Set (gleiche Instanz), fasst das DOM aber nicht an', async () => {
      await list.init();
      const alias = list.selectedItems;
      document.getElementById('btn-select-all').click();
      expect(alias.size).toBe(3);

      list.destroy();

      expect(list.selectedItems).toBe(alias);
      expect(alias.size).toBe(0);
      expect(checks().every(cb => cb.checked)).toBe(true);
      expect(document.getElementById('selected-count').textContent).toBe('3 ausgewählt');
    });

    it('setzt Shell-Flag und Permission-Cache zurück', async () => {
      await list.init();
      expect(list.isAdmin).toBe(true);
      list.destroy();
      window.isAdmin = () => false;
      expect(list.isAdmin).toBe(false);

      const spy = vi.spyOn(list, 'renderShellContent');
      await list.renderShell();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('verwirft Pagination-Callbacks', async () => {
      await list.init();
      list.destroy();
      expect(list.pagination.callbacks.onPageChange).toBeNull();
    });
  });

  describe('Hilfsfunktionen', () => {
    it('formatNumber nutzt deutsches Format', () => {
      expect(list.formatNumber(1234567.5)).toBe('1.234.567,5');
    });

    it('sanitize fällt ohne validatorSystem auf den Wert zurück', () => {
      expect(list.sanitize('a')).toBe('a');
      expect(list.sanitize(null)).toBe('');
    });

    it('sanitize nutzt validatorSystem, wenn vorhanden', () => {
      window.validatorSystem = { sanitizeHtml: (v) => `[${v}]` };
      expect(list.sanitize('a')).toBe('[a]');
      delete window.validatorSystem;
    });

    it('resolveDetailRoute', () => {
      expect(list.resolveDetailRoute('9')).toBe(`/${ENTITY}/9`);
    });

    it('getEmptyState: Default und options.emptyState', () => {
      expect(list.getEmptyState()).toEqual({ icon: 'inbox', title: `Keine ${ENTITY} vorhanden` });
      const custom = { icon: 'x', title: 'Leer' };
      const l = new TestList({ emptyState: custom });
      expect(l.getEmptyState()).toBe(custom);
      l.destroy();
    });

    it('hasActiveFilters berücksichtigt Filter, leere Werte und Suche', () => {
      expect(list.hasActiveFilters()).toBe(false);
      filterSystem.activeFilters[ENTITY] = { a: '', b: [] };
      expect(list.hasActiveFilters()).toBe(false);
      filterSystem.activeFilters[ENTITY] = { a: ['x'] };
      expect(list.hasActiveFilters()).toBe(true);
      filterSystem.activeFilters[ENTITY] = {};
      list.searchQuery = '  ';
      expect(list.hasActiveFilters()).toBe(false);
      list.searchQuery = 'x';
      expect(list.hasActiveFilters()).toBe(true);
    });
  });

  describe('Pagination-Anbindung', () => {
    it('dataLoader der Pagination lädt Seite 1 bis offset+limit und schneidet ab', async () => {
      await list.init();
      list.calls.length = 0;
      list.manual = false;
      const loader = list.pagination.dynamicResize.dataLoader;
      list.loadPageData = vi.fn(async () => ({ data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], total: 3 }));

      const result = await loader(1, 2);

      expect(list.loadPageData).toHaveBeenCalledWith(1, 3, expect.any(Object));
      expect(result).toEqual([{ id: 'b' }, { id: 'c' }]);
    });

    it('rowRenderer rendert über renderSingleRow', async () => {
      await list.init();
      const html = list.pagination.dynamicResize.rowRenderer({ id: 'z' });
      expect(html).toContain('data-id="z"');
    });
  });
});
