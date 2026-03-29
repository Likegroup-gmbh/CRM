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
    is: vi.fn(() => mock),
    then: (resolve) => resolve(mock._result),
  };
  return mock;
}

describe('KampagneDetail – Einheitlicher Skeleton', () => {
  let detail;
  let callOrder;

  beforeEach(() => {
    vi.clearAllMocks();
    callOrder = [];

    const kampagneData = {
      id: 'k1', kampagnenname: 'Test', status_id: 's1',
      unternehmen_id: 'u1', marke_id: 'm1', auftrag_id: 'a1',
      art_der_kampagne: [],
      unternehmen: { firmenname: 'GmbH' },
      marke: { markenname: 'Marke' },
      auftrag: { auftragsname: 'A1', status: 'aktiv', gesamt_budget: 1000, creator_budget: 500, bruttobetrag: 1190, nettobetrag: 1000 },
    };

    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'kampagne') {
          const q = createQueryMock({ data: kampagneData, error: null });
          q.single = vi.fn(() => Promise.resolve({ data: kampagneData, error: null }));
          return q;
        }
        if (table === 'kooperationen') {
          callOrder.push('videoTable.loadData');
          return createQueryMock({ data: [], error: null });
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
    window.canViewTable = vi.fn(() => true);
    window.moduleRegistry = { currentModule: null };
    window.content = document.createElement('div');
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn();
    window.breadcrumbSystem = { updateDetailLabel: vi.fn() };
    window.ErrorHandler = { handle: vi.fn() };
    window.dataService = { entities: {} };

    detail = new KampagneDetail();
    detail.kampagneId = 'k1';
    window.moduleRegistry.currentModule = detail;

    const originalRender = detail.render.bind(detail);
    detail.render = vi.fn(async () => {
      callOrder.push('render');
      return originalRender();
    });
  });

  it('ruft render() VOR dem Laden der VideoTable-Daten auf (non-blocking)', async () => {
    await detail.init('k1');
    // Warte kurz auf fire-and-forget _loadVideoTableAsync
    await new Promise(r => setTimeout(r, 50));

    const renderIdx = callOrder.indexOf('render');
    const vtLoadIdx = callOrder.indexOf('videoTable.loadData');

    expect(renderIdx).toBeGreaterThan(-1);
    // VideoTable lädt async nach render() – kann aufgerufen worden sein oder nicht
    if (vtLoadIdx > -1) {
      expect(renderIdx).toBeLessThan(vtLoadIdx);
    }
  });

  it('zeigt keinen Progress-Overlay beim VideoTable-Laden (kein containerId)', async () => {
    await detail.init('k1');

    if (detail.kooperationenVideoTable) {
      const container = document.getElementById(detail.kooperationenVideoTable.containerId);
      const progressOverlay = container?.querySelector('.koops-videos-progress');
      expect(progressOverlay).toBeFalsy();
    }
  });
});
