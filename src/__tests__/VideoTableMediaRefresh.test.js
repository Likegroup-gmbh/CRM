import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { refreshKoopMedia } from '../modules/kampagne/videoTableMediaRefresh.js';
import { KampagneDetailStore } from '../modules/kampagne/KampagneDetailStore.js';

function query(result) {
  const q = {
    select: vi.fn(() => q),
    in: vi.fn(() => q),
    order: vi.fn(() => q),
    then: (resolve) => resolve(result)
  };
  return q;
}

function wrapper(col, inner) {
  return `<td class="grid-cell ${col}" data-col-id="${col}"><div class="video-fields-stack">
    <div class="video-field-wrapper" data-video-id="v1">${inner}</div></div></td>`;
}

function setup({ video = {}, assets = [] } = {}) {
  document.body.innerHTML = `<div id="grid"><table class="kooperation-video-grid"><tbody>
    <tr class="kooperation-row" data-kooperation-id="k1">
      ${wrapper('col-link-content', 'alt')}
      ${wrapper('col-stills', '')}
      ${wrapper('col-finale-version', '')}
    </tr></tbody></table></div>`;

  const store = new KampagneDetailStore('kamp-1');
  store.setKooperationen([{ id: 'k1' }]);
  store.setVideos({ k1: [{ id: 'v1', kooperation_id: 'k1', asset_url: null, story_slots: [], ...video }] });

  const assetQuery = query({ data: assets, error: null });
  window.supabase = { from: vi.fn(() => assetQuery) };

  const table = {
    containerId: 'grid',
    store,
    get kooperationen() { return store.kooperationen; },
    get videos() { return store.videos; },
    dataLoader: { loadBilder: vi.fn(async () => {}) },
    _mediaViewer: { assetLoader: { invalidate: vi.fn() } },
    _rowHeightSync: { schedule: vi.fn() },
    refilter: vi.fn()
  };
  return { table, store, assetQuery };
}

const contentCell = () => document.querySelector('.col-link-content .video-field-wrapper[data-video-id="v1"]');

describe('refreshKoopMedia', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.canFeature = vi.fn((name) => name === 'mediaUpload');
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete window.supabase;
    delete window.canFeature;
  });

  it('zeigt eine neue Datei in der Content-Zelle, ohne die Tabelle neu zu zeichnen', async () => {
    const { table, store, assetQuery } = setup({
      assets: [
        { id: 'a1', video_id: 'v1', file_url: 'https://sp/v1.mp4', file_path: '/v1.mp4', version_number: 1, is_final: false, created_at: '2026-11-11T10:00:00Z' },
        { id: 'f1', video_id: 'v1', file_url: 'https://sp/f1.mp4', variant_name: '9-16', is_final: true, created_at: '2026-11-11T10:05:00Z' }
      ]
    });
    const row = document.querySelector('tr.kooperation-row');

    expect(await refreshKoopMedia(table, 'k1')).toBe(true);

    expect(assetQuery.in).toHaveBeenCalledWith('video_id', ['v1']);
    expect(contentCell().querySelector('[data-action="play-video"]')).not.toBeNull();
    expect(contentCell().querySelector('.video-settings-btn').dataset.filePath).toBe('/v1.mp4');
    expect(table.refilter).not.toHaveBeenCalled();
    expect(document.querySelector('tr.kooperation-row')).toBe(row);

    const video = store.videos.k1[0];
    expect(video.currentAsset.id).toBe('a1');
    expect(video.file_url).toBe('https://sp/v1.mp4');
    expect(video.finalAssets.map(a => a.id)).toEqual(['f1']);
    expect(video.story_slots).toBeUndefined();
    expect(store.getUnloadedVideoIds(['v1'])).toEqual([]);

    expect(table.dataLoader.loadBilder).toHaveBeenCalledWith(['k1']);
    expect(table._mediaViewer.assetLoader.invalidate).toHaveBeenCalledWith('v1');
    expect(table._rowHeightSync.schedule).toHaveBeenCalledWith(row);
    expect(row.classList.contains('realtime-updated')).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(row.classList.contains('realtime-updated')).toBe(false);
  });

  it('zeigt nach dem Löschen der letzten Datei wieder den Upload-Button', async () => {
    const { table, store } = setup({
      video: { currentAsset: { id: 'a1', file_url: 'https://sp/alt.mp4' }, file_url: 'https://sp/alt.mp4', finalAssets: [] },
      assets: []
    });

    await refreshKoopMedia(table, 'k1');

    expect(store.videos.k1[0].currentAsset).toBeNull();
    expect(store.videos.k1[0].file_url).toBeNull();
    expect(contentCell().querySelector('.video-upload-btn')).not.toBeNull();
    expect(contentCell().querySelector('[data-action="play-video"]')).toBeNull();
  });

  it('nimmt die Finale, wenn es keine Feedbackschleife gibt', async () => {
    const { table, store } = setup({
      assets: [{ id: 'f1', video_id: 'v1', file_url: 'https://sp/f1.mp4', is_final: true, created_at: '2026-11-11T10:05:00Z' }]
    });

    await refreshKoopMedia(table, 'k1');

    expect(store.videos.k1[0].currentAsset.id).toBe('f1');
    expect(contentCell().querySelector('[data-action="play-video"]')).not.toBeNull();
  });

  it('blinkt nicht, wenn sich an den Zellen nichts ändert', async () => {
    const { table } = setup({ assets: [] });
    await refreshKoopMedia(table, 'k1');
    const row = document.querySelector('tr.kooperation-row');
    row.classList.remove('realtime-updated');
    vi.advanceTimersByTime(2000);

    await refreshKoopMedia(table, 'k1');

    expect(row.classList.contains('realtime-updated')).toBe(false);
  });

  it('lässt Store und Zellen stehen, wenn die Abfrage scheitert', async () => {
    const { table, store } = setup({ video: { story_slots: [{ id: 's1' }] } });
    window.supabase = { from: vi.fn(() => query({ data: null, error: { message: 'timeout' } })) };
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await refreshKoopMedia(table, 'k1');

    expect(store.videos.k1[0].story_slots).toEqual([{ id: 's1' }]);
    expect(store.getUnloadedVideoIds(['v1'])).toEqual(['v1']);
  });

  it('ignoriert Kooperationen, die nicht in der Tabelle sind', async () => {
    const { table } = setup();
    expect(await refreshKoopMedia(table, 'fremd')).toBe(false);
    expect(window.supabase.from).not.toHaveBeenCalled();
    expect(table.dataLoader.loadBilder).not.toHaveBeenCalled();
  });
});
