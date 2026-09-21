import { describe, it, expect, afterEach, vi } from 'vitest';
import { setBriefingPersonas, setPersonaBriefings } from '../modules/briefing/BriefingPersonas.js';

vi.mock('../modules/briefing/BriefingProdukte.js', async () => {
  const actual = await vi.importActual('../modules/briefing/BriefingProdukte.js');
  return {
    ...actual,
    recomputeBriefingProdukte: vi.fn(async () => {})
  };
});

describe('BriefingPersonas Membership', () => {
  afterEach(() => {
    delete window.supabase;
    vi.clearAllMocks();
  });

  it('setBriefingPersonas schreibt nur Personas desselben Unternehmens und rechnet nach', async () => {
    const updates = [];
    window.supabase = {
      from: (table) => {
        if (table === 'campaign_briefings') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: 'b1', unternehmen_id: 'u1', marke_id: null, persona_ids: [] },
                  error: null
                })
              })
            }),
            update: (data) => {
              updates.push(data);
              return { eq: async () => ({ error: null }) };
            }
          };
        }
        if (table === 'personas') {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  { id: 'pe1', unternehmen_id: 'u1' },
                  { id: 'pe2', unternehmen_id: 'u2' }
                ],
                error: null
              })
            })
          };
        }
        throw new Error(`unerwartete Tabelle ${table}`);
      }
    };

    const { recomputeBriefingProdukte } = await import('../modules/briefing/BriefingProdukte.js');
    await setBriefingPersonas('b1', ['pe1', 'pe2', 'pe1']);
    expect(updates[0].persona_ids).toEqual(['pe1']);
    expect(recomputeBriefingProdukte).toHaveBeenCalledWith('b1');
  });

  it('setPersonaBriefings haengt an und löst vom anderen Briefing', async () => {
    const updates = [];
    window.supabase = {
      from: (table) => {
        if (table === 'personas') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: 'pe1', unternehmen_id: 'u1' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'campaign_briefings') {
          return {
            select: (cols) => {
              if (cols === 'id') {
                return {
                  contains: async () => ({
                    data: [{ id: 'b-old' }],
                    error: null
                  })
                };
              }
              return {
                in: async () => ({
                  data: [
                    { id: 'b-old', unternehmen_id: 'u1', marke_id: null, persona_ids: ['pe1'], is_draft: false },
                    { id: 'b-new', unternehmen_id: 'u1', marke_id: null, persona_ids: [], is_draft: false }
                  ],
                  error: null
                })
              };
            },
            update: (data) => {
              updates.push(data);
              return {
                eq: async (_col, id) => {
                  updates[updates.length - 1] = { ...data, _id: id };
                  return { error: null };
                }
              };
            }
          };
        }
        throw new Error(`unerwartete Tabelle ${table}`);
      }
    };

    await setPersonaBriefings('pe1', ['b-new']);
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ _id: 'b-old', persona_ids: [] }),
      expect.objectContaining({ _id: 'b-new', persona_ids: ['pe1'] })
    ]));
  });

  it('setPersonaBriefings fasst Entwurf-Briefings nicht an', async () => {
    const updates = [];
    window.supabase = {
      from: (table) => {
        if (table === 'personas') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: 'pe1', unternehmen_id: 'u1' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'campaign_briefings') {
          return {
            select: (cols) => {
              if (cols === 'id') {
                return {
                  contains: async () => ({
                    data: [{ id: 'b-draft' }, { id: 'b-final' }],
                    error: null
                  })
                };
              }
              return {
                in: async () => ({
                  data: [
                    { id: 'b-draft', unternehmen_id: 'u1', marke_id: null, persona_ids: ['pe1'], is_draft: true },
                    { id: 'b-final', unternehmen_id: 'u1', marke_id: null, persona_ids: ['pe1'], is_draft: false }
                  ],
                  error: null
                })
              };
            },
            update: (data) => {
              updates.push(data);
              return {
                eq: async (_col, id) => {
                  updates[updates.length - 1] = { ...data, _id: id };
                  return { error: null };
                }
              };
            }
          };
        }
        throw new Error(`unerwartete Tabelle ${table}`);
      }
    };

    await setPersonaBriefings('pe1', []);
    expect(updates).toEqual([
      expect.objectContaining({ _id: 'b-final', persona_ids: [] })
    ]);
  });
});
