// BriefingProdukte.test.js
// Filter und Sync der Briefing-Produkt-Zuordnung.

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  loadProdukteForBriefing,
  loadBriefingProdukte,
  syncBriefingProdukte
} from '../modules/briefing/BriefingProdukte.js';

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

  it('sync ersetzt die Junction-Zeilen', async () => {
    const deleted = [];
    const inserted = [];
    window.supabase = {
      from: (table) => {
        expect(table).toBe('campaign_briefing_produkt');
        return {
          delete: () => ({
            eq: async (_col, id) => {
              deleted.push(id);
              return { error: null };
            }
          }),
          insert: async (rows) => {
            inserted.push(rows);
            return { error: null };
          }
        };
      }
    };

    await syncBriefingProdukte('b1', ['p1', 'p1', null, 'p2']);
    expect(deleted).toEqual(['b1']);
    expect(inserted[0]).toEqual([
      { briefing_id: 'b1', produkt_id: 'p1' },
      { briefing_id: 'b1', produkt_id: 'p2' }
    ]);
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
});
