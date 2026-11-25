import { describe, it, expect, afterEach, vi } from 'vitest';
import { setBriefingPersonas, setPersonaBriefings, addPersonaToBriefing, removePersonaFromBriefing } from '../modules/briefing/BriefingPersonas.js';

// Die Mocks werfen bei jeder unbekannten Tabelle: Persona-Änderungen dürfen
// campaign_briefing_produkt nicht anfassen (ADR 0052).
describe('BriefingPersonas Membership', () => {
  afterEach(() => {
    delete window.supabase;
    vi.clearAllMocks();
  });

  it('setBriefingPersonas schreibt nur Personas desselben Unternehmens und lässt die Produkte der Linie in Ruhe', async () => {
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

    await setBriefingPersonas('b1', ['pe1', 'pe2', 'pe1']);
    expect(updates[0].persona_ids).toEqual(['pe1']);
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

describe('addPersonaToBriefing / removePersonaFromBriefing', () => {
  afterEach(() => {
    delete window.supabase;
    vi.clearAllMocks();
  });

  function mockAddScope({ briefing, persona, markeVorhanden = false }) {
    const updates = [];
    const markeInserts = [];
    window.supabase = {
      from: (table) => {
        if (table === 'campaign_briefings') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: briefing, error: null })
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
              eq: () => ({
                maybeSingle: async () => ({ data: persona, error: null })
              })
            })
          };
        }
        if (table === 'persona_marke') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: markeVorhanden ? { marke_id: briefing?.marke_id } : null, error: null })
                })
              })
            }),
            insert: async (rows) => {
              markeInserts.push(rows);
              return { error: null };
            }
          };
        }
        throw new Error(`unerwartete Tabelle ${table}`);
      }
    };
    return { updates, markeInserts };
  }

  it('haengt die Persona an und ergaenzt die Briefing-Marke', async () => {
    const { updates, markeInserts } = mockAddScope({
      briefing: { id: 'b1', unternehmen_id: 'u1', marke_id: 'm1', persona_ids: [] },
      persona: { id: 'pe1', unternehmen_id: 'u1' }
    });

    const added = await addPersonaToBriefing('b1', 'pe1');

    expect(added).toBe(true);
    expect(updates[0].persona_ids).toEqual(['pe1']);
    expect(markeInserts).toEqual([{ persona_id: 'pe1', marke_id: 'm1' }]);
  });

  it('ist idempotent: bereits verknuepfte Persona wird nicht nochmal geschrieben', async () => {
    const { updates, markeInserts } = mockAddScope({
      briefing: { id: 'b1', unternehmen_id: 'u1', marke_id: 'm1', persona_ids: ['pe1'] },
      persona: { id: 'pe1', unternehmen_id: 'u1' }
    });

    const added = await addPersonaToBriefing('b1', 'pe1');

    expect(added).toBe(false);
    expect(updates).toHaveLength(0);
    expect(markeInserts).toHaveLength(0);
  });

  it('lehnt Personas eines anderen Unternehmens ab', async () => {
    const { updates } = mockAddScope({
      briefing: { id: 'b1', unternehmen_id: 'u1', marke_id: null, persona_ids: [] },
      persona: { id: 'pe1', unternehmen_id: 'u2' }
    });

    const added = await addPersonaToBriefing('b1', 'pe1');

    expect(added).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it('removePersonaFromBriefing loest die Verknuepfung', async () => {
    const updates = [];
    window.supabase = {
      from: (table) => {
        if (table === 'campaign_briefings') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: 'b1', persona_ids: ['pe1', 'pe2'] },
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
        throw new Error(`unerwartete Tabelle ${table}`);
      }
    };

    const removed = await removePersonaFromBriefing('b1', 'pe1');

    expect(removed).toBe(true);
    expect(updates[0].persona_ids).toEqual(['pe2']);
  });

  it('removePersonaFromBriefing ist idempotent', async () => {
    const updates = [];
    window.supabase = {
      from: (table) => {
        if (table === 'campaign_briefings') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: 'b1', persona_ids: ['pe2'] },
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
        throw new Error(`unerwartete Tabelle ${table}`);
      }
    };

    const removed = await removePersonaFromBriefing('b1', 'pe1');

    expect(removed).toBe(false);
    expect(updates).toHaveLength(0);
  });
});
