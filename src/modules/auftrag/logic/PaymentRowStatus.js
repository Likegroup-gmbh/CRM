// PaymentRowStatus.js
// Zentrale Logik fuer die linke Zeilen-Farbmarkierung (Zahlungsstatus) von
// Auftraegen und Kundenrechnungen.
//
// Prioritaet: ueberwiesen (gruen) > ueberfaellig (rot) > rechnung_gestellt (orange) > keine.
// Ueberfaellig = re_faelligkeit liegt in der Vergangenheit UND nicht ueberwiesen.
//
// Massgeblich sind die angezeigten Datums-Felder (ueberwiesen_am / rechnung_gestellt_am),
// nicht die ggf. veralteten Boolean-Flags. Nur wenn kein Datum-Feld uebergeben wird,
// dient das Boolean als Fallback (z.B. dynamische Updates ueber data-Attribute).

const PAYMENT_CLASS = {
  ueberwiesen: 'auftrag-row--ueberwiesen',
  ueberfaellig: 'auftrag-row--ueberfaellig',
  rechnungGestellt: 'auftrag-row--rechnung-gestellt'
};

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

export function isReFaelligkeitOverdue(reFaelligkeit) {
  if (!reFaelligkeit) return false;
  const faellig = new Date(reFaelligkeit);
  if (Number.isNaN(faellig.getTime())) return false;
  faellig.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return faellig < today;
}

// Bezahlt = ueberwiesen_am gesetzt; nur wenn das Datums-Feld nicht uebergeben
// wird, dient das Boolean-Flag als Fallback (z.B. bei Aggregations-Queries).
export function isInvoiceRowPaid({ ueberwiesen, ueberwiesen_am } = {}) {
  return ueberwiesen_am !== undefined ? hasValue(ueberwiesen_am) : Boolean(ueberwiesen);
}

// Summen der bezahlten Rechnungszeilen (Auftrag- oder Teilrechnungs-Zeilen).
// Grundlage der „Bereits bezahlt"-Cards auf Kundenrechnungen und Stakeholder.
export function sumPaidInvoiceRows(rows) {
  return (rows || []).reduce((acc, row) => {
    if (!isInvoiceRowPaid(row)) return acc;
    acc.netto += parseFloat(row.nettobetrag) || 0;
    acc.brutto += parseFloat(row.bruttobetrag) || 0;
    return acc;
  }, { netto: 0, brutto: 0 });
}

export function getPaymentRowStatusClass({
  ueberwiesen,
  ueberwiesen_am,
  rechnung_gestellt,
  rechnung_gestellt_am,
  re_faelligkeit
} = {}) {
  const isPaid = isInvoiceRowPaid({ ueberwiesen, ueberwiesen_am });
  const isInvoiced = rechnung_gestellt_am !== undefined ? hasValue(rechnung_gestellt_am) : Boolean(rechnung_gestellt);

  if (isPaid) return PAYMENT_CLASS.ueberwiesen;
  if (isReFaelligkeitOverdue(re_faelligkeit)) return PAYMENT_CLASS.ueberfaellig;
  if (isInvoiced) return PAYMENT_CLASS.rechnungGestellt;
  return '';
}

export { PAYMENT_CLASS };
