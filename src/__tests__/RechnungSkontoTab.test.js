import { beforeEach, describe, expect, it } from 'vitest';
import { RechnungList } from '../modules/rechnung/RechnungList.js';
import {
  SKONTO_STATUS_TAB,
  updateSingleRow,
  updateStatusTabCounts,
  updateTableRows
} from '../modules/rechnung/RechnungListRenderer.js';

const monthRows = [
  { id: 'offen-skonto', status: 'Offen', skonto: true, rechnung_nr: 'RE-1' },
  { id: 'bezahlt-skonto', status: 'Bezahlt', skonto: true, rechnung_nr: 'RE-2' },
  { id: 'offen', status: 'Offen', skonto: false, rechnung_nr: 'RE-3' },
  { id: 'ohne', status: 'Bezahlt', skonto: null, rechnung_nr: 'RE-4' }
];

describe('Skonto-Tab auf der Rechnungsliste', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.currentUser = { rolle: 'admin', permissions: {} };
    window.isAdmin = () => true;
    window.isInvestor = () => false;
    window.isKunde = () => false;
    window.isMitarbeiter = () => false;
    window.validatorSystem = { sanitizeHtml: value => value };
    window.setHeadline = () => {};
    window.setContentSafely = (_el, html) => { document.body.innerHTML = html; };
  });

  it('zeigt Skonto als eigenen Tab in der Statusleiste', () => {
    const list = new RechnungList();
    list.render();

    const tab = document.querySelector('.rechnung-status-tabs [data-tab="skonto"]');
    expect(tab?.textContent).toContain('Skonto');
    expect(list.statusTabs.at(-1)).toEqual({ id: 'skonto', label: 'Skonto' });
  });

  it('filtert im bereits geladenen Monat nur Rechnungen mit gesetztem Skonto', () => {
    const list = new RechnungList();
    list.rechnungen = monthRows;

    list.activeStatusTab = 'Offen';
    expect(list.getFilteredRechnungen().map(r => r.id)).toEqual(['offen-skonto', 'offen']);

    list.activeStatusTab = SKONTO_STATUS_TAB;
    expect(list.getFilteredRechnungen().map(r => r.id)).toEqual(['offen-skonto', 'bezahlt-skonto']);
  });

  it('zaehlt Skonto unabhaengig vom Status', () => {
    const list = new RechnungList();
    list.render();
    updateStatusTabCounts(
      monthRows,
      list.statusTabs,
      { type: { rechnung: 4, contracting: 0 } },
      list.typeTabs
    );

    expect(document.querySelector('[data-status-count="skonto"]').textContent).toBe('2');
    expect(document.querySelector('[data-status-count="Offen"]').textContent).toBe('2');
    expect(document.querySelector('[data-status-count="Bezahlt"]').textContent).toBe('2');
    expect(document.querySelector('[data-status-count="alle"]').textContent).toBe('4');
  });

  it('nennt im leeren Monat, dass kein Skonto gesetzt ist', async () => {
    const list = new RechnungList();
    list.render();
    await updateTableRows([], {
      isAdmin: true,
      statusOptions: list.statusOptions,
      activeStatusTab: SKONTO_STATUS_TAB,
      activeTypeTab: 'rechnung',
      currentMonth: 7,
      currentYear: 2026,
      notizMap: new Map(),
      hasActiveFilters: false
    });

    const text = document.querySelector('#rechnungen-table-body').textContent;
    expect(text).toContain('Keine Rechnungen mit Skonto');
    expect(text).toContain('August 2026');
  });

  it('behaelt eine Skonto-Rechnung beim Bezahlen im Tab', () => {
    const list = new RechnungList();
    list.render();
    const rechnungen = [{ id: 'r1', status: 'Offen', skonto: true, zahlungsziel: null }];
    document.getElementById('rechnungen-table-body').innerHTML = `
      <tr data-id="r1">
        <td data-col="status">Offen</td>
        <td class="col-actions"></td>
      </tr>`;

    updateSingleRow('r1', 'Bezahlt', {
      rechnungen,
      statusOptions: list.statusOptions,
      activeStatusTab: SKONTO_STATUS_TAB,
      statusTabs: list.statusTabs,
      blattCounts: { type: {} },
      typeTabs: list.typeTabs,
      reloadCallback: () => { throw new Error('sollte nicht neu laden'); }
    });

    expect(document.querySelector('tr[data-id="r1"]')).toBeTruthy();
    expect(document.querySelector('td[data-col="status"]').textContent).toBe('Bezahlt');
    expect(document.querySelector('[data-status-count="skonto"]').textContent).toBe('1');
  });

  it('nimmt eine bezahlte Rechnung aus dem Offen-Tab', () => {
    const list = new RechnungList();
    list.render();
    const rechnungen = [{ id: 'r1', status: 'Offen', skonto: true, zahlungsziel: null }];
    document.getElementById('rechnungen-table-body').innerHTML = `
      <tr data-id="r1">
        <td data-col="status">Offen</td>
        <td class="col-actions"></td>
      </tr>`;

    updateSingleRow('r1', 'Bezahlt', {
      rechnungen,
      statusOptions: list.statusOptions,
      activeStatusTab: 'Offen',
      statusTabs: list.statusTabs,
      blattCounts: { type: {} },
      typeTabs: list.typeTabs,
      reloadCallback: () => { throw new Error('sollte nicht neu laden'); }
    });

    expect(document.querySelector('tr[data-id="r1"]')).toBeNull();
  });
});
