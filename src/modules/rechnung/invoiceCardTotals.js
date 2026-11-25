// Summen der Kacheln auf Kundenrechnungen und Rechnungen.
// Einzige Quelle für diese Beträge — die Listen schreiben sie ins DOM,
// das Stakeholder-Dashboard liest dieselben Funktionen.

import { isInvoiceRowPaid, isReFaelligkeitOverdue, sumPaidInvoiceRows } from '../auftrag/logic/PaymentRowStatus.js';

function betrag(v) {
  return parseFloat(v) || 0;
}

function hatDatum(value) {
  return value !== undefined && value !== null && value !== '';
}

export function hatRechnungsdatum(row) {
  return hatDatum(row?.rechnung_gestellt_am);
}

export function hatGestelltAm(row) {
  return hatDatum(row?.gestellt_am);
}

export function sumInvoiceRows(rows) {
  return (rows || []).reduce((acc, row) => {
    acc.nettobetrag += betrag(row.nettobetrag);
    acc.ust_betrag += betrag(row.ust_betrag);
    acc.bruttobetrag += betrag(row.bruttobetrag);
    return acc;
  }, { nettobetrag: 0, ust_betrag: 0, bruttobetrag: 0 });
}

// Bezahlt auf Rechnungen: nur status === 'Bezahlt'. bezahlt_am zählt nicht.
export function sumPaidRechnungRows(rows) {
  return (rows || []).reduce((acc, row) => {
    if (row.status !== 'Bezahlt') return acc;
    acc.netto += betrag(row.nettobetrag);
    acc.brutto += betrag(row.bruttobetrag);
    return acc;
  }, { netto: 0, brutto: 0 });
}

export function emptyKundenSummary() {
  return {
    nettobetrag: 0,
    ust_betrag: 0,
    bruttobetrag: 0,
    re_datum_netto: 0,
    bezahlt_netto: 0,
    unbezahlt_netto: 0,
    ueberfaellig_netto: 0,
    nicht_gestellt_netto: 0,
  };
}

export function emptyRechnungSummary() {
  return {
    nettobetrag: 0,
    ust_betrag: 0,
    bruttobetrag: 0,
    gestellt_netto: 0,
    gestellt_ust: 0,
    bezahlt_netto: 0,
    bezahlt_brutto: 0,
    unbezahlt_netto: 0,
    offen_netto: 0,
    ueberfaellig_netto: 0,
    nicht_gestellt_netto: 0,
  };
}

// Kacheln Kundenrechnungen.
// Netto = Bezahlt + Unbezahlt. Überfällig ist Teilmenge von Unbezahlt.
// Gestellt ist die Summe der Zeilen mit Rechnungsdatum, nicht Bezahlt + Offen.
export function summarizeKundenrechnungRows(rows) {
  const totals = sumInvoiceRows(rows);
  const paid = sumPaidInvoiceRows(rows);
  let reDatumNetto = 0;
  let unbezahlt = 0;
  let ueberfaellig = 0;
  let nichtGestellt = 0;
  for (const row of rows || []) {
    const netto = betrag(row.nettobetrag);
    if (hatRechnungsdatum(row)) reDatumNetto += netto;
    if (isInvoiceRowPaid(row)) continue;
    unbezahlt += netto;
    if (!hatRechnungsdatum(row)) nichtGestellt += netto;
    if (isReFaelligkeitOverdue(row?.re_faelligkeit)) ueberfaellig += netto;
  }
  return {
    nettobetrag: totals.nettobetrag,
    ust_betrag: totals.ust_betrag,
    bruttobetrag: totals.bruttobetrag,
    re_datum_netto: reDatumNetto,
    bezahlt_netto: paid.netto,
    unbezahlt_netto: unbezahlt,
    ueberfaellig_netto: ueberfaellig,
    nicht_gestellt_netto: nichtGestellt,
  };
}

// Kacheln Rechnungen.
// Gestellt = Zeilen mit gestellt_am. Bezahlt = status === 'Bezahlt'.
// Offen = Gestellt − Bezahlt. Überfällig ist die Teilmenge davon:
// gestellt, nicht bezahlt, Zahlungsziel vor heute.
// Unbezahlt = Netto − Bezahlt über alle Zeilen (Zahlungsstand).
export function summarizeRechnungRows(rows) {
  const totals = sumInvoiceRows(rows);
  const paid = sumPaidRechnungRows(rows);
  let gestelltNetto = 0;
  let gestelltUst = 0;
  let ueberfaellig = 0;
  let nichtGestellt = 0;
  for (const row of rows || []) {
    const netto = betrag(row.nettobetrag);
    const gestellt = hatGestelltAm(row);
    if (gestellt) {
      gestelltNetto += netto;
      gestelltUst += betrag(row.ust_betrag);
    }
    if (row.status === 'Bezahlt') continue;
    if (!gestellt) nichtGestellt += netto;
    if (gestellt && isReFaelligkeitOverdue(row?.zahlungsziel)) ueberfaellig += netto;
  }
  return {
    nettobetrag: totals.nettobetrag,
    ust_betrag: totals.ust_betrag,
    bruttobetrag: totals.bruttobetrag,
    gestellt_netto: gestelltNetto,
    gestellt_ust: gestelltUst,
    bezahlt_netto: paid.netto,
    bezahlt_brutto: paid.brutto,
    unbezahlt_netto: totals.nettobetrag - paid.netto,
    offen_netto: gestelltNetto - paid.netto,
    ueberfaellig_netto: ueberfaellig,
    nicht_gestellt_netto: nichtGestellt,
  };
}
