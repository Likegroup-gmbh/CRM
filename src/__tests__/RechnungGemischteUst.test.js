// Tests fuer gemischte Umsatzsteuer bei Eingangsrechnungen:
// nettobetrag (USt-pflichtig) + nettobetrag_steuerfrei (0% USt) in einer Rechnung.
import { describe, it, expect } from 'vitest';
import { berechneRechnungFromInputs } from '../core/form/logic/events/RechnungEvents.js';

function makeInput(value = '') {
  return { value: String(value) };
}

function makeToggle(checked = false) {
  return { type: 'checkbox', checked };
}

function runCalc({ netto = '', nettoSteuerfrei = '', zusatz = '', skonto = false, ustAktiv = true, ustProzent = '19', zusatzBrutto = false } = {}) {
  const outputs = {
    nettoGesamtInput: makeInput(),
    bruttoVorSkontoInput: makeInput(),
    skontoBetragInput: makeInput(),
    nettoNachSkontoInput: makeInput(),
    ustBetragInput: makeInput(),
    bruttoInput: makeInput(),
  };

  berechneRechnungFromInputs({
    nettoInput: makeInput(netto),
    nettoSteuerfreiInput: makeInput(nettoSteuerfrei),
    zusatzInput: makeInput(zusatz),
    skontoToggle: makeToggle(skonto),
    ustAktivToggle: makeToggle(ustAktiv),
    ustProzentInput: makeInput(ustProzent),
    zusatzBruttoToggle: makeToggle(zusatzBrutto),
    ...outputs,
  });

  return {
    nettoGesamt: parseFloat(outputs.nettoGesamtInput.value),
    bruttoVorSkonto: parseFloat(outputs.bruttoVorSkontoInput.value),
    skontoBetrag: parseFloat(outputs.skontoBetragInput.value),
    nettoNachSkonto: parseFloat(outputs.nettoNachSkontoInput.value),
    ustBetrag: parseFloat(outputs.ustBetragInput.value),
    brutto: parseFloat(outputs.bruttoInput.value),
  };
}

describe('berechneRechnungFromInputs - gemischte USt (steuerfreier Anteil)', () => {
  it('Beispiel des Mitarbeiters: 100 mit USt + 500 steuerfrei = 619 brutto', () => {
    const r = runCalc({ netto: '100', nettoSteuerfrei: '500' });

    expect(r.nettoGesamt).toBe(600);
    expect(r.ustBetrag).toBe(19);
    expect(r.brutto).toBe(619);
  });

  it('ohne steuerfreien Anteil bleibt das bisherige Verhalten unveraendert', () => {
    const r = runCalc({ netto: '1000' });

    expect(r.nettoGesamt).toBe(1000);
    expect(r.ustBetrag).toBe(190);
    expect(r.brutto).toBe(1190);
  });

  it('fehlender nettoSteuerfreiInput (z.B. alte Formulare) wird als 0 behandelt', () => {
    const outputs = {
      ustBetragInput: makeInput(),
      bruttoInput: makeInput(),
    };
    berechneRechnungFromInputs({
      nettoInput: makeInput('1000'),
      zusatzInput: null,
      skontoToggle: null,
      ustAktivToggle: makeToggle(true),
      ustProzentInput: makeInput('19'),
      ...outputs,
    });

    expect(parseFloat(outputs.ustBetragInput.value)).toBe(190);
    expect(parseFloat(outputs.bruttoInput.value)).toBe(1190);
  });

  it('nur steuerfreier Betrag: keine USt, brutto = steuerfrei', () => {
    const r = runCalc({ netto: '0', nettoSteuerfrei: '500' });

    expect(r.nettoGesamt).toBe(500);
    expect(r.ustBetrag).toBe(0);
    expect(r.brutto).toBe(500);
  });

  it('USt-Toggle aus: steuerfreier Anteil wird weiterhin nur addiert', () => {
    const r = runCalc({ netto: '100', nettoSteuerfrei: '500', ustAktiv: false, ustProzent: '0' });

    expect(r.ustBetrag).toBe(0);
    expect(r.brutto).toBe(600);
  });

  it('mit Zusatzkosten (netto): USt auf Leistung + Zusatzkosten, nicht auf steuerfrei', () => {
    const r = runCalc({ netto: '100', nettoSteuerfrei: '500', zusatz: '50' });

    // taxable = 150 -> USt 28.50; brutto = 150 + 28.50 + 500 = 678.50
    expect(r.nettoGesamt).toBe(650);
    expect(r.ustBetrag).toBe(28.5);
    expect(r.brutto).toBe(678.5);
  });

  it('mit Skonto: 3% wirken proportional auch auf den steuerfreien Anteil', () => {
    const r = runCalc({ netto: '100', nettoSteuerfrei: '500', skonto: true });

    // taxableNachSkonto = 97, ust = 18.43, steuerfreiNachSkonto = 485
    expect(r.skontoBetrag).toBe(18);       // 600 * 0.03
    expect(r.ustBetrag).toBeCloseTo(18.43, 2);
    expect(r.brutto).toBeCloseTo(97 + 18.43 + 485, 2);
  });

  it('Brutto-Modus fuer Zusatzkosten: steuerfreier Anteil bleibt unbesteuert additiv', () => {
    const r = runCalc({ netto: '100', nettoSteuerfrei: '500', zusatz: '119', zusatzBrutto: true });

    // USt nur auf Leistung (100 -> 19), Zusatzkosten brutto durchlaufend (119),
    // steuerfrei 500 -> brutto = 100 + 19 + 500 + 119 = 738
    expect(r.ustBetrag).toBe(19);
    expect(r.brutto).toBe(738);
    expect(r.bruttoVorSkonto).toBe(738);
  });
});
