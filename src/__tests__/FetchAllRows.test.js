import { describe, it, expect, vi } from 'vitest';
import { fetchAllRows, fetchAllRowsWave } from '../core/fetchAllRows.js';

// Die Stakeholder Uebersicht lud frueher jede Tabelle mit einer einzigen
// Anfrage und verlor still alles ueber dem PostgREST-Limit (1.000 Zeilen).
// kooperation_videos hat ueber 2.500 Zeilen. Seit der parallelen Pagination
// steht der Gesamt-Count an der ersten Antwort; die Restseiten laufen ohne
// Wasserfall.

function mockSupabase(pages) {
  const calls = [];
  const total = pages.reduce((s, p) => s + p.length, 0);
  const query = {
    order() { return this; },
    range(from, to) {
      calls.push([from, to]);
      const pageIdx = Math.floor(from / 1000);
      const data = pages[pageIdx] || [];
      return Promise.resolve({ data, error: null, count: total });
    },
  };
  return { from: vi.fn(() => ({ select: () => query })), calls };
}

describe('fetchAllRows', () => {
  it('laedt ueber die 1000-Zeilen-Grenze hinaus bis zur letzten Seite', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}` }));
    const rest = Array.from({ length: 535 }, (_, i) => ({ id: `b${i}` }));
    const sb = mockSupabase([full, rest]);

    const rows = await fetchAllRows(sb, 'kooperation_videos', 'id');

    expect(rows).toHaveLength(1535);
    expect(sb.calls).toEqual([[0, 999], [1000, 1999]]);
  });

  it('stoppt nach einer vollen einzigen Seite nicht zu frueh', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}` }));
    const sb = mockSupabase([full, []]);

    const rows = await fetchAllRows(sb, 'kooperationen', 'id');

    expect(rows).toHaveLength(1000);
    // Volle erste Seite, Count = 1000: keine weitere Seite noetig.
    expect(sb.calls).toHaveLength(1);
  });

  it('gibt leere Tabellen als leeres Array zurueck', async () => {
    const sb = mockSupabase([[]]);
    expect(await fetchAllRows(sb, 'auftrag', 'id')).toEqual([]);
  });

  it('wirft bei einem Supabase-Fehler statt Teildaten zu verwenden', async () => {
    const sb = {
      from: () => ({
        select: () => ({
          order() { return this; },
          range: () => Promise.resolve({ data: null, error: new Error('boom') }),
        }),
      }),
    };
    await expect(fetchAllRows(sb, 'auftrag', 'id')).rejects.toThrow('boom');
  });
});

// fetchAllRowsWave: grosse Tabellen ohne COUNT(*). Die ganze Welle startet
// sofort; eine volle letzte Seite holt die nächste Welle, eine kurze stoppt.

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

function waveSupabase(pages, { failPage = null } = {}) {
  const calls = [];
  const gates = [];
  const query = {
    order() { return this; },
    range(from, to) {
      calls.push([from, to]);
      const pageIdx = Math.floor(from / 1000);
      const gate = deferred();
      gates.push(gate);
      if (failPage === pageIdx) {
        gate.resolve({ data: null, error: new Error('boom') });
      } else {
        gate.resolve({ data: pages[pageIdx] || [], error: null });
      }
      return gate.promise;
    },
  };
  return { from: vi.fn(() => ({ select: () => query })), calls, gates };
}

describe('fetchAllRowsWave', () => {
  it('startet eine Welle von drei Seiten bevor die erste antwortet', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}` }));
    const rest = Array.from({ length: 500 }, (_, i) => ({ id: `c${i}` }));
    const calls = [];
    const gates = [];
    const query = {
      order() { return this; },
      range(from, to) {
        calls.push([from, to]);
        const gate = deferred();
        gates.push({ from, gate });
        return gate.promise;
      },
    };
    const sb = { from: vi.fn(() => ({ select: () => query })) };

    const pending = fetchAllRowsWave(sb, 'kooperation_videos', 'id');
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);

    const pages = { 0: full, 1000: full, 2000: rest };
    for (const { from, gate } of gates) {
      gate.resolve({ data: pages[from], error: null });
    }

    await expect(pending).resolves.toHaveLength(2500);
    expect(calls).toHaveLength(3);
  });

  it('stoppt nach einer kurzen ersten Seite ohne zweite Welle', async () => {
    const few = Array.from({ length: 50 }, (_, i) => ({ id: `a${i}` }));
    const sb = waveSupabase([few]);

    const rows = await fetchAllRowsWave(sb, 'kooperationen', 'id');

    expect(rows).toHaveLength(50);
    expect(sb.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('holt die naechste Welle, wenn die letzte Seite voll ist', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}` }));
    const tail = Array.from({ length: 100 }, (_, i) => ({ id: `d${i}` }));
    const sb = waveSupabase([full, full, full, tail]);

    const rows = await fetchAllRowsWave(sb, 'kooperation_videos', 'id');

    expect(rows).toHaveLength(3100);
    expect(sb.calls).toEqual([
      [0, 999], [1000, 1999], [2000, 2999],
      [3000, 3999], [4000, 4999], [5000, 5999],
    ]);
  });

  it('wirft bei einem Fehler auf Seite 2 statt Teildaten zu verwenden', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}` }));
    const sb = waveSupabase([full, full, full], { failPage: 1 });

    await expect(fetchAllRowsWave(sb, 'kooperation_videos', 'id')).rejects.toThrow('boom');
  });
});
