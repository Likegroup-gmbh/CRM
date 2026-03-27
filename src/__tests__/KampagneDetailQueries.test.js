import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KampagneDetail } from '../modules/kampagne/KampagneDetail.js';

function createQueryMock(result = { data: [], error: null }) {
  const mock = {
    _result: result,
    select: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    in: vi.fn(() => mock),
    single: vi.fn(() => Promise.resolve(mock._result)),
    order: vi.fn(() => mock),
    then: (resolve) => resolve(mock._result),
  };
  return mock;
}

function setupSupabaseMock(mitarbeiterByRoleData = []) {
  const fromCalls = {};

  const kampagneData = {
    id: 'k1',
    kampagnenname: 'Test-Kampagne',
    status_id: 's1',
    unternehmen_id: 'u1',
    marke_id: 'm1',
    auftrag_id: 'a1',
    art_der_kampagne: [],
    unternehmen: { firmenname: 'TestGmbH', webseite: null, branche_id: null },
    marke: { markenname: 'TestMarke', webseite: null },
    auftrag: { auftragsname: 'Auftrag1', status: 'aktiv', gesamt_budget: 1000, creator_budget: 500, bruttobetrag: 1190, nettobetrag: 1000 },
  };

  window.supabase = {
    from: vi.fn((table) => {
      fromCalls[table] = (fromCalls[table] || 0) + 1;

      if (table === 'kampagne') {
        const q = createQueryMock({ data: kampagneData, error: null });
        q.single = vi.fn(() => Promise.resolve({ data: kampagneData, error: null }));
        return q;
      }

      if (table === 'kampagne_mitarbeiter') {
        return createQueryMock({ data: mitarbeiterByRoleData, error: null });
      }

      if (table === 'creator_auswahl' || table === 'vertraege' || table === 'rechnungen') {
        return createQueryMock({ data: null, error: null, count: 0 });
      }

      return createQueryMock({ data: [], error: null });
    }),
  };

  window.notizenSystem = { loadNotizen: vi.fn(async () => []) };
  window.bewertungsSystem = { loadBewertungen: vi.fn(async () => []) };
  window.currentUser = { rolle: 'admin' };

  return fromCalls;
}

describe('KampagneDetail – Mitarbeiter-Rollen Query-Konsolidierung', () => {
  let detail;

  beforeEach(() => {
    vi.clearAllMocks();
    detail = new KampagneDetail();
    detail.kampagneId = 'k1';
  });

  it('fragt kampagne_mitarbeiter nur EINMAL ab (statt vier Mal pro Rolle)', async () => {
    const fromCalls = setupSupabaseMock([
      { role: 'cutter', mitarbeiter: { id: 'c1', name: 'Anna Cutter' } },
      { role: 'copywriter', mitarbeiter: { id: 'cw1', name: 'Ben Copy' } },
      { role: 'strategie', mitarbeiter: { id: 's1', name: 'Clara Strat' } },
      { role: 'creator_sourcing', mitarbeiter: { id: 'cs1', name: 'Dan Sourcing' } },
    ]);

    await detail.loadCriticalData();

    expect(fromCalls['kampagne_mitarbeiter']).toBe(1);
  });

  it('gruppiert Mitarbeiter korrekt nach Rolle aus einer Query', async () => {
    setupSupabaseMock([
      { role: 'cutter', mitarbeiter: { id: 'c1', name: 'Anna Cutter' } },
      { role: 'cutter', mitarbeiter: { id: 'c2', name: 'Eva Cutter2' } },
      { role: 'copywriter', mitarbeiter: { id: 'cw1', name: 'Ben Copy' } },
      { role: 'strategie', mitarbeiter: { id: 's1', name: 'Clara Strat' } },
      { role: 'creator_sourcing', mitarbeiter: { id: 'cs1', name: 'Dan Sourcing' } },
    ]);

    await detail.loadCriticalData();

    expect(detail.kampagneData.cutter).toEqual([
      { id: 'c1', name: 'Anna Cutter' },
      { id: 'c2', name: 'Eva Cutter2' },
    ]);
    expect(detail.kampagneData.cutter_ids).toEqual(['c1', 'c2']);
    expect(detail.kampagneData.copywriter).toEqual([{ id: 'cw1', name: 'Ben Copy' }]);
    expect(detail.kampagneData.copywriter_ids).toEqual(['cw1']);
    expect(detail.kampagneData.strategie).toEqual([{ id: 's1', name: 'Clara Strat' }]);
    expect(detail.kampagneData.strategie_ids).toEqual(['s1']);
    expect(detail.kampagneData.creator_sourcing).toEqual([{ id: 'cs1', name: 'Dan Sourcing' }]);
    expect(detail.kampagneData.creator_sourcing_ids).toEqual(['cs1']);
  });

  it('lädt Kooperationen NICHT in loadCriticalData', async () => {
    const fromCalls = setupSupabaseMock([]);

    await detail.loadCriticalData();

    expect(fromCalls['kooperationen']).toBeUndefined();
  });

  it('referenziert kein nicht-existierendes loadKampagneData in Event-Handlern', async () => {
    setupSupabaseMock([]);
    await detail.loadCriticalData();

    // Simuliere was die Event-Handler tun:
    // Zeile ~1916: await this.loadKampagneData()
    // Zeile ~1940: await this.loadKampagneData()
    // Zeile ~2415: this.loadKampagneData().then(...)
    // All diese sollten loadCriticalData aufrufen statt loadKampagneData
    const refreshMethod = detail.refreshData ?? detail.loadCriticalData;
    expect(typeof refreshMethod).toBe('function');

    // loadKampagneData darf NICHT im Quellcode referenziert werden
    const source = KampagneDetail.toString();
    const hasDeadRef = source.includes('loadKampagneData');
    expect(hasDeadRef).toBe(false);
  });
});
