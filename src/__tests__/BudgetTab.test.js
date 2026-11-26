import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderBudgetTab, updateBudgetTab } from '../modules/produktion/budgetTab.js';
import { mountBudgetFilter, setBudgetTags, unmountBudgetFilter } from '../modules/produktion/budgetTabFilter.js';
import { getVisibleWorkflowTabs, resolveInitialWorkflowTab } from '../modules/kampagne/KampagneDetailWorkflow.js';
import { tabHatAlleLinien } from '../modules/kampagne/linienScope.js';
import { JAHR, JANUAR, koop, koops, lena, mia, setupValidator } from './BudgetTabTestKit.js';

setupValidator();

describe('renderBudgetTab', () => {
  const stand = { decke: 40000, eigen: true, verbrauch: 0 };
  // Intl setzt ein geschütztes Leerzeichen vor das €.
  const render = (...args) => renderBudgetTab(...args).replace(/\u00a0/g, ' ');

  it('zeigt Linie, andere Linien, Noch frei und die Creator', () => {
    const html = render({ stand, koops }, { linieId: 'l1', linieName: 'Nano', eigenesBudget: 40000 });
    expect(html).not.toContain('budget-tab__overline');
    expect(html).toContain('budget-tab__segment-tip--start');
    expect(html).toContain('10.700,50 €');
    expect(html).toContain('40.000 €');
    expect(html).toContain('Diese Linie');
    expect(html).toContain('2 Kooperationen · Nano');
    expect(html).toContain('Andere Linien');
    expect(html).toContain('Noch frei');
    expect(html).toContain('Davon 500 € Zusatzkosten.');
    expect(html).toContain('budget-tab__segment--linie');
    expect(html).toContain('class="budget-tab__kanal" href="https://instagram.com/lena.lifts"');
    expect(html).toContain('@lena.lifts</a> auf Instagram');
    expect(html).toContain('href="https://www.tiktok.com/@miaokafor"');
    expect(html).toContain('href="/creator/c1"');
    expect(html).toContain('Kooperation ohne Creator-Datensatz');
    expect(html).not.toContain('Kategorien');
    expect(html).not.toContain('data-linie=');
  });

  it('zeigt bei Alle Linien eine Kachel Verbraucht ohne Hervorhebung', () => {
    const html = render({ stand, koops }, { linieId: null, eigenesBudget: 40000 });
    expect(html).toContain('Verbraucht');
    expect(html).not.toContain('Diese Linie');
    expect(html).not.toContain('budget-tab__segment--linie');
  });

  it('zeigt eine Überschreitung als Überschritten', () => {
    const html = render({ stand: { decke: 8000, eigen: true }, koops }, { eigenesBudget: 8000 });
    expect(html).toContain('Überschritten');
    expect(html).toContain('2.700,50 €');
    expect(html).toContain('34 % über dem Budget');
    expect(html).toContain('budget-tab__decke');
  });

  it('kommt ohne Kooperationen und ohne Budget aus', () => {
    const html = render({ stand: { decke: null }, koops: [] });
    expect(html).toContain('Weder Produktion noch Kampagne haben ein Budget.');
    expect(html).toContain('Noch kein Verbrauch');
    expect(html).toContain('Noch keine Kooperationen');
    expect(html).not.toContain('Noch frei');
  });

  it('rechnet mit Tag-Filter nur die passenden Kooperationen und zeigt die Chips', () => {
    const html = render({ stand, koops }, { tagIds: ['t-2026'], eigenesBudget: 40000 });
    expect(html).toContain('data-budget-tag-remove="t-2026"');
    expect(html).toContain('<span class="filter-chip-label">2026</span>');
    expect(html).not.toContain('<span class="filter-chip-label">Januar</span>');
    expect(html).toContain('data-count="verbraucht" data-count-value="5400.5"');
    expect(html).toContain('34.599,50 €');
    expect(html).toContain('2 Kooperationen · 3 Videos');
    expect(html).not.toContain('Altbestand Max');
  });

  it('macht aus einer Überschreitung mit Filter wieder Noch frei', () => {
    const html = render({ stand: { decke: 8000, eigen: true }, koops }, { tagIds: ['t-jan'], eigenesBudget: 8000 });
    expect(html).toContain('Noch frei');
    expect(html).toContain('data-count="status" data-count-value="1700"');
    expect(html).not.toContain('budget-tab__decke');
  });

  it('ignoriert unbekannte Tag-IDs', () => {
    const html = render({ stand, koops }, { tagIds: ['weg'] });
    expect(html).not.toContain('filter-chip');
    expect(html).toContain('data-count="verbraucht" data-count-value="10700.5"');
  });
});

describe('updateBudgetTab', () => {
  const stand = { decke: 40000, eigen: true };
  let root;
  const text = (key) => root.querySelector(`[data-count="${key}"]`).textContent.replace(/\u00a0/g, ' ');

  beforeEach(() => {
    root = document.createElement('div');
    root.innerHTML = renderBudgetTab({ stand, koops });
    document.body.append(root);
  });

  afterEach(() => {
    root.remove();
    delete window.matchMedia;
  });

  it('schreibt Werte und Chips der neuen Auswahl, ohne Bewegung sofort', () => {
    window.matchMedia = () => ({ matches: true });
    updateBudgetTab(root, { stand, koops }, { tagIds: ['t-2026'] });
    expect(text('verbraucht')).toBe('5.400,50 €');
    expect(text('status')).toBe('34.599,50 €');
    expect(text('prozent')).toBe('14');
    expect(root.querySelector('[data-budget-tag-remove="t-2026"]')).not.toBeNull();
  });

  it('zählt vom bisher angezeigten Wert los', () => {
    window.matchMedia = () => ({ matches: false });
    updateBudgetTab(root, { stand, koops }, { tagIds: ['t-jan'] });
    const el = root.querySelector('[data-count="verbraucht"]');
    expect(el.dataset.countValue).toBe('6300');
    expect(text('verbraucht')).toBe('10.700,50 €');
  });
});

describe('Tag-Filter neben der Überschrift', () => {
  const stand = { decke: 40000, eigen: true };
  let detail;
  const pane = () => document.getElementById('workflow-pane-budget');
  const verbraucht = () => pane().querySelector('[data-count="verbraucht"]').textContent.replace(/\u00a0/g, ' ');
  const triggerText = () => document.querySelector('[data-budget-filter] .table-select__label').textContent;
  const mount = (daten = { stand, koops }) => mountBudgetFilter(detail, {
    daten,
    optionen: () => ({ tagIds: detail.budgetTagIds })
  });

  beforeEach(() => {
    window.matchMedia = () => ({ matches: true });
    document.body.innerHTML = `<div id="workflow-pane-budget">${renderBudgetTab({ stand, koops })}</div>`;
    detail = { produktionId: 'p1' };
    mount();
  });

  afterEach(() => {
    unmountBudgetFilter(detail);
    document.body.innerHTML = '';
    delete window.matchMedia;
  });

  it('sitzt in der Kopfzeile neben „Budget“ und bietet die Tags als Mehrfachauswahl an', () => {
    const zeile = pane().querySelector('.budget-tab__head-row');
    expect(zeile.querySelector('.budget-tab__title').textContent).toBe('Budget');
    expect(zeile.querySelector('[data-budget-filter] [data-filter-select]')).not.toBeNull();
    const boxes = [...document.querySelectorAll('[data-budget-filter] input[type="checkbox"]')];
    expect(boxes.map(b => b.value)).toEqual(['t-2026', 't-jan']);
    expect(triggerText()).toBe('Alle Tags');
  });

  it('filtert bei Auswahl und nimmt den Tag über den Chip wieder raus', () => {
    const select = document.querySelector('[data-budget-filter] [data-filter-select]');
    const box = document.querySelector('[data-budget-filter] input[value="t-jan"]');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(detail.budgetTagIds).toEqual(['t-jan']);
    expect(verbraucht()).toBe('6.300 €');
    expect(document.querySelector('[data-budget-filter] [data-filter-select]')).toBe(select);
    expect(triggerText()).toBe('Januar');
    expect(pane().querySelector('[data-budget-tag-remove="t-jan"]')).not.toBeNull();

    setBudgetTags(detail, []);
    expect(box.checked).toBe(false);
    expect(triggerText()).toBe('Alle Tags');
    expect(pane().querySelector('[data-budget-tag-remove]')).toBeNull();
    expect(verbraucht()).toBe('10.700,50 €');
  });

  it('verwirft die Auswahl beim Wechsel der Produktion', () => {
    detail.budgetTagIds = ['t-jan'];
    detail.produktionId = 'p2';
    mount();
    expect(detail.budgetTagIds).toEqual([]);
  });

  it('lässt den Platz ohne Tags leer', () => {
    mount({ stand, koops: [koop('x', { videos: [100] })] });
    expect(document.querySelector('[data-budget-filter]').innerHTML).toBe('');
  });
});

describe('Budget als Workflow-Tab', () => {
  beforeEach(() => {
    window.isAdmin = () => true;
  });

  it('steht vor Briefing, nur mit Preis-Sicht', () => {
    window.canSeePricing = () => true;
    expect(getVisibleWorkflowTabs().map(t => t.id).slice(0, 2)).toEqual(['budget', 'briefing']);
    window.canSeePricing = () => false;
    expect(getVisibleWorkflowTabs().map(t => t.id)).not.toContain('budget');
  });

  it('öffnet weiter mit Kooperationen, ?tab=budget bleibt als Deeplink', () => {
    window.canSeePricing = () => true;
    window.history.replaceState(null, '', '/produktion/p1');
    expect(resolveInitialWorkflowTab()).toBe('kooperationen');
    window.history.replaceState(null, '', '/produktion/p1?tab=budget');
    expect(resolveInitialWorkflowTab()).toBe('budget');
    window.canSeePricing = () => false;
    expect(resolveInitialWorkflowTab()).toBe('kooperationen');
    window.history.replaceState(null, '', '/');
  });

  it('bietet im Linien-Umschalter Alle Linien an', () => {
    expect(tabHatAlleLinien('budget')).toBe(true);
  });
});
