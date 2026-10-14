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
import { getHideCompleted, setHideCompleted, shouldHideCompleted } from '../modules/kampagne/kampagneListPrefs.js';
import { buildRpcFilters, loadKampagnenWithRelations } from '../modules/kampagne/KampagneListDataLoader.js';
import { KAMPAGNE_FILTERS, KAMPAGNE_FILTER_PRESETS } from '../modules/kampagne/filters/KampagneFilterConfig.js';
import { renderPageHtml, renderKampagneListToolbarMenu, updateTable } from '../modules/kampagne/KampagneListRenderers.js';

describe('kampagneListPrefs', () => {
  beforeEach(() => {
    window.currentUser = { id: 'prefs-user' };
    localStorage.removeItem('kampagne-hide-completed:prefs-user');
    localStorage.removeItem('kampagne-hide-completed:other-user');
    setHideCompleted(false);
  });

  it('zeigt default alle, verbergen gilt nur ohne Suche', () => {
    expect(shouldHideCompleted('')).toBe(false);
    expect(shouldHideCompleted('  ')).toBe(false);
    setHideCompleted(true);
    expect(getHideCompleted()).toBe(true);
    expect(shouldHideCompleted('')).toBe(true);
    expect(shouldHideCompleted('Telekom')).toBe(false);
  });

  it('merkt die Wahl pro Nutzer in diesem Browser', () => {
    setHideCompleted(true);
    window.currentUser = { id: 'other-user' };
    expect(getHideCompleted()).toBe(false);
    window.currentUser = { id: 'prefs-user' };
    expect(getHideCompleted()).toBe(true);
  });
});

describe('buildRpcFilters – hide_completed', () => {
  beforeEach(() => {
    window.currentUser = { id: 'prefs-user' };
    setHideCompleted(false);
  });

  it('lässt hide_completed weg, solange der Schalter aus ist', () => {
    expect(buildRpcFilters({})).toEqual({});
  });

  it('setzt hide_completed wenn der Schalter an ist und die Suche leer', () => {
    setHideCompleted(true);
    expect(buildRpcFilters({})).toEqual({ hide_completed: true });
  });

  it('lässt hide_completed weg bei Suche, andere Filter bleiben', () => {
    setHideCompleted(true);
    const filters = buildRpcFilters(
      { unternehmen_id: 'u1', art_der_kampagne: ['UGC Paid'] },
      { searchQuery: 'Telekom' }
    );
    expect(filters.hide_completed).toBeUndefined();
    expect(filters.unternehmen_id).toBe('u1');
    expect(filters.art_der_kampagne).toEqual(['UGC Paid']);
  });
});

describe('loadKampagnenWithRelations – RPC payload', () => {
  beforeEach(() => {
    window.currentUser = { id: 'prefs-user' };
    setHideCompleted(true);
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
    window.currentUser = { id: 'prefs-user', rolle: 'admin', permissions: { kampagne: { can_edit: true } } };
    setHideCompleted(false);
    window.isKunde = () => false;
    window.isMitarbeiter = () => false;
    window.isAdmin = () => true;
    window.canBulkDelete = () => false;
    window.validatorSystem = { sanitizeHtml: (s) => s, sanitizeUrl: (s) => s };
  });

  it('rendert Plus-Menü mit Verbergen-Schalter und Filter für Interne', () => {
    const html = renderPageHtml({ currentView: 'list', searchQuery: '' });
    expect(html).toContain('btn-kampagne-list-toolbar-menu');
    expect(html).toContain('kampagne-hide-completed');
    expect(html).not.toContain('kampagne-hide-completed" checked');
    expect(html).toContain('btn-kampagne-list-filter');
    expect(html).toContain('Abgeschlossene verbergen');
  });

  it('lässt den Filter-Eintrag für Kunden weg', () => {
    window.isKunde = () => true;
    const html = renderKampagneListToolbarMenu({ isKunde: true, hideCompleted: false });
    expect(html).toContain('kampagne-hide-completed');
    expect(html).not.toContain('btn-kampagne-list-filter');
  });

  it('markiert abgeschlossene Zeilen und lässt den Abschluss-Eintrag weg', async () => {
    document.body.innerHTML = '<table><tbody id="kampagnen-table-body"><tr><td class="loading"></td></tr></tbody></table>';
    await updateTable([
      { id: 'open', kampagnenname: 'Offen', is_completed: false, creatoranzahl: 1, videoanzahl: 1 },
      { id: 'done', kampagnenname: 'Fertig', is_completed: true, creatoranzahl: 1, videoanzahl: 1 }
    ], { bindDragToScroll() {} });
    const done = document.querySelector('tr[data-id="done"]');
    const open = document.querySelector('tr[data-id="open"]');
    expect(done.classList.contains('kampagne-row--completed')).toBe(true);
    expect(open.classList.contains('kampagne-row--completed')).toBe(false);
    expect(open.innerHTML).toContain('Kampagne abschließen');
    expect(done.innerHTML).not.toContain('Kampagne abschließen');
  });
});
