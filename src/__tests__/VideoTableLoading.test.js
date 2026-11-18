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
vi.mock('../../core/VideoDeleteHelper.js', () => ({ syncVideoAssetsAfterDelete: vi.fn() }));
vi.mock('../../core/VertragSyncHelper.js', () => ({ renderVertragCell: vi.fn() }));

import { KampagneKooperationenVideoTable } from '../modules/kampagne/KampagneKooperationenVideoTable.js';
import { renderStatusSelect, KOOP_STATUS_FIELD } from '../modules/kampagne/videoTableKoopCells.js';

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

  describe('Status-Spalte als TableSelect', () => {
    const koop = { id: 'k-1', status_id: 's2', status_name: 'Aktiv' };
    const optionen = [{ id: 's1', name: 'Neu' }, { id: 's2', name: 'Aktiv' }];

    it('rendert den zentralen TableSelect mit aktuellem Status', () => {
      window.permissionSystem = { canEditField: () => true };
      const doc = new DOMParser().parseFromString(renderStatusSelect({ statusOptions: optionen }, koop), 'text/html');

      const select = doc.querySelector('.table-select');
      expect(select.dataset.field).toBe(KOOP_STATUS_FIELD);
      expect(select.dataset.itemId).toBe('k-1');
      expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Aktiv');
      expect(select.querySelector('button.table-select__trigger')).not.toBeNull();
      expect(select.querySelectorAll('.table-select__item').length).toBe(3);
      expect(select.querySelector('.table-select__item.is-active').dataset.value).toBe('s2');
    });

    it('zeigt ohne Status den Platzhalter und markiert keinen Eintrag', () => {
      window.permissionSystem = { canEditField: () => true };
      const doc = new DOMParser().parseFromString(
        renderStatusSelect({ statusOptions: optionen }, { id: 'k-2', status_id: null }), 'text/html');

      expect(doc.querySelector('.table-select__label').textContent.trim()).toBe('–');
      expect(doc.querySelector('.table-select__item.is-active')).toBeNull();
    });

    it('rendert ohne Edit-Recht einen nicht klickbaren Trigger', () => {
      window.permissionSystem = { canEditField: () => false };
      const doc = new DOMParser().parseFromString(renderStatusSelect({ statusOptions: optionen }, koop), 'text/html');

      expect(doc.querySelector('button.table-select__trigger')).toBeNull();
      expect(doc.querySelector('.table-select__trigger--disabled')).not.toBeNull();
      expect(doc.querySelector('.table-select__label').textContent.trim()).toBe('Aktiv');
    });
  });
});
