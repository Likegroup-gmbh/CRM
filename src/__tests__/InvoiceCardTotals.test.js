import { describe, it, expect } from 'vitest';
import { AusgangsrechnungenList } from '../modules/ausgangsrechnungen/AusgangsrechnungenList.js';
import {
  summarizeKundenrechnungRows,
  summarizeRechnungRows,
} from '../modules/rechnung/invoiceCardTotals.js';
import { kundenrechnungZeilen } from '../modules/rechnung/Monatsblatt.js';
import { kartenSummen } from '../modules/stakeholder/stakeholderOverviewData.js';

const kundenZeilen = [
  { id: 'a1', nettobetrag: 1000, ust_betrag: 190, bruttobetrag: 1190, rechnung_gestellt_am: '2026-08-01', ueberwiesen_am: '2026-09-01' },
  { id: 'a2', nettobetrag: 2000, ust_betrag: 380, bruttobetrag: 2380, rechnung_gestellt_am: '2026-08-15', ueberwiesen_am: null, re_faelligkeit: '2020-01-01' },
  { id: 'a3', nettobetrag: 500, ust_betrag: 95, bruttobetrag: 595, rechnung_gestellt_am: null, ueberwiesen_am: null },
];

describe('Karten-Summen sind eine Quelle', () => {
  it('Kundenrechnungs-Liste und summarizeKundenrechnungRows liefern dieselben Beträge', () => {
    const list = new AusgangsrechnungenList();
    const summary = summarizeKundenrechnungRows(kundenZeilen);
    expect(list.sumInvoiceRows(kundenZeilen)).toEqual({
      nettobetrag: summary.nettobetrag,
      ust_betrag: summary.ust_betrag,
      bruttobetrag: summary.bruttobetrag,
    });
    expect(summary.re_datum_netto).toBe(3000);
    expect(summary.bezahlt_netto).toBe(1000);
    expect(summary.unbezahlt_netto).toBe(2500);
    expect(summary.ueberfaellig_netto).toBe(2000);
    expect(summary.nettobetrag).toBeCloseTo(summary.bezahlt_netto + summary.unbezahlt_netto);
    expect(summary.ueberfaellig_netto).toBeLessThanOrEqual(summary.unbezahlt_netto);
  });

  it('Rechnungs-Netto ist Bezahlt plus Unbezahlt', () => {
    const summary = summarizeRechnungRows([
      { nettobetrag: 150, ust_betrag: 28.5, bruttobetrag: 178.5, status: 'Bezahlt' },
      { nettobetrag: 80, ust_betrag: 15.2, bruttobetrag: 95.2, status: 'Offen' },
    ]);
    expect(summary.nettobetrag).toBe(230);
    expect(summary.bezahlt_netto).toBe(150);
    expect(summary.unbezahlt_netto).toBe(80);
    expect(summary.ust_betrag).toBeCloseTo(43.7);
  });

  it('Rechnungs-Offen ist Gestellt minus Bezahlt, überfällig nur Zahlungsziel vor heute', () => {
    const summary = summarizeRechnungRows([
      { nettobetrag: 1000, ust_betrag: 190, status: 'Bezahlt', gestellt_am: '2026-08-01', zahlungsziel: '2020-01-01' },
      { nettobetrag: 2000, ust_betrag: 380, status: 'Offen', gestellt_am: '2026-08-15', zahlungsziel: '2020-01-01' },
      { nettobetrag: 400, ust_betrag: 76, status: 'Offen', gestellt_am: '2026-08-20', zahlungsziel: '2099-01-01' },
      { nettobetrag: 50, ust_betrag: 9.5, status: 'Offen', gestellt_am: null, zahlungsziel: '2020-01-01' },
    ]);
    expect(summary.gestellt_netto).toBe(3400);
    expect(summary.gestellt_ust).toBe(646);
    expect(summary.bezahlt_netto).toBe(1000);
    expect(summary.offen_netto).toBe(2400);
    expect(summary.ueberfaellig_netto).toBe(2000);
    expect(summary.ueberfaellig_netto).toBeLessThanOrEqual(summary.offen_netto);
    expect(summary.nicht_gestellt_netto).toBe(50);
    expect(summary.unbezahlt_netto).toBeCloseTo(summary.offen_netto + summary.nicht_gestellt_netto);
    expect(summary.unbezahlt_netto).toBe(2450);
  });

  it('Dashboard-Kundenzeile ist die Kachelsumme der explodierten Kundenrechnungen', () => {
    const auftraege = [
      { id: 'a1', auftragsname: 'Ganz', nettobetrag: 1000, ust_betrag: 190, bruttobetrag: 1190, rechnung_gestellt_am: '2026-03-01', ueberwiesen_am: '2026-04-01', is_draft: false, start: '2026-01-01' },
      { id: 'a2', auftragsname: 'Geteilt', nettobetrag: 9999, ust_betrag: 1, bruttobetrag: 1, ueberwiesen_am: '2020-01-01', is_draft: false, start: '2026-01-01' },
    ];
    const teilrechnungen = [
      { id: 't1', auftrag_id: 'a2', nettobetrag: 400, ust_betrag: 76, bruttobetrag: 476, rechnung_gestellt_am: '2026-05-01', ueberwiesen_am: null, re_faelligkeit: '2020-06-01' },
      { id: 't2', auftrag_id: 'a2', nettobetrag: 600, ust_betrag: 114, bruttobetrag: 714, rechnung_gestellt_am: null, ueberwiesen_am: null },
    ];
    const zeilen = kundenrechnungZeilen(auftraege, teilrechnungen);
    const cards = summarizeKundenrechnungRows(zeilen);
    const page = {
      auftraege,
      teilrechnungen,
      rechnungen: [
        { id: 'r1', kooperation_id: 'koop1', auftrag_id: 'a1', status: 'Bezahlt', nettobetrag: 150, ust_betrag: 28.5, bruttobetrag: 178.5, rechnungstyp: 'kampagne' },
        { id: 'r2', auftrag_id: 'a1', status: 'Offen', nettobetrag: 999, rechnungstyp: 'contracting' },
      ],
      kampagnen: [{ id: 'k1', auftrag_id: 'a1' }],
      kooperationen: [{ id: 'koop1', kampagne_id: 'k1' }],
      blocks: [],
      selectedYear: 'all',
      activeTab: 'gesamt_mit',
    };

    const summen = kartenSummen(page);
    expect(summen.kunden).toEqual(cards);
    expect(zeilen.map(z => z.nettobetrag)).toEqual([1000, 400, 600]);
    expect(summen.creator.bezahlt_netto).toBe(150);
    expect(summen.creator.nettobetrag).toBe(150);
    expect(summen.contracting.nettobetrag).toBe(999);
    expect(summen.contracting.unbezahlt_netto).toBe(999);
  });

  it('Creator-Rechnung ohne Kooperation zählt über auftrag_id', () => {
    const page = {
      auftraege: [
        { id: 'a1', auftragsname: 'Ganz', nettobetrag: 1000, is_draft: false, start: '2026-01-01' },
      ],
      teilrechnungen: [],
      rechnungen: [
        { id: 'r-direct', auftrag_id: 'a1', status: 'Offen', nettobetrag: 80, ust_betrag: 0, bruttobetrag: 80, rechnungstyp: 'kampagne' },
        { id: 'r-kampagne', kampagne_id: 'k1', status: 'Bezahlt', nettobetrag: 20, ust_betrag: 0, bruttobetrag: 20, rechnungstyp: 'kampagne' },
        { id: 'r-lose', status: 'Offen', nettobetrag: 650, rechnungstyp: 'kampagne' },
      ],
      kampagnen: [{ id: 'k1', auftrag_id: 'a1' }],
      kooperationen: [],
      blocks: [],
      selectedYear: 'all',
      activeTab: 'gesamt_mit',
    };

    const summen = kartenSummen(page);
    expect(summen.creator.nettobetrag).toBe(100);
    expect(summen.creator.bezahlt_netto).toBe(20);
    expect(summen.creator.unbezahlt_netto).toBe(80);
  });
});
