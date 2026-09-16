import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/filters/ModularFilterSystem.js', () => ({
  modularFilterSystem: {
    getFilters: vi.fn(() => ({})),
    applyFilters: vi.fn(),
    resetFilters: vi.fn(),
    getDynamicFilterData: vi.fn(() => null)
  }
}));

vi.mock('../core/filters/FilterDropdown.js', () => ({
  filterDropdown: {
    init: vi.fn(),
    openFromAnchor: vi.fn(),
    getActiveFilterCount: vi.fn(() => 0)
  }
}));

vi.mock('../modules/kampagne/KampagneListDataLoader.js', () => ({
  loadKampagnenWithRelations: vi.fn(async () => ({ data: [], count: 0, kampagneArtMap: new Map() })),
  loadUserPermissions: vi.fn(async () => ({}))
}));

vi.mock('../modules/kampagne/KampagneCalendarView.js', () => ({
  KampagneCalendarView: class {
    async init() {}
    destroy() {}
    reload() {}
    refresh() {}
    setSearchQuery() {}
  }
}));

import { setShowCompleted } from '../modules/kampagne/kampagneListPrefs.js';
import { renderPageHtml } from '../modules/kampagne/KampagneListRenderers.js';
import { KampagneList } from '../modules/kampagne/KampagneList.js';
import {
  buildGridRpcParams,
  clearKampagneFolderQuery,
  groupKampagnenGrid,
  initialKampagneView,
  isMissingGridRpc,
  KampagneGridView,
  loadKampagnenGrid,
  resetGridRpcAvailability
} from '../modules/kampagne/KampagneGridView.js';

function mockLocation(search = '') {
  window.history.replaceState({}, '', `/kampagne${search}`);
}

describe('initialKampagneView', () => {
  it('startet auf Liste ohne Folder-Query', () => {
    expect(initialKampagneView('')).toBe('list');
    expect(initialKampagneView('?foo=1')).toBe('list');
  });

  it('startet auf Grid wenn Unternehmen in der Query steht', () => {
    expect(initialKampagneView('?unternehmen=u1&unternehmen_name=Acme')).toBe('grid');
  });
});

describe('buildGridRpcParams', () => {
  it('Companies: keine IDs, hide_completed default an', () => {
    expect(buildGridRpcParams({}, true)).toEqual({
      p_unternehmen_id: null,
      p_marke_id: null,
      p_ohne_marke: false,
      p_hide_completed: true
    });
  });

  it('Brands: nur Unternehmen', () => {
    expect(buildGridRpcParams({
      unternehmenId: 'u1',
      viewMode: 'brands'
    }, true)).toEqual({
      p_unternehmen_id: 'u1',
      p_marke_id: null,
      p_ohne_marke: false,
      p_hide_completed: true
    });
  });

  it('Items mit Marke', () => {
    expect(buildGridRpcParams({
      unternehmenId: 'u1',
      markeId: 'm1'
    }, false)).toEqual({
      p_unternehmen_id: 'u1',
      p_marke_id: 'm1',
      p_ohne_marke: false,
      p_hide_completed: false
    });
  });

  it('Items ohne Marke: Sentinel p_ohne_marke, marke_id null', () => {
    expect(buildGridRpcParams({
      unternehmenId: 'u1',
      markeId: 'ignored',
      ohneMarke: true
    }, true)).toEqual({
      p_unternehmen_id: 'u1',
      p_marke_id: null,
      p_ohne_marke: true,
      p_hide_completed: true
    });
  });
});

describe('groupKampagnenGrid', () => {
  const rows = [
    {
      id: 'k1',
      unternehmen_id: 'u1',
      marke_id: 'm1',
      is_completed: false,
      created_at: '2026-01-02',
      unternehmen: { id: 'u1', firmenname: 'Acme' },
      marke: { id: 'm1', markenname: 'BrandX' }
    },
    {
      id: 'k2',
      unternehmen_id: 'u1',
      marke_id: null,
      is_completed: false,
      created_at: '2026-01-03',
      unternehmen: { id: 'u1', firmenname: 'Acme' }
    },
    {
      id: 'k3',
      unternehmen_id: 'u1',
      marke_id: 'm1',
      is_completed: true,
      created_at: '2026-01-01',
      unternehmen: { id: 'u1', firmenname: 'Acme' },
      marke: { id: 'm1', markenname: 'BrandX' }
    }
  ];

  it('zählt Companies ohne abgeschlossene', () => {
    const data = groupKampagnenGrid(rows, {}, true);
    expect(data.ebene).toBe('companies');
    expect(data.unternehmen).toEqual([
      expect.objectContaining({ id: 'u1', count: 2 })
    ]);
  });

  it('Brands plus ohne_marke_count', () => {
    const data = groupKampagnenGrid(rows, { unternehmenId: 'u1' }, true);
    expect(data.ebene).toBe('brands');
    expect(data.marken[0]).toMatchObject({ id: 'm1', count: 1 });
    expect(data.ohne_marke_count).toBe(1);
  });

  it('Items ohne Marke', () => {
    const data = groupKampagnenGrid(rows, { unternehmenId: 'u1', ohneMarke: true }, true);
    expect(data.kampagnen.map((k) => k.id)).toEqual(['k2']);
  });
});

describe('loadKampagnenGrid', () => {
  beforeEach(() => {
    resetGridRpcAvailability();
    window.supabase = {
      rpc: vi.fn(async () => ({ data: { ebene: 'companies', unternehmen: [] }, error: null }))
    };
  });

  it('ruft get_kampagnen_grid mit hide_completed auf', async () => {
    await loadKampagnenGrid({ unternehmenId: 'u1' }, true);
    expect(window.supabase.rpc).toHaveBeenCalledWith('get_kampagnen_grid', {
      p_unternehmen_id: 'u1',
      p_marke_id: null,
      p_ohne_marke: false,
      p_hide_completed: true
    });
  });

  it('reicht hide_completed=false durch wenn Toggle an', async () => {
    await loadKampagnenGrid({ unternehmenId: 'u1', markeId: 'm1' }, false);
    expect(window.supabase.rpc).toHaveBeenCalledWith('get_kampagnen_grid', expect.objectContaining({
      p_hide_completed: false,
      p_marke_id: 'm1'
    }));
  });

  it('fällt auf lokale Gruppierung zurück wenn RPC fehlt', async () => {
    expect(isMissingGridRpc({ code: 'PGRST202', message: 'Could not find the function' })).toBe(true);
    window.supabase.rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.get_kampagnen_grid' }
    }));
    window.supabase.from = vi.fn(() => ({
      select: vi.fn(() => ({
        not: vi.fn(async () => ({
          data: [{
            id: 'k1',
            unternehmen_id: 'u1',
            is_completed: false,
            unternehmen: { id: 'u1', firmenname: 'Acme' }
          }],
          error: null
        }))
      }))
    }));
    const data = await loadKampagnenGrid({}, true);
    expect(data.ebene).toBe('companies');
    expect(data.unternehmen[0].firmenname).toBe('Acme');
  });
});

describe('KampagneGridView Folder-Transitions', () => {
  beforeEach(() => {
    setShowCompleted(false);
    resetGridRpcAvailability();
    mockLocation('');
    window.validatorSystem = { sanitizeHtml: (s) => s, sanitizeUrl: (s) => s };
    window.breadcrumbSystem = { updateBreadcrumb: vi.fn() };
    window.navigateTo = vi.fn();
    window.ErrorHandler = { handle: vi.fn() };
    window.supabase = {
      rpc: vi.fn(async (_name, params) => {
        if (!params.p_unternehmen_id) {
          return {
            data: {
              ebene: 'companies',
              unternehmen: [{ id: 'u1', firmenname: 'Acme', logo_url: null, count: 2 }]
            },
            error: null
          };
        }
        if (params.p_ohne_marke || params.p_marke_id) {
          return {
            data: {
              ebene: 'items',
              kampagnen: [{
                id: 'k1',
                kampagnenname: 'Sommer',
                eigener_name: 'Sommer intern',
                start: '2026-06-01',
                deadline_post_produktion: '2026-07-01',
                volumen: 10000,
                is_completed: false,
                auftrag: { id: 'a1', auftragsname: 'Auftrag A' }
              }]
            },
            error: null
          };
        }
        return {
          data: {
            ebene: 'brands',
            marken: [{ id: 'm1', markenname: 'BrandX', logo_url: null, count: 1 }],
            ohne_marke_count: 2
          },
          error: null
        };
      })
    };
    document.body.innerHTML = '<div id="kampagnen-grid-root"></div>';
  });

  it('Companies → Brands → Items (Marke) synct URL und RPC-Params', async () => {
    const view = new KampagneGridView(document.getElementById('kampagnen-grid-root'));
    await view.mount();
    expect(view.currentFolder().viewMode).toBe('companies');
    expect(window.supabase.rpc).toHaveBeenLastCalledWith(
      'get_kampagnen_grid',
      expect.objectContaining({ p_unternehmen_id: null })
    );

    await view.switchToBrands('u1', 'Acme');
    expect(view.currentFolder()).toMatchObject({
      viewMode: 'brands',
      unternehmenId: 'u1',
      unternehmenName: 'Acme'
    });
    expect(window.location.search).toContain('unternehmen=u1');
    expect(window.supabase.rpc).toHaveBeenLastCalledWith(
      'get_kampagnen_grid',
      expect.objectContaining({ p_unternehmen_id: 'u1', p_marke_id: null, p_ohne_marke: false })
    );
    expect(document.getElementById('brands-grid')).toBeTruthy();
    expect(document.querySelector('[data-ohne-marke="1"]')).toBeTruthy();

    await view.switchToItems('m1', 'BrandX');
    expect(view.currentFolder()).toMatchObject({
      viewMode: 'items',
      markeId: 'm1',
      ohneMarke: false
    });
    expect(window.location.search).toContain('marke=m1');
    expect(window.supabase.rpc).toHaveBeenLastCalledWith(
      'get_kampagnen_grid',
      expect.objectContaining({ p_unternehmen_id: 'u1', p_marke_id: 'm1', p_ohne_marke: false })
    );
    expect(document.querySelector('.kampagne-grid-open')?.dataset.id).toBe('k1');
    view.destroy();
  });

  it('Items ohne Marke setzt marke=ohne Sentinel', async () => {
    const view = new KampagneGridView(document.getElementById('kampagnen-grid-root'));
    await view.mount();
    await view.switchToBrands('u1', 'Acme');
    await view.switchToItems(null, 'Nur Unternehmen', { ohneMarke: true });
    expect(view.currentFolder()).toMatchObject({
      viewMode: 'items',
      ohneMarke: true,
      markeId: null
    });
    expect(new URLSearchParams(window.location.search).get('marke')).toBe('ohne');
    expect(window.supabase.rpc).toHaveBeenLastCalledWith(
      'get_kampagnen_grid',
      expect.objectContaining({ p_ohne_marke: true, p_marke_id: null })
    );
    view.destroy();
  });

  it('Toggle hide_completed folgt shouldHideCompleted', async () => {
    const view = new KampagneGridView(document.getElementById('kampagnen-grid-root'));
    await view.mount();
    expect(window.supabase.rpc).toHaveBeenLastCalledWith(
      'get_kampagnen_grid',
      expect.objectContaining({ p_hide_completed: true })
    );

    setShowCompleted(true);
    await view.reload();
    expect(window.supabase.rpc).toHaveBeenLastCalledWith(
      'get_kampagnen_grid',
      expect.objectContaining({ p_hide_completed: false })
    );
    view.destroy();
  });
});

describe('KampagneList view-switch + Grid-Button', () => {
  beforeEach(() => {
    setShowCompleted(false);
    mockLocation('');
    window.isKunde = () => false;
    window.isMitarbeiter = () => false;
    window.isAdmin = () => true;
    window.canBulkDelete = () => false;
    window.currentUser = { permissions: { kampagne: { can_edit: true } } };
    window.validatorSystem = { sanitizeHtml: (s) => s, sanitizeUrl: (s) => s };
  });

  it('rendert Grid-Button für Interne und Kunden', () => {
    const intern = renderPageHtml({ currentView: 'list', searchQuery: '' });
    expect(intern).toContain('btn-view-grid');
    expect(intern).toContain('Grid');

    window.isKunde = () => true;
    const kunde = renderPageHtml({ currentView: 'list', searchQuery: '' });
    expect(kunde).toContain('btn-view-grid');
    expect(kunde).not.toContain('btn-view-calendar');
  });

  it('wechselt list → grid → list', async () => {
    window.supabase = {
      rpc: vi.fn(async () => ({ data: { ebene: 'companies', unternehmen: [] }, error: null }))
    };
    window.breadcrumbSystem = { updateBreadcrumb: vi.fn() };
    window.setContentSafely = (el, html) => { el.innerHTML = html; };
    window.content = document.createElement('div');
    document.body.innerHTML = `
      <div class="kampagne-list-page">
        ${renderPageHtml({ currentView: 'list', searchQuery: '' })}
      </div>
    `;

    const list = new KampagneList();
    list._isMounted = true;
    list._abortController = new AbortController();
    list._shellRendered = true;
    list.currentView = 'list';
    list.bindEvents();

    document.getElementById('btn-view-grid').click();
    await vi.waitFor(() => expect(document.getElementById('kampagnen-grid-root')).toBeTruthy());
    expect(list.currentView).toBe('grid');
    expect(list.gridView).toBeTruthy();

    document.getElementById('btn-view-list').click();
    await vi.waitFor(() => expect(document.getElementById('kampagnen-table-body')).toBeTruthy());
    expect(list.currentView).toBe('list');
    expect(list.gridView).toBeNull();
    list.destroy();
  });
});

describe('clearKampagneFolderQuery', () => {
  it('entfernt die Folder-Query', () => {
    mockLocation('?unternehmen=u1&unternehmen_name=Acme');
    clearKampagneFolderQuery();
    expect(window.location.pathname).toBe('/kampagne');
    expect(window.location.search).toBe('');
  });
});
