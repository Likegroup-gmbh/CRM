// InvoiceDisplayDate.js
// Gemeinsame Monats-Kaskade fuer Kundenrechnungen-Liste und Cashflow-Kalender:
// ueberwiesen_am → rechnung_gestellt_am → erwarteter_monat_zahlungseingang → re_faelligkeit

function parseInvoiceDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getInvoiceDisplayDate(row = {}) {
  const paid = parseInvoiceDate(row.ueberwiesen_am);
  if (paid) return { date: paid, status: 'paid' };

  const invoiced = parseInvoiceDate(row.rechnung_gestellt_am);
  if (invoiced) return { date: invoiced, status: 'invoiced' };

  const expected = parseInvoiceDate(row.erwarteter_monat_zahlungseingang);
  if (expected) return { date: expected, status: 'pending' };

  const due = parseInvoiceDate(row.re_faelligkeit);
  if (due) return { date: due, status: 'pending' };

  return { date: null, status: null };
}

export function getInvoiceMonthKey(row) {
  const { date } = getInvoiceDisplayDate(row || {});
  if (!date) return null;
  return { year: date.getFullYear(), month: date.getMonth() };
}
