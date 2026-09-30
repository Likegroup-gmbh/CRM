import { beforeEach, describe, expect, it } from 'vitest';
import { renderMainPage } from '../modules/kampagne/KampagneDetailMainRenderer.js';

const kampagneData = {
  kampagnenname: 'Burger',
  auftrag: { nettobetrag: 90000, creator_budget: 40000 }
};

describe('Kampagne als Überübersicht, Produktion als Workflow', () => {
  beforeEach(() => {
    window.validatorSystem = {
      sanitizeHtml: (value) => String(value ?? ''),
      sanitizeUrl: (value) => String(value ?? '')
    };
    window.isAdmin = () => true;
    window.isKunde = () => false;
    window.isInternal = () => false;
    window.canCreate = () => true;
    window.canFeature = () => false;
  });

  it('zeigt Soll-Karten und die Produktionsliste ohne Workflow-Tabs', () => {
    const html = renderMainPage({
      mode: 'overview',
      kampagneData,
      produktionen: [{
        id: 'p1',
        name: 'Neuer Süßer Senf 2.0',
        produkt: { name: 'Senf' },
        briefing: { aktivierung_name: 'Neuer Süßer Senf 2.0' }
      }]
    });

    expect(html).toContain('id="btn-new-produktion"');
    expect(html).toContain('href="/produktion/p1"');
    expect(html).toContain('Neuer Süßer Senf 2.0');
    expect(html).toContain('summary-cards');
    expect(html).not.toContain('data-tab="casting"');
  });

  it('zeigt auf der Produktion den Briefing-Titel und den Tab Produktion', () => {
    const html = renderMainPage({
      mode: 'workflow',
      lineTitle: 'Neuer Süßer Senf 2.0',
      kampagneData,
      activeWorkflow: 'produktion'
    });

    expect(html).toContain('Neuer Süßer Senf 2.0');
    expect(html).toContain('data-workflow-tab="produktion"');
    expect(html).toMatch(/data-workflow-tab="produktion">\s*Produktion\s*</);
    expect(html).toContain('data-workflow-tab="casting"');
    const briefing = html.indexOf('data-workflow-tab="briefing"');
    const produkte = html.indexOf('data-workflow-tab="produkte"');
    const personas = html.indexOf('data-workflow-tab="personas"');
    const casting = html.indexOf('data-workflow-tab="casting"');
    expect(briefing).toBeGreaterThan(-1);
    expect(briefing).toBeLessThan(produkte);
    expect(produkte).toBeLessThan(personas);
    expect(personas).toBeLessThan(casting);
    expect(html).not.toContain('summary-cards');
  });

  it('zeigt Produkt, Briefing und den Verbrauch am Kampagnen-Topf', () => {
    const html = renderMainPage({
      mode: 'overview',
      kampagneData,
      produktionen: [{
        id: 'p1',
        name: 'Next Magenta',
        produkt: { name: 'Magenta' },
        briefing: { aktivierung_name: 'Next Magenta' },
        budgetUsed: 12500
      }]
    });

    expect(html).toContain('Magenta');
    expect(html).toContain('Next Magenta');
    expect(html).toContain('Verbrauch');
    expect(html).toContain('budget-progress-cell');
    expect(html).toContain('style="width: 31%"');
    expect(html).toContain('31%');
  });

  it('rechnet den Balken gegen das Budget der Kampagne statt des Auftrags', () => {
    const html = renderMainPage({
      mode: 'overview',
      kampagneData: {
        kampagnenname: 'Burger',
        volumen: 25000,
        auftrag: { nettobetrag: 90000, creator_budget: 40000 }
      },
      produktionen: [{
        id: 'p1',
        name: 'Next Magenta',
        briefing: { aktivierung_name: 'Next Magenta' },
        budgetUsed: 12500
      }]
    });

    expect(html).toContain('style="width: 50%"');
    expect(html).toContain('50%');
  });

  it('rechnet den Verbrauch der anderen Produktionen im geteilten Topf gegen', () => {
    const html = renderMainPage({
      mode: 'overview',
      kampagneData,
      produktionen: [
        { id: 'p1', name: 'Produktion A', briefing: { aktivierung_name: 'A' }, budgetUsed: 12500 },
        { id: 'p2', name: 'Produktion B', briefing: { aktivierung_name: 'B' }, budgetUsed: 7500 }
      ]
    });

    // 12.500 + 7.500 = 20.000 von 40.000 -> beide Balken zeigen 50%
    expect(html.match(/style="width: 50%"/g)).toHaveLength(2);
    expect(html.match(/20\.000,00/g)).toHaveLength(2);
  });

  it('zeigt die Budget-Spalte mit eigenem Budget oder Platzhalter', () => {
    const html = renderMainPage({
      mode: 'overview',
      kampagneData,
      produktionen: [
        { id: 'p1', name: 'Produktion A', briefing: { aktivierung_name: 'A' }, budget: 15000, budgetUsed: 1000 },
        { id: 'p2', name: 'Produktion B', briefing: { aktivierung_name: 'B' }, budgetUsed: 500 }
      ]
    });

    expect(html).toContain('<th>Budget</th>');
    expect(html).toContain('15.000,00');
    expect(html).toContain('<span class="text-muted">–</span>');
    // Eigenes Budget: nur eigener Verbrauch (1.000 / 15.000 = 7%)
    expect(html).toContain('style="width: 7%"');
  });
});
