import { describe, it, expect } from 'vitest';
import { ContractDetail } from '../modules/contracts/ContractDetail.js';

describe('ContractDetail.calculateBudgetSummary', () => {
  function createInstance(contract) {
    const instance = new ContractDetail();
    instance.contract = contract;
    return instance;
  }

  it('nutzt creator_budget (Netto abzüglich Fee/KSK) als Gesamtbudget', () => {
    const instance = createInstance({
      nettobetrag: 10000,
      creator_budget: 9000,
      rechnungen: [{ nettobetrag: 5000 }]
    });

    const { totalBudget, usedBudget, openBudget } = instance.calculateBudgetSummary();

    expect(totalBudget).toBe(9000);
    expect(usedBudget).toBe(5000);
    expect(openBudget).toBe(4000);
  });

  it('fällt auf nettobetrag zurück, wenn creator_budget fehlt (Altbestände)', () => {
    const instance = createInstance({
      nettobetrag: 10000,
      creator_budget: null,
      rechnungen: [{ nettobetrag: 2500 }]
    });

    const { totalBudget, openBudget } = instance.calculateBudgetSummary();

    expect(totalBudget).toBe(10000);
    expect(openBudget).toBe(7500);
  });

  it('bevorzugt gesamt_budget vor nettobetrag als Fallback', () => {
    const instance = createInstance({
      nettobetrag: 10000,
      creator_budget: null,
      gesamt_budget: 8000,
      rechnungen: []
    });

    const { totalBudget } = instance.calculateBudgetSummary();

    expect(totalBudget).toBe(8000);
  });

  it('lässt offenes Budget nicht negativ werden', () => {
    const instance = createInstance({
      creator_budget: 9000,
      rechnungen: [{ nettobetrag: 6000 }, { nettobetrag: 5000 }]
    });

    const { usedBudget, openBudget } = instance.calculateBudgetSummary();

    expect(usedBudget).toBe(11000);
    expect(openBudget).toBe(0);
  });
});
