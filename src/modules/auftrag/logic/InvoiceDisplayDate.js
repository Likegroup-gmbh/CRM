// InvoiceDisplayDate.js
// Gemeinsame Monats-Kaskade fuer Kundenrechnungen-Liste und Cashflow-Kalender:
// rechnung_gestellt_am → ueberwiesen_am → erwarteter_monat_zahlungseingang → re_faelligkeit
// Status bleibt entkoppelt: paid schlaegt invoiced, egal welches Datum den Monat gewinnt.

function parseInvoiceDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getInvoiceDisplayDate(row = {}) {
  const invoiced = parseInvoiceDate(row.rechnung_gestellt_am);
  const paid = parseInvoiceDate(row.ueberwiesen_am);
  const expected = parseInvoiceDate(row.erwarteter_monat_zahlungseingang);
  const due = parseInvoiceDate(row.re_faelligkeit);

  const date = invoiced || paid || expected || due || null;
  const status = paid ? 'paid' : invoiced ? 'invoiced' : (expected || due) ? 'pending' : null;
  return { date, status };
}

export function getInvoiceMonthKey(row) {
  const { date } = getInvoiceDisplayDate(row || {});
  if (!date) return null;
  return { year: date.getFullYear(), month: date.getMonth() };
}
