// Tests fuer die KSK-Selbstzahler-Logik:
// Aufschlagsberechnung (4,9% vom EK-Netto), USt-Basis auf der Rechnung,
// Budget-Ableitung (Umbuchung KSK-Topf -> Creator-Budget) und Topf-Ueberschreitung.
import { describe, it, expect } from 'vitest';
import {
  KSK_SATZ_PROZENT,
  berechneKskBetrag,
  summeKskSelbstzahler,
} from '../core/budget/kskSelbstzahler.js';
import {
  berechneVerfuegbaresBudget,
  calculateAgencyFeeSummary,
  renderKskCardHtml,
} from '../core/budget/EkVkAgencyFeeHelper.js';
import { berechneRechnungFromInputs } from '../core/form/logic/events/RechnungEvents.js';

describe('berechneKskBetrag', () => {
  it('berechnet 4,9% vom EK-Netto (Plan-Beispiel: 1000 -> 49)', () => {
    expect(KSK_SATZ_PROZENT).toBe(4.9);
    expect(berechneKskBetrag(1000)).toBe(49);
  });

  it('rundet kaufmaennisch auf 2 Nachkommastellen', () => {
    // 101 * 0.049 = 4.949 -> 4.95
    expect(berechneKskBetrag(101)).toBe(4.95);
    // 55.55 * 0.049 = 2.72195 -> 2.72
    expect(berechneKskBetrag(55.55)).toBe(2.72);
  });

  it('akzeptiert Strings als Eingabe', () => {
    expect(berechneKskBetrag('1000')).toBe(49);
  });

  it('liefert 0 fuer 0, negative und ungueltige Werte', () => {
    expect(berechneKskBetrag(0)).toBe(0);
    expect(berechneKskBetrag(-500)).toBe(0);
    expect(berechneKskBetrag(null)).toBe(0);
    expect(berechneKskBetrag(undefined)).toBe(0);
    expect(berechneKskBetrag('abc')).toBe(0);
  });

  it('unterstuetzt einen abweichenden Satz (Snapshot ksk_prozent)', () => {
    expect(berechneKskBetrag(1000, 5)).toBe(50);
  });
});

describe('summeKskSelbstzahler', () => {
  it('summiert nur Selbstzahler-Kooperationen', () => {
    const koops = [
      { ksk_selbstzahler: true, ksk_betrag: 49 },
      { ksk_selbstzahler: false, ksk_betrag: 100 },
      { ksk_selbstzahler: true, ksk_betrag: '24.5' },
    ];
    expect(summeKskSelbstzahler(koops)).toBe(73.5);
  });

  it('liefert 0 fuer leere oder fehlende Listen', () => {
    expect(summeKskSelbstzahler([])).toBe(0);
    expect(summeKskSelbstzahler(undefined)).toBe(0);
    expect(summeKskSelbstzahler(null)).toBe(0);
  });

  it('ignoriert Selbstzahler ohne gueltigen Betrag', () => {
    expect(summeKskSelbstzahler([{ ksk_selbstzahler: true, ksk_betrag: null }])).toBe(0);
  });
});

describe('berechneVerfuegbaresBudget (read-derived, Plan-Rechenmodell)', () => {
  it('Umbuchung: creator_budget 9000 + KSK 49 = 9049 verfuegbar', () => {
    const auftrag = { creator_budget: 9000 };
    const koops = [{ ksk_selbstzahler: true, ksk_betrag: 49 }];
    expect(berechneVerfuegbaresBudget(auftrag, koops)).toEqual({
      basis: 9000,
      umgebucht: 49,
      verfuegbar: 9049,
    });
  });

  it('ohne Selbstzahler bleibt verfuegbar = basis', () => {
    const result = berechneVerfuegbaresBudget({ creator_budget: 9000 }, []);
    expect(result.umgebucht).toBe(0);
    expect(result.verfuegbar).toBe(9000);
  });

  it('faellt auf gesamt_budget bzw. nettobetrag zurueck', () => {
    expect(berechneVerfuegbaresBudget({ gesamt_budget: 5000 }, []).basis).toBe(5000);
    expect(berechneVerfuegbaresBudget({ nettobetrag: 10000 }, []).basis).toBe(10000);
    expect(berechneVerfuegbaresBudget(null, []).basis).toBe(0);
  });
});

describe('calculateAgencyFeeSummary - kskUmgebucht', () => {
  const details = {
    agency_services_enabled: true,
    ksk_enabled: true,
    ksk_value: 1000,
    percentage_fee_enabled: false,
  };

  it('liefert den umgebuchten Selbstzahler-Anteil mit', () => {
    const koops = [
      { id: 'k1', ksk_selbstzahler: true, ksk_betrag: 49 },
      { id: 'k2', ksk_selbstzahler: false, ksk_betrag: 0 },
    ];
    const summary = calculateAgencyFeeSummary(details, koops, []);
    expect(summary.kskValue).toBe(1000);
    expect(summary.kskUmgebucht).toBe(49);
    expect(summary.showKskCard).toBe(true);
  });

  it('kskUmgebucht ist 0 ohne Selbstzahler', () => {
    const summary = calculateAgencyFeeSummary(details, [], []);
    expect(summary.kskUmgebucht).toBe(0);
  });
});

describe('renderKskCardHtml - Umbuchung und Topf-Ueberschreitung', () => {
  const formatCurrency = (v) => `${(parseFloat(v) || 0).toFixed(2)} €`;

  it('zeigt umgebuchten Anteil und verbleibenden Topf', () => {
    const html = renderKskCardHtml(
      { showKskCard: true, kskValue: 1000, kskUmgebucht: 49 },
      formatCurrency
    );
    expect(html).toContain('Umgebucht (Selbstzahler)');
    expect(html).toContain('49.00 €');
    expect(html).toContain('951.00 €');
    expect(html).not.toContain('KSK-Topf überschritten');
  });

  it('warnt bei ueberschrittenem KSK-Topf', () => {
    const html = renderKskCardHtml(
      { showKskCard: true, kskValue: 100, kskUmgebucht: 150 },
      formatCurrency
    );
    expect(html).toContain('KSK-Topf überschritten');
    expect(html).toContain('-50.00 €');
  });

  it('ohne Umbuchung kein Breakdown', () => {
    const html = renderKskCardHtml(
      { showKskCard: true, kskValue: 1000, kskUmgebucht: 0 },
      formatCurrency
    );
    expect(html).not.toContain('Umgebucht');
  });

  it('rendert nichts ohne KSK-Kachel', () => {
    expect(renderKskCardHtml({ showKskCard: false }, formatCurrency)).toBe('');
  });
});

// --- Rechnung: KSK in USt-Basis, Brutto und Skonto ---

function makeInput(value = '') {
  return { value: String(value) };
}

function makeToggle(checked = false) {
  return { type: 'checkbox', checked };
}

function runRechnung({ netto = '', ksk = '', zusatz = '', nettoSteuerfrei = '', skonto = false, ustAktiv = true, ustProzent = '19', zusatzBrutto = false } = {}) {
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
    kskInput: makeInput(ksk),
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

describe('berechneRechnungFromInputs - KSK-Aufschlag (Selbstzahler)', () => {
  it('Plan-Beispiel ohne Zusatzkosten: 1000 + 49 KSK -> USt 199.31, brutto 1248.31', () => {
    const r = runRechnung({ netto: '1000', ksk: '49' });

    expect(r.nettoGesamt).toBe(1049);
    expect(r.ustBetrag).toBe(199.31);
    expect(r.brutto).toBe(1248.31);
  });

  it('mit Zusatzkosten (netto): USt auf netto + zusatz + ksk', () => {
    const r = runRechnung({ netto: '1000', ksk: '49', zusatz: '50' });

    // taxable = 1099 -> USt 208.81; brutto = 1307.81
    expect(r.nettoGesamt).toBe(1099);
    expect(r.ustBetrag).toBe(208.81);
    expect(r.brutto).toBe(1307.81);
  });

  it('USt-freier Creator: KSK wird addiert, aber nicht besteuert', () => {
    const r = runRechnung({ netto: '1000', ksk: '49', ustAktiv: false, ustProzent: '0' });

    expect(r.ustBetrag).toBe(0);
    expect(r.brutto).toBe(1049);
  });

  it('Skonto wirkt auf KSK wie auf den Nettobetrag', () => {
    const r = runRechnung({ netto: '1000', ksk: '49', skonto: true });

    // skonto = 1049 * 3% = 31.47; taxable nach Skonto = 1017.53
    // USt = 193.33; brutto = 1210.86
    expect(r.skontoBetrag).toBe(31.47);
    expect(r.nettoNachSkonto).toBe(1017.53);
    expect(r.ustBetrag).toBe(193.33);
    expect(r.brutto).toBe(1210.86);
  });

  it('Brutto-Zusatzkosten-Modus: USt auf Leistung + KSK, Zusatz bleibt durchlaufend', () => {
    const r = runRechnung({ netto: '100', ksk: '4.9', zusatz: '119', zusatzBrutto: true });

    // Leistung = 104.9 -> USt 19.93; brutto = 104.9 + 19.93 + 119 = 243.83
    expect(r.ustBetrag).toBe(19.93);
    expect(r.brutto).toBe(243.83);
  });

  it('ohne kskInput (alte Formulare) bleibt das Verhalten unveraendert', () => {
    const outputs = { ustBetragInput: makeInput(), bruttoInput: makeInput() };
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
});
