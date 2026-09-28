import { describe, it, expect, afterEach, vi } from 'vitest';
import { strategieService } from '../modules/strategie/StrategieService.js';
import { AddItemDrawer } from '../modules/strategie/AddItemDrawer.js';

describe('processQueue – Trigger-Fehler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete window.toastSystem;
  });

  it('setzt das Item auf error, wenn die Verarbeitung nicht startet', async () => {
    vi.spyOn(strategieService, 'getStrategieItems').mockResolvedValue([]);
    vi.spyOn(strategieService, 'createStrategieItem').mockResolvedValue({ id: 'item-1' });
    vi.spyOn(strategieService, 'enqueueItemProcessing').mockRejectedValue(new Error('HTTP 404'));
    const update = vi.spyOn(strategieService, 'updateStrategieItem').mockResolvedValue({});
    const toasts = [];
    window.toastSystem = { show: (msg, type) => toasts.push({ msg, type }) };

    const drawer = new AddItemDrawer();
    drawer.strategieId = 's1';
    drawer.teilbereiche = [];
    drawer.queue = [{
      id: 'q1',
      url: 'https://tiktok.com/@x/video/1',
      kategorie: null,
      beschreibung: null,
      platform: 'tiktok',
      status: 'pending'
    }];

    await drawer.processQueue();

    expect(update).toHaveBeenCalledWith('item-1', {
      verarbeitung_status: 'error',
      verarbeitung_fehler: 'Verarbeitung konnte nicht gestartet werden (HTTP 404) – bitte neu verarbeiten'
    });
    expect(drawer.queue[0].status).toBe('done');
    expect(toasts).toEqual([{
      msg: 'Videoreferenz angelegt, Verarbeitung fehlgeschlagen – bitte neu verarbeiten',
      type: 'warning'
    }]);
  });
});
