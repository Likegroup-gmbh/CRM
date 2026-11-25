// Oberflächen-Test für BasePaginatedList.
// Die Unterklassen (Marke, Unternehmen, Ansprechpartner, Creator, Persona, Produkt,
// Management) überschreiben und rufen diese Methoden direkt auf. Dieser Test fängt
// versehentliche API-Änderungen beim Zerlegen der Klasse ab.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { BasePaginatedList } from '../core/BasePaginatedList.js';

const PROTOTYPE_METHODS = [
  // DOM-Scoping
  'byId', 'query', 'queryAll', 'eventRoot', 'contentTarget', 'writeContent',
  // Abstrakt
  'loadPageData', 'renderSingleRow', 'renderShellContent',
  // Hooks
  'initializeFilterBar', 'bindAdditionalEvents', 'buildFilters', 'checkAdditionalPermissions',
  'onDataLoaded', 'handlePermissionsChanged', 'resetEntityCaches',
  // Lifecycle
  'init', 'checkViewPermission', 'renderNoPermission', 'renderShell', 'initializePagination',
  'handlePageChange', 'handleItemsPerPageChange', 'loadDataDebounced', 'loadData', 'loadAndRender',
  'destroy',
  // Tabelle
  'updateTable', 'getEmptyState', 'hasActiveFilters', 'renderEmptyTable', 'showErrorInTable',
  // Events / Selection
  'bindEvents', 'updateSelection', 'updateSelectAllCheckbox', 'deselectAll',
  // Sort / Filter / Suche
  'onSortChange', 'onFiltersApplied', 'onFiltersReset', 'handleSearch',
  // Permissions / Utils
  'invalidatePermissionCache', 'resolveDetailRoute', 'sanitize', 'formatNumber'
];

const PROTOTYPE_GETTERS = ['isAdmin', 'canBulkDelete', 'canEdit'];

const INSTANCE_FIELDS = [
  'entityType', 'pagination', 'selectedItems', 'options', 'currentSort', 'searchQuery',
  'embedded', 'mountRoot', '_destroyed', '_shellRendered'
];

const OPTION_KEYS = [
  'itemsPerPage', 'paginationContainerId', 'tbodySelector', 'tableColspan', 'enableDynamicResize',
  'enableDebounce', 'debounceDelay', 'searchDebounceDelay', 'headline', 'breadcrumbLabel',
  'permissionEntity', 'checkboxClass', 'selectAllId'
];

class Dummy extends BasePaginatedList {
  constructor() { super('dummy'); }
}

describe('BasePaginatedList Oberfläche', () => {
  let inst;

  afterEach(() => {
    inst?.destroy();
    inst = null;
    vi.restoreAllMocks();
  });

  it.each(PROTOTYPE_METHODS)('Prototype-Methode %s existiert als Funktion', (name) => {
    const desc = Object.getOwnPropertyDescriptor(BasePaginatedList.prototype, name);
    expect(desc, name).toBeDefined();
    expect(typeof desc.value).toBe('function');
  });

  it.each(PROTOTYPE_GETTERS)('Getter %s existiert auf dem Prototype', (name) => {
    const desc = Object.getOwnPropertyDescriptor(BasePaginatedList.prototype, name);
    expect(desc, name).toBeDefined();
    expect(typeof desc.get).toBe('function');
  });

  it('Methoden sind überschreibbar (keine Instanz-Eigenschaften, kein Freeze)', () => {
    inst = new Dummy();
    for (const name of PROTOTYPE_METHODS) {
      expect(Object.prototype.hasOwnProperty.call(inst, name), name).toBe(false);
    }
  });

  it.each(INSTANCE_FIELDS)('Instanzfeld %s ist gesetzt', (name) => {
    inst = new Dummy();
    expect(name in inst).toBe(true);
  });

  it('Feld-Typen', () => {
    inst = new Dummy();
    expect(inst.entityType).toBe('dummy');
    expect(inst.selectedItems).toBeInstanceOf(Set);
    expect(typeof inst.pagination.getState).toBe('function');
    expect(inst._destroyed).toBe(false);
    expect(inst._shellRendered).toBe(false);
    expect(inst.embedded).toBe(false);
    expect(inst.mountRoot).toBeNull();
    expect(inst.searchQuery).toBe('');
  });

  it.each(OPTION_KEYS)('options.%s ist gesetzt', (key) => {
    inst = new Dummy();
    expect(key in inst.options).toBe(true);
  });

  it('options sind schreibbar (ProduktList/PersonaList setzen enableDynamicResize)', () => {
    inst = new Dummy();
    inst.options.enableDynamicResize = false;
    expect(inst.options.enableDynamicResize).toBe(false);
  });

  it('selectedItems-Alias bleibt gültig (Aliase in Unterklassen)', () => {
    inst = new Dummy();
    const alias = inst.selectedItems;
    alias.add('x');
    expect(inst.selectedItems.has('x')).toBe(true);
    inst.deselectAll();
    expect(inst.selectedItems).toBe(alias);
  });

  it('loadData liegt auf dem Prototype und ist bindbar (CreatorList: _superLoadData)', () => {
    inst = new Dummy();
    const bound = BasePaginatedList.prototype.loadData.bind(inst);
    expect(typeof bound).toBe('function');
  });

  it('super.loadData/destroy/init aus Unterklassen erreichbar', () => {
    class Sub extends BasePaginatedList {
      constructor() { super('sub'); }
      async loadData() { return super.loadData(); }
      destroy() { return super.destroy(); }
      async init() { return super.init(); }
    }
    inst = new Sub();
    expect(typeof Object.getPrototypeOf(Sub.prototype).loadData).toBe('function');
    expect(() => inst.destroy()).not.toThrow();
  });
});
