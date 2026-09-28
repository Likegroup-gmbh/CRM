import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleEditItemSubmit, showEditItemDrawer, removeEditItemDrawer } from '../modules/strategie/StrategieDetailEditDrawer.js';
import { strategieService } from '../modules/strategie/StrategieService.js';

const SCREENSHOT_URL = 'https://xxx.supabase.co/storage/v1/object/public/strategie-screenshots/screenshots/shot.jpg';

function formData(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

function detailStub(item) {
  return {
    strategieId: 'strat-1',
    items: [item],
    rerenderItemsTable: vi.fn()
  };
}

beforeEach(() => {
  document.body.innerHTML = `
    <form id="edit-item-form">
      <button type="submit">Speichern</button>
    </form>
  `;
  window.toastSystem = { show: vi.fn() };
  vi.spyOn(strategieService, 'updateStrategieItem').mockResolvedValue({});
  vi.spyOn(strategieService, 'deleteScreenshot').mockResolvedValue();
  vi.spyOn(strategieService, 'enqueueItemProcessing').mockResolvedValue(true);
});

afterEach(() => {
  document.body.innerHTML = '';
  delete window.toastSystem;
  vi.restoreAllMocks();
});

describe('handleEditItemSubmit – Screenshot beim Link-Entfernen', () => {
  it('loescht den Screenshot und setzt screenshot_url auf null, wenn die URL geleert wird', async () => {
    const item = {
      id: 'i1',
      video_link: 'https://tiktok.com/@x/video/1',
      screenshot_url: SCREENSHOT_URL,
      teilbereich: 'Reels',
      beschreibung: 'Hook'
    };
    const detail = detailStub(item);

    await handleEditItemSubmit(detail, 'i1', formData({
      art: 'idee',
      video_link: '',
      teilbereich: 'Reels',
      beschreibung: 'Hook',
      umsetzungsvorgabe: 'alte Vorgabe'
    }));

    expect(strategieService.deleteScreenshot).toHaveBeenCalledWith(SCREENSHOT_URL);
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('i1', expect.objectContaining({
      video_link: null,
      umsetzungsvorgabe: null,
      screenshot_url: null,
      transkript: null,
      caption: null,
      verarbeitung_status: null
    }));
    expect(strategieService.updateStrategieItem.mock.calls[0][1].kundenadaption).toBeUndefined();
    expect(strategieService.enqueueItemProcessing).not.toHaveBeenCalled();
    expect(item.screenshot_url).toBeNull();
  });

  it('wirft den alten Screenshot weg, wenn der Link gewechselt wird', async () => {
    const item = {
      id: 'i1',
      video_link: 'https://tiktok.com/@x/video/1',
      screenshot_url: SCREENSHOT_URL,
      teilbereich: null,
      beschreibung: null
    };
    const detail = detailStub(item);

    await handleEditItemSubmit(detail, 'i1', formData({
      art: 'videoreferenz',
      video_link: 'https://instagram.com/reel/abc',
      teilbereich: '',
      beschreibung: '',
      umsetzungsvorgabe: 'Nur der Schnitt'
    }));

    expect(strategieService.deleteScreenshot).toHaveBeenCalledWith(SCREENSHOT_URL);
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('i1', expect.objectContaining({
      video_link: 'https://instagram.com/reel/abc',
      umsetzungsvorgabe: 'Nur der Schnitt',
      kundenadaption: null,
      kundenadaption_quelle: null,
      screenshot_url: null,
      verarbeitung_status: 'pending'
    }));
    expect(strategieService.enqueueItemProcessing).toHaveBeenCalledWith('strat-1', 'i1');
  });

  it('fasst den Screenshot nicht an, wenn die URL gleich bleibt', async () => {
    const item = {
      id: 'i1',
      video_link: 'https://tiktok.com/@x/video/1',
      screenshot_url: SCREENSHOT_URL,
      teilbereich: 'Reels',
      beschreibung: 'Neu'
    };

    await handleEditItemSubmit(detailStub(item), 'i1', formData({
      art: 'videoreferenz',
      video_link: 'https://tiktok.com/@x/video/1',
      teilbereich: 'Reels',
      beschreibung: 'Neu',
      umsetzungsvorgabe: 'Die Hook'
    }));

    expect(strategieService.deleteScreenshot).not.toHaveBeenCalled();
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('i1', expect.not.objectContaining({
      screenshot_url: null
    }));
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('i1', expect.objectContaining({
      umsetzungsvorgabe: 'Die Hook'
    }));
  });

  it('speichert eine Videoreferenz nicht ohne Umsetzungsvorgabe', async () => {
    const item = {
      id: 'i1',
      video_link: 'https://tiktok.com/@x/video/1',
      screenshot_url: SCREENSHOT_URL,
      beschreibung: 'Hook'
    };

    await handleEditItemSubmit(detailStub(item), 'i1', formData({
      art: 'videoreferenz',
      video_link: 'https://tiktok.com/@x/video/1',
      beschreibung: 'Hook',
      umsetzungsvorgabe: '  '
    }));

    expect(strategieService.updateStrategieItem).not.toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledWith('Was sollen wir von diesem Video umsetzen?', 'warning');
  });

  it('behaelt die Kundenadaption, wenn aus einer Idee eine Videoreferenz wird', async () => {
    const item = {
      id: 'i1',
      video_link: null,
      kundenadaption: 'Handgeschrieben',
      beschreibung: 'Idee'
    };

    await handleEditItemSubmit(detailStub(item), 'i1', formData({
      art: 'videoreferenz',
      video_link: 'https://tiktok.com/@x/video/1',
      beschreibung: 'Idee',
      umsetzungsvorgabe: 'Die Hook'
    }));

    const updates = strategieService.updateStrategieItem.mock.calls[0][1];
    expect(updates.kundenadaption).toBeUndefined();
    expect(updates.umsetzungsvorgabe).toBe('Die Hook');
    expect(updates.verarbeitung_status).toBe('pending');
  });
});

describe('Edit-Drawer Tabs', () => {
  afterEach(() => {
    removeEditItemDrawer();
  });

  it('oeffnet eine Idee ohne Videoreferenz-Felder', () => {
    showEditItemDrawer({
      items: [{ id: 'i1', video_link: null, beschreibung: 'Sandwich' }],
      getTeilbereicheFromStrategie: () => []
    }, 'i1');

    expect(document.getElementById('edit-item-art').value).toBe('idee');
    expect(document.querySelector('[data-art-panel="videoreferenz"]').hidden).toBe(true);
    expect(document.getElementById('edit-item-drawer-subtitle').textContent).toBe('Idee anpassen');
  });

  it('oeffnet eine Videoreferenz mit Vorgabe', () => {
    showEditItemDrawer({
      items: [{ id: 'i1', video_link: 'https://tiktok.com/x', umsetzungsvorgabe: 'Nur die Hook', beschreibung: '' }],
      getTeilbereicheFromStrategie: () => []
    }, 'i1');

    expect(document.getElementById('edit-item-art').value).toBe('videoreferenz');
    expect(document.getElementById('edit-umsetzungsvorgabe').value).toBe('Nur die Hook');
    expect(document.querySelector('[data-art-panel="videoreferenz"]').hidden).toBe(false);
  });
});
