import { describe, it, expect, vi } from 'vitest';
import { fetchAllRows } from '../core/fetchAllRows.js';

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
