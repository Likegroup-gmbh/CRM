import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadFinanzbestand, invalidateFinanzbestand } from '../core/budget/finanzbestand.js';

// Finanzbestand: gemeinsamer Load der Admin-Finanzseiten. Die Pages duerfen
// denselben Bestand teilen, ohne ihn doppelt zu scannen — und der Cache
// muss zwischen den Tests weg, sonst leckt er in die naechste Spec.

function createMockSupabase({ auftraege = [], berichtsstaende = [], berichtsstandError = null } = {}) {
  const calls = [];
  return {
    calls,
    from: vi.fn((table) => {
      if (table === 'berichtsstand') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve(
              berichtsstandError
                ? { data: null, error: berichtsstandError }
                : { data: berichtsstaende, error: null }
            ))
          }))
        };
      }
      return {
        select: vi.fn((select) => {
          calls.push([table, select]);
          return {
            order: vi.fn(() => ({
              range: vi.fn(() => Promise.resolve({
                data: table === 'auftrag' ? auftraege : [],
                error: null
              }))
            }))
          };
        })
      };
    })
  };
}

describe('loadFinanzbestand', () => {
  beforeEach(() => {
    invalidateFinanzbestand();
  });

  afterEach(() => {
    invalidateFinanzbestand();
  });

  it('laedt den Bestand einmal und gibt ihn an den zweiten Caller weiter', async () => {
    const sb = createMockSupabase({ auftraege: [{ id: 'a1', is_draft: false }] });
    const first = await loadFinanzbestand(sb);
    const second = await loadFinanzbestand(sb);

    expect(second).toBe(first);
    expect(first.auftraege).toEqual([{ id: 'a1', is_draft: false }]);
    expect(sb.calls.filter(([t]) => t === 'auftrag')).toHaveLength(1);
  });

  it('filtert Entwuerfe aus den Auftraegen', async () => {
    const sb = createMockSupabase({
      auftraege: [
        { id: 'a1', is_draft: false },
        { id: 'a2', is_draft: true },
      ]
    });
    const bestand = await loadFinanzbestand(sb);
    expect(bestand.auftraege.map(a => a.id)).toEqual(['a1']);
  });

  it('wartet auf denselben Load statt ihn doppelt zu starten', async () => {
    const sb = createMockSupabase();
    const [a, b] = await Promise.all([loadFinanzbestand(sb), loadFinanzbestand(sb)]);
    expect(a).toBe(b);
    expect(sb.calls.filter(([t]) => t === 'auftrag')).toHaveLength(1);
  });

  it('laedt nach invalidate frisch', async () => {
    const sb = createMockSupabase({ auftraege: [{ id: 'a1', is_draft: false }] });
    await loadFinanzbestand(sb);
    invalidateFinanzbestand();
    await loadFinanzbestand(sb);
    expect(sb.calls.filter(([t]) => t === 'auftrag')).toHaveLength(2);
  });

  it('schluckt einen Berichtsstand-Fehler und liefert den Rest', async () => {
    const sb = createMockSupabase({
      auftraege: [{ id: 'a1', is_draft: false }],
      berichtsstandError: new Error('boom'),
    });
    const bestand = await loadFinanzbestand(sb);
    expect(bestand.auftraege).toHaveLength(1);
    expect(bestand.berichtsstaende).toEqual([]);
  });
});
