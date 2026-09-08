// PaidInvoiceSums.test.js
// Tests fuer isInvoiceRowPaid + sumPaidInvoiceRows (Grundlage der
// „Bereits bezahlt"-Cards auf Kundenrechnungen und Stakeholder-Uebersicht).

import { describe, it, expect } from 'vitest';
import { isInvoiceRowPaid, sumPaidInvoiceRows } from '../modules/auftrag/logic/PaymentRowStatus.js';

describe('isInvoiceRowPaid', () => {
  it('nutzt ueberwiesen_am als massgebliches Feld', () => {
    expect(isInvoiceRowPaid({ ueberwiesen_am: '2026-09-01' })).toBe(true);
    expect(isInvoiceRowPaid({ ueberwiesen_am: null })).toBe(false);
    expect(isInvoiceRowPaid({ ueberwiesen_am: '' })).toBe(false);
  });

  it('faellt auf das Boolean-Flag zurueck, wenn kein Datums-Feld uebergeben wird', () => {
    expect(isInvoiceRowPaid({ ueberwiesen: true })).toBe(true);
    expect(isInvoiceRowPaid({ ueberwiesen: false })).toBe(false);
  });

  it('Datums-Feld schlaegt das Boolean-Flag', () => {
    expect(isInvoiceRowPaid({ ueberwiesen: true, ueberwiesen_am: null })).toBe(false);
    expect(isInvoiceRowPaid({ ueberwiesen: false, ueberwiesen_am: '2026-09-01' })).toBe(true);
  });

  it('leere/fehlende Werte sind nicht bezahlt', () => {
    expect(isInvoiceRowPaid({})).toBe(false);
    expect(isInvoiceRowPaid()).toBe(false);
  });
});

describe('sumPaidInvoiceRows', () => {
  it('summiert Netto und Brutto nur bezahlter Zeilen', () => {
    const rows = [
      { nettobetrag: 100, bruttobetrag: 119, ueberwiesen_am: '2026-09-01' },
      { nettobetrag: 200, bruttobetrag: 238, ueberwiesen_am: null },
      { nettobetrag: 50, bruttobetrag: 59.5, ueberwiesen_am: '2026-08-15' }
    ];
    expect(sumPaidInvoiceRows(rows)).toEqual({ netto: 150, brutto: 178.5 });
  });

  it('behandelt fehlende oder ungueltige Betraege als 0', () => {
    const rows = [
      { ueberwiesen_am: '2026-09-01' },
      { nettobetrag: 'abc', bruttobetrag: null, ueberwiesen_am: '2026-09-02' }
    ];
    expect(sumPaidInvoiceRows(rows)).toEqual({ netto: 0, brutto: 0 });
  });

  it('parst String-Betraege aus der Datenbank', () => {
    const rows = [
      { nettobetrag: '1000.50', bruttobetrag: '1190.60', ueberwiesen_am: '2026-09-01' }
    ];
    expect(sumPaidInvoiceRows(rows)).toEqual({ netto: 1000.5, brutto: 1190.6 });
  });

  it('Boolean-Fallback fuer Zeilen ohne Datums-Feld', () => {
    const rows = [{ nettobetrag: 10, bruttobetrag: 11.9, ueberwiesen: true }];
    expect(sumPaidInvoiceRows(rows)).toEqual({ netto: 10, brutto: 11.9 });
  });

  it('leere oder fehlende Liste ergibt 0', () => {
    expect(sumPaidInvoiceRows([])).toEqual({ netto: 0, brutto: 0 });
    expect(sumPaidInvoiceRows()).toEqual({ netto: 0, brutto: 0 });
  });
});
