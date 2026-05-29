import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveVideoFeedbackTarget, getVideoFeedbackSlot } from '../core/VideoFeedbackBuckets.js';
import { getTemporaryLink, toRawDropboxUrl, _resetProxyAvailability } from '../core/VideoUploadUtils.js';
import { VideoPlayerLightbox } from '../core/media/VideoPlayerLightbox.js';
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

describe('VideoPlayerLightbox – Listen & Dropdown-Logik', () => {
  it('_buildFlatList flacht Videos in gerenderter Reihenfolge', () => {
    const koops = [{ id: 'k1', name: 'A' }, { id: 'k2', name: 'B' }];
    const videos = {
      k1: [{ id: 'v1', file_url: 'u1' }, { id: 'v2', file_url: 'u2' }],
      k2: [{ id: 'v3', file_url: 'u3' }],
    };
    const player = new VideoPlayerLightbox(makeFakeTable(koops, videos));
    player._buildFlatList();
    expect(player.flat.map(e => e.video.id)).toEqual(['v1', 'v2', 'v3']);
    expect(player.flat[2].koop.id).toBe('k2');
  });

  it('_buildFlatList ueberspringt Videos ohne hochgeladene Datei', () => {
    const koops = [{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }];
    const videos = {
      k1: [{ id: 'v1', file_url: 'u1' }],
      k2: [{ id: 'v2' }, { id: 'v3', link_content: 'l3' }],
      k3: [{ id: 'v4', asset_url: 'a4' }, { id: 'v5' }],
    };
    const player = new VideoPlayerLightbox(makeFakeTable(koops, videos));
    player._buildFlatList();
    expect(player.flat.map(e => e.video.id)).toEqual(['v1', 'v3', 'v4']);
  });

  it('_versions liefert distinkte, sortierte version_number', () => {
    const player = new VideoPlayerLightbox(makeFakeTable([], {}));
    player.assets = [
      { id: 'a', version_number: 2 },
      { id: 'b', version_number: 1 },
      { id: 'c', version_number: 2 },
    ];
    expect(player._versions()).toEqual([1, 2]);
  });

  it('_variantsForVersion filtert Assets der Version', () => {
    const player = new VideoPlayerLightbox(makeFakeTable([], {}));
    player.assets = [
      { id: 'a', version_number: 1, variant_name: 'Haupt' },
      { id: 'b', version_number: 1, variant_name: 'VO Berlin' },
      { id: 'c', version_number: 2, variant_name: 'Haupt' },
    ];
    const v1 = player._variantsForVersion(1);
    expect(v1.map(a => a.id)).toEqual(['a', 'b']);
    expect(player._variantsForVersion(2).map(a => a.id)).toEqual(['c']);
  });

  it('Prev/Next-Grenzen via hasPrev/hasNext-Logik', () => {
    const koops = [{ id: 'k1' }];
    const videos = { k1: [{ id: 'v1', file_url: 'u1' }, { id: 'v2', file_url: 'u2' }] };
    const player = new VideoPlayerLightbox(makeFakeTable(koops, videos));
    player._buildFlatList();
    player.index = 0;
    expect(player.index > 0).toBe(false);
    expect(player.index < player.flat.length - 1).toBe(true);
    player.index = 1;
    expect(player.index > 0).toBe(true);
    expect(player.index < player.flat.length - 1).toBe(false);
  });
});
