// SkriptImFlow.test.js
// Skript-Editor im Skripte-Tab der Produktion (ADR 0074): Ziel-URL und
// Umleitung von /skripte/:id, Skriptwahl in der Tab-Zeile, Löschen des offenen
// Skripts, Router fragt das Modul zuerst. Die Navigation im Flow selbst
// (ADR 0079) testet produktionFlowRoute.test.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { workflow, tabUtils } = vi.hoisted(() => ({
  workflow: {
    activateWorkflowTab: vi.fn(),
    bumpPaneGen: vi.fn(),
    getVisibleWorkflowTabs: vi.fn(() => [{ id: 'skripte' }, { id: 'vertraege' }]),
    getWorkflowData: vi.fn(),
    isPaneGenCurrent: vi.fn(() => true),
    paneGeneration: vi.fn(() => 1),
    reloadWorkflowPane: vi.fn(async () => {}),
    remountWorkflowPane: vi.fn(async () => {})
  },
  tabUtils: { canViewTab: vi.fn(() => true) }
}));

vi.mock('../modules/kampagne/KampagneDetailWorkflow.js', () => workflow);
vi.mock('../modules/skripte/SkriptEditorView.js', () => ({ SkriptEditorView: vi.fn() }));
vi.mock('../modules/skripte/SkripteService.js', () => ({ skripteService: {} }));
vi.mock('../modules/creator/CreatorTable.js', () => ({ renderCreatorName: () => '' }));
vi.mock('../core/actions/ActionBuilder.js', () => ({ actionBuilder: { create: () => '' } }));
vi.mock('../core/icons/IconSystem.js', () => ({ icon: () => '<svg></svg>' }));
vi.mock('../core/TabUtils.js', () => tabUtils);

import { ladeSkriptFlowZiel, skriptFlowUrl, skriptFlowUrlSync } from '../modules/skripte/skriptFlowZiel.js';
import { replaceRouteForRedirect } from '../core/breadcrumbTrail.js';
import { renderSkriptWahl } from '../modules/kampagne/skriptWahlSwitch.js';
import { skriptGeloescht } from '../modules/kampagne/KampagneDetailSkripte.js';
import { ModuleRegistry } from '../core/ModuleRegistry.js';

function fakeDb(result) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => result
  };
  return { from: vi.fn(() => chain) };
}

function produktion(overrides = {}) {
  return {
    mode: 'workflow',
    _isMounted: true,
    produktionId: 'p1',
    linieId: 'b1',
    linien: [{ id: 'b1' }, { id: 'b2' }],
    activeWorkflowTab: 'vertraege',
    offen: {},
    skriptEditor: null,
    _updateBreadcrumb: vi.fn(),
    ...overrides
  };
}

beforeEach(() => {
  window.history.replaceState(null, '', '/produktion/p1?tab=vertraege&linie=b1');
  delete window.guestShare;
  window.isGast = () => false;
  window.permissionSystem = {};
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Ziel in der Produktion', () => {
  it('baut die Adresse aus Produktion, Linie und Skript', () => {
    expect(skriptFlowUrl({ produktionId: 'p1', linieId: 'b1', skriptId: 's1' }))
      .toBe('/produktion/p1?tab=skripte&linie=b1&skript=s1');
    expect(skriptFlowUrl({ produktionId: 'p1' })).toBe('/produktion/p1?tab=skripte');
  });

  it('leitet ein Skript mit Linie und sichtbarer Produktion um', async () => {
    const db = fakeDb({ data: { id: 's1', briefing_id: 'b1', produktion: { id: 'p1' } }, error: null });
    expect(await ladeSkriptFlowZiel('s1', db)).toBe('/produktion/p1?tab=skripte&linie=b1&skript=s1');
  });

  it('bleibt im Tool ohne Linie, ohne lesbare Produktion oder bei Fehler', async () => {
    expect(await ladeSkriptFlowZiel('s1', fakeDb({ data: { id: 's1', briefing_id: null, produktion: { id: 'p1' } } }))).toBeNull();
    expect(await ladeSkriptFlowZiel('s1', fakeDb({ data: { id: 's1', briefing_id: 'b1', produktion: null } }))).toBeNull();
    expect(await ladeSkriptFlowZiel('s1', fakeDb({ data: null, error: { message: 'boom' } }))).toBeNull();
  });

  it('bleibt im Tool für Gäste und ohne Skripte-Tab', async () => {
    const db = fakeDb({ data: { id: 's1', briefing_id: 'b1', produktion: { id: 'p1' } } });
    window.isGast = () => true;
    expect(await ladeSkriptFlowZiel('s1', db)).toBeNull();
    window.isGast = () => false;
    tabUtils.canViewTab.mockReturnValueOnce(false);
    expect(await ladeSkriptFlowZiel('s1', db)).toBeNull();
    expect(db.from).not.toHaveBeenCalled();
  });

  it('baut das Ziel ohne DB-Abfrage aus der geladenen Zeile', () => {
    const skript = { id: 's1', briefing_id: 'b1' };
    expect(skriptFlowUrlSync({ produktionId: 'p1', skript })).toBe('/produktion/p1?tab=skripte&linie=b1&skript=s1');
    expect(skriptFlowUrlSync({ produktionId: null, skript })).toBeNull();
    expect(skriptFlowUrlSync({ produktionId: 'p1', skript: { id: 's1', briefing_id: null } })).toBeNull();
    window.isGast = () => true;
    expect(skriptFlowUrlSync({ produktionId: 'p1', skript })).toBeNull();
    window.isGast = () => false;
    tabUtils.canViewTab.mockReturnValueOnce(false);
    expect(skriptFlowUrlSync({ produktionId: 'p1', skript })).toBeNull();
  });

  it('kürzt bei der Umleitung den Klickpfad bis zur Produktion', () => {
    const trail = [
      { label: 'Kampagne', url: '/kampagne/k1' },
      { label: 'Produktion', url: '/produktion/p1?tab=skripte' }
    ];
    window.history.replaceState({ route: '/skripte/s1', trail }, '', '/skripte/s1');
    replaceRouteForRedirect('/produktion/p1?tab=skripte&skript=s1');

    expect(window.location.pathname).toBe('/produktion/p1');
    expect(window.history.state.route).toBe('/produktion/p1?tab=skripte&skript=s1');
    expect(window.history.state.trail).toEqual([trail[0]]);
  });
});

describe('Skriptwahl in der Tab-Zeile', () => {
  const items = [
    { id: 's1', skript_nr: 1, titel: 'Morgenroutine', status: 'entwurf' },
    { id: 's2', skript_nr: 2, titel: 'Abendroutine', status: 'freigegeben' }
  ];

  it('zeigt "Alle Skripte" oben, das aktive Skript im Label und je Eintrag den Status', () => {
    const div = document.createElement('div');
    div.innerHTML = renderSkriptWahl({ items, aktivId: 's2' });

    const eintraege = [...div.querySelectorAll('[data-skript-wahl]')];
    expect(eintraege.map((el) => el.getAttribute('data-skript-wahl'))).toEqual(['', 's1', 's2']);
    expect(eintraege[0].textContent).toContain('Alle Skripte');
    expect(div.querySelector('.linien-switch__label').textContent).toBe('Abendroutine');
    expect(div.querySelector('.active').getAttribute('data-skript-wahl')).toBe('s2');
    expect(eintraege[1].querySelector('.tag--status')).not.toBeNull();
    expect(div.querySelector('[data-liste-switch][data-linien-switch]')).not.toBeNull();
  });
});

describe('Offenes Skript gelöscht', () => {
  it('schließt das Skript und zeigt die Tabelle der Linie', async () => {
    window.history.replaceState({ route: '/produktion/p1?tab=skripte&skript=s1' }, '', '/produktion/p1?tab=skripte&skript=s1');
    const detail = produktion({ activeWorkflowTab: 'skripte', offen: { skripte: 's1' } });

    skriptGeloescht(detail, 's1');

    expect(detail.offen.skripte).toBeNull();
    expect(window.location.search).toBe('?tab=skripte&linie=b1');
    await vi.waitFor(() => expect(workflow.remountWorkflowPane).toHaveBeenCalledWith(detail, 'skripte'));
  });

  it('vergisst das Skript in einem anderen Tab, ohne die URL anzufassen', () => {
    const detail = produktion({ offen: { skripte: 's1' } });

    skriptGeloescht(detail, 's1');

    expect(detail.offen.skripte).toBeNull();
    expect(window.location.search).toBe('?tab=vertraege&linie=b1');
    expect(workflow.remountWorkflowPane).not.toHaveBeenCalled();
  });
});

describe('Router fragt das aktive Modul zuerst', () => {
  it('baut nichts neu auf, wenn das Modul die Route selbst bedient', async () => {
    const registry = new ModuleRegistry();
    registry._doNavigate = vi.fn();
    registry.currentModule = { handleRouteInPlace: vi.fn(() => true) };

    await registry.navigateTo('/produktion/p1?tab=skripte&skript=s1');

    expect(registry.currentModule.handleRouteInPlace).toHaveBeenCalledWith('/produktion/p1?tab=skripte&skript=s1', { push: true });
    expect(registry._doNavigate).not.toHaveBeenCalled();
  });

  it('navigiert normal, wenn das Modul ablehnt, und fragt bei replace gar nicht', async () => {
    const registry = new ModuleRegistry();
    registry._confirmLeave = vi.fn(async () => true);
    registry._doNavigate = vi.fn(async () => null);
    registry.currentModule = { handleRouteInPlace: vi.fn(() => false) };

    await registry.navigateTo('/skripte/s1', true);
    expect(registry.currentModule.handleRouteInPlace).toHaveBeenCalledWith('/skripte/s1', { push: false });
    expect(registry._doNavigate).toHaveBeenCalledTimes(1);

    registry.currentModule.handleRouteInPlace.mockClear();
    await registry.navigateTo('/produktion/p1?tab=skripte', false, { replace: true });
    expect(registry.currentModule.handleRouteInPlace).not.toHaveBeenCalled();
  });

  it('fragt nicht noch einmal, wenn das Modul nach einer Abfrage selbst abgibt', async () => {
    const registry = new ModuleRegistry();
    registry._confirmLeave = vi.fn(async () => true);
    registry._doNavigate = vi.fn(async () => null);
    registry.currentModule = { handleRouteInPlace: vi.fn(() => true) };

    await registry.navigateTo('/skripte/s1', false, { ohneModulRoute: true });

    expect(registry.currentModule.handleRouteInPlace).not.toHaveBeenCalled();
    expect(registry._doNavigate).toHaveBeenCalledTimes(1);
  });
});

describe('Tab-Wechsel hält history.state.route aktuell', () => {
  it('zieht route mit, damit Zurück im richtigen Tab landet', async () => {
    const { syncTabQueryParam } = await vi.importActual('../core/TabUtils.js');
    const trail = [{ label: 'Kampagne', url: '/kampagne/k1' }];
    window.history.replaceState({ route: '/produktion/p1?tab=skripte&skript=s1', trail }, '', '/produktion/p1?tab=skripte');

    syncTabQueryParam('vertraege');

    expect(window.location.search).toBe('?tab=vertraege');
    expect(window.history.state).toEqual({ route: '/produktion/p1?tab=vertraege', trail });
  });
});
