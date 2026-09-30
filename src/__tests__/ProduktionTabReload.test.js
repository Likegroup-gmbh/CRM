import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../modules/kampagne/KampagneDetailDataLoader.js', () => ({
  loadCriticalData: vi.fn(),
  loadFullTableData: vi.fn()
}));

import { loadFullTableData } from '../modules/kampagne/KampagneDetailDataLoader.js';
import { KampagneDetail } from '../modules/kampagne/KampagneDetail.js';
import { KampagneKooperationenVideoTable } from '../modules/kampagne/KampagneKooperationenVideoTable.js';
import { VideoTableRealtimeHandler } from '../modules/kampagne/VideoTableRealtimeHandler.js';

function detailStub() {
  const detail = new KampagneDetail();
  detail._isMounted = true;
  detail.kampagneId = 'k1';
  detail.store = {};
  detail.isKunde = false;
  detail.mode = 'workflow';
  detail.produktionId = 'p1';
  detail.currentView = 'table';
  detail._refreshSummaryCards = vi.fn();
  detail.kooperationenVideoTable = { refilter: vi.fn() };
  return detail;
}

describe('reloadKooperationTable', () => {
  beforeEach(() => {
    loadFullTableData.mockReset();
    loadFullTableData.mockResolvedValue(undefined);
  });

  it('lädt die Kooperationen der offenen Produktion und zeichnet die Tabelle neu', async () => {
    const detail = detailStub();

    await detail.reloadKooperationTable();

    expect(loadFullTableData).toHaveBeenCalledWith('k1', detail.store, false, { produktionId: 'p1' });
    expect(detail._refreshSummaryCards).toHaveBeenCalled();
    expect(detail.kooperationenVideoTable.refilter).toHaveBeenCalled();
  });

  it('reiht einen zweiten Lauf hinter den laufenden', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    loadFullTableData.mockImplementationOnce(() => gate);
    const detail = detailStub();

    const first = detail.reloadKooperationTable();
    const second = detail.reloadKooperationTable();
    expect(loadFullTableData).toHaveBeenCalledTimes(1);

    release();
    await first;
    await second;
    await vi.waitUntil(() => loadFullTableData.mock.calls.length === 2);

    expect(loadFullTableData).toHaveBeenCalledTimes(2);
  });
});

describe('Produktion-Tab nach dem Anlegen', () => {
  beforeEach(() => {
    loadFullTableData.mockReset();
    loadFullTableData.mockResolvedValue(undefined);
    document.body.innerHTML = '<div class="main-content"><div id="kooperationen-videos-container"></div></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('lädt beim entityUpdated created neu', async () => {
    const detail = detailStub();
    detail.kooperationenVideoTable = {
      render: () => '',
      bindEvents: () => {},
      initFloatingScrollbar: () => {},
      initRealtimeSubscription: () => {},
      loadColumnWidths: () => {},
      updateTabCounts: () => {},
      loadAssetsAndCommentsForVisible: async () => {},
      handleKooperationDeletedById: vi.fn(),
      refilter: vi.fn(),
      attachGlobalHandlers(host) {
        KampagneKooperationenVideoTable.prototype.attachGlobalHandlers.call(this, host);
      }
    };

    await detail._mountVideoTable();
    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'kooperation', action: 'created', id: 'koop-1' }
    }));
    await vi.waitUntil(() => loadFullTableData.mock.calls.length === 1);

    expect(loadFullTableData).toHaveBeenCalledWith('k1', detail.store, false, { produktionId: 'p1' });
    window.removeEventListener('entityUpdated', detail.kooperationenVideoTable._entityUpdatedHandler);
  });
});

describe('Realtime bei leerer Kooperationstabelle', () => {
  afterEach(() => {
    delete window.supabase;
  });

  it('abonniert auch ohne bestehende Kooperation', () => {
    const api = { on: vi.fn(() => api), subscribe: vi.fn(() => api) };
    window.supabase = { channel: vi.fn(() => api) };
    const table = { kooperationen: [], kampagneId: 'k1' };
    const handler = new VideoTableRealtimeHandler(table);

    handler.initRealtimeSubscription();

    expect(window.supabase.channel).toHaveBeenCalledWith(
      'kampagne-koops-videos-k1',
      { config: { broadcast: { self: false } } }
    );
  });

  it('lädt nur die Kooperation der offenen Produktion nach', async () => {
    const reload = vi.fn();
    const table = {
      kampagneId: 'k1',
      produktionId: 'p1',
      reloadKooperationen: reload,
      refilter: vi.fn()
    };
    const handler = new VideoTableRealtimeHandler(table);

    await handler.handleNewKooperation({
      new: { kampagne_id: 'k1', produktion_id: 'andere' }
    });
    expect(reload).not.toHaveBeenCalled();

    await handler.handleNewKooperation({
      new: { kampagne_id: 'k1', produktion_id: 'p1' }
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
