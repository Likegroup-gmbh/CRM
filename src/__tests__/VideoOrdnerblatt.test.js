import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { VideoDataLoader } from '../modules/video/VideoDataLoader.js';
import { VideoList } from '../modules/video/VideoList.js';

const rpcRows = [
  {
    kampagne_id: 'k1',
    kampagnenname: 'Beta',
    eigener_name: null,
    unternehmen_id: 'u1',
    firmenname: 'Zebra',
    logo_url: 'z.png',
    video_count: 2
  },
  {
    kampagne_id: 'k2',
    kampagnenname: 'Alpha',
    eigener_name: 'Eigener',
    unternehmen_id: 'u1',
    firmenname: 'Zebra',
    logo_url: 'z.png',
    video_count: 3
  },
  {
    kampagne_id: 'k3',
    kampagnenname: 'Gamma',
    eigener_name: null,
    unternehmen_id: 'u2',
    firmenname: 'Acme',
    logo_url: null,
    video_count: 1
  }
];

describe('Video-Ordnerblatt', () => {
  beforeEach(() => {
    window.supabase = {
      rpc: vi.fn(async () => ({ data: rpcRows, error: null }))
    };
  });

  it('ruft get_video_ordnerblatt und gruppiert Counts auf Unternehmen', async () => {
    const blatt = await VideoDataLoader.loadOrdnerblatt();

    expect(window.supabase.rpc).toHaveBeenCalledWith('get_video_ordnerblatt');
    expect(blatt.unternehmen.map(u => ({ id: u.id, count: u.count, firmenname: u.firmenname }))).toEqual([
      { id: 'u2', count: 1, firmenname: 'Acme' },
      { id: 'u1', count: 5, firmenname: 'Zebra' }
    ]);
  });

  it('nutzt eigenen_name als Kampagnen-Displayname', async () => {
    const blatt = await VideoDataLoader.loadOrdnerblatt();
    expect(blatt.kampagnen.find(k => k.id === 'k2').name).toBe('Eigener');
  });

  it('sortiert Kampagnen nach Displayname', async () => {
    const blatt = await VideoDataLoader.loadOrdnerblatt();
    expect(blatt.kampagnen.map(k => k.id)).toEqual(['k1', 'k2', 'k3']);
  });

  it('schneidet Kampagnen nach Unternehmen; Kunde sieht alle', async () => {
    const blatt = await VideoDataLoader.loadOrdnerblatt();

    expect(VideoDataLoader.loadKampagnenFolders(blatt, 'u1', false).map(k => k.id)).toEqual(['k1', 'k2']);
    expect(VideoDataLoader.loadKampagnenFolders(blatt, null, false)).toEqual([]);
    expect(VideoDataLoader.loadKampagnenFolders(blatt, null, true)).toHaveLength(3);
    expect(VideoDataLoader.loadUnternehmenFolders(blatt)).toHaveLength(2);
  });

  it('laesst Zeilen ohne Unternehmen weg', async () => {
    window.supabase.rpc.mockResolvedValue({
      data: [{ kampagne_id: 'k9', unternehmen_id: null, video_count: 4 }],
      error: null
    });

    const blatt = await VideoDataLoader.loadOrdnerblatt();
    expect(blatt.unternehmen).toEqual([]);
    expect(blatt.kampagnen).toEqual([]);
  });
});

describe('VideoList Ordnerblatt-Cache', () => {
  let list;
  let loadSpy;

  beforeEach(() => {
    document.body.innerHTML = '<div id="content"></div>';
    window.content = document.getElementById('content');
    window.setContentSafely = (el, html) => { el.innerHTML = html; };
    window.setHeadline = vi.fn();
    window.isAdmin = () => true;
    window.isKunde = () => false;
    window.canViewPage = () => true;
    window.breadcrumbSystem = { updateDetailLabel: vi.fn(), setFromRoute: vi.fn() };
    window.validatorSystem = { sanitizeHtml: (t) => t || '' };

    loadSpy = vi.spyOn(VideoDataLoader, 'loadOrdnerblatt').mockResolvedValue({
      unternehmen: [{ id: 'u1', firmenname: 'Acme', logo_url: null, count: 2 }],
      kampagnen: [{ id: 'k1', name: 'Kamp 1', unternehmenId: 'u1', count: 2 }]
    });

    list = new VideoList();
    list.events.bindEvents = vi.fn();
    list.events.bindDragToScroll = vi.fn();
    list.events.destroy = vi.fn();
    list.pagination.init = vi.fn();
    list.pagination.destroy = vi.fn();
  });

  afterEach(() => {
    loadSpy.mockRestore();
  });

  it('laedt das Blatt einmal, Drill-down fetcht nicht nochmal', async () => {
    await list.init();
    expect(loadSpy).toHaveBeenCalledTimes(1);

    await list.loadAndRender();
    expect(loadSpy).toHaveBeenCalledTimes(1);

    list.viewMode = 'kampagnen';
    list.currentUnternehmenId = 'u1';
    await list.loadAndRender();
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(list.kampagnenFolders).toEqual([
      { id: 'k1', name: 'Kamp 1', unternehmenId: 'u1', count: 2 }
    ]);
  });

  it('Grid/List-Toggle refetch’t nicht', async () => {
    await list.init();
    expect(loadSpy).toHaveBeenCalledTimes(1);

    await list._handleViewModeChange('list');
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(list.listViewMode).toBe('list');
  });
});
