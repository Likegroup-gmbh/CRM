import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../core/filters/ModularFilterSystem.js', () => ({
  modularFilterSystem: { getFilters: vi.fn(() => ({})), setFilterChangeCallback: vi.fn() }
}));
vi.mock('../../core/filters/FilterDropdown.js', () => ({ filterDropdown: {} }));
vi.mock('../../core/ActionsDropdown.js', () => ({ actionsDropdown: {} }));
vi.mock('../../core/actions/ActionBuilder.js', () => ({ actionBuilder: {} }));
vi.mock('../../core/components/AvatarBubbles.js', () => ({ avatarBubbles: {} }));
vi.mock('./KampagneCalendarView.js', () => ({ KampagneCalendarView: class {} }));
vi.mock('../../core/loaders/ParallelQueryHelper.js', () => ({ parallelLoad: vi.fn() }));
vi.mock('./filters/KampagneFilterLogic.js', () => ({
  KampagneFilterLogic: {
    buildSupabaseQuery: vi.fn((q) => q),
    applyVirtualFilters: vi.fn((data) => data)
  }
}));
vi.mock('../../core/TableAnimationHelper.js', () => ({ TableAnimationHelper: class {} }));
vi.mock('./KampagneUtils.js', () => ({
  KampagneUtils: { loadAllowedKampagneIds: vi.fn(async () => null) }
}));
vi.mock('../../core/components/SearchInput.js', () => ({ SearchInput: class {} }));
vi.mock('../../core/VideoDeleteHelper.js', () => ({ deleteDropboxCascade: vi.fn() }));

import { KampagneList } from '../modules/kampagne/KampagneList.js';

function createChainableQuery(result = { data: [], error: null, count: 0 }) {
  const tracker = { rangeCalled: false, rangeArgs: null, selectArgs: null };
  const mock = {
    _tracker: tracker,
    _result: result,
    select: vi.fn((...args) => { tracker.selectArgs = args; return mock; }),
    eq: vi.fn(() => mock),
    in: vi.fn(() => mock),
    order: vi.fn(() => mock),
    range: vi.fn((from, to) => { tracker.rangeCalled = true; tracker.rangeArgs = [from, to]; return mock; }),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => resolve(mock._result),
  };
  return mock;
}

describe('KampagneList – Server-Pagination', () => {
  let list;
  let kampagneQuery;

  beforeEach(() => {
    vi.clearAllMocks();
    window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne' } }));
    list = new KampagneList();
    window.currentUser = { id: 'user1', rolle: 'admin' };

    kampagneQuery = createChainableQuery({
      data: [{ id: 'k1', kampagnenname: 'Test', art_der_kampagne: [], status_ref: { name: 'Aktiv' } }],
      error: null,
      count: 42
    });

    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'kampagne') return kampagneQuery;
        if (table === 'v_kampagne_mitarbeiter_aggregated') {
          return createChainableQuery({ data: [], error: null });
        }
        return createChainableQuery({ data: [], error: null });
      })
    };

    window.dataService = {
      entities: { kampagne: { manyToMany: {} } },
      loadManyToManyRelations: vi.fn(async () => {})
    };
  });

  it('ruft .range(from, to) mit korrekten Werten auf (Seite 1, 25 pro Seite)', async () => {
    await list.loadKampagnenWithRelations(1, 25);

    expect(kampagneQuery._tracker.rangeCalled).toBe(true);
    expect(kampagneQuery._tracker.rangeArgs).toEqual([0, 24]);
  });

  it('berechnet Range korrekt für Seite 2', async () => {
    await list.loadKampagnenWithRelations(2, 25);

    expect(kampagneQuery._tracker.rangeArgs).toEqual([25, 49]);
  });

  it('nutzt { count: "exact" } im Select für Gesamtzahl', async () => {
    await list.loadKampagnenWithRelations(1, 25);

    const selectArgs = kampagneQuery._tracker.selectArgs;
    expect(selectArgs).toBeTruthy();
    expect(selectArgs[1]).toEqual({ count: 'exact' });
  });

  it('gibt { data, count } statt nur Array zurück', async () => {
    const result = await list.loadKampagnenWithRelations(1, 25);

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('count');
    expect(result.count).toBe(42);
  });

  it('enthält Seitennummer im Cache-Key', async () => {
    await list.loadKampagnenWithRelations(1, 25);
    await list.loadKampagnenWithRelations(2, 25);

    expect(window.supabase.from).toHaveBeenCalledWith('kampagne');
    const kampagneCalls = window.supabase.from.mock.calls.filter(c => c[0] === 'kampagne');
    expect(kampagneCalls.length).toBe(2);
  });

  it('funktioniert mit allowedIds Permission-Filter + range', async () => {
    const KampagneUtilsMod = await import('../modules/kampagne/KampagneUtils.js');
    vi.spyOn(KampagneUtilsMod.KampagneUtils, 'loadAllowedKampagneIds').mockResolvedValue(['k1', 'k2', 'k3']);

    await list.loadKampagnenWithRelations(1, 25);

    expect(kampagneQuery.in).toHaveBeenCalledWith('id', ['k1', 'k2', 'k3']);
    expect(kampagneQuery._tracker.rangeCalled).toBe(true);
  });
});
