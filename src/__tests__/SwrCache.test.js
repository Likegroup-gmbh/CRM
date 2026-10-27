import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

import { swrKey, swrGet, swrSet, swrEqual, swrClear } from '../core/list/swrCache.js';
import { loadKampagnenWithRelations } from '../modules/kampagne/KampagneListDataLoader.js';
import { setShowCompleted } from '../modules/kampagne/kampagneListPrefs.js';

describe('swrCache', () => {
  beforeEach(() => {
    swrClear();
    window.currentUser = { id: 'u1' };
  });
  afterEach(() => {
    vi.useRealTimers();
    window.currentUser = null;
  });

  it('cached nichts ohne eingeloggten User', () => {
    window.currentUser = null;
    expect(swrKey(['a'])).toBeNull();
    swrSet(null, { x: 1 });
    expect(swrGet(null)).toBeNull();
  });

  it('trennt Eintraege pro User', () => {
    const k1 = swrKey(['liste', 1]);
    swrSet(k1, { n: 1 });
    window.currentUser = { id: 'u2' };
    expect(swrGet(swrKey(['liste', 1]))).toBeNull();
    window.currentUser = { id: 'u1' };
    expect(swrGet(swrKey(['liste', 1]))).toEqual({ n: 1 });
  });

  it('liefert Kopien, Mutation des Ergebnisses veraendert den Cache nicht', () => {
    const key = swrKey(['liste']);
    swrSet(key, { rows: [{ id: 'a' }] });
    swrGet(key).rows.push({ id: 'b' });
    expect(swrGet(key).rows).toHaveLength(1);
  });

  it('verwirft Eintraege nach Ablauf der Maximalzeit', () => {
    vi.useFakeTimers();
    const key = swrKey(['liste']);
    swrSet(key, { n: 1 });
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(swrGet(key)).toBeNull();
  });

  it('begrenzt die Anzahl der Eintraege (aeltester fliegt zuerst raus)', () => {
    for (let i = 0; i < 45; i++) swrSet(swrKey(['k', i]), { i });
    expect(swrGet(swrKey(['k', 0]))).toBeNull();
    expect(swrGet(swrKey(['k', 44]))).toEqual({ i: 44 });
  });

  it('swrClear leert alles, swrEqual vergleicht strukturell', () => {
    swrSet(swrKey(['x']), { a: 1 });
    swrClear();
    expect(swrGet(swrKey(['x']))).toBeNull();
    expect(swrEqual({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
    expect(swrEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  });
});

describe('loadKampagnenWithRelations – Stale-while-revalidate', () => {
  beforeEach(() => {
    swrClear();
    setShowCompleted(false);
    window.currentUser = { id: 'u1' };
    window.supabase = {
      rpc: vi.fn(async () => ({
        data: { rows: [{ id: 'k1', kampagnenname: 'Neu', art_der_kampagne: [] }], total_count: 1, art_typen: [{ id: 'a1', name: 'UGC' }] },
        error: null
      })),
      from: vi.fn(() => ({ select: vi.fn(async () => ({ data: [], error: null })) }))
    };
  });
  afterEach(() => {
    window.currentUser = null;
  });

  it('meldet beim ersten Laden nichts aus dem Cache, danach sofort die gecachte Seite', async () => {
    const onCached = vi.fn();
    await loadKampagnenWithRelations(1, 25, { onCached });
    expect(onCached).not.toHaveBeenCalled();

    // Zweiter Aufruf: Cache-Treffer kommt, bevor der RPC antwortet.
    let release;
    window.supabase.rpc = vi.fn(() => new Promise((resolve) => {
      release = () => resolve({
        data: { rows: [{ id: 'k1', kampagnenname: 'Aktualisiert', art_der_kampagne: [] }], total_count: 1 },
        error: null
      });
    }));
    const order = [];
    onCached.mockImplementation((cached) => order.push(['cached', cached.data[0].kampagnenname]));
    const pending = loadKampagnenWithRelations(1, 25, { onCached });
    await Promise.resolve();
    expect(onCached).toHaveBeenCalledTimes(1);
    expect(order).toEqual([['cached', 'Neu']]);

    release();
    const fresh = await pending;
    expect(fresh.data[0].kampagnenname).toBe('Aktualisiert');
    expect(onCached.mock.calls[0][0].kampagneArtMap.get('a1')).toBe('UGC');
  });

  it('trennt Cache nach Seite und Suche', async () => {
    await loadKampagnenWithRelations(1, 25, { searchQuery: 'a' });
    const onCached = vi.fn();
    await loadKampagnenWithRelations(2, 25, { searchQuery: 'a', onCached });
    await loadKampagnenWithRelations(1, 25, { searchQuery: 'b', onCached });
    expect(onCached).not.toHaveBeenCalled();
  });

  it('ein Fehler im Cache-Callback bricht das Laden nicht ab', async () => {
    await loadKampagnenWithRelations(1, 25);
    const result = await loadKampagnenWithRelations(1, 25, {
      onCached: () => { throw new Error('render kaputt'); }
    });
    expect(result.count).toBe(1);
  });
});
