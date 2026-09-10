import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ALL_TAB,
  UNDATED_TAB,
  filterRowsByMonthYear,
  countRowsByMonth,
  formatMonthEmptyText
} from '../modules/auftrag/logic/InvoiceMonthFilter.js';
import RechnungDataModule from '../core/data/entities/RechnungDataModule.js';
import { RechnungList, getRechnungTabKey } from '../modules/rechnung/RechnungList.js';

const rows = [
  { id: 'r1', gestellt_am: '2026-01-10', created_at: '2026-01-01', status: 'Offen' },
  { id: 'r2', gestellt_am: '2026-01-20', created_at: '2025-12-01', status: 'Bezahlt' },
  { id: 'r3', gestellt_am: '2025-08-01', created_at: '2025-07-01', status: 'Offen' },
  { id: 'r4', gestellt_am: null, created_at: '2026-01-05', status: 'Offen' },
  { id: 'r5', created_at: '2026-01-06', status: 'Offen' }
];

describe('getRechnungTabKey', () => {
  it('nutzt gestellt_am fuer den Monat', () => {
    expect(getRechnungTabKey(rows[0])).toEqual({ year: 2026, month: 0 });
    expect(getRechnungTabKey(rows[2])).toEqual({ year: 2025, month: 7 });
  });

  it('ordnet fehlendes oder ungueltiges gestellt_am in Ohne Datum', () => {
    expect(getRechnungTabKey(rows[3])).toBe(UNDATED_TAB);
    expect(getRechnungTabKey(rows[4])).toBe(UNDATED_TAB);
    expect(getRechnungTabKey({ gestellt_am: 'kein-datum' })).toBe(UNDATED_TAB);
  });
});

describe('Rechnung Monatsfilter', () => {
  it('filtert nur den gewaehlten Monat im Jahr', () => {
    const january = filterRowsByMonthYear(rows, { year: 2026, month: 0 }, getRechnungTabKey);
    expect(january.map(r => r.id)).toEqual(['r1', 'r2']);
  });

  it('filtert nach gestellt_am, nicht created_at', () => {
    // r4 hat created_at im Januar 2026, aber kein gestellt_am
    const january = filterRowsByMonthYear(rows, { year: 2026, month: 0 }, getRechnungTabKey);
    expect(january.map(r => r.id)).not.toContain('r4');
    expect(january.map(r => r.id)).not.toContain('r5');
  });

  it('laesst anderes Jahr aussen vor', () => {
    const august2026 = filterRowsByMonthYear(rows, { year: 2026, month: 7 }, getRechnungTabKey);
    expect(august2026).toEqual([]);
    const august2025 = filterRowsByMonthYear(rows, { year: 2025, month: 7 }, getRechnungTabKey);
    expect(august2025.map(r => r.id)).toEqual(['r3']);
  });

  it('sammelt Zeilen ohne gestellt_am jahrunabhaengig', () => {
    const undated = filterRowsByMonthYear(rows, { year: 2026, month: UNDATED_TAB }, getRechnungTabKey);
    expect(undated.map(r => r.id)).toEqual(['r4', 'r5']);
    const undated2019 = filterRowsByMonthYear(rows, { year: 2019, month: UNDATED_TAB }, getRechnungTabKey);
    expect(undated2019.map(r => r.id)).toEqual(['r4', 'r5']);
  });

  it('gibt im Alle-Tab jede Zeile jahr- und monatsunabhaengig zurueck', () => {
    expect(filterRowsByMonthYear(rows, { year: 2026, month: ALL_TAB }, getRechnungTabKey)).toEqual(rows);
  });

  it('zaehlt Monate und Ohne-Datum separat', () => {
    expect(countRowsByMonth(rows, 2026, getRechnungTabKey)).toEqual({
      undated: 2,
      'no-renr': 0,
      alle: rows.length,
      months: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    });
  });

  it('formatiert den Empty-State monatsbezogen', () => {
    expect(formatMonthEmptyText(7, 2026)).toBe('Keine Rechnungen im August 2026.');
    expect(formatMonthEmptyText(UNDATED_TAB, 2026)).toBe('Keine Rechnungen ohne Datum.');
  });
});

describe('RechnungDataModule Sortierung', () => {
  it('sortiert nach gestellt_am DESC, Nulls hinten mit created_at-Tiebreaker', () => {
    const sorted = RechnungDataModule.transformResult([...rows]);
    expect(sorted.map(r => r.id)).toEqual(['r2', 'r1', 'r3', 'r5', 'r4']);
  });

  it('nutzt created_at als Tiebreaker bei gleichem gestellt_am', () => {
    const data = [
      { id: 'a', gestellt_am: '2026-01-10', created_at: '2026-01-02' },
      { id: 'b', gestellt_am: '2026-01-10', created_at: '2026-01-05' }
    ];
    const sorted = RechnungDataModule.transformResult(data);
    expect(sorted.map(r => r.id)).toEqual(['b', 'a']);
  });

  it('hat gestellt_am als DB-Sort', () => {
    expect(RechnungDataModule.config.sortBy).toBe('gestellt_am');
    expect(RechnungDataModule.config.sortOrder).toBe('desc');
  });
});

describe('RechnungList Monatssheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    window.currentUser = { rolle: 'admin' };
    window.isAdmin = () => true;
    window.isKunde = () => false;
    window.isMitarbeiter = () => false;
    window.validatorSystem = { sanitizeHtml: value => value };
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn((el, html) => { document.body.innerHTML = html; });
    window.dataService = { updateEntity: vi.fn() };
    window.toastSystem = { show: vi.fn() };
  });

  it('rendert Sticky-Struktur und Monats-Tabs im Fuss', () => {
    const list = new RechnungList();
    list.render();

    const stickyHead = document.querySelector('.kr-sticky-head');
    const scrollBody = document.querySelector('.kr-scroll-body');
    const stickyFoot = document.querySelector('.kr-sticky-foot');
    expect(stickyHead).toBeTruthy();
    expect(scrollBody).toBeTruthy();
    expect(stickyFoot).toBeTruthy();

    expect(stickyHead.querySelector('.rechnung-type-tabs')).toBeTruthy();
    expect(stickyHead.querySelector('.rechnung-status-tabs')).toBeTruthy();
    expect(stickyHead.querySelector('#rechnung-month-tabs')).toBeNull();

    expect(scrollBody.querySelector('#rechnungen-table-body')).toBeTruthy();

    expect(stickyFoot.querySelector('#rechnung-month-tabs')).toBeTruthy();
    expect(stickyFoot.querySelector('#rechnung-year-select')).toBeTruthy();
    expect(stickyFoot.querySelectorAll('.tab-button')).toHaveLength(14);
  });

  it('enthaelt keine Typ- und keine Kampagne/Contract-Spalte', () => {
    const list = new RechnungList();
    list.render();
    const headers = [...document.querySelectorAll('thead th')].map(header => header.textContent.trim());

    expect(headers).not.toContain('Typ');
    expect(headers).not.toContain('Kampagne / Contract');
    expect(headers).toContain('Erstellt am');
    expect(headers).toContain('Gestellt am');
  });

  it('waehlt den aktuellen Monat vor', () => {
    const list = new RechnungList();
    const now = new Date();
    expect(list.currentMonth).toBe(now.getMonth());
    expect(list.currentYear).toBe(now.getFullYear());

    list.render();
    const active = document.querySelector('#rechnung-month-tabs .tab-button.active');
    expect(active.dataset.tab).toBe(String(now.getMonth()));
  });

  it('setzt Alle beim Oeffnen auf den aktuellen Monat zurueck', async () => {
    const list = new RechnungList();
    list.currentMonth = ALL_TAB;
    list.currentYear = 2020;
    list.loadAndRender = vi.fn();
    window.bulkActionSystem = { registerList: vi.fn() };

    await list.init();

    const now = new Date();
    expect(list.currentMonth).toBe(now.getMonth());
    expect(list.currentYear).toBe(now.getFullYear());
    expect(list.loadAndRender).toHaveBeenCalled();
    list.destroy();
  });

  it('stellt den Alle-Tab voran', () => {
    const list = new RechnungList();
    list.render();
    const tabs = [...document.querySelectorAll('#rechnung-month-tabs .tab-button[data-tab]')];
    expect(tabs[0].dataset.tab).toBe(ALL_TAB);
    expect(tabs.at(-1).dataset.tab).toBe(UNDATED_TAB);
  });

  it('aktualisiert Counts und Active-State der Monats-Tabs', () => {
    const list = new RechnungList();
    list.currentYear = 2026;
    list.currentMonth = 0;
    list.rechnungen = rows;
    list._blattCounts = {
      months: {
        undated: 2,
        alle: rows.length,
        months: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      }
    };
    document.body.innerHTML = list.renderMonthSheet();
    list.updateMonthTabUI();

    expect(document.querySelector('#rechnung-month-tabs [data-month-count="0"]').textContent).toBe('2');
    expect(document.querySelector('#rechnung-month-tabs [data-month-count="2"]').textContent).toBe('0');
    expect(document.querySelector(`#rechnung-month-tabs [data-month-count="${UNDATED_TAB}"]`).textContent).toBe('2');
    expect(document.querySelector(`#rechnung-month-tabs [data-month-count="${ALL_TAB}"]`).textContent).toBe(String(rows.length));
    expect(document.querySelector('#rechnung-month-tabs .tab-button[data-tab="0"]').classList.contains('active')).toBe(true);
  });

  it('laedt das Blatt beim Tab-Wechsel neu', () => {
    const list = new RechnungList();
    list.currentYear = 2026;
    list.currentMonth = 0;
    list.reloadBlatt = vi.fn();

    list.selectInvoiceMonth(ALL_TAB);
    expect(list.currentMonth).toBe(ALL_TAB);
    expect(list.reloadBlatt).toHaveBeenCalledWith({ withCounts: false });

    list.selectInvoiceMonth('2');
    expect(list.currentMonth).toBe(2);
    expect(list.reloadBlatt).toHaveBeenLastCalledWith({ withCounts: false });
  });

  it('markiert den Monats-Tab sofort vor dem Laden', () => {
    const list = new RechnungList();
    list.currentYear = 2026;
    list.currentMonth = 0;
    list._blattCounts = {
      months: { undated: 0, alle: 5, months: Array(12).fill(0) }
    };
    document.body.innerHTML = list.renderMonthSheet();
    list.updateMonthTabUI();
    list.reloadBlatt = vi.fn();

    list.selectInvoiceMonth(ALL_TAB);

    expect(document.querySelector(`#rechnung-month-tabs .tab-button[data-tab="${ALL_TAB}"]`).classList.contains('active')).toBe(true);
    expect(document.querySelector('#rechnung-month-tabs .tab-button[data-tab="0"]').classList.contains('active')).toBe(false);
    expect(list.reloadBlatt).toHaveBeenCalledWith({ withCounts: false });
  });

  it('laedt das Blatt bei der Suche neu', () => {
    vi.useFakeTimers();
    const list = new RechnungList();
    list.reloadBlatt = vi.fn();

    list.handleSearch('  acme  ');
    expect(list.reloadBlatt).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);

    expect(list.searchQuery).toBe('acme');
    expect(list.reloadBlatt).toHaveBeenCalledWith({ withCounts: true });
    vi.useRealTimers();
  });
});
