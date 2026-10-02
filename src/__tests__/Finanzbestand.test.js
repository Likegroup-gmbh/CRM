import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadFinanzbestand,
  invalidateFinanzbestand,
  prefetchFinanzbestand,
  PREFETCH_MAX_ALTER_MS,
} from '../core/budget/finanzbestand.js';
import {
  INVESTOR_HINT_KEY,
  startFinanzbestandPrefetch,
  startHoverPrefetch,
  wantsFinanzbestandPrefetch,
} from '../core/budget/finanzbestandBoot.js';

// Finanzbestand: gemeinsamer Load der Admin-Finanzseiten. Die Pages duerfen
// denselben Bestand teilen, ohne ihn doppelt zu scannen — und der Cache
// muss zwischen den Tests weg, sonst leckt er in die naechste Spec.

function createMockSupabase({
  auftraege = [],
  berichtsstaende = [],
  berichtsstandError = null,
  rpc = null,
} = {}) {
  const calls = [];
  const client = {
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
  if (rpc) client.rpc = rpc;
  return client;
}

const RPC_BUNDLE = {
  auftraege: [
    { id: 'a1', is_draft: false, unternehmen_id: 'u1' },
    { id: 'a2', is_draft: true, unternehmen_id: 'u1' },
  ],
  blocks: [{ id: 'b1', auftrag_id: 'a1' }],
  kampagnen: [],
  kooperationen: [],
  videos: [],
  rechnungen: [],
  creators: [{ id: 'c1', vorname: 'Ada' }],
  details: [],
  unternehmen: [{ id: 'u1', firmenname: 'Firma', ist_test: false }],
  teilrechnungen: [],
  berichtsstaende: [{ id: 's1', label: 'Stand' }],
};

describe('loadFinanzbestand', () => {
  beforeEach(() => {
    invalidateFinanzbestand();
  });

  afterEach(() => {
    invalidateFinanzbestand();
  });

  it('laedt bei jedem Aufruf live und cached keine Zahlen', async () => {
    const sb = createMockSupabase({ auftraege: [{ id: 'a1', is_draft: false }] });
    const first = await loadFinanzbestand(sb);
    const second = await loadFinanzbestand(sb);

    expect(second).not.toBe(first);
    expect(first.auftraege).toEqual([{ id: 'a1', is_draft: false }]);
    expect(sb.calls.filter(([t]) => t === 'auftrag')).toHaveLength(2);
  });

  it('traegt den Ladezeitpunkt im Bestand', async () => {
    const vorher = Date.now();
    const bestand = await loadFinanzbestand(createMockSupabase());
    expect(bestand.geladenAm).toBeGreaterThanOrEqual(vorher);
    expect(bestand.geladenAm).toBeLessThanOrEqual(Date.now());
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

  it('nimmt den Bestand aus dem RPC und scannt die Tabellen nicht', async () => {
    const rpc = vi.fn(async () => ({ data: RPC_BUNDLE, error: null }));
    const sb = createMockSupabase({ rpc });
    const bestand = await loadFinanzbestand(sb);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('stakeholder_finanzbestand');
    expect(sb.from).not.toHaveBeenCalled();
    expect(bestand.auftraege.map(a => a.id)).toEqual(['a1']);
    expect(bestand.blocks).toEqual(RPC_BUNDLE.blocks);
    expect(bestand.creators).toEqual(RPC_BUNDLE.creators);
    expect(bestand.berichtsstaende).toEqual(RPC_BUNDLE.berichtsstaende);
  });

  it('faellt auf den Tabellen-Scan zurueck, wenn die Funktion fehlt', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function stakeholder_finanzbestand' },
    }));
    const sb = createMockSupabase({
      auftraege: [{ id: 'a1', is_draft: false }],
      rpc,
    });
    const bestand = await loadFinanzbestand(sb);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(bestand.auftraege).toEqual([{ id: 'a1', is_draft: false }]);
    expect(sb.calls.filter(([t]) => t === 'auftrag')).toHaveLength(1);
    expect(sb.calls.map(([t]) => t)).toEqual(expect.arrayContaining([
      'auftrag', 'kooperation_videos', 'rechnung',
    ]));
  });

  describe('Prefetch', () => {
    const rpcOk = () => vi.fn(async () => ({ data: RPC_BUNDLE, error: null }));

    afterEach(() => {
      vi.useRealTimers();
    });

    it('uebernimmt einen frischen Prefetch genau einmal', async () => {
      const rpc = rpcOk();
      const sb = createMockSupabase({ rpc });

      prefetchFinanzbestand(sb);
      const first = await loadFinanzbestand(sb);
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(first.auftraege.map(a => a.id)).toEqual(['a1']);

      await loadFinanzbestand(sb);
      expect(rpc).toHaveBeenCalledTimes(2);
    });

    it('teilt den uebernommenen Prefetch mit parallelen Callern', async () => {
      const rpc = rpcOk();
      const sb = createMockSupabase({ rpc });

      prefetchFinanzbestand(sb);
      const [a, b] = await Promise.all([loadFinanzbestand(sb), loadFinanzbestand(sb)]);
      expect(a).toBe(b);
      expect(rpc).toHaveBeenCalledTimes(1);
    });

    it('verwirft einen Prefetch, der aelter als das Limit ist', async () => {
      vi.useFakeTimers();
      const rpc = rpcOk();
      const sb = createMockSupabase({ rpc });

      prefetchFinanzbestand(sb);
      await vi.advanceTimersByTimeAsync(PREFETCH_MAX_ALTER_MS + 1);
      await loadFinanzbestand(sb);

      expect(rpc).toHaveBeenCalledTimes(2);
    });

    it('schluckt einen Prefetch-Fehler und laedt dann selbst', async () => {
      const rpc = vi.fn()
        .mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'forbidden' } })
        .mockResolvedValueOnce({ data: RPC_BUNDLE, error: null });
      const sb = createMockSupabase({ rpc });

      prefetchFinanzbestand(sb);
      const bestand = await loadFinanzbestand(sb);

      expect(rpc).toHaveBeenCalledTimes(2);
      expect(bestand.auftraege.map(a => a.id)).toEqual(['a1']);
    });

    it('invalidate verwirft den Prefetch', async () => {
      const rpc = rpcOk();
      const sb = createMockSupabase({ rpc });

      prefetchFinanzbestand(sb);
      invalidateFinanzbestand();
      await loadFinanzbestand(sb);

      expect(rpc).toHaveBeenCalledTimes(2);
    });

    it('startet keinen zweiten Prefetch neben einem frischen', () => {
      const rpc = rpcOk();
      const sb = createMockSupabase({ rpc });

      prefetchFinanzbestand(sb);
      prefetchFinanzbestand(sb);

      expect(rpc).toHaveBeenCalledTimes(1);
    });
  });

  describe('Boot-Entscheidung', () => {
    it('prefetcht auf Dashboard- und Datenqualitaets-Routen', () => {
      ['/admin', '/admin/', '/stakeholder', '/admin/dashboard', '/admin/stakeholder', '/admin/datenqualitaet']
        .forEach((pfad) => expect(wantsFinanzbestandPrefetch(pfad, null)).toBe(true));
    });

    it('prefetcht nicht auf anderen Routen', () => {
      ['/auftrag/123', '/admin/auftrag', '/kampagne', '/creator'].forEach((pfad) => {
        expect(wantsFinanzbestandPrefetch(pfad, '1')).toBe(false);
      });
    });

    it('prefetcht am Root nur mit Investor-Hint', () => {
      expect(wantsFinanzbestandPrefetch('/', '1')).toBe(true);
      expect(wantsFinanzbestandPrefetch('/dashboard', '1')).toBe(true);
      expect(wantsFinanzbestandPrefetch('/', '0')).toBe(false);
      expect(wantsFinanzbestandPrefetch('/', null)).toBe(false);
    });

    it('liest den Hint aus dem Storage und startet den Prefetch (Datenqualitaet: Rohzeilen)', () => {
      const rpc = vi.fn(async () => ({ data: RPC_BUNDLE, error: null }));
      const sb = createMockSupabase({ rpc });
      const storage = { getItem: vi.fn(() => '1') };

      expect(startFinanzbestandPrefetch(sb, '/admin/datenqualitaet', storage)).toBe(true);
      expect(storage.getItem).toHaveBeenCalledWith(INVESTOR_HINT_KEY);
      expect(rpc).toHaveBeenCalledTimes(1);
    });

    it('startet nichts ohne Treffer', () => {
      const rpc = vi.fn(async () => ({ data: RPC_BUNDLE, error: null }));
      const sb = createMockSupabase({ rpc });

      expect(startFinanzbestandPrefetch(sb, '/', { getItem: () => null })).toBe(false);
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  describe('Hover-Prefetch', () => {
    const rpcOk = () => vi.fn(async () => ({ data: RPC_BUNDLE, error: null }));

    it('startet auf Dashboard-Route mit Accounting-Zugang und wird einmal uebernommen', async () => {
      const rpc = rpcOk();
      const sb = createMockSupabase({ rpc });

      expect(startHoverPrefetch(sb, '/admin/datenqualitaet?x=1', true)).toBe(true);
      await loadFinanzbestand(sb);
      expect(rpc).toHaveBeenCalledTimes(1);

      await loadFinanzbestand(sb);
      expect(rpc).toHaveBeenCalledTimes(2);
    });

    it('startet nicht ohne Accounting-Zugang und nicht auf anderen Routen', () => {
      const rpc = rpcOk();
      const sb = createMockSupabase({ rpc });

      expect(startHoverPrefetch(sb, '/admin', false)).toBe(false);
      expect(startHoverPrefetch(sb, '/admin/auftrag', true)).toBe(false);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('startet nicht neben einem laufenden Load', async () => {
      const rpc = rpcOk();
      const sb = createMockSupabase({ rpc });

      const lauf = loadFinanzbestand(sb);
      startHoverPrefetch(sb, '/admin/datenqualitaet', true);
      await lauf;

      expect(rpc).toHaveBeenCalledTimes(1);
    });
  });

  it('wirft einen RPC-Fehler, der nicht "Funktion fehlt" ist', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: '42501', message: 'forbidden' },
    }));
    const sb = createMockSupabase({ rpc });
    await expect(loadFinanzbestand(sb)).rejects.toMatchObject({ code: '42501' });
    expect(sb.from).not.toHaveBeenCalled();
  });
});
