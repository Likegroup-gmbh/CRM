// Der nicht auf Teilrechnungen verteilte Rest des Angebotsnettos ist nur fuer Admins sichtbar.

import { beforeEach, describe, expect, it } from 'vitest';
import { AuftragList } from '../modules/auftrag/AuftragList.js';
import { AuftragCashFlowCalendar } from '../modules/auftrag/AuftragCashFlowCalendar.js';

const ninja = {
  id: 'a1',
  nettobetrag: 1322900.84,
  unternehmen: { id: 'u1', firmenname: 'Ninja' },
  marke: { id: 'm1', markenname: 'Ninja' },
  teilrechnungen: [
    { id: 't1', position: 1, nettobetrag: 644978.39, rechnung_gestellt_am: '2026-10-01' },
    { id: 't2', position: 2, nettobetrag: 617813.70 }
  ]
};

describe('Auftragsliste: Netto-Zelle', () => {
  beforeEach(() => {
    window.validatorSystem = { sanitizeHtml: value => value };
  });

  function createList(isAdmin) {
    const list = new AuftragList();
    list._isAdmin = isAdmin;
    return list;
  }

  it('zeigt Admins den nicht verteilten Betrag', () => {
    const html = createList(true).renderNettoZelle(ninja);
    expect(html).toContain('nicht verteilt');
    expect(html).toContain('60.108,75');
  });

  it('warnt Admins, wenn die Teilrechnungen ueber dem Netto liegen', () => {
    const html = createList(true).renderNettoZelle({ ...ninja, nettobetrag: 1000000 });
    expect(html).toContain('über Netto');
    expect(html).toContain('auftrag-netto-verteilung--warnung');
  });

  it('zeigt Nicht-Admins nur den Betrag', () => {
    const html = createList(false).renderNettoZelle(ninja);
    expect(html).not.toContain('auftrag-netto-verteilung');
  });

  it('zeigt nichts bei voll verteilten Auftraegen', () => {
    const html = createList(true).renderNettoZelle({ ...ninja, nettobetrag: 1262792.09 });
    expect(html).not.toContain('auftrag-netto-verteilung');
  });
});

describe('Cashflow-Kalender: Spalte Nicht verteilt', () => {
  function renderCalendar(isAdmin) {
    window.isAdmin = () => isAdmin;
    const calendar = new AuftragCashFlowCalendar();
    calendar.currentYear = 2026;
    calendar.container = document.createElement('div');
    calendar.auftraege = [ninja];
    calendar.groupData();
    calendar.render();
    return calendar;
  }

  it('zeigt Admins den Rest pro Marke und in der Summe, ohne die Monate zu aendern', () => {
    const calendar = renderCalendar(true);
    const headers = [...calendar.container.querySelectorAll('thead th')].map(th => th.textContent.trim());
    expect(headers.at(-1)).toBe('Nicht verteilt');

    const zeile = calendar.container.querySelector('.cash-flow-data-row');
    expect(zeile.lastElementChild.textContent).toBe(calendar.formatCurrency(60108.75));
    expect(calendar.container.querySelector('tfoot tr').lastElementChild.textContent)
      .toBe(calendar.formatCurrency(60108.75));
    expect(calendar.groupedData[0].months[9].total).toBeCloseTo(644978.39);

    expect(calendar.getExportColumns().at(-1).key).toBe('nicht_verteilt');
    expect(calendar.prepareExportData()[0].nicht_verteilt).toBeCloseTo(60108.75);
  });

  it('blendet die Spalte fuer Nicht-Admins aus, auch im Export', () => {
    const calendar = renderCalendar(false);
    const headers = [...calendar.container.querySelectorAll('thead th')].map(th => th.textContent.trim());
    expect(headers).not.toContain('Nicht verteilt');
    expect(calendar.getExportColumns().map(c => c.key)).not.toContain('nicht_verteilt');
  });
});
