import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveVideoFeedbackTarget, getVideoFeedbackSlot } from '../core/VideoFeedbackBuckets.js';
import { getTemporaryLink, toRawDropboxUrl, _resetProxyAvailability } from '../core/VideoUploadUtils.js';
import { VideoPlayerLightbox } from '../core/media/VideoPlayerLightbox.js';
import { MediaItemBuilder } from '../core/media/MediaItemBuilder.js';
import { VideoAssetLoader } from '../core/media/VideoAssetLoader.js';
import { resolveStreamUrl, _clearMediaSrcCache } from '../core/media/mediaSrc.js';

describe('resolveVideoFeedbackTarget – Version->Runde Mapping', () => {
  it('Version 1 -> Runde 1, CJ fuer interne Rolle', () => {
    const t = resolveVideoFeedbackTarget(1, false);
    expect(t.runde).toBe(1);
    expect(t.feedback_typ).toBe('cj');
    expect(t.readonly).toBe(false);
    expect(t.slot.field).toBe('feedback_cj_r1');
    expect(t.counterpartSlot.field).toBe('feedback_kunde_r1');
  });

  it('Version 1 -> Kunde-Bucket fuer Kundenrolle', () => {
    const t = resolveVideoFeedbackTarget(1, true);
    expect(t.feedback_typ).toBe('kunde');
    expect(t.slot.field).toBe('feedback_kunde_r1');
  });

  it('Version 2 -> Runde 2', () => {
    const t = resolveVideoFeedbackTarget(2, false);
    expect(t.runde).toBe(2);
    expect(t.slot.field).toBe('feedback_cj_r2');
    expect(t.readonly).toBe(false);
  });

  it('Version 3 -> finale Version, read-only (runde 2)', () => {
    const t = resolveVideoFeedbackTarget(3, false);
    expect(t.readonly).toBe(true);
    expect(t.runde).toBe(2);
  });

  it('getVideoFeedbackSlot findet exakten Slot', () => {
    expect(getVideoFeedbackSlot(2, 'kunde').field).toBe('feedback_kunde_r2');
    expect(getVideoFeedbackSlot(9, 'cj')).toBeNull();
  });
});

describe('toRawDropboxUrl – Shared-Link -> einbettbar', () => {
  it('wandelt ?dl=0 in raw=1', () => {
    expect(toRawDropboxUrl('https://www.dropbox.com/s/abc/x.mp4?dl=0'))
      .toBe('https://www.dropbox.com/s/abc/x.mp4?raw=1');
  });

  it('wandelt rlkey &dl=0 in raw=1 (Hauptbug)', () => {
    const out = toRawDropboxUrl('https://www.dropbox.com/scl/fi/76at/x.mp4?rlkey=op0&dl=0');
    expect(out).toContain('raw=1');
    expect(out).not.toContain('dl=0');
    expect(out).toContain('rlkey=op0');
  });

  it('laesst direkte dropboxusercontent-Links unveraendert', () => {
    const direct = 'https://uc123.dl.dropboxusercontent.com/cd/0/x.mp4';
    expect(toRawDropboxUrl(direct)).toBe(direct);
  });
});

describe('getTemporaryLink – dropbox-proxy Client-Helper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetProxyAvailability();
  });

  it('deaktiviert Proxy nach 404 -> zweiter Call fetcht nicht mehr', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 404 }));
    global.fetch = fetchMock;

    expect(await getTemporaryLink('/a')).toBeNull();
    expect(await getTemporaryLink('/b')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('postet action=temporary-link mit Pfad und liefert link zurueck', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ link: 'https://dl.dropboxusercontent.com/x.mp4' }),
    }));
    global.fetch = fetchMock;

    const link = await getTemporaryLink('/Firma/video.mp4', 'tok');
    expect(link).toBe('https://dl.dropboxusercontent.com/x.mp4');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/.netlify/functions/dropbox-proxy');
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({ action: 'temporary-link', path: '/Firma/video.mp4', token: 'tok' });
  });

  it('gibt null zurueck wenn Pfad fehlt', async () => {
    global.fetch = vi.fn();
    expect(await getTemporaryLink('')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('gibt null zurueck bei HTTP-Fehler', async () => {
    global.fetch = vi.fn(async () => ({ ok: false }));
    expect(await getTemporaryLink('/x')).toBeNull();
  });
});

describe('resolveStreamUrl – Temp-Link-Cache & Fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _clearMediaSrcCache();
    _resetProxyAvailability();
  });

  it('Cache-Hit: zweiter Aufruf mit gleichem file_path fetcht nicht erneut', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ link: 'https://dl.dropboxusercontent.com/a.mp4' }),
    }));
    global.fetch = fetchMock;

    const a1 = await resolveStreamUrl({ file_path: '/x/a.mp4', file_url: null });
    const a2 = await resolveStreamUrl({ file_path: '/x/a.mp4', file_url: null });

    expect(a1).toBe('https://dl.dropboxusercontent.com/a.mp4');
    expect(a2).toBe(a1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Fallback auf toRawDropboxUrl wenn kein file_path', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const url = await resolveStreamUrl({
      file_path: null,
      file_url: 'https://www.dropbox.com/scl/fi/z/v.mp4?rlkey=k&dl=0',
    });

    expect(url).toContain('raw=1');
    expect(url).not.toContain('dl=0');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Fallback auf raw=1 wenn Temp-Link fehlschlaegt; cached nicht', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false }));
    global.fetch = fetchMock;

    const url = await resolveStreamUrl({
      file_path: '/x/a.mp4',
      file_url: 'https://www.dropbox.com/s/a/a.mp4?dl=0',
    });
    expect(url).toBe('https://www.dropbox.com/s/a/a.mp4?raw=1');

    // zweiter Aufruf fetcht erneut, da kein erfolgreicher Link gecacht wurde
    await resolveStreamUrl({ file_path: '/x/a.mp4', file_url: 'https://www.dropbox.com/s/a/a.mp4?dl=0' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('TTL: nach Ablauf wird erneut aufgeloest', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ link: 'https://dl.dropboxusercontent.com/a.mp4' }),
    }));
    global.fetch = fetchMock;

    const nowSpy = vi.spyOn(Date, 'now');
    const t0 = 1_000_000;
    nowSpy.mockReturnValue(t0);
    await resolveStreamUrl({ file_path: '/x/a.mp4', file_url: null });

    // innerhalb TTL -> Cache-Hit
    nowSpy.mockReturnValue(t0 + 60_000);
    await resolveStreamUrl({ file_path: '/x/a.mp4', file_url: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // nach TTL (3.5h + Puffer) -> neue Aufloesung
    nowSpy.mockReturnValue(t0 + 4 * 60 * 60 * 1000);
    await resolveStreamUrl({ file_path: '/x/a.mp4', file_url: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function makeFakeTable(koops, videosByKoop) {
  return {
    renderer: { getFilteredKooperationen: () => koops },
    videos: videosByKoop,
    videoComments: {},
    isKundeRole: () => false,
    isFieldEditableForUser: () => true,
    escapeHtml: (s) => s,
  };
}

describe('MediaItemBuilder – flache Item-Liste', () => {
  it('flacht Videos in gerenderter Reihenfolge', () => {
    const koops = [{ id: 'k1', name: 'A' }, { id: 'k2', name: 'B' }];
    const videos = {
      k1: [{ id: 'v1', file_url: 'u1' }, { id: 'v2', file_url: 'u2' }],
      k2: [{ id: 'v3', file_url: 'u3' }],
    };
    const items = new MediaItemBuilder(makeFakeTable(koops, videos)).build();
    expect(items.map(e => e.video.id)).toEqual(['v1', 'v2', 'v3']);
    expect(items.every(e => e.type === 'video')).toBe(true);
    expect(items[2].koop.id).toBe('k2');
  });

  it('ueberspringt Videos ohne hochgeladene Datei', () => {
    const koops = [{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }];
    const videos = {
      k1: [{ id: 'v1', file_url: 'u1' }],
      k2: [{ id: 'v2' }, { id: 'v3', link_content: 'l3' }],
      k3: [{ id: 'v4', asset_url: 'a4' }, { id: 'v5' }],
    };
    const items = new MediaItemBuilder(makeFakeTable(koops, videos)).build();
    expect(items.map(e => e.video.id)).toEqual(['v1', 'v3', 'v4']);
  });

  it('beruecksichtigt currentAsset.file_path als Upload', () => {
    const koops = [{ id: 'k1' }];
    const videos = { k1: [{ id: 'v1', currentAsset: { file_path: '/x/a.mp4' } }, { id: 'v2' }] };
    const items = new MediaItemBuilder(makeFakeTable(koops, videos)).build();
    expect(items.map(e => e.video.id)).toEqual(['v1']);
  });

  it('verschachtelt pro Video direkt dessen Storys (Video -> Storys -> naechstes Video)', () => {
    const koops = [{ id: 'k1', _bilder: [{ id: 'img1', file_url: 'iu1' }] }];
    const videos = {
      k1: [
        {
          id: 'v1', file_url: 'u1',
          story_slots: [
            { id: 's1a', video_id: 'v1', slot_index: 1, assets: [{ id: 'a', version_number: 1 }] },
            { id: 's1b', video_id: 'v1', slot_index: 2, assets: [{ id: 'b', version_number: 1 }] },
          ],
        },
        {
          id: 'v2', file_url: 'u2',
          story_slots: [{ id: 's2a', video_id: 'v2', slot_index: 1, assets: [{ id: 'c', version_number: 1 }] }],
        },
      ],
    };
    const items = new MediaItemBuilder(makeFakeTable(koops, videos)).build();
    // Erwartet: v1 -> s1a -> s1b -> v2 -> s2a -> Bild
    expect(items.map(e => e.type === 'video' ? e.video.id : (e.type === 'story' ? e.slot.id : 'bild')))
      .toEqual(['v1', 's1a', 's1b', 'v2', 's2a', 'bild']);
  });

  it('ueberspringt Storys ohne Assets', () => {
    const koops = [{ id: 'k1' }];
    const videos = {
      k1: [{
        id: 'v1', file_url: 'u1',
        story_slots: [
          { id: 's1', video_id: 'v1', assets: [] },
          { id: 's2', video_id: 'v1', assets: [{ id: 'sa2', version_number: 1 }] },
        ],
      }],
    };
    const items = new MediaItemBuilder(makeFakeTable(koops, videos)).build();
    const storyItems = items.filter(e => e.type === 'story');
    expect(storyItems.map(e => e.slot.id)).toEqual(['s2']);
  });
});

describe('MediaItemBuilder.ensureStorySlotsLoaded – on-demand Story-Slots', () => {
  it('laedt fehlende story_slots (undefined) via dataLoader.loadStorySlots nach', async () => {
    const koops = [{ id: 'k1' }, { id: 'k2' }];
    const videos = {
      k1: [{ id: 'v1', file_url: 'u1' }], // story_slots undefined
      k2: [{ id: 'v2', file_url: 'u2', story_slots: [] }], // bereits geladen (leer)
    };
    const table = makeFakeTable(koops, videos);
    const calls = [];
    table.dataLoader = {
      loadStorySlots: async (ids) => {
        calls.push(ids);
        for (const id of ids) videos.k1.find(v => v.id === id) && (videos.k1.find(v => v.id === id).story_slots = []);
      },
    };
    await new MediaItemBuilder(table).ensureStorySlotsLoaded();
    expect(calls).toEqual([['v1']]); // nur v1 fehlte; v2 hat bereits []
  });

  it('ruft loadStorySlots nicht auf, wenn alle story_slots vorhanden', async () => {
    const koops = [{ id: 'k1' }];
    const videos = { k1: [{ id: 'v1', file_url: 'u1', story_slots: [] }] };
    const table = makeFakeTable(koops, videos);
    let called = false;
    table.dataLoader = { loadStorySlots: async () => { called = true; } };
    await new MediaItemBuilder(table).ensureStorySlotsLoaded();
    expect(called).toBe(false);
  });
});

describe('VideoAssetLoader – Versionen & Varianten', () => {
  it('versions liefert distinkte, sortierte version_number', () => {
    const loader = new VideoAssetLoader();
    const assets = [
      { id: 'a', version_number: 2 },
      { id: 'b', version_number: 1 },
      { id: 'c', version_number: 2 },
    ];
    expect(loader.versions(assets)).toEqual([1, 2]);
  });

  it('variantsForVersion filtert Assets der Version', () => {
    const loader = new VideoAssetLoader();
    const assets = [
      { id: 'a', version_number: 1, variant_name: 'Haupt' },
      { id: 'b', version_number: 1, variant_name: 'VO Berlin' },
      { id: 'c', version_number: 2, variant_name: 'Haupt' },
    ];
    expect(loader.variantsForVersion(assets, 1).map(a => a.id)).toEqual(['a', 'b']);
    expect(loader.variantsForVersion(assets, 2).map(a => a.id)).toEqual(['c']);
  });

  it('combinedVersions ergaenzt Feedback-Runden ohne eigenes Asset', () => {
    const loader = new VideoAssetLoader();
    const assets = [{ id: 'a', version_number: 1 }];
    // Runde-2-Feedback existiert, aber kein V2-Asset -> Feedbackschleife 2 trotzdem waehlbar
    const comments = { cjR2: [{ text: 'bitte aendern' }] };
    expect(loader.combinedVersions(assets, comments)).toEqual([1, 2]);
  });

  it('applyDefaultSelection waehlt hoechste Version + aktuelles Asset', () => {
    const loader = new VideoAssetLoader();
    const assets = [
      { id: 'a', version_number: 1, is_current: false },
      { id: 'b', version_number: 2, is_current: false },
      { id: 'c', version_number: 2, is_current: true },
    ];
    expect(loader.applyDefaultSelection(assets, null)).toEqual({ selectedVersion: 2, selectedAssetId: 'c' });
  });
});

describe('VideoPlayerLightbox – Feedback-Ziel & Navigation', () => {
  function playerWith(koops, videos) {
    const table = makeFakeTable(koops, videos);
    const player = new VideoPlayerLightbox(table);
    player.items = new MediaItemBuilder(table).build();
    return player;
  }

  it('feedbackTarget mappt Story auf slot.video_id und Bild auf erstes Koop-Video', () => {
    const koops = [{ id: 'k1', _bilder: [{ id: 'img1', file_url: 'iu1' }] }];
    const videos = {
      k1: [{
        id: 'v1', file_url: 'u1',
        story_slots: [{ id: 's1', video_id: 'v1', assets: [{ id: 'sa1', version_number: 1 }] }],
      }],
    };
    const player = playerWith(koops, videos);

    player.index = player.items.findIndex(e => e.type === 'story');
    player.storyVersion = 1;
    expect(player.feedbackTarget().videoId).toBe('v1');

    player.index = player.items.findIndex(e => e.type === 'bild');
    const bildTarget = player.feedbackTarget();
    expect(bildTarget.videoId).toBe('v1');
    expect(bildTarget.target.runde).toBe(1);
  });

  it('feedbackTarget ist null fuer Bild in Koop ohne Video', () => {
    const koops = [{ id: 'k1', _bilder: [{ id: 'img1', file_url: 'iu1' }] }];
    const videos = { k1: [] };
    const player = playerWith(koops, videos);
    player.index = 0;
    expect(player.feedbackTarget()).toBeNull();
  });

  it('Prev/Next-Grenzen via hasPrev/hasNext-Logik', () => {
    const koops = [{ id: 'k1' }];
    const videos = { k1: [{ id: 'v1', file_url: 'u1' }, { id: 'v2', file_url: 'u2' }] };
    const player = playerWith(koops, videos);
    player.index = 0;
    expect(player.index > 0).toBe(false);
    expect(player.index < player.items.length - 1).toBe(true);
    player.index = 1;
    expect(player.index > 0).toBe(true);
    expect(player.index < player.items.length - 1).toBe(false);
  });
});

describe('VideoPlayerLightbox._open – kein Sprung auf fremde Kooperation', () => {
  function openabledPlayer(koops, videos) {
    const table = makeFakeTable(koops, videos);
    const player = new VideoPlayerLightbox(table);
    player.itemBuilder.ensureBilderLoaded = async () => {};
    player.lightbox = { open: () => {}, update: () => {}, close: () => {} };
    player.prefetcher = { addPreconnect: () => {}, cleanup: () => {}, prefetchNeighborAssets: () => {}, scheduleNeighborPrefetch: () => {} };
    player._loadCurrent = async () => {};
    return player;
  }

  it('oeffnet die Story der angeklickten Koop (nicht items[0] einer fremden Koop)', async () => {
    // k1 (Ziel) liegt VOR k2 ("Julia") und hat eine eigene Story.
    const koops = [{ id: 'k1', name: 'Ziel' }, { id: 'k2', name: 'Julia' }];
    const videos = {
      k1: [{ id: 'v1', file_url: 'u1', story_slots: [{ id: 's1', video_id: 'v1', slot_index: 1, assets: [{ id: 'sa1', version_number: 1 }] }] }],
      k2: [{ id: 'v2', file_url: 'u2', story_slots: [{ id: 's2', video_id: 'v2', slot_index: 1, assets: [{ id: 'sa2', version_number: 1 }] }] }],
    };
    const player = openabledPlayer(koops, videos);
    await player.openStory('v1', 'k1');
    expect(player.current?.type).toBe('story');
    expect(player.current?.koop.id).toBe('k1');
    expect(player.current?.slot.id).toBe('s1');
  });

  it('zeigt Leer-Zustand (index -1) statt fremder Koop, wenn Ziel-Koop keine Medien hat', async () => {
    // k1 hat einen Story-Button, aber KEINE ladbaren Items (keine Assets, kein Upload, keine Bilder).
    // k2 ("Julia") ist das erste Item der Liste -> darf NICHT geoeffnet werden.
    const koops = [{ id: 'k1', name: 'Sony' }, { id: 'k2', name: 'Julia' }];
    const videos = {
      k1: [{ id: 'v1', story_slots: [{ id: 's1', video_id: 'v1', assets: [] }] }],
      k2: [{ id: 'v2', file_url: 'u2', story_slots: [{ id: 's2', video_id: 'v2', assets: [{ id: 'sa2', version_number: 1 }] }] }],
    };
    const player = openabledPlayer(koops, videos);
    await player.openStory('v1', 'k1');
    expect(player.index).toBe(-1);
    expect(player.current).toBeNull();
  });

  it('laedt fehlende story_slots beim Oeffnen on-demand und zeigt dann die Story', async () => {
    // Detailansicht-Szenario: video.story_slots ist undefined (nie geladen),
    // obwohl in der DB eine Story existiert. _open muss sie nachladen.
    const koops = [{ id: 'k1', name: 'Sonny' }];
    const videos = { k1: [{ id: 'v1' }] }; // kein Upload, story_slots undefined
    const table = makeFakeTable(koops, videos);
    table.dataLoader = {
      loadStorySlots: async (ids) => {
        for (const id of ids) {
          const v = videos.k1.find(x => x.id === id);
          if (v) v.story_slots = [{ id: 's1', video_id: 'v1', slot_index: 1, assets: [{ id: 'sa1', version_number: 1 }] }];
        }
      },
    };
    const player = new VideoPlayerLightbox(table);
    player.itemBuilder.ensureBilderLoaded = async () => {};
    player.lightbox = { open: () => {}, update: () => {}, close: () => {} };
    player.prefetcher = { addPreconnect: () => {}, cleanup: () => {}, prefetchNeighborAssets: () => {}, scheduleNeighborPrefetch: () => {} };
    player._loadCurrent = async () => {};

    await player.openStory('v1', 'k1');
    expect(player.current?.type).toBe('story');
    expect(player.current?.koop.id).toBe('k1');
    expect(player.current?.slot.id).toBe('s1');
  });

  it('scopt auf die richtige Koop, wenn keine Story aber anderes Medium vorhanden ist', async () => {
    // k1 hat keine Story-Items, aber ein Video -> Fallback bleibt in k1, nicht in k2.
    const koops = [{ id: 'k1', name: 'Katrin' }, { id: 'k2', name: 'Julia' }];
    const videos = {
      k1: [{ id: 'v1', file_url: 'u1' }],
      k2: [{ id: 'v2', file_url: 'u2', story_slots: [{ id: 's2', video_id: 'v2', assets: [{ id: 'sa2', version_number: 1 }] }] }],
    };
    const player = openabledPlayer(koops, videos);
    await player.openStory('v1', 'k1');
    expect(player.current?.koop.id).toBe('k1');
  });
});
