// produktionFlowAltbestand.test.js
// Konzepte ohne Linie (Altbestand aus V1) gehören zur ganzen Produktion, wie ihre Kooperationen:
// der Tab Konzepte zeigt sie in jeder Linie hinter den eigenen, ein Link darauf bleibt in der
// aktiven Linie. Skripte und Casting-Listen ohne Linie bleiben beim Router.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { workflow } = vi.hoisted(() => ({
  workflow: {
    activateWorkflowTab: vi.fn((detail, tab) => { detail.activeWorkflowTab = tab; }),
    getVisibleWorkflowTabs: vi.fn(() => ['briefing', 'konzepte', 'skripte'].map(id => ({ id }))),
    remountWorkflowPane: vi.fn(async () => {}),
    bumpPaneGen: vi.fn(),
    isPaneGenCurrent: vi.fn(() => true),
    paneGeneration: vi.fn(() => 0)
  }
}));

vi.mock('../modules/kampagne/KampagneDetailWorkflow.js', () => workflow);
vi.mock('../core/icons/IconSystem.js', () => ({ icon: () => '<svg></svg>' }));
vi.mock('../modules/strategie/StrategieDetail.js', () => ({
  StrategieDetail: class { async prepareEmbedded() {} destroy() {} }
}));

import { routeImFlow } from '../modules/kampagne/produktionFlowRoute.js';
import { linieAbfragen, erkenneZiel } from '../modules/kampagne/produktionFlowZiele.js';
import { loadKonzeptPrefetch } from '../modules/kampagne/KampagneDetailKonzept.js';

const START = '/produktion/p1?tab=briefing&linie=b2';

function produktion(overrides = {}) {
  const detail = {
    mode: 'workflow',
    _isMounted: true,
    kampagneId: 'kamp',
    produktionId: 'p1',
    linieId: 'b2',
    linieAlle: false,
    linien: [{ id: 'b1' }, { id: 'b2' }],
    activeWorkflowTab: 'briefing',
    offen: {},
    ...overrides
  };
  detail.switchLinie = vi.fn(async (wert) => { detail.linieId = wert; });
  return detail;
}

function zeileDb(antwort) {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: vi.fn(async () => antwort) };
  return { from: vi.fn(() => chain) };
}

/** Konzept-Liste wie supabase-js: Kette, await liefert die Zeilen in created_at-Reihenfolge. */
function listeDb(zeilen) {
  const chain = {
    select: vi.fn(() => chain), eq: vi.fn(() => chain), order: vi.fn(() => chain), or: vi.fn(() => chain),
    then: (resolve, reject) => Promise.resolve({ data: zeilen, error: null }).then(resolve, reject)
  };
  return { from: vi.fn(() => chain), chain };
}

const ALT = { briefing_id: null, produktion_id: 'p1' };

let detail;

beforeEach(() => {
  window.history.replaceState({ route: START }, '', START);
  window.moduleRegistry = { navigateTo: vi.fn() };
});

afterEach(() => {
  if (detail) detail._isMounted = false;
  vi.clearAllMocks();
  delete window.supabase;
});

describe('Konzepte ohne Linie (Altbestand)', () => {
  it('Tab Konzepte: Konzepte der Linie zuerst, Altbestand dahinter, gewählt ist das eigene', async () => {
    detail = produktion();
    const { from, chain } = listeDb([
      { id: 'alt1', name: 'März', briefing_id: null },
      { id: 'k2', name: 'Linie 2', briefing_id: 'b2' },
      { id: 'alt2', name: 'Mai', briefing_id: null }
    ]);
    window.supabase = { from };

    const { listen, selectedId } = await loadKonzeptPrefetch(detail, 0);

    expect(chain.or).toHaveBeenCalledWith('briefing_id.eq.b2,briefing_id.is.null');
    expect(listen.map(k => k.id)).toEqual(['k2', 'alt1', 'alt2']);
    expect(selectedId).toBe('k2');
  });

  it('Link auf ein altes Konzept bleibt in der aktiven Linie und öffnet es', async () => {
    detail = produktion();
    window.supabase = zeileDb({ data: ALT, error: null });

    expect(routeImFlow(detail, '/konzepte/alt1?fokus=i1', { push: true })).toBe(true);

    await vi.waitFor(() => expect(workflow.activateWorkflowTab).toHaveBeenCalledWith(detail, 'konzepte', { syncUrl: false }));
    expect(detail.offen.konzepte).toBe('alt1');
    expect(detail.switchLinie).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?tab=konzepte&linie=b2&konzept=alt1&fokus=i1');
  });

  it('gilt nur für Konzepte der eigenen Produktion, nicht für Skripte und Casting-Listen', async () => {
    detail = produktion();
    expect(await linieAbfragen(detail, erkenneZiel('/konzepte/alt1'), zeileDb({ data: ALT, error: null }))).toBe('b2');
    expect(await linieAbfragen(detail, erkenneZiel('/konzepte/x'), zeileDb({ data: { ...ALT, produktion_id: 'p7' }, error: null }))).toBeNull();
    expect(await linieAbfragen(detail, erkenneZiel('/skripte/s1'), zeileDb({ data: ALT, error: null }))).toBeNull();
    expect(await linieAbfragen(detail, erkenneZiel('/castings/c1'), zeileDb({ data: ALT, error: null }))).toBeNull();
  });
});
