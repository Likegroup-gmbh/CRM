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
});
