import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuftragsdetailsCreateController } from '../modules/auftrag/AuftragsdetailsCreate.js';

describe('AuftragsdetailsCreateController Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('räumt Listener und Observer in cleanupBindings auf', () => {
    const instance = new AuftragsdetailsCreateController();
    const target = document.createElement('button');
    const handler = vi.fn();
    const observer = { disconnect: vi.fn() };

    instance.addManagedListener(target, 'click', handler);
    instance.trackObserver(observer);
    instance.cleanupBindings();

    target.click();
    expect(handler).not.toHaveBeenCalled();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(instance._eventsBound).toBe(false);
  });

  it('setzt video_anzahl auf null wenn Toggle deaktiviert ist', async () => {
    const instance = new AuftragsdetailsCreateController();
    const upsertSpy = vi.fn(async () => ({ id: 'detail-1' }));
    instance.repository = { upsertAuftragsdetails: upsertSpy };

    window.showNotification = vi.fn();
    window.notificationSystem = { show: vi.fn() };
    window.ErrorHandler = { handle: vi.fn() };
    window.navigateTo = vi.fn();

    document.body.innerHTML = `
      <form id="auftragsdetails-form">
        <input type="text" name="auftrag_id" value="auftrag-1">
        <input type="checkbox"
               id="ugc_pro_paid_video_anzahl_enabled"
               name="ugc_pro_paid_video_anzahl_enabled"
               data-video-toggle="true"
               data-target="ugc_pro_paid_video_anzahl">
        <input type="number" name="ugc_pro_paid_video_anzahl" value="9">
        <button type="submit">Speichern</button>
      </form>
    `;

    const preventDefault = vi.fn();
    await instance.handleFormSubmit({ preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenCalledTimes(1);

    const savedPayload = upsertSpy.mock.calls[0][0];
    expect(savedPayload.auftrag_id).toBe('auftrag-1');
    expect(savedPayload.ugc_pro_paid_video_anzahl).toBeNull();
    expect(savedPayload).not.toHaveProperty('ugc_pro_paid_video_anzahl_enabled');
  });
});
