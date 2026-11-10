import { describe, it, expect, vi, beforeEach } from 'vitest';
import { strategieService } from '../modules/strategie/StrategieService.js';
import { skripteService } from '../modules/skripte/SkripteService.js';

function chain(handlers) {
  const q = {};
  for (const [name, impl] of Object.entries(handlers)) {
    q[name] = (...args) => impl(q, ...args);
  }
  return q;
}

beforeEach(() => {
  window.currentUser = { id: 'user-1' };
});

describe('setSkriptFreigabe', () => {
  it('gibt eine Idee ohne Casting-Eintrag frei', async () => {
    let payload = null;
    window.supabase = {
      from: () => chain({
        select: (q) => q,
        eq: (q) => q,
        single: () => Promise.resolve({
          data: { id: 'idee-1', nicht_umsetzen: false },
          error: null
        }),
        update: (q, next) => {
          payload = next;
          return q;
        }
      })
    };

    await strategieService.setSkriptFreigabe('idee-1', true);

    expect(payload.skript_freigabe).toBe(true);
    expect(payload.skript_freigabe_von).toBe('user-1');
    expect(payload.skript_freigabe_am).toEqual(expect.any(String));
  });

  it('blockt „Nicht umsetzen“', async () => {
    const update = vi.fn();
    window.supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { id: 'idee-1', nicht_umsetzen: true },
              error: null
            })
          })
        }),
        update
      })
    };

    await expect(strategieService.setSkriptFreigabe('idee-1', true))
      .rejects.toThrow('Nicht umsetzen');
    expect(update).not.toHaveBeenCalled();
  });
});

describe('unassignCastingItem', () => {
  it('löst die Zuordnung, ohne die Skript-Freigabe zurückzunehmen', async () => {
    let payload = null;
    window.supabase = {
      from: (table) => {
        if (table === 'skripte') {
          return {
            select: () => ({
              eq: () => Promise.resolve({ count: 0, error: null })
            })
          };
        }
        return {
          update: (next) => {
            payload = next;
            return {
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({ data: { id: 'idee-1', ...next }, error: null })
                })
              })
            };
          }
        };
      }
    };

    await strategieService.unassignCastingItem('idee-1');

    expect(payload).toEqual({ creator_auswahl_item_id: null });
  });
});

describe('loadFreigegebeneVideoideen', () => {
  it('filtert nicht mehr auf einen Casting-Eintrag', async () => {
    const calls = [];
    const q = {
      select() { return q; },
      eq(...args) { calls.push(['eq', ...args]); return q; },
      not(...args) { calls.push(['not', ...args]); return q; },
      order() { return Promise.resolve({ data: [], error: null }); }
    };
    window.supabase = { from: () => q };

    const ideen = await skripteService.loadFreigegebeneVideoideen({
      unternehmenId: 'u1',
      kampagneId: 'k1'
    });

    expect(ideen).toEqual([]);
    expect(calls).toContainEqual(['eq', 'skript_freigabe', true]);
    expect(calls.some((c) => c[0] === 'not' && c[1] === 'creator_auswahl_item_id')).toBe(false);
  });
});
