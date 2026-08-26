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

import { loadKampagnenWithRelations } from '../modules/kampagne/KampagneListDataLoader.js';
import { setShowCompleted } from '../modules/kampagne/kampagneListPrefs.js';

describe('KampagneList – Server-Pagination via RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setShowCompleted(false);
    window.supabase = {
      rpc: vi.fn(async () => ({
        data: { rows: [{ id: 'k1', kampagnenname: 'Test', art_der_kampagne: [] }], total_count: 42 },
        error: null
      })),
      from: vi.fn(() => ({
        select: vi.fn(async () => ({ data: [], error: null }))
      }))
    };
  });

  it('ruft get_kampagnen_list mit page/limit auf', async () => {
    await loadKampagnenWithRelations(2, 25, { searchQuery: '' });
    expect(window.supabase.rpc).toHaveBeenCalledWith('get_kampagnen_list', expect.objectContaining({
      p_page: 2,
      p_limit: 25
    }));
  });

  it('gibt { data, count } zurück', async () => {
    const result = await loadKampagnenWithRelations(1, 25);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('count');
    expect(result.count).toBe(42);
    expect(result.data).toHaveLength(1);
  });
});
