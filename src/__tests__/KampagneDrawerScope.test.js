import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KampagneDetail } from '../modules/kampagne/KampagneDetail.js';
import { VideoTableColumnVisibilityDrawer } from '../modules/kampagne/VideoTableColumnVisibilityDrawer.js';
import { CustomColumnsDrawer } from '../modules/kampagne/columns/CustomColumnsDrawer.js';

describe('Kampagnen-Drawer-Scope', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.moduleRegistry = { currentModule: null };
  });

  it('verwirft beide gecachten Drawer bei einer neuen Initialisierung', async () => {
    const detail = new KampagneDetail();
    detail.kampagneId = 'kampagne-a';
    detail.videoColumnVisibilityDrawer = { destroy: vi.fn() };
    detail._customColumnsDrawer = { destroy: vi.fn() };

    const visibilityDrawer = detail.videoColumnVisibilityDrawer;
    const customColumnsDrawer = detail._customColumnsDrawer;

    await detail.init('kampagne-b');

    expect(visibilityDrawer.destroy).toHaveBeenCalledOnce();
    expect(customColumnsDrawer.destroy).toHaveBeenCalledOnce();
    expect(detail.videoColumnVisibilityDrawer).toBeNull();
    expect(detail._customColumnsDrawer).toBeNull();
  });

  it('räumt den Sichtbarkeits-Drawer synchron auf und verwirft seinen Cache', () => {
    document.body.innerHTML = `
      <div id="video-column-visibility-drawer-overlay"></div>
      <div id="video-column-visibility-drawer"></div>
    `;
    const drawer = new VideoTableColumnVisibilityDrawer('kampagne-a', {});
    drawer._settingsLoaded = true;
    drawer.hiddenColumns = ['cp-col-mail'];

    drawer.destroy();

    expect(document.getElementById('video-column-visibility-drawer')).toBeNull();
    expect(document.getElementById('video-column-visibility-drawer-overlay')).toBeNull();
    expect(drawer._settingsLoaded).toBe(false);
    expect(drawer.hiddenColumns).toEqual([]);
  });

  it('räumt den Custom-Columns-Drawer synchron auf', () => {
    document.body.innerHTML = `
      <div id="custom-columns-drawer-overlay"></div>
      <div id="custom-columns-drawer"></div>
    `;
    const drawer = new CustomColumnsDrawer('kampagne-a', {}, vi.fn());

    drawer.destroy();

    expect(document.getElementById('custom-columns-drawer')).toBeNull();
    expect(document.getElementById('custom-columns-drawer-overlay')).toBeNull();
  });
});
