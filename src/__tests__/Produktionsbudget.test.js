import { describe, expect, it } from 'vitest';
import { ProjektErstellenValidator } from '../modules/projekt-erstellen/services/ProjektErstellenValidator.js';
import {
  budgetMeldung,
  kampagneBudgetPot,
  kampagneCreatorDecke,
  ladeBudgetStand,
  preisBleibtImBudget,
  validateProduktionsbudgets,
  verbrauchZeilen,
  verbrauchZeilenProKampagne
} from '../modules/produktion/produktionsbudget.js';
import { renderMainPage } from '../modules/kampagne/KampagneDetailMainRenderer.js';
import { StepProduktion } from '../modules/projekt-erstellen/steps/StepProduktion.js';
import { FeedbackCard } from '../modules/projekt-erstellen/components/FeedbackCard.js';

describe('Produktionsbudget', () => {
  it('erlaubt den leeren Schritt', () => {
    expect(validateProduktionsbudgets([], 50000).valid).toBe(true);
    expect(validateProduktionsbudgets([
      { name: 'Produktion 1', budget: null, verbrauch: 0 }
    ], 50000).valid).toBe(true);
  });

  it('verlangt für jede Produktion ein Budget, sobald eins gesetzt ist', () => {
    const result = validateProduktionsbudgets([
      { name: 'Produktion 1', budget: 15000, verbrauch: 0 },
      { name: 'Produktion 2', budget: null, verbrauch: 4000 }
    ], 50000);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Produktion 2');
  });

  it('blockiert Summe über dem Volumen und Budget unter dem Verbrauch', () => {
    const zuviel = validateProduktionsbudgets([
      { name: 'Produktion 1', budget: 30000, verbrauch: 0 },
      { name: 'Produktion 2', budget: 30000, verbrauch: 0 }
    ], 50000);
    expect(zuviel.valid).toBe(false);
    expect(zuviel.errors.join(' ')).toContain('Volumen');

    const unterVerbrauch = validateProduktionsbudgets([
      { name: 'Produktion 1', budget: 1000, verbrauch: 4000 }
    ], 50000);
    expect(unterVerbrauch.valid).toBe(false);
    expect(unterVerbrauch.errors[0]).toContain('Verbrauch');
  });

  it('lässt 20, 20 und 10 bei 50.000 durch', () => {
    const result = validateProduktionsbudgets([
      { name: 'Produktion 1', budget: 20000, verbrauch: 0 },
      { name: 'Produktion 2', budget: 20000, verbrauch: 0 },
      { name: 'Produktion 3', budget: 10000, verbrauch: 0 }
    ], 50000);
    expect(result.valid).toBe(true);
  });

  it('prüft den Verkaufspreis gegen die Decke', () => {
    expect(preisBleibtImBudget({ verbrauch: 14000, delta: 2000, decke: 15000 })).toBe(false);
    expect(preisBleibtImBudget({ verbrauch: 14000, delta: 1000, decke: 15000 })).toBe(true);
    expect(preisBleibtImBudget({ verbrauch: 0, delta: 100, decke: null })).toBe(true);
  });

  it('Decke ohne Produktionsbudget: Creator-Budget vor Volumen', () => {
    const auftrag = { creator_budget: 40000 };
    expect(kampagneCreatorDecke({ creator_budget: 30000, volumen: 50000, auftrag }))
      .toEqual({ decke: 30000, quelle: 'creator' });
    expect(kampagneCreatorDecke({ creator_budget: null, volumen: 50000, auftrag }))
      .toEqual({ decke: 40000, quelle: 'creator' });
    expect(kampagneCreatorDecke({ volumen: 50000 }))
      .toEqual({ decke: 50000, quelle: 'volumen' });
    expect(kampagneCreatorDecke({ creator_budget: 0, volumen: 50000 }))
      .toEqual({ decke: 0, quelle: 'creator' });
    expect(kampagneCreatorDecke({})).toEqual({ decke: null, quelle: null });
    expect(budgetMeldung(false, 'creator')).toContain('Creator-Budget');
    expect(budgetMeldung(false, 'volumen')).toContain('Volumen');
  });

  it('ladeBudgetStand: budget-lose Produktion rechnet gegen das Creator-Budget', async () => {
    const tabellen = {
      produktion: [{ id: 'p1', budget: null, kampagne_id: 'k1' }, { id: 'p2', budget: null, kampagne_id: 'k1' }],
      produktion_verbrauch: [{ produktion_id: 'p1', budget_used: '1000' }, { produktion_id: 'p2', budget_used: '2000' }],
      kampagne: [{ id: 'k1', volumen: 50000, creator_budget: 30000, auftrag: { creator_budget: 40000 } }]
    };
    const supabase = {
      from(name) {
        let rows = tabellen[name];
        const query = {
          select: () => query,
          eq: (col, val) => { rows = rows.filter(r => (col === 'produktion_id' || col === 'id' || col === 'kampagne_id' ? r[col] === val : true)); return query; },
          not: (col) => { rows = rows.filter(r => r[col] != null); return query; },
          in: (col, vals) => { rows = rows.filter(r => vals.includes(r[col])); return query; },
          limit: () => query,
          maybeSingle: () => Promise.resolve({ data: rows[0] || null, error: null }),
          then: (resolve) => resolve({ data: rows, error: null })
        };
        return query;
      }
    };
    const stand = await ladeBudgetStand(supabase, 'p1');
    expect(stand).toEqual({ decke: 30000, verbrauch: 3000, eigen: false, quelle: 'creator' });
  });

  it('Topf: Kampagnen-Budget schlägt Auftrags-Budget', () => {
    const auftrag = { creator_budget: 40000, gesamt_budget: 60000, nettobetrag: 90000 };
    expect(kampagneBudgetPot({ creator_budget: 30000, volumen: 25000, auftrag })).toBe(30000);
    expect(kampagneBudgetPot({ volumen: 25000, auftrag })).toBe(25000);
    expect(kampagneBudgetPot({ auftrag })).toBe(40000);
    expect(kampagneBudgetPot({ auftrag: { gesamt_budget: 60000, nettobetrag: 90000 } })).toBe(60000);
    expect(kampagneBudgetPot({ auftrag: { nettobetrag: 90000 } })).toBe(90000);
    expect(kampagneBudgetPot(null)).toBe(0);
  });

  it('Verbrauchszeilen: eigenes Budget trägt nur den eigenen Verbrauch', () => {
    const [zeile] = verbrauchZeilen([
      { id: 'p1', budget: 15000, budgetUsed: 1000 }
    ], 40000);
    expect(zeile).toEqual({ eigenesBudget: 15000, used: 1000, total: 15000 });
  });

  it('Verbrauchszeilen: budget-lose Produktionen rechnen den Verbrauch der anderen gegen', () => {
    const zeilen = verbrauchZeilen([
      { id: 'p1', budget: null, budgetUsed: 12500 },
      { id: 'p2', budgetUsed: 7500 },
      { id: 'p3', budget: 20000, budgetUsed: 2000 }
    ], 40000);
    expect(zeilen[0]).toEqual({ eigenesBudget: null, used: 20000, total: 40000 });
    expect(zeilen[1]).toEqual({ eigenesBudget: null, used: 20000, total: 40000 });
    expect(zeilen[2]).toEqual({ eigenesBudget: 20000, used: 2000, total: 20000 });
  });

  it('Verbrauchszeilen: used bleibt null, solange der Verbrauch fehlt', () => {
    const [geteilt, eigen] = verbrauchZeilen([
      { id: 'p1', budget: null },
      { id: 'p2', budget: 15000 }
    ], 40000);
    expect(geteilt.used).toBeNull();
    expect(eigen.used).toBeNull();
  });

  it('Verbrauchszeilen pro Kampagne: jede Kampagne rechnet mit ihrem eigenen Topf', () => {
    const zeilen = verbrauchZeilenProKampagne([
      { id: 'p1', kampagne_id: 'k1', budgetUsed: 10000, kampagne: { id: 'k1', volumen: 50000 } },
      { id: 'p2', kampagne_id: 'k1', budgetUsed: 5000, kampagne: { id: 'k1', volumen: 50000 } },
      { id: 'p3', kampagne_id: 'k2', budgetUsed: 3000, kampagne: { id: 'k2', auftrag: { nettobetrag: 20000 } } }
    ]);
    expect(zeilen.get('p1')).toEqual({ eigenesBudget: null, used: 15000, total: 50000 });
    expect(zeilen.get('p2')).toEqual({ eigenesBudget: null, used: 15000, total: 50000 });
    expect(zeilen.get('p3')).toEqual({ eigenesBudget: null, used: 3000, total: 20000 });
  });

  it('hängt die Produktion an den Wizard', () => {
    const validator = new ProjektErstellenValidator();
    const result = validator.validateStep(5, {
      auftrag: { nettobetrag: 50000, titel: 'Launch' },
      kampagnen: [{ kampagnen_nummer: 1, volumen: 50000, campaign_blocks: [{ campaign_type: 'ugc_paid' }] }],
      produktionen: [
        { name: 'Produktion 1', kampagnen_nummer: 1, budget: 60000, verbrauch: 0 }
      ]
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Volumen');
  });
});

describe('Produktionsbudget in der Oberfläche', () => {
  it('rechnet den Balken gegen das eigene Budget und zeigt es auf der Produktion', () => {
    window.validatorSystem = {
      sanitizeHtml: (value) => String(value ?? ''),
      sanitizeUrl: (value) => String(value ?? '')
    };
    window.isAdmin = () => true;
    window.isKunde = () => false;
    window.isInternal = () => false;
    window.canCreate = () => false;
    window.canFeature = () => false;

    const html = renderMainPage({
      mode: 'overview',
      kampagneData: { kampagnenname: 'Burger', auftrag: { creator_budget: 40000, nettobetrag: 50000 } },
      produktionen: [{
        id: 'p1',
        name: 'Produktion 1',
        budget: 15000,
        budgetUsed: 1000,
        briefing: { aktivierung_name: 'Serum' }
      }]
    });
    expect(html).toContain('1.000,00');
    expect(html).toContain('href="/produktion/p1"');

    const workflow = renderMainPage({
      mode: 'workflow',
      lineTitle: 'Serum',
      produktion: { id: 'p1', name: 'Produktion 1', budget: 15000, budgetUsed: 1000 },
      kampagneData: { kampagnenname: 'Burger', volumen: 50000, auftrag: { nettobetrag: 50000 } },
      activeWorkflow: 'produktion'
    });
    expect(workflow).toContain('Produktionsbudget');
    expect(workflow).toContain('15.000,00');
    expect(workflow).toContain('Verbrauch');
  });

  it('zeigt im Schritt Name, Budget und den Rest', () => {
    const host = document.createElement('div');
    const step = new StepProduktion({
      formData: {
        auftrag: { nettobetrag: 50000 },
        kampagnen: [{ kampagnen_nummer: 1, volumen: 50000 }],
        produktionen: [{ _key: 'a', kampagnen_nummer: 1, name: 'Produktion 1', budget: 15000, verbrauch: 0 }]
      }
    });
    step.host = host;
    step.render(host);
    expect(host.querySelector('table.data-table')).toBeTruthy();
    expect(host.textContent).toContain('Name');
    expect(host.textContent).toContain('Produktionsbudget');
    expect(host.querySelector('[data-prod-name]').value).toBe('Produktion 1');
    expect(host.textContent).toContain('15.000,00');
    expect(host.textContent).toContain('35.000,00');
    expect(host.querySelector('[data-prod-add]')).toBeTruthy();
  });

  it('listet gesetzte Budgets im Preview als Tabelle', () => {
    const card = new FeedbackCard(document.createElement('div'), { currentStep: 4, formData: {} });
    const html = card.buildProduktionen({
      kampagnen: [{ kampagnen_nummer: 1, eigener_name: 'Recovery Kit', volumen: 75000 }],
      produktionen: [
        { name: 'Shake It Off', kampagnen_nummer: 1, budget: 15000 },
        { name: 'Reload', kampagnen_nummer: 1, budget: null }
      ]
    });
    expect(html).toContain('pe-summary-table');
    expect(html).toContain('Produktion');
    expect(html).toContain('Budget');
    expect(html).toContain('Shake It Off');
    expect(html).toContain('15.000,00');
    expect(html).not.toContain('Reload');
    expect(html).not.toContain('<th>Kampagne</th>');

    const empty = card.buildProduktionen({ produktionen: [] });
    expect(empty).toContain('Produktionsbudget');
    expect(empty).not.toContain('pe-summary-table');
  });

  it('zeigt die Kampagne im Preview, sobald mehrere im Auftrag stehen', () => {
    const card = new FeedbackCard(document.createElement('div'), { currentStep: 4, formData: {} });
    const html = card.buildProduktionen({
      kampagnen: [
        { kampagnen_nummer: 1, eigener_name: 'Recovery Kit', volumen: 50000 },
        { kampagnen_nummer: 2, eigener_name: 'Launch', volumen: 25000 }
      ],
      produktionen: [
        { name: 'Shake It Off', kampagnen_nummer: 1, budget: 15000 }
      ]
    });
    expect(html).toContain('<th>Kampagne</th>');
    expect(html).toContain('Recovery Kit');
    expect(html).toContain('Shake It Off');
  });
});
