import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../core/PromoteFinalAsset.js', async (importOriginal) => ({
  ...(await importOriginal()),
  promoteAssetToFinal: vi.fn(async () => {}),
  unmarkFinalSlot: vi.fn(async () => {}),
}));
vi.mock('../core/media/downloadMediaAsset.js', async (importOriginal) => ({
  ...(await importOriginal()),
  downloadMediaAsset: vi.fn(),
}));

import { VideoPlayerLightbox } from '../core/media/player/VideoPlayerLightbox.js';
import { bindPlayerEvents } from '../core/media/player/VideoPlayerEvents.js';
import { swapVideoSrc } from '../core/media/player/stage/swapVideoSrc.js';
import { promoteAssetToFinal } from '../core/PromoteFinalAsset.js';
import { downloadMediaAsset } from '../core/media/downloadMediaAsset.js';

function makeTable(koops, videosByKoop, extra = {}) {
  return {
    renderer: { getFilteredKooperationen: () => koops },
    videos: videosByKoop,
    videoComments: {},
    isKundeRole: () => false,
    isFieldEditableForUser: () => true,
    ...extra,
  };
}

/** Player mit gestubbter Lightbox-Shell/Stage: testet Session-/Intent-/Event-Fluss. */
function makePlayer(table) {
  const player = new VideoPlayerLightbox(table);
  player.itemBuilder.ensureBilderLoaded = async () => {};
  player.lightbox = { open: vi.fn(), update: vi.fn(async () => {}), close: vi.fn(), isOpen: () => true };
  player.prefetcher = { addPreconnect() {}, cleanup() {}, prefetchNeighborAssets() {}, scheduleNeighborPrefetch() {} };
  player.stage.show = vi.fn(async () => {});
  return player;
}

const LOOP1 = { id: 'l1', video_id: 'v1', version_number: 1, is_final: false, created_at: 't1', file_path: '/x/l1.mp4' };
const LOOP2 = { id: 'l2', video_id: 'v1', version_number: 2, is_final: false, created_at: 't2', file_path: '/x/l2.mp4' };
const FIN_A = { id: 'fa', video_id: 'v1', version_number: 1, is_final: true, variant_name: '9:16', created_at: 't3', file_path: '/x/fa.mp4' };
const FIN_B = { id: 'fb', video_id: 'v1', version_number: 1, is_final: true, variant_name: '4:5', created_at: 't4', file_path: '/x/fb.mp4' };

describe('Direkteinstieg "Finale Version" (intent)', () => {
  function videoPlayer() {
    const table = makeTable([{ id: 'k1' }], { k1: [{ id: 'v1', file_url: 'u1' }] });
    const player = makePlayer(table);
    player.assetLoader._cache.set('v1', [LOOP1, LOOP2, FIN_A, FIN_B]);
    return player;
  }

  it('openVideoFinal ohne assetId waehlt die erste finale Variante', async () => {
    const player = videoPlayer();
    await player.openVideoFinal('v1', 'k1');
    expect(player.session.video).toEqual({ version: 'final', assetId: 'fa' });
  });

  it('openVideoFinal mit assetId waehlt genau diese Variante', async () => {
    const player = videoPlayer();
    await player.openVideoFinal('v1', 'k1', 'fb');
    expect(player.session.video).toEqual({ version: 'final', assetId: 'fb' });
  });

  it('openVideo (normal) waehlt die hoechste Schleifen-Version', async () => {
    const player = videoPlayer();
    await player.openVideo('v1', 'k1');
    expect(player.session.video).toEqual({ version: 2, assetId: 'l2' });
  });

  it('der Intent wird verbraucht und leakt nicht in spaetere Oeffnungen', async () => {
    const player = videoPlayer();
    await player.openVideoFinal('v1', 'k1', 'fb');
    expect(player.session.intent).toBeNull();

    // Fehlgeschlagener Final-Einstieg (nichts zu zeigen) darf den naechsten
    // normalen Einstieg nicht beeinflussen.
    await player.openVideoFinal('gibt-es-nicht', 'k-fremd');
    await player.openVideo('v1', 'k1');
    expect(player.session.video.version).toBe(2);
  });

  it('openStillFinal waehlt das finale Still', async () => {
    const stills = [
      { id: 's1', video_id: 'v1', version_number: 1, is_final: false, file_url: 'https://cdn/s1.jpg', file_path: '/s1.jpg', created_at: 'c1' },
      { id: 'sf', video_id: 'v1', version_number: 1, is_final: true, file_url: 'https://cdn/sf.jpg', file_path: '/sf.jpg', created_at: 'c2' },
    ];
    const table = makeTable([{ id: 'k1', _bilder: stills }], { k1: [{ id: 'v1', file_url: 'u1' }] });
    const player = makePlayer(table);
    await player.openStillFinal('v1', 'k1', 'sf');
    expect(player.session.current.type).toBe('bild');
    expect(player.session.still).toEqual({ version: 'final', assetId: 'sf' });
  });
});

describe('VideoPlayerEvents – Selects schreiben in die Session und laden neu', () => {
  function loadedPlayer() {
    const table = makeTable([{ id: 'k1' }], { k1: [{ id: 'v1', file_url: 'u1' }] });
    const player = makePlayer(table);
    player.assetLoader._cache.set('v1', [LOOP1, LOOP2, FIN_A, FIN_B]);
    player.session.items = player.itemBuilder.build();
    player.session.index = 0;
    player.session.assets = [LOOP1, LOOP2, FIN_A, FIN_B];
    player.session.video = { version: 2, assetId: 'l2' };
    return player;
  }

  function mountRoot(html) {
    const root = document.createElement('div');
    root.innerHTML = html;
    return root;
  }

  it('Versions-Select: setzt Version + neuestes Asset, rendert neu, zeigt Quelle', async () => {
    const player = loadedPlayer();
    const root = mountRoot('<select class="player-version-select"><option value="1">1</option><option value="final">F</option></select>');
    bindPlayerEvents(root, player);

    const select = root.querySelector('select');
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(player.stage.show).toHaveBeenCalled());

    expect(player.session.video).toEqual({ version: 1, assetId: 'l1' });
    expect(player.lightbox.update).toHaveBeenCalled();
  });

  it('Versions-Select "final": waehlt die neueste finale Variante', async () => {
    const player = loadedPlayer();
    const root = mountRoot('<select class="player-version-select"><option value="final">F</option></select>');
    bindPlayerEvents(root, player);
    const select = root.querySelector('select');
    select.value = 'final';
    select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(player.stage.show).toHaveBeenCalled());
    expect(player.session.video.version).toBe('final');
    expect(['fa', 'fb']).toContain(player.session.video.assetId);
  });

  it('Varianten-Select: nur Asset tauschen, Body wird nicht neu gerendert', () => {
    const player = loadedPlayer();
    const root = mountRoot('<select class="player-variant-select"><option value="l1">a</option></select>');
    bindPlayerEvents(root, player);
    const select = root.querySelector('select');
    select.value = 'l1';
    select.dispatchEvent(new Event('change'));
    expect(player.session.video).toEqual({ version: 2, assetId: 'l1' });
    expect(player.stage.show).toHaveBeenCalled();
    expect(player.lightbox.update).not.toHaveBeenCalled();
  });

  it('Story-Versions-Select "final" waehlt die erste finale Variante und loescht src', async () => {
    const table = makeTable([{ id: 'k1' }], {
      k1: [{ id: 'v1', file_url: 'u1', story_slots: [{ id: 's1', video_id: 'v1', slot_index: 1, assets: [
        { id: 'a', version_number: 1, file_path: '/a' },
        { id: 'f1', is_final: true, file_path: '/f1' },
        { id: 'f2', is_final: true, file_path: '/f2' },
      ] }] }],
    });
    const player = makePlayer(table);
    player.session.items = player.itemBuilder.build();
    player.session.index = player.session.items.findIndex(i => i.type === 'story');
    player.session.src = 'blob:alt';

    const root = mountRoot('<select class="story-version-select"><option value="final">F</option></select>');
    bindPlayerEvents(root, player);
    const select = root.querySelector('select');
    select.value = 'final';
    select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(player.stage.show).toHaveBeenCalled());

    expect(player.session.story).toEqual({ version: 'final', finalAssetId: 'f1' });
    expect(player.session.src).toBeNull();
  });

  it('Still-Varianten-Select springt auf das Item des gewaehlten Stills', async () => {
    const stills = [
      { id: 's1', video_id: 'v1', version_number: 1, file_url: 'https://cdn/1.jpg', created_at: 'c' },
      { id: 's2', video_id: 'v1', version_number: 1, file_url: 'https://cdn/2.jpg', created_at: 'c' },
    ];
    const table = makeTable([{ id: 'k1', _bilder: stills }], { k1: [{ id: 'v1', file_url: 'u1' }] });
    const player = makePlayer(table);
    player.session.items = player.itemBuilder.build();
    player.session.index = player.session.items.findIndex(i => i.type === 'bild' && i.image.id === 's1');
    player.jumpTo = vi.fn(async () => {});

    const root = mountRoot('<select class="still-variant-select"><option value="s2">2</option></select>');
    bindPlayerEvents(root, player);
    const select = root.querySelector('select');
    select.value = 's2';
    select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(player.jumpTo).toHaveBeenCalled());

    const target = player.session.items.findIndex(i => i.type === 'bild' && i.image.id === 's2');
    expect(player.jumpTo).toHaveBeenCalledWith(target);
  });

  it('Prev/Next/Download-Buttons rufen die Host-Aktionen', () => {
    const player = loadedPlayer();
    player.navigate = vi.fn();
    player.download = vi.fn();
    const root = mountRoot('<button class="vpl-prev"></button><button class="vpl-next"></button><button class="vpl-download"></button>');
    bindPlayerEvents(root, player);
    root.querySelector('.vpl-prev').click();
    root.querySelector('.vpl-next').click();
    root.querySelector('.vpl-download').click();
    expect(player.navigate).toHaveBeenNthCalledWith(1, -1);
    expect(player.navigate).toHaveBeenNthCalledWith(2, 1);
    expect(player.download).toHaveBeenCalledTimes(1);
  });
});

describe('PromoteFinalControl', () => {
  function promotePlayer(tableExtra = {}) {
    const table = makeTable([{ id: 'k1' }], { k1: [{ id: 'v1', file_url: 'u1' }] }, tableExtra);
    const player = makePlayer(table);
    player.session.items = player.itemBuilder.build();
    player.session.index = 0;
    player.session.assets = [LOOP1, LOOP2, FIN_A];
    player.session.video = { version: 2, assetId: 'l2' };
    return player;
  }

  beforeEach(() => {
    vi.mocked(promoteAssetToFinal).mockClear();
  });

  it('html(): Buttons je Final-Variante; leer fuer Kunden und finale Assets', () => {
    const player = promotePlayer();
    const html = player.promote.html();
    expect(html).toContain('data-slot="9:16"');
    expect(html).toContain('data-slot="4:5"');

    player.table.isKundeRole = () => true;
    expect(player.promote.html()).toBe('');
    player.table.isKundeRole = () => false;

    player.session.video = { version: 'final', assetId: 'fa' };
    expect(player.promote.html()).toBe('');
  });

  it('html(): markierte Variante wird als aktiv/aufhebbar gerendert', () => {
    const player = promotePlayer();
    // fa wurde aus l2 abgeleitet -> Slot 9:16 ist belegt
    player.session.assets = [LOOP1, LOOP2, { ...FIN_A, source_asset_id: 'l2' }];
    const html = player.promote.html();
    expect(html).toContain('data-unmark="1"');
    expect(html).toContain('Final 9:16');
  });

  it('Klick: promotet das gewaehlte Asset, laedt Assets neu, aktualisiert Drawer + Body', async () => {
    const refresh = vi.fn();
    const player = promotePlayer({ _drawerActions: { refreshFinalAssetsForVideo: refresh } });
    const fresh = [LOOP1, LOOP2, FIN_A, FIN_B];
    player.assetLoader.reload = vi.fn(async () => fresh);

    const root = document.createElement('div');
    root.innerHTML = player.promote.html();
    player.promote.bind(root);
    root.querySelector('[data-slot="4:5"]').click();

    await vi.waitFor(() => expect(player.lightbox.update).toHaveBeenCalled());
    expect(promoteAssetToFinal).toHaveBeenCalledWith('video', expect.objectContaining({ id: 'l2' }), '4:5');
    expect(player.assetLoader.reload).toHaveBeenCalledWith('v1');
    expect(player.session.assets).toBe(fresh);
    expect(refresh).toHaveBeenCalledWith('v1', 'k1');
  });

  it('Fehler beim Promoten: Toast + Button wieder aktiv, kein Reload', async () => {
    const player = promotePlayer();
    window.toastSystem = { show: vi.fn() };
    vi.mocked(promoteAssetToFinal).mockRejectedValueOnce(new Error('kaputt'));
    player.assetLoader.reload = vi.fn();

    const root = document.createElement('div');
    root.innerHTML = player.promote.html();
    player.promote.bind(root);
    const btn = root.querySelector('[data-slot="9:16"]');
    btn.click();

    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('kaputt', 'error'));
    expect(btn.disabled).toBe(false);
    expect(player.assetLoader.reload).not.toHaveBeenCalled();
  });
});

describe('Player.download', () => {
  beforeEach(() => {
    vi.mocked(downloadMediaAsset).mockClear();
    window.toastSystem = { show: vi.fn() };
  });

  it('Video mit gewaehltem Asset: laedt genau dieses Asset', () => {
    const table = makeTable([{ id: 'k1', creator: { vorname: 'Max', nachname: 'M' } }], { k1: [{ id: 'v1', file_url: 'u1', position: 1 }] });
    const player = makePlayer(table);
    player.session.items = player.itemBuilder.build();
    player.session.index = 0;
    player.session.assets = [LOOP1, LOOP2];
    player.session.video = { version: 2, assetId: 'l2' };

    player.download();

    expect(downloadMediaAsset).toHaveBeenCalledTimes(1);
    const [source, filename] = vi.mocked(downloadMediaAsset).mock.calls[0];
    expect(source).toBe(LOOP2);
    expect(filename).toMatch(/\.mp4$/);
  });

  it('Legacy-Video ohne Asset: nutzt die Video-URL', () => {
    const table = makeTable([{ id: 'k1' }], { k1: [{ id: 'v1', link_content: 'https://legacy/v.mp4' }] });
    const player = makePlayer(table);
    player.session.items = player.itemBuilder.build();
    player.session.index = 0;

    player.download();

    const [source] = vi.mocked(downloadMediaAsset).mock.calls[0];
    expect(source).toMatchObject({ file_url: 'https://legacy/v.mp4' });
  });

  it('Story ohne Datei: Toast statt Download', () => {
    const table = makeTable([{ id: 'k1' }], {
      k1: [{ id: 'v1', file_url: 'u1', story_slots: [{ id: 's1', video_id: 'v1', slot_index: 1, assets: [{ id: 'a', version_number: 1 }] }] }],
    });
    const player = makePlayer(table);
    player.session.items = player.itemBuilder.build();
    player.session.index = player.session.items.findIndex(i => i.type === 'story');
    player.session.story = { version: 1, finalAssetId: null };

    player.download();

    expect(downloadMediaAsset).not.toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledWith('Kein Inhalt zum Herunterladen.', 'error');
  });

  it('Story mit Datei: Dateiname aus Slot + Version', () => {
    const table = makeTable([{ id: 'k1' }], {
      k1: [{ id: 'v1', file_url: 'u1', story_slots: [{ id: 's1', video_id: 'v1', slot_name: 'Intro', slot_index: 1, assets: [{ id: 'a', version_number: 1, file_path: '/s/a.jpg' }] }] }],
    });
    const player = makePlayer(table);
    player.session.items = player.itemBuilder.build();
    player.session.index = player.session.items.findIndex(i => i.type === 'story');
    player.session.story = { version: 1, finalAssetId: null };

    player.download();

    expect(downloadMediaAsset).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'Intro_v1');
  });
});

describe('swapVideoSrc', () => {
  function fakeVideo({ currentTime = 12, paused = false, readyState = 0 } = {}) {
    const listeners = {};
    return {
      currentTime, paused, readyState, src: 'alt',
      play: vi.fn(() => Promise.resolve()),
      addEventListener: (ev, fn) => { listeners[ev] = fn; },
      fire: (ev) => listeners[ev]?.(),
    };
  }

  it('setzt die Quelle, stellt nach loadedmetadata die Position wieder her und spielt weiter', () => {
    const video = fakeVideo();
    swapVideoSrc(video, 'blob:neu', { resume: true });
    expect(video.src).toBe('blob:neu');
    video.currentTime = 0;
    video.fire('loadedmetadata');
    expect(video.currentTime).toBe(12);
    expect(video.play).toHaveBeenCalled();
  });

  it('ohne resume bleibt das Video pausiert', () => {
    const video = fakeVideo();
    swapVideoSrc(video, 'blob:neu');
    video.fire('loadedmetadata');
    expect(video.currentTime).toBe(12);
    expect(video.play).not.toHaveBeenCalled();
  });

  it('bereits pausiertes Video wird auch mit resume nicht gestartet', () => {
    const video = fakeVideo({ paused: true });
    swapVideoSrc(video, 'blob:neu', { resume: true });
    video.fire('loadedmetadata');
    expect(video.play).not.toHaveBeenCalled();
  });

  it('readyState >= 1: sofort wiederherstellen (kein Warten auf loadedmetadata)', () => {
    const video = fakeVideo({ readyState: 1 });
    swapVideoSrc(video, 'blob:neu', { resume: true });
    expect(video.currentTime).toBe(12);
    expect(video.play).toHaveBeenCalled();
  });
});
