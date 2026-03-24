import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderBezahltToggle } from '../modules/rechnung/RechnungBezahltToggle.js';

describe('RechnungBezahltToggle', () => {

  describe('renderBezahltToggle', () => {

    // --- Checked / Unchecked ---

    it('zeigt checked wenn Status Bezahlt ist', () => {
      const html = renderBezahltToggle({ id: 'r1', status: 'Bezahlt' }, true);
      expect(html).toContain('checked');
    });

    it('zeigt nicht checked wenn Status Offen ist', () => {
      const html = renderBezahltToggle({ id: 'r2', status: 'Offen' }, true);
      expect(html).not.toMatch(/\bchecked\b/);
    });

    it('zeigt nicht checked bei Status Rückfrage', () => {
      const html = renderBezahltToggle({ id: 'r3', status: 'Rückfrage' }, true);
      expect(html).not.toMatch(/\bchecked\b/);
    });

    it('zeigt nicht checked bei Status An Qonto gesendet', () => {
      const html = renderBezahltToggle({ id: 'r4', status: 'An Qonto gesendet' }, true);
      expect(html).not.toMatch(/\bchecked\b/);
    });

    // --- Disabled / Enabled ---

    it('ist disabled wenn canEdit false ist', () => {
      const html = renderBezahltToggle({ id: 'r5', status: 'Offen' }, false);
      expect(html).toContain('disabled');
    });

    it('ist nicht disabled wenn canEdit true ist', () => {
      const html = renderBezahltToggle({ id: 'r6', status: 'Offen' }, true);
      expect(html).not.toMatch(/\bdisabled\b/);
    });

    // --- Data-Attribute ---

    it('hat data-id mit Rechnungs-ID', () => {
      const html = renderBezahltToggle({ id: 'abc-123', status: 'Offen' }, true);
      expect(html).toContain('data-id="abc-123"');
    });

    // --- CSS-Klassen ---

    it('hat toggle-switch Wrapper-Klasse', () => {
      const html = renderBezahltToggle({ id: 'r7', status: 'Offen' }, true);
      expect(html).toContain('toggle-switch');
      expect(html).toContain('rechnung-bezahlt-toggle-wrapper');
    });

    it('hat rechnung-bezahlt-toggle Klasse auf dem Input', () => {
      const html = renderBezahltToggle({ id: 'r8', status: 'Offen' }, true);
      expect(html).toContain('rechnung-bezahlt-toggle');
    });

    it('hat toggle-slider span', () => {
      const html = renderBezahltToggle({ id: 'r9', status: 'Offen' }, true);
      expect(html).toContain('toggle-slider');
    });

  });

  describe('Event-Handling (Inflight-Guard & Rollback)', () => {

    let container;
    let mockUpdateEntity;
    let inflight;

    beforeEach(() => {
      inflight = new Set();
      mockUpdateEntity = vi.fn().mockResolvedValue({ success: true });
      window.dataService = { updateEntity: mockUpdateEntity };
      window.currentUser = { rolle: 'mitarbeiter' };
      window.toastSystem = { show: vi.fn() };

      container = document.createElement('div');
      container.innerHTML = renderBezahltToggle({ id: 'test-1', status: 'Offen' }, true);
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
      delete window.dataService;
      delete window.currentUser;
      delete window.toastSystem;
    });

    function getToggle() {
      return container.querySelector('.rechnung-bezahlt-toggle');
    }

    async function simulateToggleChange(toggle) {
      const id = toggle.dataset.id;
      if (!id || inflight.has(id)) return;

      const newStatus = toggle.checked ? 'Bezahlt' : 'Offen';
      inflight.add(id);
      toggle.disabled = true;

      try {
        const result = await window.dataService.updateEntity('rechnung', id, { status: newStatus });
        if (result?.error) throw new Error(result.error);
      } catch {
        toggle.checked = !toggle.checked;
      } finally {
        inflight.delete(id);
        toggle.disabled = false;
      }
    }

    it('verhindert Doppel-Request waehrend Inflight', async () => {
      const toggle = getToggle();
      toggle.checked = true;

      const promise1 = simulateToggleChange(toggle);
      const promise2 = simulateToggleChange(toggle);

      await Promise.all([promise1, promise2]);

      expect(mockUpdateEntity).toHaveBeenCalledTimes(1);
    });

    it('setzt Checkbox zurueck bei API-Fehler', async () => {
      mockUpdateEntity.mockRejectedValueOnce(new Error('DB Error'));

      const toggle = getToggle();
      expect(toggle.checked).toBe(false);

      toggle.checked = true;
      await simulateToggleChange(toggle);

      expect(toggle.checked).toBe(false);
    });

  });

});
