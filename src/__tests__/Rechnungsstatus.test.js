import { describe, it, expect } from 'vitest';
import { calculateRechnungsstatus } from '../core/budget/rechnungsstatus.js';

// PRD Schritt 5: Zahlungsstand als Snapshot "Stand heute" — je Seite
// (Kunden / Creator) gestellt, davon bezahlt, davon offen und noch nicht
// gestellt. Ueberfaellig ist eine Teilmenge von offen.
// Identitaeten: gestellt = bezahlt + offen; kundenseitig ausserdem
// nettobetrag = gestellt + nichtGestellt (ADR 0007: nichtGestellt darf
// negativ werden, das ist kundenseitige Ueberfakturierung).

const HEUTE = new Date('2026-09-09');

const AUFTRAG = {
  id: 'a1',
  nettobetrag: 10000,
  rechnung_gestellt_am: '2026-03-10',
  ueberwiesen: false,
  ueberwiesen_am: null,
  re_faelligkeit: '2026-12-31',
};

const KAMPAGNE = { id: 'k1', auftrag_id: 'a1' };
const KOOP = { id: 'ko1', kampagne_id: 'k1', einkaufspreis_netto: 5000, ksk_selbstzahler: false };

const CREATOR_RECHNUNG = {
  id: 'r1',
  auftrag_id: 'a1',
  kooperation_id: 'ko1',
  status: 'Offen',
  nettobetrag: 5000,
  nettobetrag_steuerfrei: 0,
  zusatzkosten: 0,
  gestellt_am: '2026-06-01',
  zahlungsziel: '2026-12-31',
};

function base(overrides = {}) {
  return {
    auftraege: [AUFTRAG],
    kampagnen: [KAMPAGNE],
    kooperationen: [],
    videos: [],
    rechnungen: [],
    teilrechnungen: [],
    heute: HEUTE,
    ...overrides,
  };
}

describe('Kundenseite', () => {
  it('gestellte, unbezahlte Kundenrechnung zaehlt als gestellt und offen', () => {
    const s = calculateRechnungsstatus(base());
    expect(s.kunden.gestellt).toBe(10000);
    expect(s.kunden.bezahlt).toBe(0);
    expect(s.kunden.offen).toBe(10000);
    expect(s.kunden.ueberfaellig).toBe(0);
    expect(s.kunden.nichtGestellt).toBe(0);
  });

  it('ueberwiesen_am macht die Rechnung bezahlt', () => {
    const s = calculateRechnungsstatus(base({
      auftraege: [{ ...AUFTRAG, ueberwiesen: true, ueberwiesen_am: '2026-04-01' }],
    }));
    expect(s.kunden.bezahlt).toBe(10000);
    expect(s.kunden.offen).toBe(0);
  });

  it('Auftrag ohne jede Rechnung steht komplett in noch nicht gestellt', () => {
    const s = calculateRechnungsstatus(base({
      auftraege: [{ ...AUFTRAG, rechnung_gestellt_am: null }],
    }));
    expect(s.kunden.gestellt).toBe(0);
    expect(s.kunden.nichtGestellt).toBe(10000);
  });

  it('Teilrechnungen ersetzen den Auftrags-Nettobetrag, ungestellte Teile sind noch nicht gestellt', () => {
    const s = calculateRechnungsstatus(base({
      teilrechnungen: [
        { id: 't1', auftrag_id: 'a1', nettobetrag: 4000, rechnung_gestellt: true, rechnung_gestellt_am: '2026-03-01', ueberwiesen: true, ueberwiesen_am: '2026-03-20' },
        { id: 't2', auftrag_id: 'a1', nettobetrag: 4000, rechnung_gestellt: true, rechnung_gestellt_am: '2026-05-01', ueberwiesen: false, ueberwiesen_am: null },
        { id: 't3', auftrag_id: 'a1', nettobetrag: 2000, rechnung_gestellt: false, rechnung_gestellt_am: null },
      ],
    }));
    expect(s.kunden.gestellt).toBe(8000);
    expect(s.kunden.bezahlt).toBe(4000);
    expect(s.kunden.offen).toBe(4000);
    expect(s.kunden.nichtGestellt).toBe(2000);
  });

  it('ueberfaellig nur bei ueberschrittener Faelligkeit ohne Zahlung', () => {
    const offen = calculateRechnungsstatus(base({
      auftraege: [{ ...AUFTRAG, re_faelligkeit: '2026-04-09' }],
    }));
    expect(offen.kunden.ueberfaellig).toBe(10000);

    const bezahlt = calculateRechnungsstatus(base({
      auftraege: [{ ...AUFTRAG, re_faelligkeit: '2026-04-09', ueberwiesen: true, ueberwiesen_am: '2026-06-01' }],
    }));
    expect(bezahlt.kunden.ueberfaellig).toBe(0);
  });

  it('kundenseitige Ueberfakturierung macht nichtGestellt negativ statt geklemmt (ADR 0007)', () => {
    const s = calculateRechnungsstatus(base({
      teilrechnungen: [
        { id: 't1', auftrag_id: 'a1', nettobetrag: 6000, rechnung_gestellt: true, rechnung_gestellt_am: '2026-03-01' },
        { id: 't2', auftrag_id: 'a1', nettobetrag: 6000, rechnung_gestellt: true, rechnung_gestellt_am: '2026-05-01' },
      ],
    }));
    expect(s.kunden.gestellt).toBe(12000);
    expect(s.kunden.nichtGestellt).toBe(-2000);
  });

  it('bezahlte, aber nicht als gestellt markierte Teilrechnung zaehlt als gestellt und bezahlt', () => {
    // Zahlungseingang setzt eine gestellte Rechnung voraus — die Zeile ist
    // falsch gepflegt, aber das Geld ist da. Sie gehoert in beide Toepfe,
    // sonst bricht die Identitaet gestellt = bezahlt + offen.
    const s = calculateRechnungsstatus(base({
      teilrechnungen: [
        { id: 't1', auftrag_id: 'a1', nettobetrag: 4000, rechnung_gestellt: false, rechnung_gestellt_am: null, ueberwiesen: true, ueberwiesen_am: '2026-03-20' },
      ],
    }));
    expect(s.kunden.gestellt).toBe(4000);
    expect(s.kunden.bezahlt).toBe(4000);
    expect(s.kunden.offen).toBe(0);
  });
});

describe('Creatorseite', () => {
  const mitRechnung = (rechnung = {}, rest = {}) => base({
    kooperationen: [KOOP],
    rechnungen: [{ ...CREATOR_RECHNUNG, ...rechnung }],
    ...rest,
  });

  it('gestellt ist Honorar + KSK + Zusatzkosten, offen solange nicht bezahlt', () => {
    const s = calculateRechnungsstatus(mitRechnung());
    expect(s.creator.gestellt).toBeCloseTo(5245, 2); // 5000 + 245 KSK
    expect(s.creator.offen).toBeCloseTo(5245, 2);
    expect(s.creator.bezahlt).toBe(0);
  });

  it('Status Bezahlt zaehlt zu bezahlt', () => {
    const s = calculateRechnungsstatus(mitRechnung({ status: 'Bezahlt' }));
    expect(s.creator.bezahlt).toBeCloseTo(5245, 2);
    expect(s.creator.offen).toBe(0);
  });

  it('bezahlt_am gilt auch ohne Status Bezahlt als bezahlt', () => {
    const s = calculateRechnungsstatus(mitRechnung({ status: 'Offen', bezahlt_am: '2026-07-01' }));
    expect(s.creator.bezahlt).toBeCloseTo(5245, 2);
    expect(s.creator.offen).toBe(0);
  });

  it('Selbstzahler-Rechnung kommt ohne KSK-Aufschlag aus', () => {
    const s = calculateRechnungsstatus(mitRechnung({}, {
      kooperationen: [{ ...KOOP, ksk_selbstzahler: true }],
    }));
    expect(s.creator.gestellt).toBe(5000);
  });

  it('steuerfreier Anteil und Zusatzkosten fliessen in gestellt ein', () => {
    const s = calculateRechnungsstatus(mitRechnung({
      nettobetrag: 4000, nettobetrag_steuerfrei: 1000, zusatzkosten: 250,
    }));
    // 5000 Honorar + 245 KSK + 250 Zusatzkosten
    expect(s.creator.gestellt).toBeCloseTo(5495, 2);
  });

  it('ueberfaellig creatorseitig ueber das Zahlungsziel', () => {
    const s = calculateRechnungsstatus(mitRechnung({ zahlungsziel: '2026-01-01' }));
    expect(s.creator.ueberfaellig).toBeCloseTo(5245, 2);

    const bezahlt = calculateRechnungsstatus(mitRechnung({ zahlungsziel: '2026-01-01', status: 'Bezahlt' }));
    expect(bezahlt.creator.ueberfaellig).toBe(0);
  });

  it('noch nicht gestellt kommt aus dem Kooperations-Restbetrag', () => {
    const s = calculateRechnungsstatus(mitRechnung({ nettobetrag: 2000 }));
    // Soll 5000, fakturiert 2000 -> 3000 noch nicht gestellt
    expect(s.creator.nichtGestellt).toBe(3000);
  });

  it('das Soll folgt der Kalkulation: Video-EK schlagen den Kooperations-EK', () => {
    const s = calculateRechnungsstatus(base({
      kooperationen: [{ ...KOOP, einkaufspreis_netto: null }],
      videos: [
        { id: 'v1', kooperation_id: 'ko1', einkaufspreis_netto: 1000 },
        { id: 'v2', kooperation_id: 'ko1', einkaufspreis_netto: 2000 },
      ],
    }));
    expect(s.creator.nichtGestellt).toBe(3000);
  });

  it('Belege zu Entwurfs-Auftraegen zaehlen auf keiner Seite', () => {
    const s = calculateRechnungsstatus(base({
      auftraege: [], // a1 ist Entwurf und herausgefiltert
      kooperationen: [KOOP],
      rechnungen: [CREATOR_RECHNUNG],
    }));
    expect(s.kunden.gestellt).toBe(0);
    expect(s.creator.gestellt).toBe(0);
    expect(s.creator.nichtGestellt).toBe(0);
  });
});

describe('Identitaeten', () => {
  it('gestellt = bezahlt + offen auf beiden Seiten, nettobetrag = gestellt + nichtGestellt kundenseitig', () => {
    const s = calculateRechnungsstatus(base({
      teilrechnungen: [
        { id: 't1', auftrag_id: 'a1', nettobetrag: 4000, rechnung_gestellt: true, rechnung_gestellt_am: '2026-03-01', ueberwiesen: true, ueberwiesen_am: '2026-03-20' },
        { id: 't2', auftrag_id: 'a1', nettobetrag: 4000, rechnung_gestellt: true, rechnung_gestellt_am: '2026-05-01' },
      ],
      kooperationen: [KOOP],
      rechnungen: [CREATOR_RECHNUNG],
    }));

    expect(s.kunden.bezahlt + s.kunden.offen).toBeCloseTo(s.kunden.gestellt, 2);
    expect(s.creator.bezahlt + s.creator.offen).toBeCloseTo(s.creator.gestellt, 2);
    expect(s.kunden.gestellt + s.kunden.nichtGestellt).toBeCloseTo(10000, 2);
    expect(s.kunden.ueberfaellig).toBeLessThanOrEqual(s.kunden.offen);
    expect(s.creator.ueberfaellig).toBeLessThanOrEqual(s.creator.offen);
  });
});
