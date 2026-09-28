import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyProduktionVerbrauch,
  createProduktionForBriefing,
  emptyProduktionId,
  listAllProduktionen,
  resolveProduktionLinks,
  sumBudgetByProduktion
} from '../modules/produktion/ProduktionService.js';

function chain(result) {
  const query = {
    update: vi.fn(() => query),
    insert: vi.fn(() => query),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result))
  };
  return query;
}

describe('createProduktionForBriefing', () => {
  beforeEach(() => {
    window.supabase = { from: vi.fn() };
  });

  it('aktualisiert eine bestehende Produktion statt eine zweite anzulegen', async () => {
    const query = chain({ data: { id: 'prod-1' }, error: null });
    window.supabase.from.mockReturnValue(query);

    const row = await createProduktionForBriefing({
      kampagneId: 'kamp-1',
      briefingId: 'brief-1',
      produktId: 'produkt-1',
      titel: 'Funky Safari Ketchup',
      produktionId: 'prod-1'
    });

    expect(row).toEqual({ id: 'prod-1' });
    expect(query.update).toHaveBeenCalledWith({
      briefing_id: 'brief-1',
      produkt_id: 'produkt-1',
      name: 'Funky Safari Ketchup'
    });
    expect(query.insert).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('id', 'prod-1');
    expect(query.eq).toHaveBeenCalledWith('kampagne_id', 'kamp-1');
  });

  it('legt eine neue Produktion an, wenn das Briefing noch frei ist', async () => {
    const lookup = chain({ data: null, error: null });
    const insert = chain({ data: { id: 'prod-neu' }, error: null });
    window.supabase.from
      .mockReturnValueOnce(lookup)
      .mockReturnValueOnce(insert);

    const row = await createProduktionForBriefing({
      kampagneId: 'kamp-1',
      briefingId: 'brief-2',
      produktId: 'produkt-2',
      titel: 'Neuer Süßer Senf 2.0'
    });

    expect(row).toEqual({ id: 'prod-neu' });
    expect(insert.insert).toHaveBeenCalledWith({
      kampagne_id: 'kamp-1',
      briefing_id: 'brief-2',
      produkt_id: 'produkt-2',
      name: 'Neuer Süßer Senf 2.0'
    });
  });
});

describe('resolveProduktionLinks', () => {
  it('übernimmt die eine briefing_id der Kinder und den Briefing-Titel', () => {
    const resolved = resolveProduktionLinks({
      produktion: { briefing_id: null, produkt_id: null, name: 'Kampagne' },
      childBriefingIds: ['brief-1', 'brief-1'],
      briefing: { id: 'brief-1', aktivierung_name: 'Next Magenta' }
    });

    expect(resolved.briefingId).toBe('brief-1');
    expect(resolved.ambiguous).toBe(false);
    expect(resolved.patch).toEqual({
      briefing_id: 'brief-1',
      name: 'Next Magenta'
    });
  });

  it('schreibt zwei Briefings nicht zurück', () => {
    const resolved = resolveProduktionLinks({
      produktion: { briefing_id: null, produkt_id: null },
      childBriefingIds: ['brief-1', 'brief-2']
    });

    expect(resolved.briefingId).toBeNull();
    expect(resolved.briefingIds).toEqual(['brief-1', 'brief-2']);
    expect(resolved.ambiguous).toBe(true);
    expect(resolved.patch).toBeNull();
  });

  it('füllt produkt_id, wenn das Briefing genau ein Produkt hat', () => {
    const resolved = resolveProduktionLinks({
      produktion: { briefing_id: 'brief-1', produkt_id: null },
      briefingProdukte: [{ id: 'produkt-1', name: 'Magenta' }]
    });

    expect(resolved.produktId).toBe('produkt-1');
    expect(resolved.produkt).toEqual({ id: 'produkt-1', name: 'Magenta' });
    expect(resolved.patch).toEqual({ produkt_id: 'produkt-1' });
  });

  it('lässt mehrere Produkte am Briefing ungesetzt', () => {
    const resolved = resolveProduktionLinks({
      produktion: { briefing_id: 'brief-1', produkt_id: null },
      briefingProdukte: [
        { id: 'produkt-1', name: 'A' },
        { id: 'produkt-2', name: 'B' }
      ]
    });

    expect(resolved.produktId).toBeNull();
    expect(resolved.patch).toBeNull();
  });

  it('schreibt ein Briefing nicht, das schon einer anderen Produktion gehört', () => {
    const resolved = resolveProduktionLinks({
      produktion: { briefing_id: null, produkt_id: null },
      childBriefingIds: ['brief-1'],
      takenBriefingIds: ['brief-1'],
      briefing: { aktivierung_name: 'Next Magenta' }
    });

    expect(resolved.briefingId).toBe('brief-1');
    expect(resolved.patch).toBeNull();
  });
});

describe('emptyProduktionId', () => {
  it('gibt die einzige leere Produktion zurück', () => {
    expect(emptyProduktionId([
      { id: 'p1', briefing_id: null, resolvedBriefingIds: [] },
      { id: 'p2', briefing_id: 'brief-1' }
    ])).toBe('p1');
  });

  it('gibt null zurück, wenn keine oder mehrere leer sind', () => {
    expect(emptyProduktionId([])).toBeNull();
    expect(emptyProduktionId([
      { id: 'p1', briefing_id: null },
      { id: 'p2', briefing_id: null }
    ])).toBeNull();
    expect(emptyProduktionId([
      { id: 'p1', briefing_id: null, resolvedBriefingIds: ['brief-1'] }
    ])).toBeNull();
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
      briefing: { id: 'b1', aktivierung_name: 'Brief', persona_ids: ['persona-1', 'persona-2'] }
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
    expect(result[0].briefing.verknuepfte_personas).toEqual([{ id: 'persona-1', name: 'Anna' }]);
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
