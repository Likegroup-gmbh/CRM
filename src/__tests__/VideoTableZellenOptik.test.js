import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderContentCell, renderStillsCell, renderFinaleVersionCell } from '../modules/kampagne/videoTableMediaCells.js';
import { renderCustomCell } from '../modules/kampagne/columns/CustomColumnRenderer.js';
import { VideoTableRenderer } from '../modules/kampagne/VideoTableRenderer.js';

const koop = { id: 'k1', _bilder: [] };
const video = { id: 'v1', finalAssets: [] };

function knopf(html, selektor) {
  const box = document.createElement('template');
  box.innerHTML = html;
  return box.content.querySelector(selektor);
}

describe('Upload-Buttons der Kooperationstabelle', () => {
  beforeEach(() => {
    window.canFeature = vi.fn((name) => name === 'mediaUpload');
    window.permissionSystem = { canEdit: () => true };
  });

  afterEach(() => {
    delete window.canFeature;
    delete window.permissionSystem;
  });

  it('sind Secondary-Buttons und behalten den Hook für den Upload-Drawer', () => {
    const custom = renderCustomCell(
      { id: 'custom:u1', uuid: 'u1', label: 'Rohmaterial', fieldType: 'upload', entityType: 'video' },
      koop, [video], { getCustomColumnValue: () => '' }, { hiddenColumns: [], isKundeRole: () => false }
    );
    for (const html of [renderContentCell(koop, video), renderStillsCell(koop, video), renderFinaleVersionCell(koop, video), custom]) {
      const btn = knopf(html, '.video-upload-btn');
      expect(btn.classList.contains('mdc-btn')).toBe(true);
      expect(btn.classList.contains('mdc-btn--secondary')).toBe(true);
    }
  });
});

describe('Ausrichtung der Video-Spalten', () => {
  const ctx = {
    t: { isColumnVisibleForCustomer: () => true, isFieldEditableForUser: () => true },
    koop,
    videos: [video],
    allVideosCount: 1
  };
  const zelle = (colId) => knopf(new VideoTableRenderer(ctx.t)._bodyCellRenderers()[colId](ctx), 'td');

  it('Video-Nr und die Checkbox-Spalten stehen mittig', () => {
    expect(zelle('col-video-nr').classList.contains('video-stack-cell--center')).toBe(true);
    expect(zelle('col-skript-freigegeben').classList.contains('checkbox-stack')).toBe(true);
  });

  it('die Spalte „Videos“ (Gesamtanzahl) gibt es nicht mehr', () => {
    expect(new VideoTableRenderer(ctx.t)._bodyCellRenderers()['col-videoanzahl']).toBeUndefined();
  });
});
