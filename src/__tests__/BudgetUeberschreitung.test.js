import { describe, it, expect } from 'vitest';
import { calculateBudgetOverview } from '../core/budget/calculateBudgetOverview.js';
import { calculateCreatorPaymentSummary, calculateEkVkTotals } from '../core/budget/EkVkAgencyFeeHelper.js';

// ADR 0007: Unplausible Zahlen werden ausgewiesen, nicht geglaettet.
// Diese Tests halten fest, dass Ueberschreitungen sichtbar bleiben. Wer hier
// ein Math.max(0, ...) wieder einbaut, macht einen gerissenen Auftrag optisch
// ununterscheidbar von einem punktgenau ausgeschoepften.

describe('Budgetueberschreitung bleibt sichtbar', () => {
  it('liefert ein negatives verfuegbares Budget, wenn der Auftrag gerissen wurde', () => {
    const result = calculateBudgetOverview({
      auftrag: { nettobetrag: 10000, creator_budget: 10000 },
      details: { campaign_type: ['ugc_paid'] },
      kooperationen: [{ id: 'k1' }],
      videos: [{ kooperation_id: 'k1', einkaufspreis_netto: 30000, verkaufspreis_netto: 30000 }],
    });

    expect(result.verbrauchtesBudget).toBeGreaterThan(result.auftragsvolumen);
    expect(result.verfuegbaresBudget).toBeLessThan(0);
  });

  it('liefert weiterhin einen positiven Rest, solange Budget uebrig ist', () => {
    const result = calculateBudgetOverview({
      auftrag: { nettobetrag: 10000, creator_budget: 10000 },
      details: { campaign_type: ['ugc_paid'] },
      kooperationen: [{ id: 'k1' }],
      videos: [{ kooperation_id: 'k1', einkaufspreis_netto: 1000, verkaufspreis_netto: 1000 }],
    });

    expect(result.verfuegbaresBudget).toBeGreaterThan(0);
  });

  it('verfuegbaresBudget ist immer Volumen minus Verbrauch, ohne Untergrenze', () => {
    const result = calculateBudgetOverview({
      auftrag: { nettobetrag: 5000, creator_budget: 5000 },
      details: { campaign_type: ['ugc_paid'] },
      kooperationen: [{ id: 'k1' }],
      videos: [{ kooperation_id: 'k1', einkaufspreis_netto: 8000, verkaufspreis_netto: 8000 }],
    });

    expect(result.verfuegbaresBudget).toBe(result.auftragsvolumen - result.verbrauchtesBudget);
  });
});

describe('Ueberzahlung an Creator bleibt sichtbar', () => {
  it('macht die Ueberzahlung als negatives Offen kenntlich', () => {
    const rechnungen = [{ status: 'Bezahlt', nettobetrag: 2500, rechnungstyp: 'kampagne' }];
    const { paid, open } = calculateCreatorPaymentSummary(2000, rechnungen);

    expect(paid).toBe(2500);
    expect(open).toBe(-500);
  });
});

describe('EK/VK-Summen stimmen mit der Marge ueberein', () => {
  it('haelt die Identitaet auch bei halb bepreisten Zeilen ein', () => {
    const koops = [{ id: 'k1' }];
    const videos = [
      { kooperation_id: 'k1', einkaufspreis_netto: 200, verkaufspreis_netto: 500 },
      { kooperation_id: 'k1', einkaufspreis_netto: null, verkaufspreis_netto: 900 },
      { kooperation_id: 'k1', einkaufspreis_netto: 300, verkaufspreis_netto: 0 },
    ];

    const { ekSum, vkSum, marginSum, incompleteSum } = calculateEkVkTotals(koops, videos);

    expect(vkSum - ekSum).toBe(marginSum + incompleteSum);
    expect(marginSum).toBe(300);
    expect(incompleteSum).toBe(600);
  });
});
