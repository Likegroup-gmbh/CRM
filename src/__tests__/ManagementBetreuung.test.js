import { describe, expect, it } from 'vitest';
import { diffIds, normalizePhone } from '../modules/ansprechpartner/betreuung.js';
import { openAddAnsprechpartnerDrawer, renderManagementBetreuung } from '../modules/ansprechpartner/managementBetreuung.js';

const people = [{ id: 'p1', vorname: 'Anna', nachname: 'Berg', email: 'anna@example.de' }];
const creators = [
  { id: 'c2', vorname: 'Dirk', nachname: 'Zwei' },
  { id: 'c1', vorname: 'Cara', nachname: 'Eins' }
];

describe('Management-Betreuung', () => {
  it('zeigt die Zuordnung als Tabelle mit Mehrfachauswahl', () => {
    document.body.innerHTML = renderManagementBetreuung({
      people,
      creators,
      links: [{ ansprechpartner_id: 'p1', creator_id: 'c1' }]
    });

    expect(document.querySelector('table.betreuung-table')).toBeTruthy();
    expect(document.querySelector('.section-header h3')?.textContent).toBe('Ansprechpartner');
    expect(document.querySelectorAll('.form-field--inline')).toHaveLength(0);
    expect(document.querySelector('.table-link')?.textContent).toBe('Anna Berg');
    expect(document.querySelector('a[href="mailto:anna@example.de"]')).toBeTruthy();
    expect([...document.querySelectorAll('th')].map((th) => th.textContent)).toContain('Rufnummer');

    const cell = document.querySelector('[data-betreuung-ap="p1"]');
    const checked = [...cell.querySelectorAll('input[type="checkbox"]:checked')].map((box) => box.value);
    expect(checked).toEqual(['c1']);
    const labels = [...cell.querySelectorAll('.table-select__item-label')].map((node) => node.textContent);
    expect(labels).toEqual(['Cara Eins', 'Dirk Zwei']);
    expect(cell.querySelector('.filter-select__trigger .table-select__label')?.textContent).toBe('Cara Eins');
    expect(cell.querySelector('[data-select-search]')).toBeTruthy();
    expect(cell.closest('.betreuung-table-wrap')).toBeTruthy();
    expect(document.querySelector('col.betreuung-col-creators')).toBeTruthy();
  });

  it('zeigt den leeren Zustand ohne Tabelle', () => {
    document.body.innerHTML = renderManagementBetreuung({ people: [], creators: [], links: [] });
    expect(document.querySelector('.empty-state h3')?.textContent).toBe('Keine Ansprechpartner');
    expect(document.querySelector('table')).toBeNull();
    const add = document.querySelector('#mgmt-ap-add');
    expect(add?.querySelector('.mdc-btn__label')?.textContent).toBe('Ansprechpartner hinzufügen');
    expect(add?.querySelector('.mdc-btn__icon')).toBeTruthy();
  });

  it('lässt Creator außerhalb des Managements aus der Auswahl', () => {
    document.body.innerHTML = renderManagementBetreuung({
      people,
      creators: [creators[1]],
      links: [{ ansprechpartner_id: 'p1', creator_id: 'fremd' }]
    });
    const checked = document.querySelectorAll('[data-betreuung-ap="p1"] input[type="checkbox"]:checked');
    expect(checked).toHaveLength(0);
  });

  it('berechnet nur die geänderten Verknüpfungen', () => {
    expect(diffIds(['a', 'b'], ['b', 'c'])).toEqual({ add: ['c'], remove: ['a'] });
  });

  it('zeigt eine gesetzte Rufnummer in der Tabelle', () => {
    document.body.innerHTML = renderManagementBetreuung({
      people: [{
        ...people[0],
        telefonnummer: '176 123456',
        telefonnummer_land: { iso_code: 'de', vorwahl: '+49' }
      }],
      creators: [],
      links: []
    });
    expect(document.querySelector('a[href="tel:49176123456"] .phone-number')?.textContent).toBe('+49 176 123456');
  });

  it('öffnet das Anlegen im Drawer inklusive Creator-Auswahl', () => {
    const panel = openAddAnsprechpartnerDrawer({
      subtitle: 'Talent X',
      creators: [{ id: 'c1', vorname: 'Cara', nachname: 'Eins' }],
      onSubmit: async () => ({ ok: true })
    });
    expect(panel.classList.contains('drawer-panel')).toBe(true);
    expect(panel.querySelector('.drawer-title')?.textContent).toBe('Ansprechpartner hinzufügen');
    expect(panel.querySelector('.drawer-footer .mdc-btn__label')?.textContent).toBe('Abbrechen');
    expect(panel.querySelector('#field-telefonnummer')).toBeTruthy();
    expect(panel.querySelector('#filter-select-mgmt-ap-creators [data-select-search]')).toBeTruthy();
    expect(document.querySelector('.modal.overlay-modal')).toBeNull();
    panel.querySelector('[data-close-drawer]').click();
  });

  it('lässt die Rufnummer leer und prüft eine gesetzte Nummer', () => {
    expect(normalizePhone('', 'de')).toEqual({ ok: true, telefonnummer: null, telefonnummer_land_id: null });
    expect(normalizePhone(' 0176 123 ', 'land-1')).toEqual({
      ok: true,
      telefonnummer: '176 123',
      telefonnummer_land_id: 'land-1'
    });
    expect(normalizePhone('176', '').ok).toBe(false);
    expect(normalizePhone('abc', 'land-1').ok).toBe(false);
  });
});
