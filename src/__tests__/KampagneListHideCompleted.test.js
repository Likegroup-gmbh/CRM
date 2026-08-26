import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../core/filters/ModularFilterSystem.js', () => ({
  modularFilterSystem: {
    getFilters: vi.fn(() => ({})),
    getDynamicFilterData: vi.fn(() => null)
  }
}));

vi.mock('../modules/kampagne/filters/KampagneFilterLogic.js', () => ({
  KampagneFilterLogic: {
    applyVirtualFilters: vi.fn((data) => data)
  }
}));

import { modularFilterSystem } from '../core/filters/ModularFilterSystem.js';
import { getShowCompleted, setShowCompleted, shouldHideCompleted } from '../modules/kampagne/kampagneListPrefs.js';
import { buildRpcFilters, loadKampagnenWithRelations } from '../modules/kampagne/KampagneListDataLoader.js';
import { KAMPAGNE_FILTERS, KAMPAGNE_FILTER_PRESETS } from '../modules/kampagne/filters/KampagneFilterConfig.js';
import { renderPageHtml, renderKampagneListToolbarMenu } from '../modules/kampagne/KampagneListRenderers.js';

describe('kampagneListPrefs', () => {
  beforeEach(() => {
    setShowCompleted(false);
  });

  it('blendet default aus, außer Switch an oder Suche gesetzt', () => {
    expect(shouldHideCompleted('')).toBe(true);
    expect(shouldHideCompleted('  ')).toBe(true);
    expect(shouldHideCompleted('Telekom')).toBe(false);
    setShowCompleted(true);
    expect(shouldHideCompleted('')).toBe(false);
    expect(getShowCompleted()).toBe(true);
  });
});

describe('buildRpcFilters – hide_completed', () => {
  beforeEach(() => {
    setShowCompleted(false);
  });

  it('setzt hide_completed wenn Switch aus und Suche leer', () => {
    expect(buildRpcFilters({})).toEqual({ hide_completed: true });
  });

  it('lässt hide_completed weg bei Suche, andere Filter bleiben', () => {
    const filters = buildRpcFilters(
      { unternehmen_id: 'u1', art_der_kampagne: ['UGC Paid'] },
      { searchQuery: 'Telekom' }
    );
    expect(filters.hide_completed).toBeUndefined();
    expect(filters.unternehmen_id).toBe('u1');
    expect(filters.art_der_kampagne).toEqual(['UGC Paid']);
  });

  it('lässt hide_completed weg wenn Switch an ist', () => {
    setShowCompleted(true);
    expect(buildRpcFilters({})).toEqual({});
  });
});

describe('loadKampagnenWithRelations – RPC payload', () => {
  beforeEach(() => {
    setShowCompleted(false);
    modularFilterSystem.getFilters.mockReturnValue({});
    window.supabase = {
      rpc: vi.fn(async () => ({ data: { rows: [], total_count: 0 }, error: null })),
      from: vi.fn(() => ({
        select: vi.fn(async () => ({ data: [], error: null }))
      }))
    };
  });

  it('schickt hide_completed ohne Suche', async () => {
    await loadKampagnenWithRelations(1, 25, { searchQuery: '' });
    expect(window.supabase.rpc).toHaveBeenCalledWith('get_kampagnen_list', {
      p_page: 1,
      p_limit: 25,
      p_search: null,
      p_filters: { hide_completed: true }
    });
  });

  it('lässt hide_completed bei Suche weg', async () => {
    await loadKampagnenWithRelations(1, 25, { searchQuery: 'Telekom' });
    const payload = window.supabase.rpc.mock.calls[0][1];
    expect(payload.p_search).toBe('Telekom');
    expect(payload.p_filters.hide_completed).toBeUndefined();
  });
});

describe('KampagneFilterConfig – alter Completed-Filter weg', () => {
  it('enthält keinen is_completed-Filter und kein completed_this_month-Preset', () => {
    expect(KAMPAGNE_FILTERS.some((f) => f.id === 'is_completed')).toBe(false);
    expect(KAMPAGNE_FILTER_PRESETS.some((p) => p.id === 'completed_this_month')).toBe(false);
  });
});

describe('KampagneList toolbar', () => {
  beforeEach(() => {
    setShowCompleted(false);
    window.isKunde = () => false;
    window.isMitarbeiter = () => false;
    window.isAdmin = () => true;
    window.canBulkDelete = () => false;
    window.currentUser = { permissions: { kampagne: { can_edit: true } } };
    window.validatorSystem = { sanitizeHtml: (s) => s, sanitizeUrl: (s) => s };
  });

  it('rendert Plus-Menü mit Toggle und Filter für Interne', () => {
    const html = renderPageHtml({ currentView: 'list', searchQuery: '' });
    expect(html).toContain('btn-kampagne-list-toolbar-menu');
    expect(html).toContain('kampagne-show-completed');
    expect(html).toContain('btn-kampagne-list-filter');
    expect(html).toContain('Abgeschlossene anzeigen');
  });

  it('lässt den Filter-Eintrag für Kunden weg', () => {
    window.isKunde = () => true;
    const html = renderKampagneListToolbarMenu({ isKunde: true, showCompleted: false });
    expect(html).toContain('kampagne-show-completed');
    expect(html).not.toContain('btn-kampagne-list-filter');
  });
});
