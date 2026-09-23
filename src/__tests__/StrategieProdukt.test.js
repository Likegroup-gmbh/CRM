import { describe, it, expect, vi, afterEach } from 'vitest';
import { strategieService } from '../modules/strategie/StrategieService.js';

const ITEM = {
  id: 'i1',
  strategie_id: 's1',
  creator_auswahl_item_id: 'c1',
  nicht_umsetzen: false,
  ist_vorschlag: false,
  produkt_id: null
};

function chain(result) {
  const q = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    update: vi.fn(() => q),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  };
  return q;
}

function client(byTable, updates) {
  window.supabase = {
    from: vi.fn((table) => {
      const queue = byTable[table];
      const next = Array.isArray(queue) ? queue.shift() : queue;
      const q = chain(next);
      q.update = vi.fn((patch) => {
        updates.push(patch);
        return q;
      });
      return q;
    })
  };
}

describe('setSkriptFreigabe Produkt', () => {
  afterEach(() => {
    delete window.supabase;
    delete window.currentUser;
  });

  function itemRow(overrides = {}) {
    return { data: { ...ITEM, ...overrides }, error: null };
  }

  function keinVorschlag() {
    return { data: { ist_vorschlag: false }, error: null };
  }

  function produkte(rows) {
    return {
      data: rows.map((p) => ({ produkt_id: p.id, produkt: p })),
      error: null
    };
  }

  it('setzt das einzige Briefing-Produkt bei der Freigabe', async () => {
    const updates = [];
    client({
      strategie_items: [itemRow(), keinVorschlag(), { data: { id: 'i1' }, error: null }],
      strategie: { data: { id: 's1', briefing_id: 'b1' }, error: null },
      campaign_briefing_produkt: produkte([{ id: 'pr-1', name: 'Serum' }])
    }, updates);

    const produkt = await strategieService.setSkriptFreigabe('i1', true);

    expect(produkt).toEqual({ id: 'pr-1', name: 'Serum' });
    expect(updates).toHaveLength(1);
    expect(updates[0].produkt_id).toBe('pr-1');
    expect(updates[0].skript_freigabe).toBe(true);
  });

  it('blockt die Freigabe, wenn mehrere Produkte ohne Zuordnung da sind', async () => {
    const updates = [];
    client({
      strategie_items: [itemRow()],
      strategie: { data: { id: 's1', briefing_id: 'b1' }, error: null },
      campaign_briefing_produkt: produkte([
        { id: 'pr-1', name: 'Serum' },
        { id: 'pr-2', name: 'Cleanser' }
      ])
    }, updates);

    await expect(strategieService.setSkriptFreigabe('i1', true))
      .rejects.toThrow('Zuerst ein Produkt zuordnen.');
    expect(updates).toHaveLength(0);
  });

  it('gibt ohne Briefing-Produkt frei und laesst die ID leer', async () => {
    const updates = [];
    client({
      strategie_items: [itemRow(), keinVorschlag(), { data: { id: 'i1' }, error: null }],
      strategie: { data: { id: 's1', briefing_id: 'b1' }, error: null },
      campaign_briefing_produkt: produkte([])
    }, updates);

    const produkt = await strategieService.setSkriptFreigabe('i1', true);

    expect(produkt).toBeNull();
    expect(updates[0].skript_freigabe).toBe(true);
    expect(updates[0]).not.toHaveProperty('produkt_id');
  });

  it('ueberschreibt ein bereits zugeordnetes Produkt nicht', async () => {
    const updates = [];
    client({
      strategie_items: [
        itemRow({ produkt_id: 'pr-konzept' }),
        keinVorschlag(),
        { data: { id: 'i1' }, error: null }
      ]
    }, updates);

    const produkt = await strategieService.setSkriptFreigabe('i1', true);

    expect(produkt).toBeNull();
    expect(updates[0].skript_freigabe).toBe(true);
    expect(updates[0]).not.toHaveProperty('produkt_id');
    expect(window.supabase.from).not.toHaveBeenCalledWith('campaign_briefing_produkt');
  });
});
