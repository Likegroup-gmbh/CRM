// BriefingProdukte.test.js
// Filter und Sync der Briefing-Produkt-Zuordnung.

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  loadProdukteForBriefing,
  loadBriefingProdukte,
  addBriefingProdukte,
  removeBriefingProdukt,
  loadUebernehmbareProdukte,
  uebernehmeProdukte
} from '../modules/briefing/BriefingProdukte.js';

// Kleine In-Memory-Datenbank: select/eq/in/maybeSingle, insert, update, delete.
function fakeDb(initial) {
  const rows = {};
  for (const [table, list] of Object.entries(initial)) rows[table] = list.map(r => ({ ...r }));

  return {
    rows,
    from(table) {
      const state = { filters: [], op: 'select', insertRows: [] };
      const matches = () => rows[table].filter(row => state.filters.every(([col, test]) => test(row[col])));
      const query = {
        select: () => query,
        eq: (col, val) => { state.filters.push([col, v => v === val]); return query; },
        in: (col, vals) => { state.filters.push([col, v => vals.includes(v)]); return query; },
        insert: (list) => { state.op = 'insert'; state.insertRows = list; return query; },
        update: (patch) => { state.op = 'update'; state.patch = patch; return query; },
        delete: () => { state.op = 'delete'; return query; },
        maybeSingle: async () => ({ data: matches()[0] || null, error: null }),
        then: (resolve, reject) => {
          if (state.op === 'insert') rows[table].push(...state.insertRows.map(r => ({ ...r })));
          else if (state.op === 'update') matches().forEach(row => Object.assign(row, state.patch));
          else if (state.op === 'delete') {
            const drop = new Set(matches());
            rows[table] = rows[table].filter(row => !drop.has(row));
          }
          return Promise.resolve({ data: state.op === 'select' ? matches() : null, error: null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
}

describe('BriefingProdukte', () => {
  afterEach(() => {
    delete window.supabase;
  });

  it('ohne Unternehmen oder Supabase leer', async () => {
    expect(await loadProdukteForBriefing(null)).toEqual([]);
    window.supabase = { from: vi.fn() };
    expect(await loadProdukteForBriefing('')).toEqual([]);
    expect(window.supabase.from).not.toHaveBeenCalled();
  });

  it('laesst Marken-Treffer und unternehmensweite Produkte durch', async () => {
    window.supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                { id: '1', name: 'Serum', unternehmen_id: 'u1', produkt_marke: [{ marke_id: 'm1' }] },
                { id: '2', name: 'Creme', unternehmen_id: 'u1', produkt_marke: [] },
                { id: '3', name: 'Anderes', unternehmen_id: 'u1', produkt_marke: [{ marke_id: 'm2' }] }
              ],
              error: null
            })
          })
        })
      })
    };

    const rows = await loadProdukteForBriefing('u1', 'm1');
    expect(rows.map(r => r.id)).toEqual(['1', '2']);
    expect(rows[0].produkt_marke).toBeUndefined();
  });

  it('loadBriefingProdukte sortiert nach Name', async () => {
    window.supabase = {
      from: () => ({
        select: () => ({
          eq: async () => ({
            data: [
              { produkt_id: 'p2', produkt: { id: 'p2', name: 'Zebra' } },
              { produkt_id: 'p1', produkt: { id: 'p1', name: 'Alpha' } }
            ],
            error: null
          })
        })
      })
    };

    const rows = await loadBriefingProdukte('b1');
    expect(rows.map(r => r.name)).toEqual(['Alpha', 'Zebra']);
  });

  it('addBriefingProdukte haengt nur Fehlendes an und loescht nichts', async () => {
    const db = fakeDb({
      campaign_briefing_produkt: [{ briefing_id: 'b1', produkt_id: 'p1' }]
    });
    window.supabase = db;

    const neu = await addBriefingProdukte('b1', ['p1', 'p2', 'p2', null]);

    expect(neu).toEqual(['p2']);
    expect(db.rows.campaign_briefing_produkt).toEqual([
      { briefing_id: 'b1', produkt_id: 'p1' },
      { briefing_id: 'b1', produkt_id: 'p2' }
    ]);

    expect(await addBriefingProdukte('b1', ['p1', 'p2'])).toEqual([]);
    expect(db.rows.campaign_briefing_produkt).toHaveLength(2);
  });

  it('dasselbe Produkt haengt an zwei Linien, ohne dass die erste es verliert', async () => {
    const db = fakeDb({
      campaign_briefing_produkt: [{ briefing_id: 'nano', produkt_id: 'creme' }]
    });
    window.supabase = db;

    await addBriefingProdukte('ugc', ['creme']);

    expect(db.rows.campaign_briefing_produkt).toEqual([
      { briefing_id: 'nano', produkt_id: 'creme' },
      { briefing_id: 'ugc', produkt_id: 'creme' }
    ]);
  });

  it('removeBriefingProdukt loest nur die eine Verknuepfung', async () => {
    const db = fakeDb({
      campaign_briefing_produkt: [
        { briefing_id: 'nano', produkt_id: 'creme' },
        { briefing_id: 'ugc', produkt_id: 'creme' },
        { briefing_id: 'ugc', produkt_id: 'serum' }
      ]
    });
    window.supabase = db;

    await removeBriefingProdukt('ugc', 'creme');

    expect(db.rows.campaign_briefing_produkt).toEqual([
      { briefing_id: 'nano', produkt_id: 'creme' },
      { briefing_id: 'ugc', produkt_id: 'serum' }
    ]);
  });

  it('uebernehmeProdukte verknuepft nur Produkte des Unternehmens', async () => {
    const db = fakeDb({
      campaign_briefings: [{ id: 'ugc', unternehmen_id: 'u1', persona_ids: [] }],
      produkt: [
        { id: 'creme', unternehmen_id: 'u1' },
        { id: 'fremd', unternehmen_id: 'u2' }
      ],
      campaign_briefing_produkt: []
    });
    window.supabase = db;

    const neu = await uebernehmeProdukte('ugc', ['creme', 'fremd']);

    expect(neu).toEqual(['creme']);
    expect(db.rows.campaign_briefing_produkt).toEqual([{ briefing_id: 'ugc', produkt_id: 'creme' }]);
  });

  it('uebernehmeProdukte beruehrt weder Personas noch Skripte der anderen Linie', async () => {
    const db = fakeDb({
      campaign_briefings: [
        { id: 'nano', unternehmen_id: 'u1', persona_ids: ['marco', 'mia'] },
        { id: 'ugc', unternehmen_id: 'u1', persona_ids: ['eigene'] }
      ],
      produkt: [{ id: 'creme', unternehmen_id: 'u1' }],
      skripte: [{ id: 's1', produkt_id: 'creme', briefing_id: 'nano' }],
      campaign_briefing_produkt: [{ briefing_id: 'nano', produkt_id: 'creme' }]
    });
    window.supabase = db;

    await uebernehmeProdukte('ugc', ['creme']);

    expect(db.rows.campaign_briefings.find(b => b.id === 'ugc').persona_ids).toEqual(['eigene']);
    expect(db.rows.campaign_briefings.find(b => b.id === 'nano').persona_ids).toEqual(['marco', 'mia']);
    expect(db.rows.skripte).toEqual([{ id: 's1', produkt_id: 'creme', briefing_id: 'nano' }]);
    expect(db.rows.campaign_briefing_produkt).toEqual([
      { briefing_id: 'nano', produkt_id: 'creme' },
      { briefing_id: 'ugc', produkt_id: 'creme' }
    ]);
  });

  it('loadUebernehmbareProdukte blendet aus, was schon an der Linie haengt', async () => {
    window.supabase = {
      from: (table) => {
        if (table === 'produkt') {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [
                    { id: 'creme', name: 'Creme', unternehmen_id: 'u1', produkt_marke: [] },
                    { id: 'serum', name: 'Serum', unternehmen_id: 'u1', produkt_marke: [{ marke_id: 'm1' }] },
                    { id: 'andere', name: 'Andere', unternehmen_id: 'u1', produkt_marke: [{ marke_id: 'm2' }] }
                  ],
                  error: null
                })
              })
            })
          };
        }
        expect(table).toBe('campaign_briefing_produkt');
        return {
          select: () => ({
            eq: async () => ({
              data: [{ produkt_id: 'creme', produkt: { id: 'creme', name: 'Creme' } }],
              error: null
            })
          })
        };
      }
    };

    const rows = await loadUebernehmbareProdukte({ briefingId: 'ugc', unternehmenId: 'u1', markeId: 'm1' });

    expect(rows.map(r => r.id)).toEqual(['serum']);
  });
});
