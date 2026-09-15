import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleEditItemSubmit } from '../modules/strategie/StrategieDetailEditDrawer.js';
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
      video_link: '',
      teilbereich: 'Reels',
      beschreibung: 'Hook'
    }));

    expect(strategieService.deleteScreenshot).toHaveBeenCalledWith(SCREENSHOT_URL);
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('i1', expect.objectContaining({
      video_link: null,
      screenshot_url: null,
      transkript: null,
      caption: null,
      verarbeitung_status: null
    }));
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
      video_link: 'https://instagram.com/reel/abc',
      teilbereich: '',
      beschreibung: ''
    }));

    expect(strategieService.deleteScreenshot).toHaveBeenCalledWith(SCREENSHOT_URL);
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('i1', expect.objectContaining({
      video_link: 'https://instagram.com/reel/abc',
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
      video_link: 'https://tiktok.com/@x/video/1',
      teilbereich: 'Reels',
      beschreibung: 'Neu'
    }));

    expect(strategieService.deleteScreenshot).not.toHaveBeenCalled();
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('i1', expect.not.objectContaining({
      screenshot_url: null
    }));
  });
});
