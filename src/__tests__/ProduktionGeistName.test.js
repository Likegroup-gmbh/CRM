import { describe, expect, it, vi } from 'vitest';
import { ProjektErstellenPersistence } from '../modules/projekt-erstellen/services/ProjektErstellenPersistence.js';

function fakeSupabase() {
  const inserts = [];
  const updates = [];
  const supabase = {
    from: vi.fn(() => ({
      insert: vi.fn((row) => { inserts.push(row); return Promise.resolve({ error: null }); }),
      update: vi.fn((patch) => {
        updates.push(patch);
        return { eq: vi.fn(() => Promise.resolve({ error: null })) };
      })
    }))
  };
  return { supabase, inserts, updates };
}

describe('Produktion ohne Briefing: Name aus dem Projektnamen', () => {
  it('nummeriert leere Namen hinter dem Projektnamen', async () => {
    const { supabase, inserts } = fakeSupabase();
    const persistence = new ProjektErstellenPersistence();
    await persistence._syncProduktionen(
      supabase,
      {
        auftrag: { titel: 'Serum Launch' },
        produktionen: [
          { _key: 'a', kampagnen_nummer: 1, name: '', budget: 1000 },
          { _key: 'b', kampagnen_nummer: 1, name: '  ', budget: 2000 },
          { _key: 'c', kampagnen_nummer: 1, name: 'Eigener Name', budget: 3000 }
        ]
      },
      [{ kampagnen_nummer: 1 }],
      ['k1']
    );
    expect(inserts.map(row => row.name)).toEqual([
      'Serum Launch – Produktion 1',
      'Serum Launch – Produktion 2',
      'Eigener Name'
    ]);
  });

  it('nimmt für weitere Kampagnen den Namen mit Zähler', async () => {
    const { supabase, inserts } = fakeSupabase();
    const persistence = new ProjektErstellenPersistence();
    await persistence._syncProduktionen(
      supabase,
      {
        auftrag: { titel: 'Serum Launch' },
        produktionen: [{ _key: 'a', kampagnen_nummer: 2, name: '', budget: 500 }]
      },
      [{ kampagnen_nummer: 1 }, { kampagnen_nummer: 2 }],
      ['k1', 'k2']
    );
    expect(inserts[0].name).toBe('Serum Launch (2) – Produktion 1');
  });

  it('legt geplante Produktionen auch ohne Budget an und löscht bestehende nie', async () => {
    const { supabase, inserts, updates } = fakeSupabase();
    const deletes = vi.fn();
    const from = supabase.from;
    supabase.from = vi.fn((table) => ({ ...from(table), delete: deletes }));
    const persistence = new ProjektErstellenPersistence();
    await persistence._syncProduktionen(
      supabase,
      {
        auftrag: { titel: 'Serum Launch' },
        produktionen: [
          { _key: 'a', id: 'p-alt', kampagnen_nummer: 1, name: 'Alt', budget: 500 },
          { _key: 'b', kampagnen_nummer: 1, name: '', budget: null },
          { _key: 'c', kampagnen_nummer: 1, name: '', budget: null }
        ]
      },
      [{ kampagnen_nummer: 1 }],
      ['k1']
    );
    expect(updates).toHaveLength(1);
    expect(inserts.map(row => row.name)).toEqual([
      'Serum Launch – Produktion 1',
      'Serum Launch – Produktion 2'
    ]);
    expect(deletes).not.toHaveBeenCalled();
  });
});
