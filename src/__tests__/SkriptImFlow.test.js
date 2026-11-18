// SkriptImFlow.test.js
// Skript-Editor im Skripte-Tab der Produktion (ADR 0074): Ziel-URL und
// Umleitung von /skripte/:id, Skriptwahl in der Tab-Zeile, Navigation ohne
// Neuaufbau über handleRouteInPlace.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { workflow, tabUtils } = vi.hoisted(() => ({
  workflow: {
    activateWorkflowTab: vi.fn(),
    bumpPaneGen: vi.fn(),
    getVisibleWorkflowTabs: vi.fn(() => [{ id: 'skripte' }, { id: 'vertraege' }]),
    getWorkflowData: vi.fn(),
    isPaneGenCurrent: vi.fn(() => true),
    loadWorkflowPane: vi.fn(async () => {}),
    paneGeneration: vi.fn(() => 1),
    reloadWorkflowPane: vi.fn(async () => {})
  },
  tabUtils: { canViewTab: vi.fn(() => true) }
}));

vi.mock('../modules/kampagne/KampagneDetailWorkflow.js', () => workflow);
vi.mock('../modules/skripte/SkriptEditorView.js', () => ({ SkriptEditorView: vi.fn() }));
vi.mock('../modules/skripte/SkripteService.js', () => ({ skripteService: {} }));
vi.mock('../modules/creator/CreatorTable.js', () => ({ renderCreatorNameCell: () => '<td></td>' }));
vi.mock('../core/actions/ActionBuilder.js', () => ({ actionBuilder: { create: () => '' } }));
vi.mock('../core/icons/IconSystem.js', () => ({ icon: () => '<svg></svg>' }));
vi.mock('../core/TabUtils.js', () => tabUtils);

import { ladeSkriptFlowZiel, skriptFlowUrl } from '../modules/skripte/skriptFlowZiel.js';
import { replaceRouteForRedirect } from '../core/breadcrumbTrail.js';
import { renderSkriptWahl } from '../modules/kampagne/skriptWahlSwitch.js';
import { routeImSkripteTab, skriptGeloescht, skriptParam } from '../modules/kampagne/KampagneDetailSkripte.js';
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
    skriptOffenId: null,
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

describe('Navigation im Skripte-Tab ohne Neuaufbau', () => {
  it('öffnet ein Skript aus einem anderen Tab mit eigenem History-Eintrag', () => {
    const detail = produktion();
    const trail = [{ label: 'Kampagne', url: '/kampagne/k1' }];
    window.history.replaceState({ route: '/produktion/p1?tab=vertraege', trail }, '', '/produktion/p1?tab=vertraege&linie=b1');
    const laengeVorher = window.history.length;

    const erledigt = routeImSkripteTab(detail, '/produktion/p1?tab=skripte&linie=b1&skript=s1', { push: true });

    expect(erledigt).toBe(true);
    expect(window.history.length).toBe(laengeVorher + 1);
    expect(window.history.state).toEqual({ route: '/produktion/p1?tab=skripte&linie=b1&skript=s1', trail });
    expect(detail.skriptOffenId).toBe('s1');
    expect(workflow.activateWorkflowTab).toHaveBeenCalledWith(detail, 'skripte', { syncUrl: false });
  });

  it('schließt das Skript im selben Tab (Zurück) und lädt die Tabelle', async () => {
    const detail = produktion({ activeWorkflowTab: 'skripte', skriptOffenId: 's1' });

    expect(routeImSkripteTab(detail, '/produktion/p1?tab=skripte&linie=b1')).toBe(true);
    expect(detail.skriptOffenId).toBeNull();
    await vi.waitFor(() => expect(workflow.loadWorkflowPane).toHaveBeenCalledWith(detail, 'skripte'));
    expect(workflow.activateWorkflowTab).not.toHaveBeenCalled();
  });

  it('überlässt dem Router andere Produktion, andere Linie, anderen Tab und Gäste', () => {
    const detail = produktion();
    expect(routeImSkripteTab(detail, '/produktion/p2?tab=skripte&skript=s1')).toBe(false);
    expect(routeImSkripteTab(detail, '/produktion/p1?tab=skripte&linie=b2&skript=s1')).toBe(false);
    expect(routeImSkripteTab(detail, '/produktion/p1?tab=vertraege')).toBe(false);
    expect(routeImSkripteTab(produktion({ mode: 'overview' }), '/produktion/p1?tab=skripte')).toBe(false);
    window.guestShare = { entityType: 'kampagne' };
    expect(routeImSkripteTab(detail, '/produktion/p1?tab=skripte&skript=s1')).toBe(false);
    expect(detail.skriptOffenId).toBeNull();
  });

  it('überlässt dem Router den Tab, wenn der Nutzer ihn nicht sieht', () => {
    workflow.getVisibleWorkflowTabs.mockReturnValueOnce([{ id: 'vertraege' }]);
    expect(routeImSkripteTab(produktion(), '/produktion/p1?tab=skripte&skript=s1')).toBe(false);
  });

  it('liest das offene Skript aus der URL', () => {
    expect(skriptParam('?tab=skripte&skript=s9')).toBe('s9');
    expect(skriptParam('?tab=skripte')).toBeNull();
  });

  it('schließt das offene Skript, wenn es gelöscht wurde', async () => {
    window.history.replaceState({ route: '/produktion/p1?tab=skripte&skript=s1' }, '', '/produktion/p1?tab=skripte&skript=s1');
    const detail = produktion({ activeWorkflowTab: 'skripte', skriptOffenId: 's1' });

    skriptGeloescht(detail, 's1');

    expect(detail.skriptOffenId).toBeNull();
    expect(window.location.search).toBe('?tab=skripte');
    await vi.waitFor(() => expect(workflow.loadWorkflowPane).toHaveBeenCalledWith(detail, 'skripte'));
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
