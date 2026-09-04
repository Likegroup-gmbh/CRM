import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_TAB,
  NO_RENR_TAB,
  UNDATED_TAB,
  countRowsByMonth,
  filterRowsByMonthYear,
  findInvoiceCacheRow,
  formatMonthEmptyText,
  resolveDefaultMonth
} from '../modules/auftrag/logic/InvoiceMonthFilter.js';
import { AusgangsrechnungenList } from '../modules/ausgangsrechnungen/AusgangsrechnungenList.js';
import { defaultReNrPrefix } from '../modules/auftrag/logic/PrefixedNumberSort.js';
import { DataPreparer } from '../core/data/DataPreparer.js';
import { EntityRegistry } from '../core/data/entities/index.js';

const rows = [
  { id: 'a1', teilrechnung_id: 'tr1', re_nr: 'RE-1', rechnung_gestellt_am: '2026-01-10' },
  { id: 'a2', teilrechnung_id: 'tr2', re_nr: 'RE-2', ueberwiesen_am: '2026-03-05', rechnung_gestellt_am: '2026-01-01' },
  { id: 'a3', teilrechnung_id: 'tr3', re_nr: 'RE-3', rechnung_gestellt_am: '2025-08-01' },
  { id: 'a4', teilrechnung_id: 'tr4', re_nr: 'RE-4' },
  { id: 'a5', teilrechnung_id: 'tr5', re_nr: '', rechnung_gestellt_am: '2026-01-20' }
];

describe('InvoiceMonthFilter', () => {
  it('filtert nur den gewaehlten Monat im Jahr', () => {
    const january = filterRowsByMonthYear(rows, { year: 2026, month: 0 });
    expect(january.map(r => r.id)).toEqual(['a1']);
  });

  it('folgt derselben Datumskaskade wie der Cashflow-Kalender', () => {
    const march = filterRowsByMonthYear(rows, { year: 2026, month: 2 });
    expect(march.map(r => r.id)).toEqual(['a2']);
  });

  it('laesst anderes Jahr aussen vor', () => {
    const august2026 = filterRowsByMonthYear(rows, { year: 2026, month: 7 });
    expect(august2026).toEqual([]);
    const august2025 = filterRowsByMonthYear(rows, { year: 2025, month: 7 });
    expect(august2025.map(r => r.id)).toEqual(['a3']);
  });

  it('sammelt Zeilen ohne Datum jahrunabhaengig', () => {
    expect(filterRowsByMonthYear(rows, { year: 2026, month: UNDATED_TAB }).map(r => r.id)).toEqual(['a4']);
    expect(filterRowsByMonthYear(rows, { year: 2019, month: UNDATED_TAB }).map(r => r.id)).toEqual(['a4']);
  });

  it('sammelt Zeilen ohne Rechnungsnummer exklusiv und jahrunabhaengig', () => {
    expect(filterRowsByMonthYear(rows, { year: 2026, month: NO_RENR_TAB }).map(r => r.id)).toEqual(['a5']);
    expect(filterRowsByMonthYear(rows, { year: 2019, month: NO_RENR_TAB }).map(r => r.id)).toEqual(['a5']);
    expect(filterRowsByMonthYear(rows, { year: 2026, month: 0 }).map(r => r.id)).not.toContain('a5');
    expect(filterRowsByMonthYear(rows, { year: 2026, month: UNDATED_TAB }).map(r => r.id)).not.toContain('a5');
  });

  it('gibt im Alle-Tab jede Zeile jahr- und monatsunabhaengig zurueck', () => {
    expect(filterRowsByMonthYear(rows, { year: 2026, month: ALL_TAB })).toEqual(rows);
    expect(filterRowsByMonthYear(rows, { year: 2019, month: ALL_TAB })).toEqual(rows);
  });

  it('behaelt den Alle-Tab auch ohne Treffer im gewaehlten Jahr', () => {
    expect(resolveDefaultMonth(rows, 2019, ALL_TAB)).toBe(ALL_TAB);
    expect(resolveDefaultMonth([], 2026, ALL_TAB)).toBe(ALL_TAB);
  });

  it('zaehlt Monate, Ohne-Datum und Ohne-RE-Nr separat', () => {
    expect(countRowsByMonth(rows, 2026)).toEqual({
      undated: 1,
      'no-renr': 1,
      alle: rows.length,
      months: [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    });
  });

  it('nimmt den aktuellen Monat wenn Daten da sind, sonst den ersten Monat mit Daten', () => {
    expect(resolveDefaultMonth(rows, 2026, 0)).toBe(0);
    expect(resolveDefaultMonth(rows, 2026, 7)).toBe(0);
    expect(resolveDefaultMonth([{ id: 'x' }], 2026, 7)).toBe(NO_RENR_TAB);
  });

  it('formatiert den Empty-State monatsbezogen', () => {
    expect(formatMonthEmptyText(7, 2026)).toBe('Keine Rechnungen im August 2026.');
    expect(formatMonthEmptyText(UNDATED_TAB, 2026)).toBe('Keine Rechnungen ohne Datum.');
    expect(formatMonthEmptyText(NO_RENR_TAB, 2026)).toBe('Keine Rechnungen ohne Rechnungsnummer.');
    expect(formatMonthEmptyText(ALL_TAB, 2026)).toBe('Keine Rechnungen vorhanden.');
  });

  it('findet Cache-Zeilen ueber Teilrechnungs- oder Auftrags-ID', () => {
    expect(findInvoiceCacheRow(rows, 'tr2')?.id).toBe('a2');
    expect(findInvoiceCacheRow([{ id: 'legacy', teilrechnung_id: null }], 'legacy')?.id).toBe('legacy');
  });
});

describe('AusgangsrechnungenList Monatssheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    window.currentUser = { rolle: 'admin' };
    window.validatorSystem = { sanitizeHtml: value => value };
    window.dataService = { updateEntity: vi.fn() };
    window.toastSystem = { show: vi.fn() };
  });

  it('deaktiviert Pagination und rendert die Monats-Leiste statt des Pagination-Containers', () => {
    const list = new AusgangsrechnungenList();
    expect(list.usesPagination).toBe(false);

    document.body.innerHTML = list.renderListView();
    expect(document.getElementById('pagination-auftrag')).toBeNull();
    expect(document.getElementById('ausgangsrechnungen-month-tabs')).toBeTruthy();
    expect(document.getElementById('ausgangsrechnungen-year-select')).toBeTruthy();
    expect(document.querySelectorAll('#ausgangsrechnungen-month-tabs .tab-button')).toHaveLength(15);
  });

  it('kuerzt die Rechnungsspalten auf alltagstaugliche Header', () => {
    const list = new AusgangsrechnungenList();
    document.body.innerHTML = list.renderListView();
    const headers = [...document.querySelectorAll('thead th')]
      .map(header => header.textContent.trim());

    expect(headers).toContain('RE-Nr.');
    expect(headers).toContain('RE-Datum');
    expect(headers).toContain('Fällig am');
    expect(headers).toContain('Zahlungseingang');
    expect(headers).toContain('RE gestellt');
    expect(headers).toContain('MwSt');
    expect(headers).toContain('Bezahlt');
    expect(headers).not.toContain('Rechnungsnummer');
    expect(headers).not.toContain('Mehrwertsteuer');
    expect(headers).not.toContain('Überwiesen');
  });

  it('aktualisiert Counts und Active-State der Tabs', () => {
    const list = new AusgangsrechnungenList();
    list.currentYear = 2026;
    list.currentMonth = 0;
    list._allInvoiceRows = rows;
    document.body.innerHTML = list.renderMonthSheet();
    list.updateMonthTabUI();

    expect(document.querySelector('[data-month-count="0"]').textContent).toBe('1');
    expect(document.querySelector('[data-month-count="2"]').textContent).toBe('1');
    expect(document.querySelector(`[data-month-count="${UNDATED_TAB}"]`).textContent).toBe('1');
    expect(document.querySelector(`[data-month-count="${NO_RENR_TAB}"]`).textContent).toBe('1');
    expect(document.querySelector(`[data-month-count="${ALL_TAB}"]`).textContent).toBe(String(rows.length));
    expect(document.querySelector('#ausgangsrechnungen-month-tabs .tab-button[data-tab="0"]').classList.contains('active')).toBe(true);
  });

  it('stellt den Alle-Tab voran und zeigt darin alle Zeilen', () => {
    const list = new AusgangsrechnungenList();
    list.currentYear = 2026;
    list.currentMonth = 0;
    list._allInvoiceRows = rows;
    list.updateTable = vi.fn();
    document.body.innerHTML = list.renderMonthSheet();

    const tabs = [...document.querySelectorAll('#ausgangsrechnungen-month-tabs .tab-button[data-tab]')];
    expect(tabs[0].dataset.tab).toBe(ALL_TAB);
    expect(tabs.at(-1).dataset.tab).toBe(NO_RENR_TAB);

    list.selectInvoiceMonth(ALL_TAB);
    expect(list.currentMonth).toBe(ALL_TAB);
    expect(list.updateTable).toHaveBeenCalledWith(rows, 'auftraege');
  });

  it('waehlt trotz vorangestelltem Alle-Tab den aktuellen Monat vor', () => {
    const list = new AusgangsrechnungenList();
    const now = new Date();
    expect(list.currentMonth).toBe(now.getMonth());

    document.body.innerHTML = list.renderMonthSheet();
    const active = document.querySelector('#ausgangsrechnungen-month-tabs .tab-button.active');
    expect(active.dataset.tab).toBe(String(now.getMonth()));
  });

  it('filtert beim Tab-Wechsel nur den Cache', () => {
    const list = new AusgangsrechnungenList();
    list.currentYear = 2026;
    list.currentMonth = 0;
    list._allInvoiceRows = rows;
    list.updateTable = vi.fn();
    list.updateMonthTabUI = vi.fn();

    list.selectInvoiceMonth('2');
    expect(list.currentMonth).toBe(2);
    expect(list.updateTable).toHaveBeenCalledWith([rows[1]], 'auftraege');
  });

  it('entfernt eine Zeile aus dem aktuellen Monat nach Rechnungsdatum-Edit', () => {
    const list = new AusgangsrechnungenList();
    list.currentYear = 2026;
    list.currentMonth = 0;
    list._allInvoiceRows = rows.map(row => ({ ...row }));
    list.updateTable = vi.fn();
    list.updateMonthTabUI = vi.fn();

    list.onInlineBillingUpdated({
      id: 'tr1',
      field: 'rechnung_gestellt_am',
      value: '2026-04-10'
    });

    expect(list._allInvoiceRows[0].rechnung_gestellt_am).toBe('2026-04-10');
    expect(list.updateTable).toHaveBeenCalledWith([], 'auftraege');
  });

  it('entfernt eine Zeile aus Ohne-RE-Nr nach re_nr-Save', () => {
    const list = new AusgangsrechnungenList();
    list.currentYear = 2026;
    list.currentMonth = NO_RENR_TAB;
    list._allInvoiceRows = rows.map(row => ({ ...row }));
    list.updateTable = vi.fn();
    list.updateMonthTabUI = vi.fn();

    list.onInlineReNrUpdated({ id: 'tr5', value: 'RE-5' });

    expect(list._allInvoiceRows[4].re_nr).toBe('RE-5');
    expect(list.updateTable).toHaveBeenCalledWith([], 'auftraege');
  });

  it('rendert re_nr als grid-input fuer Admins und als Text fuer Kunden', () => {
    const list = new AusgangsrechnungenList();
    list._isAdmin = true;
    list._isKunde = false;
    const html = list.renderRechnungsnummerCell({
      id: 'a1',
      teilrechnung_id: 'tr1',
      re_nr: 'RE-9'
    });
    expect(html).toContain('auftrag-inline-re-nr-input');
    expect(html).toContain('data-entity="auftrag_teilrechnung"');
    expect(html).toContain('data-id="tr1"');
    expect(html).toContain('value="RE-9"');

    list._isAdmin = false;
    expect(list.renderRechnungsnummerCell({ id: 'a1', re_nr: 'RE-9' })).toBe('RE-9');
  });

  it('fuellt leere re_nr mit RE-{Jahr} ohne den Cache zu setzen', () => {
    const list = new AusgangsrechnungenList();
    list._isAdmin = true;
    const prefix = defaultReNrPrefix();
    const html = list.renderRechnungsnummerCell({
      id: 'a5',
      teilrechnung_id: 'tr5',
      re_nr: ''
    });
    expect(html).toContain(`value="${prefix}"`);
    expect(html).toContain(`data-previous-value="${prefix}"`);
  });

  it('speichert bloßen RE-Prefix als null und laesst den Cache ohne Nummer', async () => {
    const list = new AusgangsrechnungenList();
    list._isAdmin = true;
    list.currentYear = 2026;
    list.currentMonth = NO_RENR_TAB;
    list._allInvoiceRows = rows.map(row => ({ ...row }));
    list.updateTable = vi.fn();
    list.updateMonthTabUI = vi.fn();
    window.dataService.updateEntity.mockResolvedValue({ success: true });

    const prefix = defaultReNrPrefix();
    document.body.innerHTML = `
      <input class="grid-input auftrag-inline-re-nr-input"
        data-entity="auftrag_teilrechnung" data-id="tr5" data-field="re_nr"
        data-previous-value="RE-ALT" value="${prefix}">
    `;

    await list.handleInlineReNrChange(document.querySelector('.auftrag-inline-re-nr-input'));
    expect(window.dataService.updateEntity).toHaveBeenCalledWith(
      'auftrag_teilrechnung',
      'tr5',
      { re_nr: null }
    );

    list.onInlineReNrUpdated({ id: 'tr5', field: 're_nr', value: null });
    expect(list._allInvoiceRows[4].re_nr).toBeNull();
    expect(list.updateTable).toHaveBeenCalled();
  });

  it('schreibt externe_po ohne die Tabelle neu zu filtern', async () => {
    const list = new AusgangsrechnungenList();
    list._isAdmin = true;
    list.currentYear = 2026;
    list.currentMonth = NO_RENR_TAB;
    list._allInvoiceRows = rows.map(row => ({ ...row }));
    list.updateTable = vi.fn();
    list.updateMonthTabUI = vi.fn();
    window.dataService.updateEntity.mockResolvedValue({ success: true });

    document.body.innerHTML = `
      <input class="grid-input auftrag-inline-text-input"
        data-entity="auftrag_teilrechnung" data-id="tr5" data-field="externe_po"
        data-previous-value="" value="PO-99">
    `;

    await list.handleInlineReNrChange(document.querySelector('.auftrag-inline-text-input'));
    expect(window.dataService.updateEntity).toHaveBeenCalledWith(
      'auftrag_teilrechnung',
      'tr5',
      { externe_po: 'PO-99' }
    );

    list.onInlineReNrUpdated({ id: 'tr5', field: 'externe_po', value: 'PO-99' });
    expect(list._allInvoiceRows[4].externe_po).toBe('PO-99');
    expect(list._allInvoiceRows[4].re_nr).toBe('');
    expect(list.updateTable).not.toHaveBeenCalled();
  });

  it('rendert Rechnungsdatum als Billing-Picker und Externe PO als Input', () => {
    const list = new AusgangsrechnungenList();
    list._isAdmin = true;
    const dateHtml = list.renderInvoiceDateCell({
      id: 'a1',
      teilrechnung_id: 'tr1',
      rechnung_gestellt_am: '2026-08-19'
    });
    expect(dateHtml).toContain('auftrag-inline-date-input');
    expect(dateHtml).toContain('data-date-field="rechnung_gestellt_am"');
    expect(dateHtml).toContain('data-field="rechnung_gestellt"');
    expect(dateHtml).toContain('data-entity="auftrag_teilrechnung"');

    const poHtml = list.renderExternePoCell({
      id: 'a1',
      teilrechnung_id: 'tr1',
      externe_po: ''
    });
    expect(poHtml).toContain('auftrag-inline-text-input');
    expect(poHtml).toContain('data-field="externe_po"');
    expect(poHtml).toContain('placeholder="Externe PO"');

    list._isAdmin = false;
    expect(list.renderInvoiceDateCell({ rechnung_gestellt_am: '2026-08-19' })).toBe(
      list.formatDate('2026-08-19')
    );
    expect(list.renderExternePoCell({ externe_po: 'PO-1' })).toBe('PO-1');
  });

  it('bereitet externe_po fuer Teilrechnungen vor', async () => {
    const preparer = new DataPreparer();
    const result = await preparer.prepareDataForSupabase(
      { externe_po: 'PO-99' },
      EntityRegistry.auftrag_teilrechnung.fields,
      'auftrag_teilrechnung'
    );
    expect(result).toEqual({ externe_po: 'PO-99' });
  });

  it('schreibt re_nr auf die Teilrechnung und skippt unveraenderte Werte', async () => {
    const list = new AusgangsrechnungenList();
    list._isAdmin = true;
    window.dataService.updateEntity.mockResolvedValue({ success: true });
    document.body.innerHTML = `
      <input class="grid-input auftrag-inline-re-nr-input"
        data-entity="auftrag_teilrechnung" data-id="tr1" data-field="re_nr"
        data-previous-value="" value="RE-100">
    `;
    const input = document.querySelector('.auftrag-inline-re-nr-input');

    await list.handleInlineReNrChange(input);
    expect(window.dataService.updateEntity).toHaveBeenCalledWith(
      'auftrag_teilrechnung',
      'tr1',
      { re_nr: 'RE-100' }
    );

    window.dataService.updateEntity.mockClear();
    input.dataset.previousValue = 'RE-100';
    input.value = 'RE-100';
    await list.handleInlineReNrChange(input);
    expect(window.dataService.updateEntity).not.toHaveBeenCalled();
  });

  it('speichert leere Rechnungsnummer als null auf dem Auftrag', async () => {
    const list = new AusgangsrechnungenList();
    list._isAdmin = true;
    window.dataService.updateEntity.mockResolvedValue({ success: true });
    document.body.innerHTML = `
      <input class="grid-input auftrag-inline-re-nr-input"
        data-entity="auftrag" data-id="a1" data-field="re_nr"
        data-previous-value="RE-1" value="   ">
    `;

    await list.handleInlineReNrChange(document.querySelector('.auftrag-inline-re-nr-input'));
    expect(window.dataService.updateEntity).toHaveBeenCalledWith('auftrag', 'a1', { re_nr: null });
  });

  it('bereitet re_nr fuer Teilrechnungen vor', async () => {
    const preparer = new DataPreparer();
    const result = await preparer.prepareDataForSupabase(
      { re_nr: 'RE-2026-001' },
      EntityRegistry.auftrag_teilrechnung.fields,
      'auftrag_teilrechnung'
    );
    expect(result).toEqual({ re_nr: 'RE-2026-001' });
  });

  it('leert den Cache beim Destroy und entfernt den focusin-Listener', () => {
    const list = new AusgangsrechnungenList();
    list._allInvoiceRows = rows;
    list._monthInitialized = true;
    list.bindGlobalDelegatedEvents();
    expect(list._globalFocusInHandler).toEqual(expect.any(Function));
    const focusHandler = list._globalFocusInHandler;
    const remove = vi.spyOn(document, 'removeEventListener');
    list.destroy();
    expect(list._allInvoiceRows).toEqual([]);
    expect(list._monthInitialized).toBe(false);
    expect(remove).toHaveBeenCalledWith('focusin', focusHandler);
    expect(list._globalFocusInHandler).toBeNull();
    remove.mockRestore();
  });

  it('short-circuited entityUpdated fuer externe_po ohne Full-Reload', () => {
    const list = new AusgangsrechnungenList();
    list.loadAuftraegeData = vi.fn();
    const patch = vi.spyOn(list, 'onInlineReNrUpdated');
    list.bindGlobalDelegatedEvents();

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: {
        entity: 'auftrag_teilrechnung',
        action: 'updated',
        id: 'tr5',
        field: 'externe_po',
        value: 'PO-99'
      }
    }));

    expect(patch).toHaveBeenCalledWith(expect.objectContaining({
      field: 'externe_po',
      value: 'PO-99'
    }));
    expect(list.loadAuftraegeData).not.toHaveBeenCalled();
    list.destroy();
  });
});
