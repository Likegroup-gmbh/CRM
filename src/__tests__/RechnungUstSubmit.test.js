import { describe, it, expect, beforeEach } from 'vitest';
import { finalizeRechnungSubmitData } from '../core/form/logic/events/RechnungEvents.js';
import { AutoCalculation } from '../core/form/logic/AutoCalculation.js';

function makeForm({ ustAktivChecked = true, ustProzentValue = '19', skontoChecked = false, geprueftChecked = false, kskChecked = false, nettoValue = '1000', ustBetragValue = '190', bruttobetragValue = '1190' } = {}) {
  const inputs = {
    ust_aktiv: { type: 'checkbox', checked: ustAktivChecked, name: 'ust_aktiv' },
    ust_prozent: { type: 'number', value: ustProzentValue, name: 'ust_prozent' },
    skonto: { type: 'checkbox', checked: skontoChecked, name: 'skonto' },
    geprueft: { type: 'checkbox', checked: geprueftChecked, name: 'geprueft' },
    ksk_pflichtig: { type: 'checkbox', checked: kskChecked, name: 'ksk_pflichtig' },
    nettobetrag: { type: 'number', value: nettoValue, name: 'nettobetrag' },
    ust_betrag: { type: 'number', value: ustBetragValue, name: 'ust_betrag' },
    bruttobetrag: { type: 'number', value: bruttobetragValue, name: 'bruttobetrag' },
  };

  return {
    querySelector: (selector) => {
      const match = selector.match(/input\[name="([^"]+)"\]/);
      if (match) return inputs[match[1]] || null;
      return null;
    },
  };
}

describe('finalizeRechnungSubmitData', () => {
  it('sets ust_prozent to 0 when toggle is OFF', () => {
    const form = makeForm({ ustAktivChecked: false, ustProzentValue: '0' });
    const submitData = { ust_aktiv: 'on', ust_prozent: '19' };

    finalizeRechnungSubmitData(form, submitData);

    expect(submitData.ust_prozent).toBe(0);
    expect(submitData).not.toHaveProperty('ust_aktiv');
  });

  it('sets ust_prozent to 19 when toggle is ON and field has 19', () => {
    const form = makeForm({ ustAktivChecked: true, ustProzentValue: '19' });
    const submitData = {};

    finalizeRechnungSubmitData(form, submitData);

    expect(submitData.ust_prozent).toBe(19);
    expect(submitData).not.toHaveProperty('ust_aktiv');
  });

  it('preserves custom ust_prozent when toggle is ON', () => {
    const form = makeForm({ ustAktivChecked: true, ustProzentValue: '7' });
    const submitData = {};

    finalizeRechnungSubmitData(form, submitData);

    expect(submitData.ust_prozent).toBe(7);
  });

  it('overrides creator prefill: toggle OFF despite creator having USt', () => {
    const form = makeForm({ ustAktivChecked: false, ustProzentValue: '19' });
    const submitData = { ust_prozent: '19' };

    finalizeRechnungSubmitData(form, submitData);

    expect(submitData.ust_prozent).toBe(0);
  });

  it('copies bruttobetrag and ust_betrag from computed fields', () => {
    const form = makeForm({ ustBetragValue: '95.00', bruttobetragValue: '595.00' });
    const submitData = {};

    finalizeRechnungSubmitData(form, submitData);

    expect(submitData.ust_betrag).toBe(95);
    expect(submitData.bruttobetrag).toBe(595);
  });

  it('handles checkbox states for skonto, geprueft, ksk_pflichtig', () => {
    const form = makeForm({ skontoChecked: true, geprueftChecked: true, kskChecked: false });
    const submitData = {};

    finalizeRechnungSubmitData(form, submitData);

    expect(submitData.skonto).toBe(true);
    expect(submitData.geprueft).toBe(true);
    expect(submitData.ksk_pflichtig).toBe(false);
  });

  it('defaults ust_prozent to 19 when field value is empty/NaN and toggle is ON', () => {
    const form = makeForm({ ustAktivChecked: true, ustProzentValue: '' });
    const submitData = {};

    finalizeRechnungSubmitData(form, submitData);

    expect(submitData.ust_prozent).toBe(19);
  });

  it('entfernt leeres vertrag_id statt es auf null zu setzen (kein Entknuepfen)', () => {
    const form = makeForm();

    const empty = { vertrag_id: '' };
    finalizeRechnungSubmitData(form, empty);
    expect(empty).not.toHaveProperty('vertrag_id');

    const nullVal = { vertrag_id: null };
    finalizeRechnungSubmitData(form, nullVal);
    expect(nullVal).not.toHaveProperty('vertrag_id');
  });

  it('behaelt ein gesetztes vertrag_id (bewusstes Aendern bleibt moeglich)', () => {
    const form = makeForm();
    const submitData = { vertrag_id: 'v-123' };

    finalizeRechnungSubmitData(form, submitData);

    expect(submitData.vertrag_id).toBe('v-123');
  });
});

describe('AutoCalculation.calculateUstBetrag with ust_prozent=0', () => {
  let calc;

  beforeEach(() => {
    calc = new AutoCalculation();
  });

  function makeCalcForm(nettoValue, ustProzentValue) {
    const fields = {
      nettobetrag: { value: nettoValue },
      ust_prozent: { value: ustProzentValue },
    };
    return {
      querySelector: (selector) => {
        const match = selector.match(/\[name="([^"]+)"\]/);
        if (match) return fields[match[1]] || null;
        return null;
      },
      querySelectorAll: () => [],
    };
  }

  it('returns 0 when ust_prozent is 0', () => {
    const form = makeCalcForm('1000', '0');
    const result = calc.calculateUstBetrag(form, null);
    expect(result).toBe(0);
  });

  it('returns 190 when ust_prozent is 19 and netto is 1000', () => {
    const form = makeCalcForm('1000', '19');
    const result = calc.calculateUstBetrag(form, null);
    expect(result).toBe(190);
  });

  it('defaults to 19% when ust_prozent field is missing', () => {
    const form = {
      querySelector: (selector) => {
        if (selector.includes('nettobetrag')) return { value: '100' };
        return null;
      },
      querySelectorAll: () => [],
    };
    const result = calc.calculateUstBetrag(form, null);
    expect(result).toBe(19);
  });

  it('defaults to 19% when ust_prozent field has empty value', () => {
    const form = makeCalcForm('100', '');
    const result = calc.calculateUstBetrag(form, null);
    expect(result).toBe(19);
  });
});
