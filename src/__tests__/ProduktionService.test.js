import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyProduktionVerbrauch,
  canDeleteLinie,
  canDeleteProduktion,
  createProduktion,
  deleteLinieInhalt,
  deleteProduktion,
  linienFromBriefings,
  listAllProduktionen,
  nextProduktionNummer,
  scopeByLinie,
  sumBudgetByProduktion,
  withLinien
} from '../modules/produktion/ProduktionService.js';

function countQuery(counts) {
  return (table) => {
    const state = { filters: {} };
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((col, val) => { state.filters[col] = val; return query; }),
      then: (resolve, reject) => Promise.resolve({
        count: counts[`${table}.${Object.keys(state.filters)[0]}`] ?? 0,
        error: null
      }).then(resolve, reject)
    };
    return query;
  };
}

describe('Linien aus Briefings', () => {
  const briefings = [
    { id: 'b2', aktivierung_name: 'Winter', is_draft: false, created_at: '2026-02-01' },
    { id: 'b1', aktivierung_name: 'Sommer', is_draft: true, created_at: '2026-01-01' }
  ];

  it('sortiert die Linien nach Anlage und markiert Entwürfe', () => {
    expect(linienFromBriefings(briefings).map(l => [l.id, l.name, l.is_draft]))
      .toEqual([['b1', 'Sommer', true], ['b2', 'Winter', false]]);
  });

  it('nimmt als Haupt-Briefing die erste finalisierte Linie, sonst die erste', () => {
    expect(withLinien({ id: 'p1', briefings }).briefing.id).toBe('b2');
    expect(withLinien({ id: 'p1', briefings: [briefings[1]] }).briefing.id).toBe('b1');
    expect(withLinien({ id: 'p1', briefings: [] }).briefing).toBeNull();
  });

  it('scopeByLinie grenzt nur mit Linie ein', () => {
    const query = { eq: vi.fn(() => 'scoped') };
    expect(scopeByLinie(query, null)).toBe(query);
    expect(scopeByLinie(query, 'b1')).toBe('scoped');
    expect(query.eq).toHaveBeenCalledWith('briefing_id', 'b1');
  });
});

describe('nextProduktionNummer', () => {
  it('zählt über die höchste Nummer und die Anzahl hinaus', () => {
    expect(nextProduktionNummer([])).toBe(1);
    expect(nextProduktionNummer(['Serum – Produktion 1', 'Serum – Produktion 2'])).toBe(3);
    expect(nextProduktionNummer(['Serum Sommer', 'Serum – Produktion 4'])).toBe(5);
    expect(nextProduktionNummer(['A', 'B', 'C'])).toBe(4);
  });
});

describe('createProduktion', () => {
  it('legt eine Produktion mit der nächsten Nummer an, ohne Budget', async () => {
    const insert = vi.fn(() => ({
      select: () => ({ single: () => Promise.resolve({ data: { id: 'neu', name: 'x' }, error: null }) })
    }));
    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'kampagne') {
          return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { kampagnenname: 'Serum' }, error: null }) }) }) };
        }
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [{ name: 'Serum – Produktion 1' }], error: null }) }),
          insert
        };
      })
    };

    const row = await createProduktion({ kampagneId: 'k1' });

    expect(row.id).toBe('neu');
    const payload = insert.mock.calls[0][0];
    expect(payload.kampagne_id).toBe('k1');
    expect(payload.name).toMatch(/Produktion 2$/);
    expect(payload).not.toHaveProperty('budget');
  });

  it('verlangt eine Kampagne', async () => {
    window.supabase = { from: vi.fn() };
    await expect(createProduktion({})).rejects.toThrow('Kampagne fehlt');
  });
});

describe('Lösch-Gates', () => {
  it('sperrt eine Linie mit Kooperationen', async () => {
    window.supabase = { from: vi.fn(countQuery({ 'kooperationen.briefing_id': 2 })) };
    const gate = await canDeleteLinie('b1');
    expect(gate.ok).toBe(false);
    expect(gate.reason).toMatch(/Kooperationen/);
    await expect(deleteLinieInhalt('b1')).rejects.toThrow(/Kooperationen/);
  });

  it('löscht Skripte, Konzept und Casting einer Linie ohne Kooperationen', async () => {
    const deleted = [];
    const base = countQuery({});
    window.supabase = {
      from: vi.fn((table) => {
        const query = base(table);
        query.delete = vi.fn(() => ({
          eq: vi.fn((col, val) => { deleted.push([table, col, val]); return Promise.resolve({ error: null }); })
        }));
        return query;
      })
    };

    await deleteLinieInhalt('b1');

    expect(deleted).toEqual([
      ['skripte', 'briefing_id', 'b1'],
      ['strategie', 'briefing_id', 'b1'],
      ['creator_auswahl', 'briefing_id', 'b1']
    ]);
  });

  it('sperrt eine Produktion mit Briefing (auch Entwurf)', async () => {
    window.supabase = { from: vi.fn(countQuery({ 'campaign_briefings.produktion_id': 1 })) };
    const gate = await canDeleteProduktion('p1');
    expect(gate.ok).toBe(false);
    expect(gate.reason).toMatch(/Briefings/);
  });

  it('sperrt eine Produktion mit Kooperationen', async () => {
    window.supabase = { from: vi.fn(countQuery({ 'kooperationen.produktion_id': 1 })) };
    expect((await canDeleteProduktion('p1')).ok).toBe(false);
  });

  it('löscht eine leere Produktion', async () => {
    const del = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));
    const base = countQuery({});
    window.supabase = { from: vi.fn((table) => ({ ...base(table), delete: del })) };
    expect((await canDeleteProduktion('p1')).ok).toBe(true);
    await deleteProduktion('p1');
    expect(del).toHaveBeenCalled();
  });

  it('löscht eine Produktion mit Linien nicht', async () => {
    window.supabase = { from: vi.fn(countQuery({ 'campaign_briefings.produktion_id': 2 })) };
    await expect(deleteProduktion('p1')).rejects.toThrow(/Briefings/);
  });
});

describe('sumBudgetByProduktion', () => {
  it('summiert den Verkaufspreis der Videos je Produktion', () => {
    const sums = sumBudgetByProduktion(
      [
        { id: 'k1', produktion_id: 'p1' },
        { id: 'k2', produktion_id: 'p1' },
        { id: 'k3', produktion_id: 'p2' }
      ],
      [
        { kooperation_id: 'k1', verkaufspreis_netto: '1000' },
        { kooperation_id: 'k2', verkaufspreis_netto: 250.5 },
        { kooperation_id: 'k3', verkaufspreis_netto: null }
      ]
    );

    expect(sums.get('p1')).toBe(1250.5);
    expect(sums.get('p2')).toBe(0);
  });
});

function produktionQuery(rows) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => Promise.resolve({ data: rows, error: null, count: rows.length }))
  };
  return query;
}

describe('listAllProduktionen', () => {
  const rows = [
    { id: 'p1', name: 'Alt', created_at: '2026-01-01' },
    { id: 'p2', name: 'Neu', created_at: '2026-02-01' }
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('liest die Summe aus produktion_verbrauch und nicht aus den Video-Zeilen', async () => {
    let releaseBudget;
    const budgetGate = new Promise(resolve => { releaseBudget = resolve; });
    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'produktion') return produktionQuery(rows);
        if (table === 'produktion_verbrauch') {
          return {
            select: vi.fn(() => budgetGate.then(() => ({
              data: [{ produktion_id: 'p2', budget_used: '10.5' }],
              error: null
            })))
          };
        }
        throw new Error(`unerwartete Tabelle ${table}`);
      })
    };

    const seen = [];
    const pending = listAllProduktionen({
      onRows: (next) => seen.push(next.map(row => row.budgetUsed))
    });

    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual([undefined, undefined]);
    expect(window.supabase.from).not.toHaveBeenCalledWith('kooperation_videos');
    expect(window.supabase.from).not.toHaveBeenCalledWith('kooperationen');
    expect(window.supabase.from).not.toHaveBeenCalledWith('personas');

    releaseBudget();
    const result = await pending;

    expect(result.map(row => row.id)).toEqual(['p2', 'p1']);
    expect(result.map(row => row.budgetUsed)).toEqual([10.5, 0]);
  });

  it('liefert die Zeilen auch ohne Summe, wenn die View fehlschlägt', async () => {
    const error = new Error('view fehlt');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'produktion') return produktionQuery(rows);
        return { select: vi.fn(() => Promise.resolve({ data: null, error })) };
      })
    };

    const seen = [];
    const result = await listAllProduktionen({ onRows: (next) => seen.push(next) });

    expect(seen).toHaveLength(1);
    expect(seen[0].every(row => row.budgetUsed == null)).toBe(true);
    expect(result).toBe(seen[0]);
    expect(console.error).toHaveBeenCalledWith('Produktion-Verbrauch nicht geladen', error);
  });

  it('hängt Personas aus persona_ids an das Briefing', async () => {
    const withBriefing = [{
      id: 'p1',
      name: 'Senf',
      created_at: '2026-02-01',
      briefings: [{ id: 'b1', aktivierung_name: 'Brief', persona_ids: ['persona-1', 'persona-2'] }]
    }];
    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'produktion') return produktionQuery(withBriefing);
        if (table === 'personas') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve({
                data: [{ id: 'persona-1', name: 'Anna' }],
                error: null
              }))
            }))
          };
        }
        if (table === 'produktion_verbrauch') {
          return { select: vi.fn(() => Promise.resolve({ data: [], error: null })) };
        }
        throw new Error(`unerwartete Tabelle ${table}`);
      })
    };

    const result = await listAllProduktionen();

    expect(window.supabase.from).toHaveBeenCalledWith('personas');
    expect(result[0].briefings[0].verknuepfte_personas).toEqual([{ id: 'persona-1', name: 'Anna' }]);
  });
});

describe('applyProduktionVerbrauch', () => {
  it('schreibt die Summe auf die passende Produktion', () => {
    const next = applyProduktionVerbrauch(
      [{ id: 'p1' }, { id: 'p2' }],
      [{ produktion_id: 'p1', budget_used: '4' }]
    );
    expect(next.map(row => row.budgetUsed)).toEqual([4, 0]);
  });
});
