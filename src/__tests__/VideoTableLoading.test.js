import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../core/loaders/ParallelQueryHelper.js', () => ({ parallelLoad: vi.fn() }));
vi.mock('./VideoTableRealtimeHandler.js', () => ({
  VideoTableRealtimeHandler: class { subscribe() {} unsubscribe() {} }
}));
vi.mock('./VideoTableUIHelpers.js', () => ({
  VideoTableUIHelpers: class {
    startPerformanceTracking() {}
    endPerformanceTracking() {}
    logPerformanceSummary() {}
    updateLoadingProgress() {}
    removeLoadingProgress() {}
  }
}));
vi.mock('./VideoUploadDrawer.js', () => ({ VideoUploadDrawer: class {} }));
vi.mock('./VideoSettingsDrawer.js', () => ({ VideoSettingsDrawer: class {} }));
vi.mock('../../core/VideoDeleteHelper.js', () => ({ deleteVideoFile: vi.fn() }));
vi.mock('../../core/VertragSyncHelper.js', () => ({ renderVertragCell: vi.fn() }));

import { KampagneKooperationenVideoTable } from '../modules/kampagne/KampagneKooperationenVideoTable.js';

function createChainableQuery(result = { data: [], error: null }) {
  const mock = {
    _result: result,
    select: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    in: vi.fn(() => mock),
    is: vi.fn(() => mock),
    order: vi.fn(() => mock),
    then: (resolve) => resolve(mock._result),
  };
  return mock;
}

describe('KampagneKooperationenVideoTable – Ladeoptimierung', () => {
  let table;
  let queriedTables;

  beforeEach(() => {
    vi.clearAllMocks();
    queriedTables = [];

    window.currentUser = { id: 'u1', rolle: 'admin' };

    window.supabase = {
      from: vi.fn((tableName) => {
        queriedTables.push(tableName);
        if (tableName === 'kooperationen') {
          return createChainableQuery({
            data: [{
              id: 'koop1', name: 'Test', creator_id: 'c1',
              kampagne: { id: 'k1', kampagnenname: 'K1', unternehmen: { firmenname: 'U1' }, marke: { markenname: 'M1' } }
            }],
            error: null
          });
        }
        if (tableName === 'kooperation_videos') {
          return createChainableQuery({ data: [{ id: 'v1', kooperation_id: 'koop1', position: 1 }], error: null });
        }
        if (tableName === 'creator') {
          return createChainableQuery({ data: [{ id: 'c1', vorname: 'Max', nachname: 'M' }], error: null });
        }
        return createChainableQuery({ data: [], error: null });
      })
    };

    window.dataService = { entities: {} };

    table = new KampagneKooperationenVideoTable('k1');
  });

  // Zyklus 12: versand wird zusammen mit videos/creators geladen (nicht in separater Stufe)
  it('lädt versand parallel mit videos+creators statt in separater Stufe', async () => {
    await table.loadData();

    const versandIndex = queriedTables.indexOf('kooperation_versand');
    const videosIndex = queriedTables.indexOf('kooperation_videos');
    const assetIndex = queriedTables.indexOf('kooperation_video_asset');

    expect(versandIndex).toBeGreaterThan(-1);
    expect(videosIndex).toBeGreaterThan(-1);

    // versand muss VOR assets/comments geladen werden (= in Stufe 2, nicht Stufe 3)
    if (assetIndex > -1) {
      expect(versandIndex).toBeLessThan(assetIndex);
    }
    // versand soll in der gleichen Batch wie videos sein
    expect(versandIndex).toBeGreaterThan(videosIndex);
    expect(versandIndex).toBeLessThan(videosIndex + 4);
  });

  // Zyklus 13: Kooperationen von außen akzeptieren
  it('überspringt Kooperationen-Query wenn Daten vorab gesetzt', async () => {
    table.kooperationen = [{
      id: 'koop1', name: 'Extern', creator_id: 'c1',
      kampagne: { id: 'k1', kampagnenname: 'K1' }
    }];

    await table.loadData();

    expect(queriedTables).not.toContain('kooperationen');
  });

  it('positioniert das Portal nach oben wenn unten zu wenig Platz ist', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });

    const trigger = document.createElement('span');
    trigger.className = 'status-select-trigger';
    trigger.getBoundingClientRect = () => ({ top: 540, bottom: 570, left: 100, right: 280 });

    const portal = document.createElement('div');
    portal.className = 'status-dropdown-portal';
    Object.defineProperty(portal, 'offsetHeight', { configurable: true, value: 180 });
    Object.defineProperty(portal, 'offsetWidth', { configurable: true, value: 180 });
    document.body.appendChild(portal);

    table._positionStatusPortal(trigger, portal);

    // Unten 540+180 > 600 -> oeffnet nach oben: top = 540 - 180 - 4 = 356
    expect(portal.style.top).toBe('356px');
  });

  it('oeffnet das Status-Portal an document.body und schliesst es wieder', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });

    document.body.innerHTML = `
      <div class="status-select-wrapper" data-kooperation-id="k-1">
        <span class="status-select-trigger"></span>
        <div class="status-dropdown">
          <a href="#" class="status-dropdown-item" data-value="">kein Status</a>
        </div>
      </div>
    `;

    const wrapper = document.querySelector('.status-select-wrapper');
    const trigger = wrapper.querySelector('.status-select-trigger');
    trigger.getBoundingClientRect = () => ({ top: 100, bottom: 130, left: 50, right: 200 });

    const portal = table._openStatusPortal(wrapper);
    expect(portal).not.toBeNull();
    expect(document.querySelectorAll('.status-dropdown-portal').length).toBe(1);
    expect(portal.dataset.kooperationId).toBe('k-1');

    table._closeStatusPortal();
    expect(document.querySelectorAll('.status-dropdown-portal').length).toBe(0);
    expect(wrapper.classList.contains('open')).toBe(false);
  });
});
