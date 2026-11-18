// SkriptEditorEingebettet.test.js
// Editor im Skripte-Tab der Produktion (ADR 0074): keine Listenspalte, die
// Produktion bekommt Skript, Liste und Wechsel über das Einbettungs-Objekt.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockService } = vi.hoisted(() => ({
  mockService: {
    loadSkript: vi.fn(),
    loadSkripte: vi.fn(),
    getChatMessages: vi.fn(async () => []),
    getVersionen: vi.fn(async () => []),
    subscribeToChat: vi.fn(() => null),
    updateSkript: vi.fn(),
    personaLabel: vi.fn(() => ''),
    versionLabel: vi.fn((v) => `v${v?.version_nr || 1}`),
    loadAktiveModi: vi.fn(async () => []),
    loadSkriptVerknuepfungen: vi.fn(async () => [])
  }
}));

vi.mock('../modules/skripte/SkripteService.js', () => ({
  skripteService: mockService,
  FUNNEL_STUFEN: {},
  VIDEO_LAENGEN: {},
  SKRIPT_BEREICHE: {}
}));

vi.mock('../modules/skripte/SkriptList.js', () => ({
  matchesKampagne: (item, kampagneId) => item.kampagne_id === kampagneId,
  matchesLinie: (item, briefingId) => item.briefing_id === briefingId
}));

vi.mock('../core/icons/IconSystem.js', () => ({
  icon: () => '<svg></svg>'
}));

import { SkriptEditorView } from '../modules/skripte/SkriptEditorView.js';
import { setupEditorWindow, skriptFixture } from './skriptEditorTestKit.js';

const skript = skriptFixture;

describe('SkriptEditorView eingebettet', () => {
  let view;
  let container;
  let einbettung;
  const merkeKontext = vi.fn();

  beforeEach(() => {
    setupEditorWindow();
    einbettung = { zeigeSkript: vi.fn(), skriptGewechselt: vi.fn(), zeigeListe: vi.fn() };
    view = new SkriptEditorView({ _merkeKontext: merkeKontext }, { einbettung });
    container = document.createElement('div');
    document.body.appendChild(container);
    mockService.loadSkript.mockImplementation(async (id) => ({ ...skript, id }));
    mockService.loadSkripte.mockResolvedValue([
      { ...skript },
      { ...skript, id: 's2', skript_nr: 4, titel: 'Abendroutine' }
    ]);
  });

  afterEach(async () => {
    await view.cleanup();
    container.remove();
    vi.clearAllMocks();
  });

  it('rendert ohne Listenspalte und ohne "Neues Skript"', async () => {
    await view.render(container, 's1');

    expect(container.querySelector('.skripte-editor--eingebettet')).not.toBeNull();
    expect(container.querySelector('#ed-liste')).toBeNull();
    expect(container.querySelector('#ed-neu')).toBeNull();
    expect(container.querySelector('#ed-doc')).not.toBeNull();
  });

  it('gibt Skript und Liste an die Produktion statt an die eigene Breadcrumb', async () => {
    await view.render(container, 's1');

    expect(einbettung.zeigeSkript).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
    expect(window.breadcrumbSystem.updateBreadcrumb).not.toHaveBeenCalled();
    const [items, opts] = einbettung.zeigeListe.mock.calls.at(-1);
    expect(items.map((s) => s.id)).toEqual(expect.arrayContaining(['s1', 's2']));
    expect(opts.aktivId).toBe('s1');
    expect(typeof opts.verknuepfungenFuer).toBe('function');
  });

  it('meldet einen Skriptwechsel an die Produktion statt die URL selbst zu setzen', async () => {
    await view.render(container, 's1');
    await view.switchSkript('s2');

    expect(einbettung.skriptGewechselt).toHaveBeenCalledWith('s2');
    expect(merkeKontext).not.toHaveBeenCalled();
    expect(einbettung.zeigeListe.mock.calls.at(-1)[1].aktivId).toBe('s2');
  });
});
