import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreatorDetail } from '../modules/creator/CreatorDetail.js';

function createQueryMock(result = { data: [], error: null }) {
  const mock = {
    _result: result,
    select: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    in: vi.fn(() => mock),
    order: vi.fn(() => mock),
    then: (resolve) => resolve(mock._result),
  };
  return mock;
}

function setupSupabaseMock({
  kampagneCreator = [],
  kooperationen = [],
  kampagneDetails = [],
} = {}) {
  window.supabase = {
    from: vi.fn((table) => {
      if (table === 'kampagne_creator') {
        return createQueryMock({ data: kampagneCreator, error: null });
      }

      if (table === 'kooperationen') {
        return createQueryMock({ data: kooperationen, error: null });
      }

      if (table === 'kampagne') {
        return createQueryMock({ data: kampagneDetails, error: null });
      }

      return createQueryMock({ data: [], error: null });
    }),
  };
}

describe('CreatorDetail – Kampagnen aus Kooperationen', () => {
  let detail;

  beforeEach(() => {
    vi.clearAllMocks();
    detail = new CreatorDetail();
    detail.creatorId = 'creator-1';
    detail.kampagnen = [];
    detail.kooperationen = [];
  });

  it('lädt Kampagnen aus Kooperationen wenn kampagne_creator leer ist', async () => {
    setupSupabaseMock({
      kampagneCreator: [],
      kooperationen: [
        {
          id: 'koop-1',
          created_at: '2025-01-01',
          kampagne: { id: 'k1', kampagnenname: 'Kampagne A', eigener_name: null },
        },
        {
          id: 'koop-2',
          created_at: '2025-02-01',
          kampagne: { id: 'k2', kampagnenname: 'Kampagne B', eigener_name: null },
        },
      ],
      kampagneDetails: [
        {
          id: 'k1',
          kampagnenname: 'Kampagne A',
          unternehmen: { id: 'u1', firmenname: 'Firma A' },
          marke: { id: 'm1', markenname: 'Marke A' },
          start: '2025-01-15',
          creatoranzahl: 3,
          videoanzahl: 5,
        },
        {
          id: 'k2',
          kampagnenname: 'Kampagne B',
          unternehmen: { id: 'u2', firmenname: 'Firma B' },
          marke: { id: 'm2', markenname: 'Marke B' },
          start: '2025-02-15',
          creatoranzahl: 1,
          videoanzahl: 2,
        },
      ],
    });

    await detail.loadKampagnen();

    expect(detail.kampagnen).toHaveLength(2);
    expect(detail.kampagnen.map(e => e.kampagne.id).sort()).toEqual(['k1', 'k2']);
    expect(detail.kampagnen[0].kampagne.unternehmen?.firmenname).toBeTruthy();
  });

  it('dedupliziert Kampagnen aus kampagne_creator und Kooperationen', async () => {
    setupSupabaseMock({
      kampagneCreator: [
        {
          kampagne_id: 'k1',
          hinzugefuegt_am: '2024-12-01',
          kampagne: {
            id: 'k1',
            kampagnenname: 'Kampagne A',
            eigener_name: null,
            start: '2024-12-01',
            unternehmen: { id: 'u1', firmenname: 'Firma A' },
            marke: { id: 'm1', markenname: 'Marke A' },
          },
        },
      ],
      kooperationen: [
        {
          id: 'koop-1',
          created_at: '2025-01-01',
          kampagne: { id: 'k1', kampagnenname: 'Kampagne A', eigener_name: null },
        },
      ],
      kampagneDetails: [
        {
          id: 'k1',
          kampagnenname: 'Kampagne A',
          unternehmen: { id: 'u1', firmenname: 'Firma A' },
          marke: { id: 'm1', markenname: 'Marke A' },
        },
      ],
    });

    await detail.loadKampagnen();

    expect(detail.kampagnen).toHaveLength(1);
    expect(detail.kampagnen[0].kampagne.id).toBe('k1');
  });

  it('reichert Kooperations-Kampagnen mit Detailfeldern an', async () => {
    setupSupabaseMock({
      kampagneCreator: [],
      kooperationen: [
        {
          id: 'koop-1',
          created_at: '2025-01-01',
          kampagne: { id: 'k1', kampagnenname: 'Kampagne A', eigener_name: null },
        },
      ],
      kampagneDetails: [
        {
          id: 'k1',
          kampagnenname: 'Kampagne A',
          status: 'aktiv',
          start: '2025-03-01',
          deadline: '2025-06-01',
          art_der_kampagne: ['UGC'],
          creatoranzahl: 4,
          videoanzahl: 8,
          unternehmen: { id: 'u1', firmenname: 'Firma A' },
          marke: { id: 'm1', markenname: 'Marke A' },
        },
      ],
    });

    await detail.loadKampagnen();

    const kampagne = detail.kampagnen[0].kampagne;
    expect(kampagne.start).toBe('2025-03-01');
    expect(kampagne.deadline).toBe('2025-06-01');
    expect(kampagne.art_der_kampagne).toEqual(['UGC']);
    expect(kampagne.creatoranzahl).toBe(4);
    expect(kampagne.videoanzahl).toBe(8);
  });
});
