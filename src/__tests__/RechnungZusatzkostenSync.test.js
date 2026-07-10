import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  syncEkZusatzkostenFromRechnung,
  syncEkZusatzkostenFromRechnungId,
  syncEkZusatzkostenAfterRechnungSave,
} from '../core/RechnungZusatzkostenSync.js';

function makeSupabase({
  koopRow,
  rechnungRow = null,
  koopLoadError = null,
  rechnungLoadError = null,
  updateError = null,
} = {}) {
  const updateCalls = [];

  const supabase = {
    from: vi.fn((table) => {
      if (table === 'rechnung') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: rechnungRow,
                error: rechnungLoadError,
              })),
            })),
          })),
        };
      }
      if (table !== 'kooperationen') {
        throw new Error(`Unerwartete Tabelle: ${table}`);
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: koopRow,
              error: koopLoadError,
            })),
          })),
        })),
        update: vi.fn((payload) => {
          updateCalls.push(payload);
          return {
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: {
                    id: koopRow?.id || 'k1',
                    einkaufspreis_zusatzkosten: payload.einkaufspreis_zusatzkosten ?? koopRow?.einkaufspreis_zusatzkosten ?? null,
                    verkaufspreis_zusatzkosten: payload.verkaufspreis_zusatzkosten ?? koopRow?.verkaufspreis_zusatzkosten ?? null,
                  },
                  error: updateError,
                })),
              })),
            })),
          };
        }),
      };
    }),
  };

  return { supabase, updateCalls };
}

describe('syncEkZusatzkostenFromRechnung', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liefert error wenn kooperationId fehlt', async () => {
    const result = await syncEkZusatzkostenFromRechnung({ zusatzkosten: 50 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/kooperationId/i);
  });

  it('skipped wenn zusatzkosten = 0', async () => {
    const { supabase } = makeSupabase();
    const result = await syncEkZusatzkostenFromRechnung({
      kooperationId: 'k1',
      zusatzkosten: 0,
      supabase,
    });
    expect(result.success).toBe(true);
    expect(result.skipped).toBe('no_zusatzkosten');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('skipped wenn zusatzkosten null/undefined', async () => {
    const { supabase } = makeSupabase();
    const result = await syncEkZusatzkostenFromRechnung({
      kooperationId: 'k1',
      zusatzkosten: null,
      supabase,
    });
    expect(result.success).toBe(true);
    expect(result.skipped).toBe('no_zusatzkosten');
  });

  it('ueberschreibt EK und VK auch wenn bereits Werte gesetzt sind (Rechnung = Source of Truth)', async () => {
    const { supabase, updateCalls } = makeSupabase({
      koopRow: {
        id: 'k1',
        einkaufspreis_netto: 1000,
        einkaufspreis_zusatzkosten: 100,
        einkaufspreis_ust: 190,
        verkaufspreis_netto: 1200,
        verkaufspreis_zusatzkosten: 100,
        verkaufspreis_ust: 228,
      },
    });

    const result = await syncEkZusatzkostenFromRechnung({
      kooperationId: 'k1',
      zusatzkosten: 50,
      ustProzent: 19,
      supabase,
    });

    expect(result.success).toBe(true);
    expect(result.updatedSides).toEqual(['ek', 'vk']);
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0].einkaufspreis_zusatzkosten).toBe(50);
    expect(updateCalls[1].verkaufspreis_zusatzkosten).toBe(50);
  });

  it('schreibt EK und VK Zusatzkosten + neue USt/Gesamt mit 19 %', async () => {
    const { supabase, updateCalls } = makeSupabase({
      koopRow: {
        id: 'k1',
        einkaufspreis_netto: 1000,
        einkaufspreis_zusatzkosten: 0,
        einkaufspreis_ust: 190,
        verkaufspreis_netto: 1200,
        verkaufspreis_zusatzkosten: 0,
        verkaufspreis_ust: 228,
      },
    });

    const result = await syncEkZusatzkostenFromRechnung({
      kooperationId: 'k1',
      zusatzkosten: 50,
      ustProzent: 19,
      supabase,
    });

    expect(result.success).toBe(true);
    expect(result.updatedSides).toEqual(['ek', 'vk']);
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0]).toEqual({
      einkaufspreis_zusatzkosten: 50,
      einkaufspreis_ust: 199.5,
      einkaufspreis_gesamt: 1249.5,
    });
    expect(updateCalls[1]).toEqual({
      verkaufspreis_zusatzkosten: 50,
      verkaufspreis_ust: 237.5,
      verkaufspreis_gesamt: 1487.5,
    });
  });

  it('rechnet Brutto-Zusatzkosten vor dem Sync auf netto zurueck', async () => {
    const { supabase, updateCalls } = makeSupabase({
      koopRow: {
        id: 'k1',
        einkaufspreis_netto: 1000,
        einkaufspreis_zusatzkosten: 0,
        einkaufspreis_ust: 190,
        verkaufspreis_netto: 1200,
        verkaufspreis_zusatzkosten: 0,
        verkaufspreis_ust: 228,
      },
    });

    const result = await syncEkZusatzkostenFromRechnung({
      kooperationId: 'k1',
      zusatzkosten: 119,
      zusatzkostenBrutto: true,
      ustProzent: 19,
      supabase,
    });

    expect(result.success).toBe(true);
    expect(result.updatedSides).toEqual(['ek', 'vk']);
    // 119 brutto / 1.19 = 100 netto; calcPreisBlock schlaegt die USt wieder auf
    expect(updateCalls[0]).toEqual({
      einkaufspreis_zusatzkosten: 100,
      einkaufspreis_ust: 209,
      einkaufspreis_gesamt: 1309,
    });
    expect(updateCalls[1]).toEqual({
      verkaufspreis_zusatzkosten: 100,
      verkaufspreis_ust: 247,
      verkaufspreis_gesamt: 1547,
    });
  });

  it('ueberschreibt EK und VK wenn neue Rechnung mit anderem Betrag gespeichert wird', async () => {
    const { supabase, updateCalls } = makeSupabase({
      koopRow: {
        id: 'k1',
        einkaufspreis_netto: 1000,
        einkaufspreis_zusatzkosten: 500,
        einkaufspreis_ust: 285,
        verkaufspreis_netto: 1200,
        verkaufspreis_zusatzkosten: 555,
        verkaufspreis_ust: 228,
      },
    });

    const result = await syncEkZusatzkostenFromRechnung({
      kooperationId: 'k1',
      zusatzkosten: 755,
      ustProzent: 19,
      supabase,
    });

    expect(result.success).toBe(true);
    expect(result.updatedSides).toEqual(['ek', 'vk']);
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0]).toEqual({
      einkaufspreis_zusatzkosten: 755,
      einkaufspreis_ust: 333.45,
      einkaufspreis_gesamt: 2088.45,
    });
    expect(updateCalls[1]).toEqual({
      verkaufspreis_zusatzkosten: 755,
      verkaufspreis_ust: 371.45,
      verkaufspreis_gesamt: 2326.45,
    });
  });

  it('rechnet mit 0 % wenn Creator nicht umsatzsteuerpflichtig', async () => {
    const { supabase, updateCalls } = makeSupabase({
      koopRow: {
        id: 'k1',
        einkaufspreis_netto: 1000,
        einkaufspreis_zusatzkosten: null,
        einkaufspreis_ust: 0,
      },
    });

    const result = await syncEkZusatzkostenFromRechnung({
      kooperationId: 'k1',
      zusatzkosten: 80,
      ustProzent: 0,
      supabase,
    });

    expect(result.success).toBe(true);
    expect(updateCalls[0].einkaufspreis_zusatzkosten).toBe(80);
    expect(updateCalls[1].verkaufspreis_zusatzkosten).toBe(80);
  });

  it('Fallback auf USt aus Kooperation wenn ustProzent fehlt', async () => {
    const { supabase, updateCalls } = makeSupabase({
      koopRow: {
        id: 'k1',
        einkaufspreis_netto: 1000,
        einkaufspreis_zusatzkosten: 0,
        einkaufspreis_ust: 70,
      },
    });

    const result = await syncEkZusatzkostenFromRechnung({
      kooperationId: 'k1',
      zusatzkosten: 100,
      supabase,
    });

    expect(result.success).toBe(true);
    expect(updateCalls[0].einkaufspreis_zusatzkosten).toBe(100);
    expect(updateCalls[0].einkaufspreis_ust).toBe(77);
    expect(updateCalls[0].einkaufspreis_gesamt).toBe(1177);
  });

  it('Fallback auf 19 % wenn weder ustProzent noch Kooperations-USt ableitbar', async () => {
    const { supabase, updateCalls } = makeSupabase({
      koopRow: {
        id: 'k1',
        einkaufspreis_netto: 0,
        einkaufspreis_zusatzkosten: 0,
        einkaufspreis_ust: 0,
      },
    });

    const result = await syncEkZusatzkostenFromRechnung({
      kooperationId: 'k1',
      zusatzkosten: 100,
      supabase,
    });

    expect(result.success).toBe(true);
    expect(updateCalls[0].einkaufspreis_zusatzkosten).toBe(100);
    expect(updateCalls[1].verkaufspreis_zusatzkosten).toBe(100);
  });

  it('blockiert nicht wenn Update fehlschlaegt', async () => {
    const { supabase } = makeSupabase({
      koopRow: {
        id: 'k1',
        einkaufspreis_netto: 1000,
        einkaufspreis_zusatzkosten: 0,
        einkaufspreis_ust: 190,
      },
      updateError: { message: 'permission denied' },
    });

    const result = await syncEkZusatzkostenFromRechnung({
      kooperationId: 'k1',
      zusatzkosten: 50,
      ustProzent: 19,
      supabase,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permission denied/);
  });

  it('syncEkZusatzkostenFromRechnungId laedt Rechnung und synchronisiert', async () => {
    const { supabase, updateCalls } = makeSupabase({
      rechnungRow: {
        id: 'r1',
        kooperation_id: 'k1',
        zusatzkosten: 75,
        ust_prozent: 19,
      },
      koopRow: {
        id: 'k1',
        einkaufspreis_netto: 200,
        einkaufspreis_zusatzkosten: 0,
        einkaufspreis_ust: 38,
      },
    });

    const result = await syncEkZusatzkostenFromRechnungId('r1', { supabase });
    expect(result.success).toBe(true);
    expect(updateCalls[0].einkaufspreis_zusatzkosten).toBe(75);
  });

  it('blockiert nicht wenn Kooperation nicht ladbar', async () => {
    const { supabase, updateCalls } = makeSupabase({
      koopLoadError: { message: 'not found' },
    });

    const result = await syncEkZusatzkostenFromRechnung({
      kooperationId: 'k1',
      zusatzkosten: 50,
      supabase,
    });

    expect(result.success).toBe(false);
    expect(updateCalls).toHaveLength(0);
  });
});

describe('syncEkZusatzkostenAfterRechnungSave', () => {
  let toastShow;

  beforeEach(() => {
    toastShow = vi.fn();
    globalThis.window = globalThis.window || {};
    globalThis.window.toastSystem = { show: toastShow };
    globalThis.window.dispatchEvent = vi.fn();
    globalThis.window.CustomEvent = function (type, init) { return { type, ...(init || {}) }; };
  });

  afterEach(() => {
    delete globalThis.window.toastSystem;
  });

  it('zeigt Success-Toast wenn Sync EK+VK aktualisiert', async () => {
    const { supabase } = makeSupabase({
      rechnungRow: { id: 'r1', kooperation_id: 'k1', zusatzkosten: 100, ust_prozent: 19 },
      koopRow: {
        id: 'k1',
        einkaufspreis_netto: 1000, einkaufspreis_zusatzkosten: 0, einkaufspreis_ust: 190,
        verkaufspreis_netto: 1200, verkaufspreis_zusatzkosten: 0, verkaufspreis_ust: 228,
      },
    });

    const result = await syncEkZusatzkostenAfterRechnungSave('r1', { supabase });

    expect(result.success).toBe(true);
    expect(toastShow).toHaveBeenCalledWith(
      expect.stringMatching(/Zusatzkosten in Kooperation/i),
      'success'
    );
  });

  it('zeigt RLS-Hinweis in Warning-Toast wenn Update permission denied', async () => {
    const { supabase } = makeSupabase({
      rechnungRow: { id: 'r1', kooperation_id: 'k1', zusatzkosten: 100, ust_prozent: 19 },
      koopRow: {
        id: 'k1',
        einkaufspreis_netto: 1000, einkaufspreis_zusatzkosten: 0, einkaufspreis_ust: 190,
        verkaufspreis_netto: 1200, verkaufspreis_zusatzkosten: 0, verkaufspreis_ust: 228,
      },
      updateError: { message: 'permission denied for table kooperationen' },
    });

    const result = await syncEkZusatzkostenAfterRechnungSave('r1', { supabase });

    expect(result.success).toBe(false);
    expect(toastShow).toHaveBeenCalledWith(
      expect.stringMatching(/RLS|permission/i),
      'warning'
    );
  });
});
