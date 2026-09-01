import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../core/loaders/ParallelQueryHelper.js', () => ({ parallelLoad: vi.fn() }));
vi.mock('../modules/kampagne/VideoTableRealtimeHandler.js', () => ({
  VideoTableRealtimeHandler: class { subscribe() {} unsubscribe() {} }
}));
vi.mock('../modules/kampagne/VideoTableUIHelpers.js', () => ({
  VideoTableUIHelpers: class {
    startPerformanceTracking() {}
    endPerformanceTracking() {}
    logPerformanceSummary() {}
    updateLoadingProgress() {}
    removeLoadingProgress() {}
  }
}));
vi.mock('../modules/kampagne/VideoUploadDrawer.js', () => ({ VideoUploadDrawer: class {} }));
vi.mock('../modules/kampagne/VideoSettingsDrawer.js', () => ({ VideoSettingsDrawer: class {} }));
vi.mock('../core/VideoDeleteHelper.js', () => ({ deleteVideoFile: vi.fn() }));
vi.mock('../core/VertragSyncHelper.js', () => ({ renderVertragCell: vi.fn() }));

import { VideoTableRenderer } from '../modules/kampagne/VideoTableRenderer.js';
import { VideoTableDataLoader } from '../modules/kampagne/VideoTableDataLoader.js';
import { KampagneDetailStore } from '../modules/kampagne/KampagneDetailStore.js';
import { KampagneKooperationenVideoTable } from '../modules/kampagne/KampagneKooperationenVideoTable.js';

function makeTable({ isKunde = false } = {}) {
  return {
    videos: {},
    store: null,
    hiddenColumns: [],
    isKundeRole: () => isKunde,
    isFieldEditableForUser: () => !isKunde,
    escapeHtml(text) {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },
  };
}

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

describe('Finale-Spalte – Kunden-Play-Button', () => {
  it('zeigt ohne finalAssets einen Bindestrich fuer Kunden', () => {
    const table = makeTable({ isKunde: true });
    const renderer = new VideoTableRenderer(table);
    const html = renderer.renderFinaleVersionCell({ id: 'k1' }, { id: 'v1' });
    expect(html).toContain('no-content-placeholder');
    expect(html).not.toContain('play-final');
    expect(html).not.toContain('finale-upload-btn');
  });

  it('zeigt Kunden einen Play-Button sobald finalAssets da sind', () => {
    const table = makeTable({ isKunde: true });
    const renderer = new VideoTableRenderer(table);
    const html = renderer.renderFinaleVersionCell({ id: 'k1' }, {
      id: 'v1',
      finalAssets: [{ id: 'f1', variant_name: '9:16' }],
    });
    expect(html).toContain('data-action="play-final"');
    expect(html).toContain('9:16');
    expect(html).not.toContain('finale-upload-btn');
  });

  it('zeigt ein markiertes Still in der Finale-Spalte', () => {
    const table = makeTable({ isKunde: true });
    const renderer = new VideoTableRenderer(table);
    const html = renderer.renderFinaleVersionCell({
      id: 'k1',
      _bilder: [{ id: 's1', video_id: 'v1', is_final: true, variant_name: 'Still', file_url: 'https://x/s.jpg' }],
    }, { id: 'v1', finalAssets: [] });
    expect(html).toContain('data-action="play-final-still"');
    expect(html).toContain('Still');
    expect(html).toContain('finale-still-thumb');
    expect(html).toContain('https://x/s.jpg');
  });

  it('behaelt das Icon als Fallback wenn das Thumb nicht laedt', () => {
    const table = makeTable({ isKunde: true });
    const renderer = new VideoTableRenderer(table);
    document.body.innerHTML = renderer.renderFinaleVersionCell({
      id: 'k1',
      _bilder: [{ id: 's1', video_id: 'v1', is_final: true, variant_name: 'Still', file_url: 'https://x/s.jpg' }],
    }, { id: 'v1', finalAssets: [] });

    const media = document.querySelector('.finale-still-media');
    expect(media.querySelector('svg')).not.toBeNull();
    media.querySelector('img.finale-still-thumb').remove();
    expect(media.querySelector('svg')).not.toBeNull();
  });

  it('zeigt bei SharePoint-Stills nur das Icon statt eines kaputten Bildes', () => {
    const table = makeTable({ isKunde: true });
    const renderer = new VideoTableRenderer(table);
    const html = renderer.renderFinaleVersionCell({
      id: 'k1',
      _bilder: [{
        id: 's1',
        video_id: 'v1',
        is_final: true,
        variant_name: 'Still',
        file_url: 'https://contoso-my.sharepoint.com/:i:/g/personal/a/abc',
      }],
    }, { id: 'v1', finalAssets: [] });
    expect(html).toContain('data-action="play-final-still"');
    expect(html).not.toContain('finale-still-thumb');
    expect(html).not.toContain('sharepoint.com');
  });
});

describe('Stills-Spalte', () => {
  it('zeigt Upload fuer Staff wenn keine Stills da sind', () => {
    const table = makeTable({ isKunde: false });
    const renderer = new VideoTableRenderer(table);
    const html = renderer.renderStillsCell({ id: 'k1', _bilder: [] }, { id: 'v1' });
    expect(html).toContain('stills-upload-btn');
  });

  it('zeigt Ansehen ohne Upload fuer Kunden', () => {
    const table = makeTable({ isKunde: true });
    const renderer = new VideoTableRenderer(table);
    const html = renderer.renderStillsCell({
      id: 'k1',
      _bilder: [{ id: 's1', video_id: 'v1', is_final: false, file_url: 'https://x/s.jpg' }],
    }, { id: 'v1' });
    expect(html).toContain('data-action="view-bilder"');
    expect(html).not.toContain('stills-upload-btn');
  });

  it('zeigt Ansehen wenn nur ein finales Still existiert', () => {
    const table = makeTable({ isKunde: false });
    const renderer = new VideoTableRenderer(table);
    const html = renderer.renderStillsCell({
      id: 'k1',
      _bilder: [{ id: 's1', video_id: 'v1', is_final: true, variant_name: 'Still' }],
    }, { id: 'v1' });
    expect(html).toContain('data-action="view-bilder"');
    expect(html).not.toContain('stills-upload-btn');
  });
});

describe('Finale-Spalte – Asset-Hydrate', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="grid">
        <div class="col-finale-version">
          <div class="video-field-wrapper" data-video-id="v1">
            <span class="no-content-placeholder">—</span>
          </div>
        </div>
      </div>
    `;
  });

  function setupLoader({ finalResult }) {
    window.supabase = {
      from: vi.fn((tableName) => {
        if (tableName === 'kooperation_video_asset') {
          const mock = createChainableQuery({ data: [], error: null });
          mock.select = vi.fn((cols) => {
            mock._result = cols.includes('variant_name')
              ? finalResult
              : { data: [], error: null };
            return mock;
          });
          return mock;
        }
        return createChainableQuery({ data: [], error: null });
      }),
    };

    const table = makeTable({ isKunde: true });
    table.containerId = 'grid';
    table.kooperationen = [{ id: 'k1' }];
    table.videos = { k1: [{ id: 'v1' }] };
    table.videoComments = {};
    table.renderer = new VideoTableRenderer(table);
    return { table, loader: new VideoTableDataLoader(table) };
  }

  it('patched die Finale-Zelle nach dem Laden und liefert finalsOk', async () => {
    const { loader } = setupLoader({
      finalResult: {
        data: [{
          id: 'f1', video_id: 'v1', file_url: 'https://x', file_path: '/Finale_Version/a.mp4',
          variant_name: '9:16', is_final: true, created_at: '2026-08-20T00:00:00Z',
        }],
        error: null,
      },
    });

    const result = await loader.loadAssetsAndComments(['v1']);
    expect(result.finalsOk).toBe(true);
    const cell = document.querySelector('.col-finale-version .video-field-wrapper[data-video-id="v1"]');
    expect(cell.querySelector('[data-action="play-final"]')).not.toBeNull();
    expect(cell.textContent).toContain('9:16');
  });

  it('markiert Videos nicht als geladen wenn die Final-Query fehlschlaegt', async () => {
    const { table, loader } = setupLoader({
      finalResult: { data: null, error: { message: 'statement timeout' } },
    });
    const store = new KampagneDetailStore('kamp-1');
    store.setVideos({ k1: [{ id: 'v1' }] });
    table.store = store;
    table.videos = store.videos;
    table.dataLoader = loader;
    table.refilter = vi.fn();

    await KampagneKooperationenVideoTable.prototype.loadAssetsAndCommentsForVisible.call(table);
    expect(store.getUnloadedVideoIds(['v1'])).toEqual(['v1']);
  });
});

describe('Finale-Spalte – Bilder-Hydrate', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="grid">
        <div class="col-finale-version">
          <div class="video-field-wrapper" data-video-id="v1">
            <span class="no-content-placeholder">—</span>
          </div>
        </div>
        <div class="col-stills">
          <div class="video-field-wrapper" data-video-id="v1">
            <button type="button" class="stills-upload-btn">Upload</button>
          </div>
        </div>
      </div>
    `;
  });

  it('patched die Finale- und Stills-Zelle nach loadBilder', async () => {
    window.supabase = {
      from: vi.fn(() => createChainableQuery({
        data: [{
          id: 's1',
          kooperation_id: 'k1',
          video_id: 'v1',
          is_final: true,
          variant_name: 'Still',
          file_url: 'https://cdn.example.com/s.jpg',
        }],
        error: null,
      })),
    };

    const table = makeTable({ isKunde: true });
    table.containerId = 'grid';
    table.kooperationen = [{ id: 'k1' }];
    table.videos = { k1: [{ id: 'v1', finalAssets: [] }] };
    table.renderer = new VideoTableRenderer(table);
    const loader = new VideoTableDataLoader(table);

    await loader.loadBilder(['k1']);

    expect(table.kooperationen[0]._bilder).toHaveLength(1);
    const finale = document.querySelector('.col-finale-version .video-field-wrapper[data-video-id="v1"]');
    expect(finale.querySelector('[data-action="play-final-still"]')).not.toBeNull();
    expect(finale.querySelector('img.finale-still-thumb')).not.toBeNull();
    const stills = document.querySelector('.col-stills .video-field-wrapper[data-video-id="v1"]');
    expect(stills.querySelector('[data-action="view-bilder"]')).not.toBeNull();
  });

  it('zieht Stills nach, wenn die Detailseite die Tabelle als geladen markiert', async () => {
    window.supabase = {
      from: vi.fn((tableName) => createChainableQuery(
        tableName === 'kooperation_bilder_asset'
          ? {
              data: [{
                id: 's1',
                kooperation_id: 'k1',
                video_id: 'v1',
                is_final: true,
                variant_name: 'Still',
                file_url: 'https://cdn.example.com/s.jpg',
              }],
              error: null,
            }
          : { data: [], error: null }
      )),
    };

    const table = makeTable();
    table.containerId = 'grid';
    table.store = null;
    table.kooperationen = [{ id: 'k1' }];
    table.videos = { k1: [{ id: 'v1', finalAssets: [] }] };
    table.videoComments = {};
    table.stillComments = {};
    table.renderer = new VideoTableRenderer(table);
    table.dataLoader = new VideoTableDataLoader(table);
    // Wie auf der Detailseite: Daten gelten als geladen, loadData laeuft nicht.
    table._dataLoaded = true;

    await KampagneKooperationenVideoTable.prototype.loadAssetsAndCommentsForVisible.call(table);

    expect(table.kooperationen[0]._bilder).toHaveLength(1);
    const finale = document.querySelector('.col-finale-version .video-field-wrapper[data-video-id="v1"]');
    expect(finale.querySelector('[data-action="play-final-still"]')).not.toBeNull();
  });

  it('fragt Stills nicht erneut ab, wenn sie schon geladen sind', async () => {
    const from = vi.fn(() => createChainableQuery({ data: [], error: null }));
    window.supabase = { from };

    const table = makeTable();
    table.kooperationen = [{ id: 'k1', _bilder: [] }];
    const loader = new VideoTableDataLoader(table);

    await loader.loadBilderForVisible();
    expect(from).not.toHaveBeenCalled();
  });

  it('ueberschreibt vorhandene Stills nicht wenn die Query fehlschlaegt', async () => {
    window.supabase = {
      from: vi.fn(() => createChainableQuery({
        data: null,
        error: { message: 'column source_asset_id does not exist' },
      })),
    };

    const table = makeTable();
    table.kooperationen = [{
      id: 'k1',
      _bilder: [{ id: 'keep', video_id: 'v1', is_final: true }],
    }];
    table.videos = { k1: [{ id: 'v1' }] };
    table.renderer = new VideoTableRenderer(table);
    const loader = new VideoTableDataLoader(table);

    await loader.loadBilder(['k1']);
    expect(table.kooperationen[0]._bilder.map(b => b.id)).toEqual(['keep']);
  });
});
