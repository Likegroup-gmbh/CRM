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

export function getPaymentRowStatusClass({
  ueberwiesen,
  ueberwiesen_am,
  rechnung_gestellt,
  rechnung_gestellt_am,
  re_faelligkeit
} = {}) {
  const isPaid = ueberwiesen_am !== undefined ? hasValue(ueberwiesen_am) : Boolean(ueberwiesen);
  const isInvoiced = rechnung_gestellt_am !== undefined ? hasValue(rechnung_gestellt_am) : Boolean(rechnung_gestellt);

  if (isPaid) return PAYMENT_CLASS.ueberwiesen;
  if (isReFaelligkeitOverdue(re_faelligkeit)) return PAYMENT_CLASS.ueberfaellig;
  if (isInvoiced) return PAYMENT_CLASS.rechnungGestellt;
  return '';
}

export { PAYMENT_CLASS };
