import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizedFetch } from '../core/auth/getAccessToken.js';
import { openManagementAnfrage } from '../modules/creator-auswahl/managementAnfrageDrawer.js';

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(),
}));

function supabaseMock(bag = {}) {
  bag.inserts = [];
  const tables = {
    creator_auswahl: [{ id: 'liste-1', name: 'Forgeworks Casting' }],
    management: [
      { id: 'm1', firmenname: 'Studio One', email: 'hallo@studio.test' },
      { id: 'm2', firmenname: 'Nord Talent', email: 'nord@talent.test' },
    ],
    ansprechpartner: [
      { id: 'p1', vorname: 'Lea', nachname: 'Klein', email: 'lea@studio.test', management_id: 'm1' },
      { id: 'p2', vorname: 'Tim', nachname: 'Bohm', email: '', management_id: 'm1' },
    ],
  };
  return {
    from(table) {
      const result = { data: tables[table] || [], error: null };
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        in() { return chain; },
        order() { return chain; },
        limit() { return chain; },
        insert(row) {
          bag.inserts.push(row);
          return Promise.resolve({ error: null });
        },
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
      };
      return chain;
    },
  };
}

describe('Management-Anfrage', () => {
  afterEach(() => {
    document.getElementById('management-anfrage-drawer')?.remove();
    document.getElementById('management-anfrage-drawer-overlay')?.remove();
    document.querySelectorAll('.filter-select__panel').forEach((panel) => panel.remove());
    delete window.supabase;
    delete window.toastSystem;
    authorizedFetch.mockReset();
  });

  it('nutzt das Filter-Dropdown und die Anschreiben-Hülle statt einer Checkbox-Liste', async () => {
    window.supabase = supabaseMock();
    await openManagementAnfrage({ liste: { id: 'liste-1', name: 'Forgeworks Casting', kampagne_id: 'k1' } });
    const drawer = document.getElementById('management-anfrage-drawer');

    expect(drawer.classList.contains('anschreiben-drawer')).toBe(true);
    expect(drawer.querySelector('.drawer-title').textContent).toBe('Managements anfragen');
    expect(drawer.querySelector('.drawer-footer [data-action="send"]').textContent).toBe('Senden');
    expect(drawer.textContent).toContain('nicht als Anhang');
    expect(drawer.querySelector('[data-management] .filter-select')).not.toBeNull();
    expect(drawer.querySelector('[data-management] .filter-select__panel').hidden).toBe(true);
    expect(drawer.querySelector('[data-management] .filter-select__trigger').textContent).toContain('Management wählen');
    expect(drawer.querySelector('[data-betreff]').classList.contains('input')).toBe(true);

    drawer.querySelector('#filter-select-management-anfrage-management .filter-select__trigger').click();
    const panel = [...document.querySelectorAll('.filter-select__panel')].find((node) => !node.hidden);
    expect(panel.querySelector('[data-select-search]')).not.toBeNull();
    expect(panel.textContent).toContain('Studio One');
    expect(panel.textContent).toContain('Nord Talent');

    panel.querySelector('input[value="m1"]').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const personen = drawer.querySelector('#filter-select-management-anfrage-personen');
    expect(personen).not.toBeNull();
    personen.querySelector('.filter-select__trigger').click();
    const peoplePanel = [...document.querySelectorAll('.filter-select__panel')].find((node) => node.querySelector('input[value="p1"]'));
    expect(peoplePanel.textContent).toContain('Lea Klein · Studio One');
    expect(peoplePanel.textContent).not.toContain('Tim Bohm');
  });

  it('schickt die gewählte Person und legt den Link nicht im Browser an', async () => {
    const bag = {};
    window.supabase = supabaseMock(bag);
    window.toastSystem = { show: vi.fn() };
    authorizedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sent: 1, failed: 0, total: 1, errors: [] }),
    });
    await openManagementAnfrage({ liste: { id: 'liste-1', name: 'Forgeworks Casting', kampagne_id: 'k1' } });
    const drawer = document.getElementById('management-anfrage-drawer');

    drawer.querySelector('#filter-select-management-anfrage-management .filter-select__trigger').click();
    const panel = [...document.querySelectorAll('.filter-select__panel')].find((node) => !node.hidden);
    panel.querySelector('input[value="m1"]').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    drawer.querySelector('#filter-select-management-anfrage-personen .filter-select__trigger').click();
    const peoplePanel = [...document.querySelectorAll('.filter-select__panel')].find((node) => node.querySelector('input[value="p1"]'));
    peoplePanel.querySelector('input[value="p1"]').click();

    drawer.querySelector('[data-action="send"]').click();
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalled());

    const [, init] = authorizedFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      castingId: 'liste-1',
      empfaenger: [{ managementId: 'm1', ansprechpartnerId: 'p1' }],
    });
    expect(bag.inserts).toEqual([]);
    expect(window.toastSystem.show).toHaveBeenCalledWith('Anfrage: 1 gesendet', 'success');
  });
});
