import { describe, expect, it } from 'vitest';
import { getInvoiceDisplayDate, getInvoiceMonthKey } from '../modules/auftrag/logic/InvoiceDisplayDate.js';

describe('InvoiceDisplayDate', () => {
  it('priorisiert ueberwiesen_am vor allen anderen Daten', () => {
    expect(getInvoiceDisplayDate({
      ueberwiesen_am: '2026-04-10',
      rechnung_gestellt_am: '2026-03-01',
      erwarteter_monat_zahlungseingang: '2026-02-01',
      re_faelligkeit: '2026-01-15'
    })).toEqual({
      date: new Date('2026-04-10'),
      status: 'paid'
    });
  });

  it('nimmt rechnung_gestellt_am wenn noch nicht bezahlt', () => {
    expect(getInvoiceDisplayDate({
      rechnung_gestellt_am: '2026-03-01',
      erwarteter_monat_zahlungseingang: '2026-02-01',
      re_faelligkeit: '2026-01-15'
    })).toEqual({
      date: new Date('2026-03-01'),
      status: 'invoiced'
    });
  });

  it('faellt auf erwarteten Zahlungseingang als pending zurueck', () => {
    expect(getInvoiceDisplayDate({
      erwarteter_monat_zahlungseingang: '2026-02-01',
      re_faelligkeit: '2026-01-15'
    })).toEqual({
      date: new Date('2026-02-01'),
      status: 'pending'
    });
  });

  it('faellt auf Rechnungsfaelligkeit als pending zurueck', () => {
    expect(getInvoiceDisplayDate({
      re_faelligkeit: '2026-01-15'
    })).toEqual({
      date: new Date('2026-01-15'),
      status: 'pending'
    });
  });

  it('liefert null wenn kein Datum gesetzt ist', () => {
    expect(getInvoiceDisplayDate({})).toEqual({ date: null, status: null });
    expect(getInvoiceDisplayDate({ ueberwiesen_am: '', rechnung_gestellt_am: null })).toEqual({
      date: null,
      status: null
    });
    expect(getInvoiceMonthKey({})).toBeNull();
  });

  it('ignoriert ungueltige Datumsstrings', () => {
    expect(getInvoiceDisplayDate({ ueberwiesen_am: 'kein-datum' })).toEqual({
      date: null,
      status: null
    });
  });

  it('bildet year/month nur aus dem Rechnungsdatum', () => {
    expect(getInvoiceMonthKey({ rechnung_gestellt_am: '2026-08-19' })).toEqual({
      year: 2026,
      month: 7
    });
    expect(getInvoiceMonthKey({
      ueberwiesen_am: '2026-03-05',
      rechnung_gestellt_am: '2026-01-10'
    })).toEqual({ year: 2026, month: 0 });
    expect(getInvoiceMonthKey({ ueberwiesen_am: '2026-03-05' })).toBeNull();
  });
});
