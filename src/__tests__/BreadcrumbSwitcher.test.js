import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KampagneUtils } from '../modules/kampagne/KampagneUtils.js';
import {
  SWITCHER_LIMIT,
  hasSwitcherConfig,
  shouldEnableSwitcher,
  loadSwitcherItems,
  escapeSwitcherQuery
} from '../core/breadcrumbSwitcher.js';

function createQuery({ data = [], error = null } = {}) {
  const calls = { tables: [], select: null, or: null, inCalls: [], order: null, limit: null, neq: [] };
  const result = { data, error };
  const chain = {
    select(...args) { calls.select = args; return chain; },
    or(...args) { calls.or = args; return chain; },
    in(...args) { calls.inCalls.push(args); return chain; },
    eq() { return chain; },
    neq(...args) { calls.neq.push(args); return chain; },
    order(...args) { calls.order = args; return chain; },
    limit(...args) { calls.limit = args; return chain; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
  };
  return {
    calls,
    supabase: {
      from: vi.fn((table) => {
        calls.tables.push(table);
        return chain;
      })
    }
  };
}

describe('breadcrumbSwitcher', () => {
  beforeEach(() => {
    window.currentUser = { id: 'admin-1', rolle: 'admin' };
  });

  afterEach(() => {
    window.currentUser = null;
    delete window.supabase;
    delete window.getAllowedUnternehmenIds;
    delete window.getAllowedMarkenIds;
    vi.restoreAllMocks();
  });

  it('hat Config für die v1-Entities, nicht für skripte/dashboard', () => {
    expect(hasSwitcherConfig('kampagne')).toBe(true);
    expect(hasSwitcherConfig('unternehmen')).toBe(true);
    expect(hasSwitcherConfig('briefing')).toBe(true);
    expect(hasSwitcherConfig('skripte')).toBe(false);
    expect(hasSwitcherConfig('dashboard')).toBe(false);
  });

  it('aktiviert den Switcher nur auf klassischen Detail-IDs mit can_view', () => {
    expect(shouldEnableSwitcher('kampagne', 'abc')).toBe(true);
    expect(shouldEnableSwitcher('kampagne')).toBe(false);
    expect(shouldEnableSwitcher('kampagne', 'new')).toBe(false);
    expect(shouldEnableSwitcher('kampagne', 'abc', { action: 'edit' })).toBe(false);
    expect(shouldEnableSwitcher('skripte', 'dna', { isChild: true })).toBe(false);
    expect(shouldEnableSwitcher('skripte', 'abc-uuid')).toBe(false);
  });

  it('deaktiviert den Switcher ohne can_view', () => {
    window.currentUser = null;
    expect(shouldEnableSwitcher('kampagne', 'abc')).toBe(false);
  });

  it('escapt ILIKE-Sonderzeichen', () => {
    expect(escapeSwitcherQuery('a%b_c,d')).toBe('a\\%b\\_cd');
  });

  it('lädt Admin-Kampagnen ungescoped, limit 25, Display-Name', async () => {
    const { supabase, calls } = createQuery({
      data: [
        { id: 'k1', kampagnenname: 'Auto-Name', eigener_name: 'Sommer 25' },
        { id: 'k2', kampagnenname: 'Winter', eigener_name: null }
      ]
    });
    window.supabase = supabase;

    const { items, error } = await loadSwitcherItems({ segment: 'kampagne' });

    expect(error).toBeNull();
    expect(calls.tables).toContain('kampagne');
    expect(calls.inCalls).toHaveLength(0);
    expect(calls.order).toEqual(['updated_at', { ascending: false }]);
    expect(calls.limit).toEqual([SWITCHER_LIMIT]);
    expect(items).toEqual([
      { id: 'k1', label: 'Sommer 25', route: '/kampagne/k1' },
      { id: 'k2', label: 'Winter', route: '/kampagne/k2' }
    ]);
  });

  it('filtert Mitarbeiter-Unternehmen über erlaubte IDs', async () => {
    window.currentUser = { id: 'm1', rolle: 'mitarbeiter' };
    window.getAllowedUnternehmenIds = vi.fn(async () => ['u1', 'u2']);
    const { supabase, calls } = createQuery({
      data: [{ id: 'u1', firmenname: 'Acme' }]
    });
    window.supabase = supabase;

    const { items } = await loadSwitcherItems({ segment: 'unternehmen' });

    expect(window.getAllowedUnternehmenIds).toHaveBeenCalled();
    expect(calls.inCalls).toContainEqual(['id', ['u1', 'u2']]);
    expect(items).toEqual([{ id: 'u1', label: 'Acme', route: '/unternehmen/u1' }]);
  });

  it('gibt leer zurück wenn Mitarbeiter-Scope leer ist', async () => {
    window.currentUser = { id: 'm1', rolle: 'mitarbeiter' };
    window.getAllowedUnternehmenIds = vi.fn(async () => []);
    const { supabase } = createQuery({ data: [{ id: 'u1', firmenname: 'Acme' }] });
    window.supabase = supabase;

    const { items } = await loadSwitcherItems({ segment: 'unternehmen' });
    expect(items).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('sucht serverseitig in den Listen-Feldern', async () => {
    const { supabase, calls } = createQuery({ data: [] });
    window.supabase = supabase;

    await loadSwitcherItems({ segment: 'kampagne', query: 'sommer' });

    expect(calls.or[0]).toContain('kampagnenname.ilike.%sommer%');
    expect(calls.or[0]).toContain('eigener_name.ilike.%sommer%');
  });

  it('filtert Kampagnen für Mitarbeiter über loadAllowedKampagneIds', async () => {
    window.currentUser = { id: 'm1', rolle: 'mitarbeiter' };
    vi.spyOn(KampagneUtils, 'loadAllowedKampagneIds').mockResolvedValue(['k9']);
    const { supabase, calls } = createQuery({
      data: [{ id: 'k9', kampagnenname: 'Nur Meine', eigener_name: null }]
    });
    window.supabase = supabase;

    const { items } = await loadSwitcherItems({ segment: 'kampagne' });

    expect(calls.inCalls).toContainEqual(['id', ['k9']]);
    expect(items[0].route).toBe('/kampagne/k9');
  });

  it('filtert Aufträge über unternehmen_id, nicht GlobalSearch-Sperre', async () => {
    window.currentUser = { id: 'm1', rolle: 'mitarbeiter', zugriffsrechte: { auftrag: { can_view: true } } };
    window.getAllowedUnternehmenIds = vi.fn(async () => ['u1']);
    const { supabase, calls } = createQuery({
      data: [{ id: 'a1', auftragsname: 'PO-1' }]
    });
    window.supabase = supabase;

    const { items } = await loadSwitcherItems({ segment: 'auftrag' });

    expect(calls.tables).toContain('auftrag');
    expect(calls.inCalls).toContainEqual(['unternehmen_id', ['u1']]);
    expect(items[0]).toEqual({ id: 'a1', label: 'PO-1', route: '/auftrag/a1' });
  });

  it('lädt Briefings aus campaign_briefings', async () => {
    const { supabase, calls } = createQuery({
      data: [{ id: 'b1', aktivierung_name: 'Launch' }]
    });
    window.supabase = supabase;

    const { items } = await loadSwitcherItems({ segment: 'briefing' });
    expect(calls.tables).toContain('campaign_briefings');
    expect(items[0]).toEqual({ id: 'b1', label: 'Launch', route: '/briefing/b1' });
  });

  it('schließt Kunden aus der Mitarbeiter-Liste aus', async () => {
    window.currentUser = { id: 'admin-1', rolle: 'admin' };
    const { supabase, calls } = createQuery({
      data: [{ id: 'p1', name: 'Pat' }]
    });
    window.supabase = supabase;

    await loadSwitcherItems({ segment: 'mitarbeiter' });
    expect(calls.tables).toContain('benutzer');
    expect(calls.neq).toContainEqual(['rolle', 'kunde']);
  });

  it('gibt leer zurück ohne can_view', async () => {
    window.currentUser = { id: 'm1', rolle: 'mitarbeiter' };
    const { supabase } = createQuery({ data: [{ id: 'a1', auftragsname: 'X' }] });
    window.supabase = supabase;

    const { items } = await loadSwitcherItems({ segment: 'auftrag' });
    expect(items).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
