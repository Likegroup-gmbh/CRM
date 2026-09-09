import { describe, it, expect } from 'vitest';
import { calculateMonatsauswertung } from '../core/budget/monatsauswertung.js';

// ADR 0006: Zwei Periodisierungen. Die Margensicht ordnet Fremdkosten dem
// Monat der Kundenrechnung zu, die Buchhaltungssicht jedem Beleg seinen
// eigenen Rechnungsmonat. Grundlage sind ausschliesslich Rechnungen.
// ADR 0007: Was nicht zugeordnet werden kann, wird ausgewiesen, nicht
// geglaettet oder stillschweigend uebersprungen.

const AUFTRAG_MAERZ = {
  id: 'a1',
  auftragtype: 'Einmalprojekt',
  nettobetrag: 10000,
  rechnung_gestellt_am: '2026-03-10',
};

const KAMPAGNE_A1 = { id: 'k1', auftrag_id: 'a1' };
const KOOP_A1 = { id: 'ko1', kampagne_id: 'k1', einkaufspreis_netto: 5000, ksk_selbstzahler: false };
const BLOCK_UGC = { id: 'b1', auftrag_id: 'a1', campaign_type: 'ugc_paid' };

function base(overrides = {}) {
  return {
    auftraege: [AUFTRAG_MAERZ],
    blocks: [BLOCK_UGC],
    kampagnen: [KAMPAGNE_A1],
    kooperationen: [KOOP_A1],
    rechnungen: [],
    teilrechnungen: [],
    ...overrides,
  };
}

function cell(result, sicht, bereich, month, field) {
  const row = result.views[sicht].bereiche[bereich];
  if (!row) return 0;
  return row[field]?.[month] || 0;
}

describe('Umsatz nach Rechnungsdatum', () => {
  it('bucht den Nettobetrag in den Monat von rechnung_gestellt_am', () => {
    const r = calculateMonatsauswertung(base());
    expect(cell(r, 'buchhaltung', 'ugc_paid', '2026-03', 'umsatz')).toBe(10000);
    expect(cell(r, 'marge', 'ugc_paid', '2026-03', 'umsatz')).toBe(10000);
  });

  it('Auftrag ohne Rechnungsdatum liefert keinen Umsatz in der Matrix', () => {
    const r = calculateMonatsauswertung(base({
      auftraege: [{ ...AUFTRAG_MAERZ, rechnung_gestellt_am: null }],
    }));
    expect(r.months).not.toContain('2026-03');
    expect(r.kontrolle.umsatzGesamt).toBe(0);
  });

  it('Teilrechnungen ersetzen den Auftrags-Nettobetrag, sonst wird doppelt gezaehlt', () => {
    const r = calculateMonatsauswertung(base({
      teilrechnungen: [
        { id: 't1', auftrag_id: 'a1', nettobetrag: 4000, rechnung_gestellt: true, rechnung_gestellt_am: '2026-03-01' },
        { id: 't2', auftrag_id: 'a1', nettobetrag: 6000, rechnung_gestellt: true, rechnung_gestellt_am: '2026-05-01' },
        { id: 't3', auftrag_id: 'a1', nettobetrag: 2000, rechnung_gestellt: false, rechnung_gestellt_am: null },
      ],
    }));
    expect(cell(r, 'buchhaltung', 'ugc_paid', '2026-03', 'umsatz')).toBe(4000);
    expect(cell(r, 'buchhaltung', 'ugc_paid', '2026-05', 'umsatz')).toBe(6000);
    expect(r.kontrolle.umsatzGesamt).toBe(10000);
    expect(r.months).not.toContain(null);
  });
});

describe('Fremdkosten: Buchhaltung vs. Marge', () => {
  const CREATOR_RE_JUNI = {
    id: 'r1',
    auftrag_id: 'a1',
    kooperation_id: 'ko1',
    status: 'Bezahlt',
    rechnungstyp: 'kampagne',
    nettobetrag: 5000,
    nettobetrag_steuerfrei: 0,
    zusatzkosten: 0,
    gestellt_am: '2026-06-15',
  };

  it('Buchhaltungssicht: die Creatorrechnung steht in ihrem eigenen Monat', () => {
    const r = calculateMonatsauswertung(base({ rechnungen: [CREATOR_RE_JUNI] }));
    expect(cell(r, 'buchhaltung', 'ugc_paid', '2026-06', 'honorar')).toBe(5000);
    expect(cell(r, 'buchhaltung', 'ugc_paid', '2026-03', 'honorar')).toBe(0);
  });

  it('Margensicht: dieselbe Rechnung steht im Monat der Kundenrechnung', () => {
    const r = calculateMonatsauswertung(base({ rechnungen: [CREATOR_RE_JUNI] }));
    expect(cell(r, 'marge', 'ugc_paid', '2026-03', 'honorar')).toBe(5000);
    expect(cell(r, 'marge', 'ugc_paid', '2026-06', 'honorar')).toBe(0);
  });

  it('Differenz = Umsatz minus Fremdkosten und stimmt in der Margensicht pro Monat', () => {
    const r = calculateMonatsauswertung(base({ rechnungen: [CREATOR_RE_JUNI] }));
    const ksk = cell(r, 'marge', 'ugc_paid', '2026-03', 'ksk');
    const differenz = cell(r, 'marge', 'ugc_paid', '2026-03', 'differenz');
    expect(differenz).toBeCloseTo(10000 - 5000 - ksk, 2);
  });

  it('KSK ist 4,9 % des Honorars und ein eigener Posten', () => {
    const r = calculateMonatsauswertung(base({ rechnungen: [CREATOR_RE_JUNI] }));
    expect(cell(r, 'buchhaltung', 'ugc_paid', '2026-06', 'ksk')).toBeCloseTo(245, 2);
  });

  it('Margensicht bei 50/50-Teilrechnungen: die Kosten folgen dem Umsatz anteilig', () => {
    const r = calculateMonatsauswertung(base({
      teilrechnungen: [
        { id: 't1', auftrag_id: 'a1', nettobetrag: 5000, rechnung_gestellt: true, rechnung_gestellt_am: '2026-03-01' },
        { id: 't2', auftrag_id: 'a1', nettobetrag: 5000, rechnung_gestellt: true, rechnung_gestellt_am: '2026-05-01' },
      ],
      rechnungen: [CREATOR_RE_JUNI],
    }));
    // Haelfte des Umsatzes liegt in Maerz, Haelfte in Mai -> die Kosten
    // duerfen nicht komplett im ersten Monat landen, sonst kippt die Marge.
    expect(cell(r, 'marge', 'ugc_paid', '2026-03', 'honorar')).toBeCloseTo(2500, 2);
    expect(cell(r, 'marge', 'ugc_paid', '2026-05', 'honorar')).toBeCloseTo(2500, 2);
    expect(cell(r, 'marge', 'ugc_paid', '2026-06', 'honorar')).toBe(0);
    // Buchhaltungssicht bleibt unveraendert: Juni.
    expect(cell(r, 'buchhaltung', 'ugc_paid', '2026-06', 'honorar')).toBe(5000);
  });

  it('Margensicht bei ungleichen Teilrechnungen verteilt nach Umsatzanteil', () => {
    const r = calculateMonatsauswertung(base({
      teilrechnungen: [
        { id: 't1', auftrag_id: 'a1', nettobetrag: 8000, rechnung_gestellt: true, rechnung_gestellt_am: '2026-03-01' },
        { id: 't2', auftrag_id: 'a1', nettobetrag: 2000, rechnung_gestellt: true, rechnung_gestellt_am: '2026-05-01' },
      ],
      rechnungen: [CREATOR_RE_JUNI],
    }));
    expect(cell(r, 'marge', 'ugc_paid', '2026-03', 'honorar')).toBeCloseTo(4000, 2);
    expect(cell(r, 'marge', 'ugc_paid', '2026-05', 'honorar')).toBeCloseTo(1000, 2);
  });

  it('Selbstzahler-Kooperationen erzeugen keine KSK', () => {
    const r = calculateMonatsauswertung(base({
      kooperationen: [{ ...KOOP_A1, ksk_selbstzahler: true }],
      rechnungen: [CREATOR_RE_JUNI],
    }));
    expect(cell(r, 'buchhaltung', 'ugc_paid', '2026-06', 'ksk')).toBe(0);
  });

  it('Honorar umfasst auch den steuerfreien Nettobetrag, Zusatzkosten bleiben getrennt', () => {
    const r = calculateMonatsauswertung(base({
      rechnungen: [{ ...CREATOR_RE_JUNI, nettobetrag: 4000, nettobetrag_steuerfrei: 1000, zusatzkosten: 250 }],
    }));
    expect(cell(r, 'buchhaltung', 'ugc_paid', '2026-06', 'honorar')).toBe(5000);
    expect(cell(r, 'buchhaltung', 'ugc_paid', '2026-06', 'zusatzkosten')).toBe(250);
  });
});

describe('Sonderzeilen statt stiller Luecken', () => {
  it('Creatorrechnung ohne Kundenrechnung faellt in der Margensicht aus der Matrix und wird ausgewiesen', () => {
    const r = calculateMonatsauswertung(base({
      auftraege: [{ ...AUFTRAG_MAERZ, rechnung_gestellt_am: null }],
      rechnungen: [{
        id: 'r1', auftrag_id: 'a1', kooperation_id: 'ko1', status: 'Offen',
        nettobetrag: 3000, nettobetrag_steuerfrei: 0, zusatzkosten: 0, gestellt_am: '2026-06-01',
      }],
    }));
    expect(cell(r, 'marge', 'ugc_paid', '2026-06', 'honorar')).toBe(0);
    expect(r.sonderzeilen.ohneKundenrechnung.betrag).toBeCloseTo(3000 + 147, 2);
    expect(r.sonderzeilen.ohneKundenrechnung.faelle).toBe(1);
    // In der Buchhaltungssicht steht sie trotzdem in ihrem Monat.
    expect(cell(r, 'buchhaltung', 'ugc_paid', '2026-06', 'honorar')).toBe(3000);
  });

  it('kalkulierter Restbetrag ohne Rechnung wird als noch nicht fakturiert ausgewiesen', () => {
    const r = calculateMonatsauswertung(base({
      rechnungen: [{
        id: 'r1', auftrag_id: 'a1', kooperation_id: 'ko1', status: 'Bezahlt',
        nettobetrag: 2000, nettobetrag_steuerfrei: 0, zusatzkosten: 0, gestellt_am: '2026-06-01',
      }],
    }));
    // Soll 5000, fakturiert 2000 -> 3000 offen
    expect(r.sonderzeilen.nochNichtFakturiert.betrag).toBe(3000);
    expect(r.sonderzeilen.nochNichtFakturiert.faelle).toBe(1);
  });

  it('Soll folgt der Kalkulation: Video-EK schlagen den Kooperations-EK, wenn gepflegt', () => {
    const r = calculateMonatsauswertung(base({
      // Kooperations-EK leer, aber Videos bepreist -> Soll ist 3.000, nicht 0.
      kooperationen: [{ ...KOOP_A1, einkaufspreis_netto: null }],
      videos: [
        { id: 'v1', kooperation_id: 'ko1', einkaufspreis_netto: 1000 },
        { id: 'v2', kooperation_id: 'ko1', einkaufspreis_netto: 2000 },
      ],
    }));
    expect(r.sonderzeilen.nochNichtFakturiert.betrag).toBe(3000);
    expect(r.sonderzeilen.nochNichtFakturiert.faelle).toBe(1);
  });

  it('Selbstzahler-Soll enthaelt den KSK-Aufschlag, weil die Rechnung ihn mitfakturiert', () => {
    const r = calculateMonatsauswertung(base({
      kooperationen: [{ ...KOOP_A1, ksk_selbstzahler: true, ksk_betrag: 245 }],
      rechnungen: [{
        id: 'r1', auftrag_id: 'a1', kooperation_id: 'ko1', status: 'Bezahlt',
        nettobetrag: 5245, nettobetrag_steuerfrei: 0, zusatzkosten: 0, gestellt_am: '2026-06-01',
      }],
    }));
    // Soll 5000 + 245 Aufschlag = 5245, fakturiert 5245 -> nichts offen.
    expect(r.sonderzeilen.nochNichtFakturiert.faelle).toBe(0);
    expect(r.sonderzeilen.ueberfakturiert.faelle).toBe(0);
  });

  it('Rechnungen zu Entwurfs-Auftraegen verunreinigen weder Matrix noch Sonderzeilen', () => {
    const r = calculateMonatsauswertung(base({
      // a1 ist NICHT in auftraege (z. B. Entwurf, herausgefiltert)
      auftraege: [],
      rechnungen: [{
        id: 'r1', auftrag_id: 'a1', kooperation_id: 'ko1', status: 'Bezahlt',
        nettobetrag: 3000, nettobetrag_steuerfrei: 0, zusatzkosten: 0, gestellt_am: '2026-06-01',
      }],
    }));
    expect(r.months).toEqual([]);
    expect(r.kontrolle.honorarInMatrix.buchhaltung).toBe(0);
    expect(r.sonderzeilen.ohneKundenrechnung.faelle).toBe(0);
    expect(r.sonderzeilen.nochNichtFakturiert.faelle).toBe(0);
  });

  it('voll fakturierte Kooperationen tauchen nicht auf, Ueberfakturierung bleibt negativ sichtbar', () => {
    const voll = calculateMonatsauswertung(base({
      rechnungen: [{
        id: 'r1', auftrag_id: 'a1', kooperation_id: 'ko1', status: 'Bezahlt',
        nettobetrag: 5000, nettobetrag_steuerfrei: 0, zusatzkosten: 0, gestellt_am: '2026-06-01',
      }],
    }));
    expect(voll.sonderzeilen.nochNichtFakturiert.faelle).toBe(0);

    const ueber = calculateMonatsauswertung(base({
      rechnungen: [{
        id: 'r1', auftrag_id: 'a1', kooperation_id: 'ko1', status: 'Bezahlt',
        nettobetrag: 6000, nettobetrag_steuerfrei: 0, zusatzkosten: 0, gestellt_am: '2026-06-01',
      }],
    }));
    expect(ueber.sonderzeilen.ueberfakturiert.betrag).toBe(1000);
    expect(ueber.sonderzeilen.ueberfakturiert.faelle).toBe(1);
  });

  it('Rechnungen mit Datum vor 2020 werden separat ausgewiesen statt in Phantom-Monaten', () => {
    const r = calculateMonatsauswertung(base({
      rechnungen: [{
        id: 'r1', auftrag_id: 'a1', kooperation_id: 'ko1', status: 'Bezahlt',
        nettobetrag: 15940, nettobetrag_steuerfrei: 0, zusatzkosten: 0, gestellt_am: '2019-05-01',
      }],
    }));
    expect(r.months.every(m => m >= '2020')).toBe(true);
    expect(r.sonderzeilen.unplausibleDaten.faelle).toBe(1);
    // Ausgewiesen wird die komplette Fremdkosten-Last: Honorar + 4,9 % KSK.
    expect(r.sonderzeilen.unplausibleDaten.betrag).toBeCloseTo(15940 * 1.049, 2);
  });
});

describe('Zuordnung und Kontrollsummen', () => {
  it('weist Umsatz und Kosten ueber den Auftrag dem Leistungsbereich zu', () => {
    const r = calculateMonatsauswertung(base());
    expect(r.views.buchhaltung.bereiche.ugc_paid).toBeTruthy();
    expect(r.views.buchhaltung.bereiche.influencer_marketing).toBeUndefined();
  });

  it('Auftrag ohne Block landet in Nicht zugeordnet, die Summe bleibt das Gesamt', () => {
    const r = calculateMonatsauswertung(base({ blocks: [] }));
    expect(cell(r, 'buchhaltung', 'nicht_zugeordnet', '2026-03', 'umsatz')).toBe(10000);
    const summeBereiche = Object.values(r.views.buchhaltung.bereiche)
      .reduce((s, row) => s + Object.values(row.umsatz).reduce((x, y) => x + y, 0), 0);
    expect(summeBereiche).toBe(r.kontrolle.umsatzGesamt);
  });

  it('Contracting-Rechnung landet im Bereich Contracting', () => {
    const r = calculateMonatsauswertung(base({
      auftraege: [{ ...AUFTRAG_MAERZ, auftragtype: 'Contracting' }],
      rechnungen: [{
        id: 'r1', auftrag_id: 'a1', kooperation_id: null, status: 'Bezahlt', rechnungstyp: 'contracting',
        nettobetrag: 2000, nettobetrag_steuerfrei: 0, zusatzkosten: 0, gestellt_am: '2026-03-20',
      }],
    }));
    expect(cell(r, 'buchhaltung', 'contracting', '2026-03', 'honorar')).toBe(2000);
  });

  it('Summe aller Bereiche ergibt das Gesamt, in beiden Sichten', () => {
    const r = calculateMonatsauswertung(base({
      rechnungen: [{
        id: 'r1', auftrag_id: 'a1', kooperation_id: 'ko1', status: 'Bezahlt',
        nettobetrag: 5000, nettobetrag_steuerfrei: 0, zusatzkosten: 100, gestellt_am: '2026-06-01',
      }],
    }));
    for (const sicht of ['buchhaltung', 'marge']) {
      const view = r.views[sicht];
      const summe = Object.values(view.bereiche).reduce((s, row) =>
        s + Object.values(row.honorar).reduce((x, y) => x + y, 0), 0);
      expect(summe).toBeCloseTo(r.kontrolle.honorarInMatrix[sicht], 2);
    }
  });

  it('Monate sind sortiert und beide Sichten teilen die Achse', () => {
    const r = calculateMonatsauswertung(base({
      rechnungen: [{
        id: 'r1', auftrag_id: 'a1', kooperation_id: 'ko1', status: 'Bezahlt',
        nettobetrag: 5000, nettobetrag_steuerfrei: 0, zusatzkosten: 0, gestellt_am: '2026-06-01',
      }],
    }));
    expect(r.months).toEqual(['2026-03', '2026-06']);
  });
});
