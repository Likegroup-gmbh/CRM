// produktionFlowRoute.test.js
// Navigation im Produktionsflow ohne Neuaufbau (ADR 0079): Adressen der eigenen
// Produktion, Entity-Adressen aus Pills und Tabellen, Linienwechsel, Abfrage mit
// Stale-Schutz und Rückfall auf den Router.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { workflow } = vi.hoisted(() => ({
  workflow: {
    activateWorkflowTab: vi.fn(),
    getVisibleWorkflowTabs: vi.fn(() => ['briefing', 'produkte', 'personas', 'casting', 'konzepte', 'skripte', 'vertraege']
      .map(id => ({ id }))),
    remountWorkflowPane: vi.fn(async () => {})
  }
}));

vi.mock('../modules/kampagne/KampagneDetailWorkflow.js', () => workflow);
vi.mock('../core/icons/IconSystem.js', () => ({ icon: () => '<svg></svg>' }));

import { routeImFlow, zeigeImTab } from '../modules/kampagne/produktionFlowRoute.js';

function produktion(overrides = {}) {
  const detail = {
    mode: 'workflow',
    _isMounted: true,
    produktionId: 'p1',
    linieId: 'b1',
    linieAlle: false,
    linien: [
      { id: 'b1', briefing: { produkte: [{ produkt: { id: 'x1' } }], persona_ids: ['y1'] } },
      { id: 'b2', briefing: { produkte: [{ produkt: { id: 'x2' } }], persona_ids: [] } }
    ],
    activeWorkflowTab: 'vertraege',
    offen: {},
    ...overrides
  };
  // Wie KampagneDetail: der Linienwechsel schließt alles Offene
  detail.switchLinie = vi.fn(async (wert) => {
    if (wert === 'alle') detail.linieAlle = true;
    else detail.linieId = wert;
    detail.offen = {};
  });
  return detail;
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

function skriptDb(antworten) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: vi.fn(() => antworten.shift())
  };
  return { from: vi.fn(() => chain) };
}

const trail = [{ label: 'Kampagne', url: '/kampagne/k1' }];

beforeEach(() => {
  window.history.replaceState({ route: '/produktion/p1?tab=vertraege&linie=b1', trail }, '', '/produktion/p1?tab=vertraege&linie=b1');
  delete window.guestShare;
  window.moduleRegistry = { navigateTo: vi.fn() };
});

afterEach(() => {
  vi.clearAllMocks();
  delete window.supabase;
});

describe('Adressen der eigenen Produktion', () => {
  it('öffnet ein Skript aus einem anderen Tab mit eigenem History-Eintrag', () => {
    const detail = produktion();
    const laengeVorher = window.history.length;

    expect(routeImFlow(detail, '/produktion/p1?tab=skripte&linie=b1&skript=s1', { push: true })).toBe(true);

    expect(window.history.length).toBe(laengeVorher + 1);
    expect(window.history.state).toEqual({ route: '/produktion/p1?tab=skripte&linie=b1&skript=s1', trail });
    expect(detail.offen.skripte).toBe('s1');
    expect(workflow.activateWorkflowTab).toHaveBeenCalledWith(detail, 'skripte', { syncUrl: false });
  });

  it('schließt die Ansicht im selben Tab (Zurück) und mountet die Liste', () => {
    const detail = produktion({ activeWorkflowTab: 'skripte', offen: { skripte: 's1' } });

    expect(routeImFlow(detail, '/produktion/p1?tab=skripte&linie=b1')).toBe(true);

    expect(detail.offen.skripte).toBeNull();
    expect(workflow.remountWorkflowPane).toHaveBeenCalledWith(detail, 'skripte');
    expect(workflow.activateWorkflowTab).not.toHaveBeenCalled();
  });

  it('tut nichts, wenn der Tab das Ziel schon zeigt', () => {
    const detail = produktion({ activeWorkflowTab: 'produkte', offen: { produkte: 'x1' } });
    expect(routeImFlow(detail, '/produktion/p1?tab=produkte&linie=b1&produkt=x1')).toBe(true);
    expect(workflow.remountWorkflowPane).not.toHaveBeenCalled();
    expect(workflow.activateWorkflowTab).not.toHaveBeenCalled();
  });

  it('behält die Auswahl in Konzept und Casting, wenn die Adresse keine trägt', () => {
    const detail = produktion({ offen: { konzepte: 'k2' } });
    expect(routeImFlow(detail, '/produktion/p1?tab=konzepte&linie=b1', { push: true })).toBe(true);
    expect(detail.offen.konzepte).toBe('k2');
    expect(workflow.activateWorkflowTab).toHaveBeenCalledWith(detail, 'konzepte', { syncUrl: false });
  });

  it('wechselt erst die Linie, dann öffnet das Ziel', async () => {
    const detail = produktion({ offen: { skripte: 'alt' } });

    expect(routeImFlow(detail, '/produktion/p1?tab=skripte&linie=b2&skript=s1', { push: true })).toBe(true);

    expect(detail.switchLinie).toHaveBeenCalledWith('b2', { alleBehalten: true });
    await vi.waitFor(() => expect(workflow.activateWorkflowTab).toHaveBeenCalledWith(detail, 'skripte', { syncUrl: false }));
    expect(detail.offen.skripte).toBe('s1');
  });

  it('schaltet "Alle Linien" nur in Tabs, die sie haben', () => {
    const detail = produktion();
    expect(routeImFlow(detail, '/produktion/p1?tab=vertraege&linie=alle', { push: true })).toBe(true);
    expect(detail.switchLinie).toHaveBeenCalledWith('alle', { alleBehalten: undefined });
    expect(routeImFlow(produktion(), '/produktion/p1?tab=skripte&linie=alle')).toBe(false);
  });

  it('überlässt dem Router andere Produktion, fremde Linie und Parameter, Gäste und die Übersicht', () => {
    const detail = produktion();
    expect(routeImFlow(detail, '/produktion/p2?tab=skripte&skript=s1')).toBe(false);
    expect(routeImFlow(detail, '/produktion/p1?tab=skripte&linie=b9&skript=s1')).toBe(false);
    expect(routeImFlow(detail, '/produktion/p1?tab=skripte&einreichung=e1')).toBe(false);
    expect(routeImFlow(detail, '/produktion/p1')).toBe(false);
    expect(routeImFlow(produktion({ mode: 'overview' }), '/produktion/p1?tab=skripte')).toBe(false);
    window.guestShare = { entityType: 'kampagne' };
    expect(routeImFlow(detail, '/produktion/p1?tab=skripte&skript=s1')).toBe(false);
    expect(detail.offen).toEqual({});
  });

  it('überlässt dem Router Tabs, die der Nutzer nicht sieht', () => {
    workflow.getVisibleWorkflowTabs.mockReturnValueOnce([{ id: 'vertraege' }]);
    expect(routeImFlow(produktion(), '/produktion/p1?tab=skripte&skript=s1')).toBe(false);
  });
});

describe('Entity-Adressen aus Pills und Tabellen', () => {
  it('zeigt ein Briefing einer anderen Linie im Briefing-Tab', async () => {
    const detail = produktion({ activeWorkflowTab: 'produkte' });

    expect(routeImFlow(detail, '/briefing/b2', { push: true })).toBe(true);

    expect(window.location.pathname + window.location.search).toBe('/produktion/p1?tab=briefing&linie=b2');
    expect(detail.switchLinie).toHaveBeenCalledWith('b2', { alleBehalten: true });
    await vi.waitFor(() => expect(workflow.activateWorkflowTab).toHaveBeenCalledWith(detail, 'briefing', { syncUrl: false }));
  });

  it('öffnet ein Produkt der Linie im Produkte-Tab ohne Abfrage', () => {
    const detail = produktion({ activeWorkflowTab: 'kooperationen' });
    window.supabase = { from: vi.fn() };

    expect(routeImFlow(detail, '/marke/m1/produkt?produkt=x1', { push: true })).toBe(true);

    expect(window.location.search).toBe('?tab=produkte&linie=b1&produkt=x1');
    expect(detail.offen.produkte).toBe('x1');
    expect(workflow.activateWorkflowTab).toHaveBeenCalledWith(detail, 'produkte', { syncUrl: false });
    expect(window.supabase.from).not.toHaveBeenCalled();
  });

  it('lässt Zurück/Vor auf eine Einzelseite die Einzelseite bleiben', () => {
    expect(routeImFlow(produktion(), '/produkt/x1')).toBe(false);
  });

  it('lässt Anlegen-Seiten und Fremdes beim Router', () => {
    const detail = produktion();
    expect(routeImFlow(detail, '/produkt/new?briefing=b1', { push: true })).toBe(false);
    expect(routeImFlow(detail, '/kooperation/k1', { push: true })).toBe(false);
    expect(routeImFlow(detail, '/briefing/b9', { push: true })).toBe(false);
  });

  it('fragt die Linie eines Skripts ab und öffnet es danach', async () => {
    const detail = produktion({ activeWorkflowTab: 'produkte' });
    window.supabase = skriptDb([Promise.resolve({ data: { briefing_id: 'b1' }, error: null })]);

    expect(routeImFlow(detail, '/skripte/s1', { push: true })).toBe(true);

    await vi.waitFor(() => expect(workflow.activateWorkflowTab).toHaveBeenCalledWith(detail, 'skripte', { syncUrl: false }));
    expect(detail.offen.skripte).toBe('s1');
    expect(window.location.search).toBe('?tab=skripte&linie=b1&skript=s1');
  });

  it('navigiert normal, wenn das Skript nicht zur Produktion gehört', async () => {
    window.supabase = skriptDb([Promise.resolve({ data: { briefing_id: 'b7' }, error: null })]);

    expect(routeImFlow(produktion(), '/skripte/s1', { push: true })).toBe(true);

    await vi.waitFor(() => expect(window.moduleRegistry.navigateTo)
      .toHaveBeenCalledWith('/skripte/s1', false, { ohneModulRoute: true }));
    expect(workflow.activateWorkflowTab).not.toHaveBeenCalled();
  });

  it('verwirft eine Abfrage, die ein neuer Klick überholt hat', async () => {
    const langsam = deferred();
    const detail = produktion();
    window.supabase = skriptDb([langsam.promise, Promise.resolve({ data: { briefing_id: 'b1' }, error: null })]);

    routeImFlow(detail, '/skripte/s1', { push: true });
    routeImFlow(detail, '/skripte/s2', { push: true });
    await vi.waitFor(() => expect(detail.offen.skripte).toBe('s2'));
    langsam.resolve({ data: { briefing_id: 'b1' }, error: null });
    await langsam.promise;
    await Promise.resolve();

    expect(detail.offen.skripte).toBe('s2');
    expect(workflow.activateWorkflowTab).toHaveBeenCalledTimes(1);
  });
});

describe('Wechsel im Tab', () => {
  it('ersetzt die Adresse, statt einen History-Eintrag anzulegen', () => {
    const detail = produktion({ activeWorkflowTab: 'produkte', offen: { produkte: 'x1' } });
    window.history.replaceState({ route: '/produktion/p1?tab=produkte&linie=b1&produkt=x1', trail }, '',
      '/produktion/p1?tab=produkte&linie=b1&produkt=x1');
    const laengeVorher = window.history.length;

    zeigeImTab(detail, 'produkte', 'x3');

    expect(window.history.length).toBe(laengeVorher);
    expect(window.location.search).toBe('?tab=produkte&linie=b1&produkt=x3');
    expect(window.history.state.trail).toEqual(trail);
    expect(detail.offen.produkte).toBe('x3');
    expect(workflow.remountWorkflowPane).toHaveBeenCalledWith(detail, 'produkte');
  });
});
