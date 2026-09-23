import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProduktionForBriefing,
  emptyProduktionId,
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
