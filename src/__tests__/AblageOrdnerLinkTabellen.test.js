import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderContentCell } from '../modules/kampagne/videoTableMediaCells.js';
import { patchRenderedAssetsAndComments } from '../modules/kampagne/videoTableAssetsLoader.js';
import { renderKooperationVideos } from '../modules/kooperation/kooperationVideosTab.js';
import { VideoTableRenderer } from '../modules/video/VideoTableRenderer.js';
import { SP_ORDNER, rolleZuruecksetzen, setRolle } from './ablageOrdnerLinkTestKit.js';

const KOOP = { id: 'k1', name: 'Koop' };
const videoMitOrdner = () => ({ id: 'v1', kooperation_id: 'k1', position: 1, folder_url: SP_ORDNER, asset_url: null });

const contentCell = () => document.querySelector('.col-link-content .video-field-wrapper[data-video-id="v1"]');

describe('Tabellen – Ordner-Links und Play-Button für Kunden', () => {
  afterEach(() => {
    rolleZuruecksetzen();
    document.body.innerHTML = '';
  });

  it('Kampagne: Ordner-Icon ist für Kunden ein Leselink-Knopf, fürs Team ein Link', () => {
    setRolle('kunde');
    const kunde = renderContentCell(KOOP, videoMitOrdner());
    expect(kunde).not.toContain('sharepoint.com');
    expect(kunde).toContain('data-action="ablage-ordner-link"');

    setRolle('team');
    expect(renderContentCell(KOOP, videoMitOrdner())).toContain(`href="${SP_ORDNER}"`);
  });

  it('Kampagne: nach dem Laden der Assets wird aus dem Ordner der Play-Button', () => {
    setRolle('kunde');
    const video = videoMitOrdner();
    document.body.innerHTML = `<div id="grid"><table><tr><td class="col-link-content">
      <div class="video-field-wrapper" data-video-id="v1">${renderContentCell(KOOP, video)}</div></td></tr></table></div>`;
    expect(contentCell().querySelector('[data-action="play-video"]')).toBeNull();

    // applyWithoutStore bzw. store.applyAssets hängen das Asset an das Video
    const asset = { id: 'a1', video_id: 'v1', file_url: 'https://x.sharepoint.com/a1.mp4', ablage: 'sharepoint' };
    video.currentAsset = asset;
    video.file_url = asset.file_url;
    const dl = {
      table: { containerId: 'grid', kooperationen: [KOOP], videos: { k1: [video] }, videoComments: {} },
      patchRenderedBilderCells: vi.fn(),
    };
    patchRenderedAssetsAndComments(dl, new Map([['v1', asset]]));

    expect(contentCell().querySelector('[data-action="play-video"]')).not.toBeNull();
    expect(contentCell().innerHTML).not.toContain('ablage-ordner-link');
  });

  it('Kooperation: Videos-Tab rendert (ohne actionsHtml-Absturz), Kunde ohne webUrl', () => {
    setRolle('kunde');
    const html = renderKooperationVideos({ videos: [videoMitOrdner()], kooperationId: 'k1', sanitize: (s) => s });
    expect(html).toContain('data-action="ablage-ordner-link"');
    expect(html).not.toContain('sharepoint.com');
    expect(html).not.toContain('EK Netto');

    setRolle('team');
    expect(renderKooperationVideos({ videos: [videoMitOrdner()], kooperationId: 'k1', sanitize: (s) => s }))
      .toContain(`href="${SP_ORDNER}"`);
  });

  it('Videoliste: Ordner-Spalte für Kunden über den Leselink', () => {
    setRolle('kunde');
    const html = VideoTableRenderer._renderRow({ ...videoMitOrdner(), kooperation: { id: 'k1' } }, true);
    expect(html).not.toContain('sharepoint.com');
    expect(html).toContain('data-kooperation-id="k1"');
  });
});
