import { afterEach, describe, expect, it } from 'vitest';
import { openManagementAnfrage } from '../modules/creator-auswahl/managementAnfrageDrawer.js';

function supabaseMock() {
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
        insert() { return Promise.resolve({ error: null }); },
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
  });

  it('nutzt das Filter-Dropdown und die Anschreiben-Hülle statt einer Checkbox-Liste', async () => {
    window.supabase = supabaseMock();
    await openManagementAnfrage({ liste: { id: 'liste-1', name: 'Forgeworks Casting', kampagne_id: 'k1' } });
    const drawer = document.getElementById('management-anfrage-drawer');

    expect(drawer.classList.contains('anschreiben-drawer')).toBe(true);
    expect(drawer.querySelector('.drawer-title').textContent).toBe('Managements anfragen');
    expect(drawer.querySelector('.drawer-footer [data-action="create"]').textContent).toBe('Links erzeugen');
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
});
