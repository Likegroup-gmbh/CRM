import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/media/mediaSrc.js', () => ({ resolveStreamUrl: vi.fn(), prefetchStreamUrl: vi.fn() }));

import { resolveStreamUrl } from '../core/media/mediaSrc.js';
import { PlayerSession } from '../core/media/player/PlayerSession.js';
import { VideoPlayerView } from '../core/media/player/VideoPlayerView.js';
import { StageController } from '../core/media/player/stage/StageController.js';
import { SP_ASSET, SP_ORDNER, rolleZuruecksetzen, setRolle } from './ablageOrdnerLinkTestKit.js';

const URL_1 = 'https://netorg12915005.sharepoint.com/_layouts/15/download.aspx?tempauth=eins';
const URL_2 = 'https://netorg12915005.sharepoint.com/_layouts/15/download.aspx?tempauth=zwei';

const SP_MEDIA = {
  key: null,
  label: 'Video 1',
  lookup: { file_path: SP_ASSET.file_path, file_url: SP_ASSET.file_url, typ: 'video', id: 'a1', ablage: 'sharepoint', etag: 'e1' },
};
const OHNE_DATEI = { key: null, label: 'Video 1', lookup: { file_path: null, file_url: null, typ: 'video', id: null, ablage: null, etag: null } };

/** Stage mit echter View und Session, der Rest der Lightbox als Attrappe. */
function stageFuer(media) {
  const session = new PlayerSession(null);
  session.items = [{ type: 'video', koop: { id: 'k1', name: 'Koop' }, video: { id: 'v1', folder_url: SP_ORDNER } }];
  session.loading = true;
  const host = {
    session,
    lightbox: { isOpen: () => true, contentEl: document.body },
    playback: { mount: vi.fn(), unmount: vi.fn(), rearmFullscreen: vi.fn() },
    videoPool: { take: () => null },
    prefetcher: { prefetchNeighborAssets: vi.fn(), scheduleNeighborPrefetch: vi.fn(), prefetchNeighbors: vi.fn() },
    currentMedia: () => media,
    download: vi.fn(),
  };
  host.view = new VideoPlayerView(host);
  host.stage = new StageController(host);
  document.body.innerHTML = `<div class="media-viewer-stage">${host.view.renderStageInner()}</div>`;
  host.stage.mount(document.body);
  return host;
}

const stage = () => document.querySelector('.media-viewer-stage');
const videoFehler = () => stage().querySelector('video').dispatchEvent(new Event('error'));

describe('Player – SharePoint-Fallbacks ohne webUrl', () => {
  let host;

  beforeEach(() => {
    resolveStreamUrl.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    host?.stage.reset();
    vi.restoreAllMocks();
    rolleZuruecksetzen();
    document.body.innerHTML = '';
  });

  it('Kunde: "Kein Video" zeigt den Leselink-Knopf statt der Ordner-webUrl', async () => {
    setRolle('kunde');
    resolveStreamUrl.mockResolvedValue(null);
    host = stageFuer(OHNE_DATEI);
    await host.stage.show();

    expect(stage().textContent).toContain('Kein Video hochgeladen.');
    expect(stage().innerHTML).not.toContain('sharepoint.com');
    expect(stage().querySelector('button[data-action="ablage-ordner-link"]').dataset.kooperationId).toBe('k1');
  });

  it('Team behält den direkten Ordner-Link, Gast bekommt keinen', async () => {
    resolveStreamUrl.mockResolvedValue(null);
    setRolle('team');
    host = stageFuer(OHNE_DATEI);
    await host.stage.show();
    expect(stage().querySelector('a.media-viewer-fallback-link').getAttribute('href')).toBe(SP_ORDNER);

    setRolle('gast');
    host = stageFuer(OHNE_DATEI);
    await host.stage.show();
    expect(stage().querySelector('.media-viewer-fallback-link')).toBeNull();
  });

  it('SharePoint-Datei ohne Link: "Erneut versuchen" statt "Kein Video hochgeladen"', async () => {
    setRolle('kunde');
    resolveStreamUrl.mockResolvedValueOnce(null).mockResolvedValueOnce(URL_1);
    host = stageFuer(SP_MEDIA);
    await host.stage.show();

    expect(stage().textContent).toContain('Video konnte gerade nicht geladen werden.');
    expect(stage().textContent).not.toContain('Kein Video hochgeladen');

    stage().querySelector('.vpl-erneut').click();
    await vi.waitFor(() => expect(stage().querySelector('video')?.getAttribute('src')).toContain(URL_1));
    expect(host.session.ladeFehler).toBe(false);
  });

  it('Video-Error: Link einmal frisch holen, beim zweiten Fehler der Fallback', async () => {
    setRolle('kunde');
    resolveStreamUrl.mockResolvedValueOnce(URL_1).mockResolvedValueOnce(URL_2);
    host = stageFuer(SP_MEDIA);
    await host.stage.show();

    videoFehler();
    await vi.waitFor(() => expect(stage().querySelector('video')?.getAttribute('src')).toContain(URL_2));

    videoFehler();
    expect(stage().textContent).toContain('Dieses Format kann im Browser nicht abgespielt werden.');
    expect(resolveStreamUrl).toHaveBeenCalledTimes(2);
  });

  it('Video-Error mit derselben URL (nicht abgelaufen): direkt der Fallback', async () => {
    setRolle('kunde');
    resolveStreamUrl.mockResolvedValue(URL_1);
    host = stageFuer(SP_MEDIA);
    await host.stage.show();

    videoFehler();
    await vi.waitFor(() => expect(stage().textContent).toContain('Dieses Format kann im Browser nicht abgespielt werden.'));
    expect(resolveStreamUrl).toHaveBeenCalledTimes(2);
  });

  it('Bild ohne Vorschau: Ablage-Datei als Knopf über ablage-link', () => {
    setRolle('kunde');
    host = stageFuer(SP_MEDIA);
    document.body.innerHTML = host.view.renderImageNotPreviewable({ ...SP_ASSET, id: 's1' });
    expect(document.body.innerHTML).not.toContain('sharepoint.com');
    expect(document.querySelector('button').dataset).toMatchObject({ action: 'ablage-datei-link', typ: 'still', id: 's1' });
  });
});
