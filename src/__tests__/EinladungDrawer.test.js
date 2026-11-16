// EinladungDrawer.test.js
// Einladungs-Drawer (ADR 0055): Anlegen, Versand, Code-Banner.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EinladungDrawer } from '../modules/einladung/EinladungDrawer.js';

describe('Einladungs-Drawer', () => {
  let invoke;
  const fertig = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    document.body.innerHTML = '';
    window.isInternal = () => true;
    invoke = vi.fn(async () => ({
      data: { einladungId: 'e1', link: 'https://crm.test/einladung/abc', code: '123456', gesendet: ['anna@firma.de'], fehlgeschlagen: [] },
      error: null
    }));
    const tabellen = {
      ansprechpartner_kampagne: [{ ansprechpartner: { id: 'a1', vorname: 'Anna', nachname: 'Meyer', email: 'anna@firma.de' } }],
      einladung: []
    };
    window.supabase = {
      functions: { invoke },
      from: (tabelle) => {
        const kette = {
          select: () => kette,
          eq: () => kette,
          is: () => kette,
          order: () => kette,
          then: (resolve) => resolve({ data: tabellen[tabelle] ?? [], error: null })
        };
        return kette;
      }
    };
    window.toastSystem = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  });

  async function oeffne() {
    const drawer = new EinladungDrawer();
    drawer.open({
      art: 'briefing',
      produktionId: 'p1',
      kampagneId: 'k1',
      unternehmenId: 'u1',
      markeId: null,
      kontextName: 'Sommer'
    });
    await fertig();
    await fertig();
    return drawer;
  }

  it('öffnet als Side-Drawer mit Ansprechpartnern und Knopf je nach Auswahl', async () => {
    await oeffne();
    const panel = document.getElementById('einladung-drawer');
    expect(panel.classList.contains('drawer-panel')).toBe(true);
    expect(document.querySelector('.modal.overlay-modal')).toBeNull();

    const knopf = panel.querySelector('#einladung-submit');
    expect(knopf.textContent).toBe('Einladung erstellen');
    const haken = panel.querySelector('[data-ap-email="anna@firma.de"]');
    expect(haken).not.toBeNull();
    expect(haken.checked).toBe(false);

    haken.checked = true;
    haken.dispatchEvent(new Event('change', { bubbles: true }));
    expect(knopf.textContent).toBe('Einladung erstellen und senden');
  });

  it('schickt gewählte und freie Adressen samt Notiz an create', async () => {
    await oeffne();
    const panel = document.getElementById('einladung-drawer');
    panel.querySelector('#einladung-typ').value = 'paid_creator_ads';

    const haken = panel.querySelector('[data-ap-email="anna@firma.de"]');
    haken.checked = true;
    haken.dispatchEvent(new Event('change', { bubbles: true }));

    const frei = panel.querySelector('#einladung-frei-input');
    frei.value = 'Chef@Firma.de';
    frei.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    panel.querySelector('#einladung-nachricht').value = 'Bitte bis Freitag.';

    panel.querySelector('#einladung-submit').click();
    await fertig();
    await fertig();

    expect(invoke).toHaveBeenCalledTimes(1);
    const [name, { body }] = invoke.mock.calls[0];
    expect(name).toBe('einladung');
    expect(body).toMatchObject({
      action: 'create',
      art: 'briefing',
      briefingTyp: 'paid_creator_ads',
      produktionId: 'p1',
      emails: ['anna@firma.de', 'chef@firma.de'],
      nachricht: 'Bitte bis Freitag.'
    });
    expect(window.toastSystem.success).toHaveBeenCalled();
    expect(panel.querySelector('#einladung-banner').hidden).toBe(false);
  });

  it('legt ohne Empfänger an, ohne emails mitzuschicken', async () => {
    await oeffne();
    const panel = document.getElementById('einladung-drawer');
    panel.querySelector('#einladung-typ').value = 'owned_social';
    panel.querySelector('#einladung-submit').click();
    await fertig();
    await fertig();
    const { body } = invoke.mock.calls[0][1];
    expect(body.emails).toBeUndefined();
    expect(body.nachricht).toBeUndefined();
  });

  it('verlangt den Briefing-Typ vor dem Anlegen', async () => {
    await oeffne();
    document.querySelector('#einladung-submit').click();
    await fertig();
    expect(invoke).not.toHaveBeenCalled();
    expect(window.toastSystem.warning).toHaveBeenCalled();
  });

  it('warnt, wenn die Mail nicht zugestellt wurde, und zeigt Code und Link zum Kopieren', async () => {
    invoke.mockResolvedValueOnce({
      data: { einladungId: 'e1', link: 'https://crm.test/einladung/abc', code: '654321', gesendet: [], fehlgeschlagen: ['anna@firma.de'] },
      error: null
    });
    await oeffne();
    const panel = document.getElementById('einladung-drawer');
    panel.querySelector('#einladung-typ').value = 'paid_creator_ads';
    const haken = panel.querySelector('[data-ap-email="anna@firma.de"]');
    haken.checked = true;
    haken.dispatchEvent(new Event('change', { bubbles: true }));
    panel.querySelector('#einladung-submit').click();
    await fertig();
    await fertig();
    expect(window.toastSystem.warning).toHaveBeenCalled();
    expect(panel.querySelector('#einladung-banner').textContent).toContain('654321');
    expect(panel.querySelector('#einladung-banner').textContent).toContain('anna@firma.de');
  });
});
