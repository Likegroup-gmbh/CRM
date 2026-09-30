import { describe, it, expect } from 'vitest';
import { calculateKoopAbrechenbarkeit } from '../core/budget/koopFakturierung.js';

// ADR 0004/0015: Der Kooperations-Selektor der Rechnungserstellung entscheidet
// ueber den Restbetrag. fakturiert = nettobetrag + nettobetrag_steuerfrei +
// ksk_betrag (KSK-Aufschlag verbraucht den Rest), Soll = Video-EK sonst
// Kooperations-EK, plus KSK-Aufschlag bei Selbstzahlern.
describe('calculateKoopAbrechenbarkeit', () => {
  const koop = (over = {}) => ({
    id: 'k1',
    einkaufspreis_netto: 1000,
    ksk_selbstzahler: false,
    ksk_betrag: null,
    ...over,
  });
  const rechnung = (over = {}) => ({
    kooperation_id: 'k1',
    nettobetrag: 0,
    nettobetrag_steuerfrei: 0,
    ksk_betrag: 0,
    ist_schlussrechnung: false,
    ...over,
  });

  it('ohne Rechnung ist jede Kooperation abrechenbar', () => {
    const map = calculateKoopAbrechenbarkeit({ kooperationen: [koop()], rechnungen: [] });
    const e = map.get('k1');
    expect(e.abrechenbar).toBe(true);
    expect(e.rest).toBe(1000);
    expect(e.anzahlRechnungen).toBe(0);
  });

  it('teilfakturierte Kooperation bleibt mit Rest abrechenbar', () => {
    const map = calculateKoopAbrechenbarkeit({
      kooperationen: [koop()],
      rechnungen: [rechnung({ nettobetrag: 600 })],
    });
    const e = map.get('k1');
    expect(e.abrechenbar).toBe(true);
    expect(e.fakturiert).toBe(600);
    expect(e.rest).toBe(400);
  });

  it('voll fakturierte Kooperation faellt heraus', () => {
    const map = calculateKoopAbrechenbarkeit({
      kooperationen: [koop()],
      rechnungen: [rechnung({ nettobetrag: 600 }), rechnung({ nettobetrag: 400 })],
    });
    expect(map.get('k1').abrechenbar).toBe(false);
  });

  it('steuerfreie Anteile zaehlen auf den Restbetrag', () => {
    const map = calculateKoopAbrechenbarkeit({
      kooperationen: [koop()],
      rechnungen: [rechnung({ nettobetrag_steuerfrei: 1000 })],
    });
    expect(map.get('k1').abrechenbar).toBe(false);
  });

  it('KSK-Aufschlag auf der Rechnung verbraucht den Restbetrag (Selbstzahler)', () => {
    // Soll = 1000 EK + 49 KSK; Rechnung stellt 1000 Honorar + 49 Aufschlag.
    const map = calculateKoopAbrechenbarkeit({
      kooperationen: [koop({ ksk_selbstzahler: true, ksk_betrag: 49 })],
      rechnungen: [rechnung({ nettobetrag: 1000, ksk_betrag: 49 })],
    });
    const e = map.get('k1');
    expect(e.soll).toBe(1049);
    expect(e.fakturiert).toBe(1049);
    expect(e.abrechenbar).toBe(false);
  });

  it('ohne KSK in der Rechnung bleibt bei Selbstzahlern der Aufschlag offen', () => {
    const map = calculateKoopAbrechenbarkeit({
      kooperationen: [koop({ ksk_selbstzahler: true, ksk_betrag: 49 })],
      rechnungen: [rechnung({ nettobetrag: 1000 })],
    });
    const e = map.get('k1');
    expect(e.rest).toBe(49);
    expect(e.abrechenbar).toBe(true);
  });

  it('Schlussrechnung schliesst trotz offenem Restbetrag ab (Minderabrechnung)', () => {
    const map = calculateKoopAbrechenbarkeit({
      kooperationen: [koop()],
      rechnungen: [rechnung({ nettobetrag: 800, ist_schlussrechnung: true })],
    });
    const e = map.get('k1');
    expect(e.hatSchlussrechnung).toBe(true);
    expect(e.abrechenbar).toBe(false);
    expect(e.rest).toBe(200);
  });

  it('ohne pruefbares Soll bleibt die Kooperation trotz Rechnung auswaehlbar', () => {
    const map = calculateKoopAbrechenbarkeit({
      kooperationen: [koop({ einkaufspreis_netto: null })],
      rechnungen: [rechnung({ nettobetrag: 500 })],
    });
    expect(map.get('k1').abrechenbar).toBe(true);
  });

  it('Video-EK schlaegt den Kooperations-EK', () => {
    const map = calculateKoopAbrechenbarkeit({
      kooperationen: [koop()],
      videos: [
        { kooperation_id: 'k1', einkaufspreis_netto: 300 },
        { kooperation_id: 'k1', einkaufspreis_netto: 250 },
      ],
      rechnungen: [rechnung({ nettobetrag: 550 })],
    });
    const e = map.get('k1');
    expect(e.soll).toBe(550);
    expect(e.abrechenbar).toBe(false);
  });

  it('Ueberfakturierung schliesst aus (Rest negativ)', () => {
    const map = calculateKoopAbrechenbarkeit({
      kooperationen: [koop()],
      rechnungen: [rechnung({ nettobetrag: 1200 })],
    });
    const e = map.get('k1');
    expect(e.rest).toBeLessThan(0);
    expect(e.abrechenbar).toBe(false);
  });

  it('Zusatzkosten auf der Rechnung verkleinern den Restbetrag nicht', () => {
    const map = calculateKoopAbrechenbarkeit({
      kooperationen: [koop()],
      rechnungen: [rechnung({ nettobetrag: 600, zusatzkosten: 100 })],
    });
    expect(map.get('k1').rest).toBe(400);
  });
});
