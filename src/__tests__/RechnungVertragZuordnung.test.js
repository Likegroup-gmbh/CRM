import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findSignedVertragForKooperation, backfillRechnungVertragId } from '../modules/rechnung/RechnungVertragZuordnung.js';

describe('RechnungVertragZuordnung', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Mock fuer findSignedVertragForKooperation.
  // vertraege-Query endet auf drei .eq()-Aufrufe (creator_id, kampagne_id, is_draft)
  // und wird direkt awaited (kein .limit() mehr).
  function makeFindMock({ koop = { id: 'k1', creator_id: 'c1', kampagne_id: 'kamp1' }, vertraege = [], koopError = null, vertragError = null } = {}) {
    return {
      from: vi.fn((table) => {
        if (table === 'kooperationen') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: koop, error: koopError }))
              }))
            }))
          };
        }
        if (table === 'vertraege') {
          const result = Promise.resolve({ data: vertraege, error: vertragError });
          const eq3 = vi.fn(() => result);
          const eq2 = vi.fn(() => ({ eq: eq3 }));
          const eq1 = vi.fn(() => ({ eq: eq2 }));
          return { select: vi.fn(() => ({ eq: eq1 })) };
        }
      })
    };
  }

  it('gibt vertragId des unterschriebenen Vertrags zurueck', async () => {
    const mock = makeFindMock({
      vertraege: [{ id: 'v1', unterschriebener_vertrag_url: 'https://signed.pdf', kooperation_id: 'k1' }]
    });

    const result = await findSignedVertragForKooperation('k1', mock);
    expect(result.ok).toBe(true);
    expect(result.vertragId).toBe('v1');
  });

  it('bevorzugt den signierten Vertrag mit passender kooperation_id', async () => {
    // Zwei signierte Vertraege fuer dieselbe creator+kampagne, aber unterschiedliche Kooperation.
    const mock = makeFindMock({
      koop: { id: 'k-target', creator_id: 'c1', kampagne_id: 'kamp1' },
      vertraege: [
        { id: 'v-other', unterschriebener_vertrag_url: 'https://a.pdf', kooperation_id: 'k-other' },
        { id: 'v-target', dropbox_file_url: 'https://b.pdf', kooperation_id: 'k-target' }
      ]
    });

    const result = await findSignedVertragForKooperation('k-target', mock);
    expect(result.ok).toBe(true);
    expect(result.vertragId).toBe('v-target');
  });

  it('faellt auf irgendeinen signierten Vertrag zurueck wenn kooperation_id nicht passt', async () => {
    const mock = makeFindMock({
      koop: { id: 'k-target', creator_id: 'c1', kampagne_id: 'kamp1' },
      vertraege: [
        { id: 'v-other', unterschriebener_vertrag_url: 'https://a.pdf', kooperation_id: 'k-other' }
      ]
    });

    const result = await findSignedVertragForKooperation('k-target', mock);
    expect(result.ok).toBe(true);
    expect(result.vertragId).toBe('v-other');
  });

  it('gibt vertragId null wenn kein unterschriebener Vertrag existiert', async () => {
    const mock = makeFindMock({ vertraege: [] });

    const result = await findSignedVertragForKooperation('k1', mock);
    expect(result.ok).toBe(false);
    expect(result.vertragId).toBeNull();
  });

  it('gibt vertragId null wenn Vertrag existiert aber nicht unterschrieben ist', async () => {
    const mock = makeFindMock({
      vertraege: [{ id: 'v1', unterschriebener_vertrag_url: null, dropbox_file_url: null, kooperation_id: 'k1' }]
    });

    const result = await findSignedVertragForKooperation('k1', mock);
    expect(result.ok).toBe(true);
    expect(result.vertragId).toBeNull();
  });

  it('gibt Fehler wenn Kooperation nicht gefunden wird', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Not found' }
            }))
          }))
        }))
      }))
    };

    const result = await findSignedVertragForKooperation('unknown', mockSupabase);
    expect(result.ok).toBe(false);
    expect(result.vertragId).toBeNull();
    expect(result.message).toBeTruthy();
  });

});

describe('backfillRechnungVertragId', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeSupabaseMock({ koops = [], updated = [], koopError = null, updateError = null } = {}) {
    const updateMock = vi.fn(() => ({
      is: vi.fn(() => ({
        in: vi.fn(() => ({
          select: vi.fn(() => Promise.resolve({ data: updated, error: updateError }))
        }))
      }))
    }));

    return {
      from: vi.fn((table) => {
        if (table === 'kooperationen') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ data: koops, error: koopError }))
              }))
            }))
          };
        }
        if (table === 'rechnung') {
          return { update: updateMock };
        }
      }),
      _updateMock: updateMock
    };
  }

  it('verknuepft Rechnungen mit vertrag_id=NULL zur selben creator+kampagne', async () => {
    const mock = makeSupabaseMock({
      koops: [{ id: 'k1' }, { id: 'k2' }],
      updated: [{ id: 'r1' }, { id: 'r2' }]
    });

    const result = await backfillRechnungVertragId('v1', 'creator1', 'kamp1', mock);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(2);
    expect(mock._updateMock).toHaveBeenCalledWith({ vertrag_id: 'v1' });
  });

  it('gibt updatedCount=0 zurueck wenn keine passenden Kooperationen existieren', async () => {
    const mock = makeSupabaseMock({ koops: [] });

    const result = await backfillRechnungVertragId('v1', 'creator1', 'kamp1', mock);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(0);
    expect(mock._updateMock).not.toHaveBeenCalled();
  });

  it('gibt updatedCount=0 zurueck wenn keine Rechnungen verknuepft werden muessen', async () => {
    const mock = makeSupabaseMock({
      koops: [{ id: 'k1' }],
      updated: []
    });

    const result = await backfillRechnungVertragId('v1', 'creator1', 'kamp1', mock);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(0);
  });

  it('gibt Fehler zurueck wenn Argumente fehlen', async () => {
    const mock = makeSupabaseMock();

    const result = await backfillRechnungVertragId(null, 'creator1', 'kamp1', mock);

    expect(result.success).toBe(false);
    expect(result.updatedCount).toBe(0);
    expect(result.error).toBeTruthy();
  });

  it('gibt Fehler zurueck wenn Kooperationen-Query fehlschlaegt', async () => {
    const mock = makeSupabaseMock({
      koopError: { message: 'DB error' }
    });

    const result = await backfillRechnungVertragId('v1', 'creator1', 'kamp1', mock);

    expect(result.success).toBe(false);
    expect(result.updatedCount).toBe(0);
    expect(result.error).toBeTruthy();
  });

  it('gibt Fehler zurueck wenn Rechnungs-Update fehlschlaegt', async () => {
    const mock = makeSupabaseMock({
      koops: [{ id: 'k1' }],
      updateError: { message: 'Update failed' }
    });

    const result = await backfillRechnungVertragId('v1', 'creator1', 'kamp1', mock);

    expect(result.success).toBe(false);
    expect(result.updatedCount).toBe(0);
    expect(result.error).toBeTruthy();
  });

});
