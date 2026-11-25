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

  it('gibt vertragId des unterschriebenen Vertrags zurueck, der die Kooperation deckt', async () => {
    const mock = makeFindMock({
      vertraege: [{ id: 'v1', unterschriebener_vertrag_url: 'https://signed.pdf', kooperation_id: 'k1' }]
    });

    const result = await findSignedVertragForKooperation('k1', mock);
    expect(result.ok).toBe(true);
    expect(result.vertragId).toBe('v1');
  });

  it('bevorzugt den signierten Vertrag, der die Kooperation deckt', async () => {
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

  it('nimmt einen Vertrag, der die Kooperation ueber die Junction deckt (zweite Linie)', async () => {
    const mock = makeFindMock({
      koop: { id: 'k-zweite', creator_id: 'c1', kampagne_id: 'kamp1' },
      vertraege: [{
        id: 'v-stamm',
        dropbox_file_url: 'https://signed.pdf',
        kooperation_id: 'k-erste',
        vertrag_kooperation: [{ kooperation_id: 'k-erste' }, { kooperation_id: 'k-zweite' }]
      }]
    });

    const result = await findSignedVertragForKooperation('k-zweite', mock);
    expect(result.ok).toBe(true);
    expect(result.vertragId).toBe('v-stamm');
  });

  it('weicht nicht mehr auf einen fremden Vertrag derselben Kampagne aus', async () => {
    const mock = makeFindMock({
      koop: { id: 'k-target', creator_id: 'c1', kampagne_id: 'kamp1' },
      vertraege: [
        { id: 'v-other', unterschriebener_vertrag_url: 'https://a.pdf', kooperation_id: 'k-other',
          vertrag_kooperation: [{ kooperation_id: 'k-other' }] }
      ]
    });

    const result = await findSignedVertragForKooperation('k-target', mock);
    expect(result.ok).toBe(true);
    expect(result.vertragId).toBeNull();
  });

  it('ignoriert abgelehnte Vertraege', async () => {
    const mock = makeFindMock({
      vertraege: [{ id: 'v1', status: 'abgelehnt', dropbox_file_url: 'https://a.pdf', kooperation_id: 'k1' }]
    });

    const result = await findSignedVertragForKooperation('k1', mock);
    expect(result.vertragId).toBeNull();
  });

  it('gibt vertragId null wenn kein Vertrag fuer Creator und Kampagne existiert', async () => {
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

  // junction: Kooperationen, die der Vertrag deckt; erzeuger: vertraege.kooperation_id
  function makeSupabaseMock({ junction = [], erzeuger = [], updated = [], junctionError = null, updateError = null } = {}) {
    const inMock = vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: updated, error: updateError }))
    }));
    const updateMock = vi.fn(() => ({ is: vi.fn(() => ({ in: inMock })) }));

    return {
      from: vi.fn((table) => {
        if (table === 'vertrag_kooperation') {
          return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: junction, error: junctionError })) })) };
        }
        if (table === 'vertraege') {
          return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: erzeuger, error: null })) })) };
        }
        if (table === 'rechnung') {
          return { update: updateMock };
        }
      }),
      _updateMock: updateMock,
      _inMock: inMock
    };
  }

  it('verknuepft Rechnungen aller gedeckten Kooperationen', async () => {
    const mock = makeSupabaseMock({
      junction: [{ kooperation_id: 'k1' }, { kooperation_id: 'k2' }],
      erzeuger: [{ kooperation_id: 'k1' }],
      updated: [{ id: 'r1' }, { id: 'r2' }]
    });

    const result = await backfillRechnungVertragId('v1', mock);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(2);
    expect(mock._updateMock).toHaveBeenCalledWith({ vertrag_id: 'v1' });
    expect(mock._inMock).toHaveBeenCalledWith('kooperation_id', ['k1', 'k2']);
  });

  it('fasst keine Kooperation an, die der Vertrag nicht deckt', async () => {
    const mock = makeSupabaseMock({
      junction: [{ kooperation_id: 'k1' }],
      erzeuger: [{ kooperation_id: 'k1' }],
      updated: [{ id: 'r1' }]
    });

    await backfillRechnungVertragId('v1', mock);

    const ids = mock._inMock.mock.calls[0][1];
    expect(ids).toEqual(['k1']);
    expect(ids).not.toContain('k-nicht-gedeckt');
  });

  it('nimmt die Erzeuger-Kooperation auch ohne Junction-Zeile (Altbestand)', async () => {
    const mock = makeSupabaseMock({ junction: [], erzeuger: [{ kooperation_id: 'k9' }], updated: [] });

    const result = await backfillRechnungVertragId('v1', mock);

    expect(result.success).toBe(true);
    expect(mock._inMock).toHaveBeenCalledWith('kooperation_id', ['k9']);
  });

  it('gibt updatedCount=0 zurueck wenn der Vertrag keine Kooperation deckt', async () => {
    const mock = makeSupabaseMock({ junction: [], erzeuger: [{ kooperation_id: null }] });

    const result = await backfillRechnungVertragId('v1', mock);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(0);
    expect(mock._updateMock).not.toHaveBeenCalled();
  });

  it('gibt Fehler zurueck wenn die vertragId fehlt', async () => {
    const mock = makeSupabaseMock();

    const result = await backfillRechnungVertragId(null, mock);

    expect(result.success).toBe(false);
    expect(result.updatedCount).toBe(0);
    expect(result.error).toBeTruthy();
  });

  it('gibt Fehler zurueck wenn die Junction-Abfrage fehlschlaegt', async () => {
    const mock = makeSupabaseMock({ junctionError: { message: 'DB error' } });

    const result = await backfillRechnungVertragId('v1', mock);

    expect(result.success).toBe(false);
    expect(result.updatedCount).toBe(0);
    expect(result.error).toBeTruthy();
  });

  it('gibt Fehler zurueck wenn Rechnungs-Update fehlschlaegt', async () => {
    const mock = makeSupabaseMock({
      junction: [{ kooperation_id: 'k1' }],
      updateError: { message: 'Update failed' }
    });

    const result = await backfillRechnungVertragId('v1', mock);

    expect(result.success).toBe(false);
    expect(result.updatedCount).toBe(0);
    expect(result.error).toBeTruthy();
  });

});
