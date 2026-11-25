// produktionFlowFokus.test.js
// Sprungziel im Tab (?fokus=, ADR 0079): Kooperation aus der Vollansicht springt an ihre
// Zeile, die Videoidee an ihre Zeile im Konzept mit offenem Drawer. Danach ist fokus aus der URL.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { workflow } = vi.hoisted(() => ({
  workflow: {
    activateWorkflowTab: vi.fn((detail, tab) => { detail.activeWorkflowTab = tab; }),
    getVisibleWorkflowTabs: vi.fn(() => ['briefing', 'kooperationen', 'konzepte', 'skripte', 'videos'].map(id => ({ id }))),
    remountWorkflowPane: vi.fn(async () => {})
  }
}));

vi.mock('../modules/kampagne/KampagneDetailWorkflow.js', () => workflow);
vi.mock('../core/icons/IconSystem.js', () => ({ icon: () => '<svg></svg>' }));

import { routeImFlow } from '../modules/kampagne/produktionFlowRoute.js';
import { kooperationFlowUrl } from '../modules/kampagne/kooperationFlowZiel.js';

const START = '/produktion/p1?tab=videos&linie=b1';

function produktion(overrides = {}) {
  const detail = {
    mode: 'workflow',
    _isMounted: true,
    produktionId: 'p1',
    linieId: 'b1',
    linieAlle: false,
    linien: [{ id: 'b1' }, { id: 'b2' }],
    activeWorkflowTab: 'videos',
    currentView: 'table',
    kooperationenVideoTable: { activeFilterTab: 'offen' },
    store: { kooperationen: [{ id: 'k1' }, { id: 'k2' }] },
    offen: {},
    ...overrides
  };
  detail.switchLinie = vi.fn(async (wert) => { detail.linieId = wert; });
  return detail;
}

function db(antwort) {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: vi.fn(async () => antwort) };
  return { from: vi.fn(() => chain) };
}

const koopZeile = (id) => document.body.insertAdjacentHTML('beforeend',
  `<table><tr class="kooperation-row" data-kooperation-id="${id}"><td></td></tr></table>`);
const zeile = (sel) => document.querySelector(sel);
const adresse = () => window.location.pathname + window.location.search;

let detail;

beforeEach(() => {
  document.body.innerHTML = '';
  window.history.replaceState({ route: START }, '', START);
  window.isAdmin = () => true;
  window.moduleRegistry = { navigateTo: vi.fn() };
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  if (detail) detail._isMounted = false;
  vi.clearAllMocks();
  delete window.supabase;
  delete window.isAdmin;
  delete window.guestShare;
});

describe('Sprungziel im Tab', () => {
  it('Kooperation: Tab Kooperationen, Zeile angesprungen und markiert, fokus verlässt die URL', () => {
    detail = produktion();
    koopZeile('k1');

    expect(routeImFlow(detail, '/produktion/p1?tab=kooperationen&linie=b1&fokus=k1', { push: true })).toBe(true);

    expect(workflow.activateWorkflowTab).toHaveBeenCalledWith(detail, 'kooperationen', { syncUrl: false });
    const tr = zeile('tr[data-kooperation-id="k1"]');
    expect(tr.classList.contains('is-flow-fokus')).toBe(true);
    expect(tr.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    expect(adresse()).toBe('/produktion/p1?tab=kooperationen&linie=b1');
    expect(detail.switchLinie).not.toHaveBeenCalled();
  });

  it('Kooperation außerhalb des Filters: schaltet auf Alle, dann springt es', async () => {
    detail = produktion();
    detail.switchTab = vi.fn(() => koopZeile('k2'));

    routeImFlow(detail, '/produktion/p1?tab=kooperationen&linie=b1&fokus=k2', { push: true });

    expect(detail.switchTab).toHaveBeenCalledWith('alle');
    await vi.waitFor(() => expect(zeile('tr[data-kooperation-id="k2"]').classList.contains('is-flow-fokus')).toBe(true));
    expect(detail.switchTab).toHaveBeenCalledTimes(1);
  });

  it('Videoidee: Konzept-Tab der Linie, wartet auf die Zeile und öffnet den Drawer', async () => {
    detail = produktion();
    window.supabase = db({ data: { briefing_id: 'b2', produktion_id: 'p1' }, error: null });

    expect(routeImFlow(detail, '/konzepte/s1?fokus=i1', { push: true })).toBe(true);

    await vi.waitFor(() => expect(adresse()).toBe('/produktion/p1?tab=konzepte&linie=b2&konzept=s1&fokus=i1'));
    await vi.waitFor(() => expect(workflow.activateWorkflowTab).toHaveBeenCalledWith(detail, 'konzepte', { syncUrl: false }));
    expect(detail.offen.konzepte).toBe('s1');

    detail.konzeptWorksheet = { items: [{ id: 'i1' }], showEditItemDrawer: vi.fn() };
    document.body.innerHTML = '<div id="workflow-pane-konzepte"><table><tr class="item-row" data-item-id="i1"><td></td></tr></table></div>';

    await vi.waitFor(() => expect(detail.konzeptWorksheet.showEditItemDrawer).toHaveBeenCalledWith('i1'));
    expect(zeile('tr[data-item-id="i1"]').classList.contains('is-flow-fokus')).toBe(true);
    expect(adresse()).toBe('/produktion/p1?tab=konzepte&linie=b2&konzept=s1');
  });

  it('Produktion ohne Linien: Konzept der Produktion öffnet ohne Linienwechsel', async () => {
    detail = produktion({ linien: [], linieId: null });
    window.supabase = db({ data: { briefing_id: null, produktion_id: 'p1' }, error: null });

    routeImFlow(detail, '/konzepte/s1?fokus=i1', { push: true });

    await vi.waitFor(() => expect(workflow.activateWorkflowTab).toHaveBeenCalledWith(detail, 'konzepte', { syncUrl: false }));
    expect(adresse()).toBe('/produktion/p1?tab=konzepte&konzept=s1&fokus=i1');
    expect(detail.switchLinie).not.toHaveBeenCalled();
    expect(window.moduleRegistry.navigateTo).not.toHaveBeenCalled();
  });

  it('ein neuer Sprung löst den alten ab', async () => {
    detail = produktion();
    routeImFlow(detail, '/produktion/p1?tab=kooperationen&linie=b1&fokus=k9', { push: true });
    koopZeile('k1');
    routeImFlow(detail, '/produktion/p1?tab=kooperationen&linie=b1&fokus=k1', { push: true });
    koopZeile('k9');

    await new Promise(r => setTimeout(r, 200));
    expect(zeile('tr[data-kooperation-id="k1"]').classList.contains('is-flow-fokus')).toBe(true);
    expect(zeile('tr[data-kooperation-id="k9"]').classList.contains('is-flow-fokus')).toBe(false);
  });

  it('Link zur Kooperation: bleibt in der Produktion, sonst die Detailseite', () => {
    expect(kooperationFlowUrl({ produktionId: 'p1', linieId: 'alle', kooperationId: 'k1' }))
      .toBe('/produktion/p1?tab=kooperationen&linie=alle&fokus=k1');
    expect(kooperationFlowUrl({ produktionId: 'p1', kooperationId: 'k1' })).toBe('/produktion/p1?tab=kooperationen&fokus=k1');
    expect(kooperationFlowUrl({ produktionId: null, kooperationId: 'k1' })).toBe('/kooperation/k1');
    window.guestShare = { entityType: 'kampagne' };
    expect(kooperationFlowUrl({ produktionId: 'p1', kooperationId: 'k1' })).toBe('/kooperation/k1');
  });
});
