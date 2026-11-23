// SkriptEditorStatus.test.js
// Status im Dokumentkopf des Editors: für das Team als Select wie in der
// Skripte-Tabelle, gespeichert mit derselben Freigabe-Regel.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockService } = vi.hoisted(() => ({
  mockService: {
    loadSkript: vi.fn(),
    loadSkripte: vi.fn(),
    getChatMessages: vi.fn(async () => []),
    getVersionen: vi.fn(async () => []),
    subscribeToChat: vi.fn(() => null),
    updateSkript: vi.fn(),
    setzeSkriptStatus: vi.fn(async () => {}),
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
import { STATUS_FELD } from '../modules/skripte/editor/SkriptEditorStatus.js';
import { skriptStatusOptions } from '../modules/skripte/skriptStatusOptions.js';
import { skripteSkriptDatenMethoden } from '../modules/skripte/service/skripteSkriptDaten.js';
import { setupEditorWindow, skriptFixture } from './skriptEditorTestKit.js';

function waehle(field, value, itemId = 's1') {
  document.dispatchEvent(new CustomEvent('table-select-change', { detail: { field, itemId, value } }));
}

const statusLabel = (container) => container.querySelector('[data-ed-status] .table-select__label')?.textContent;

describe('Status im Dokumentkopf', () => {
  let view;
  let container;

  async function oeffne(skript = {}, { intern = true } = {}) {
    setupEditorWindow({ intern });
    mockService.loadSkript.mockResolvedValue({ ...skriptFixture, ...skript });
    mockService.loadSkripte.mockResolvedValue([{ ...skriptFixture, ...skript }]);
    view = new SkriptEditorView({ _merkeKontext: () => {} });
    await view.render(container, 's1');
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    await view?.cleanup();
    container.remove();
    vi.clearAllMocks();
  });

  it('zeigt dem Team den Status als Select statt des Freigegeben-Badges', async () => {
    await oeffne({ status: 'freigegeben' });

    expect(statusLabel(container)).toBe('Freigegeben');
    expect(container.querySelector('[data-ed-status] .table-select__trigger')?.tagName).toBe('BUTTON');
    expect(container.querySelector('.skripte-badge--success')).toBeNull();
  });

  it('zeigt dem Kunden keinen Select, sondern weiter das Badge', async () => {
    await oeffne({ status: 'freigegeben' }, { intern: false });

    expect(container.querySelector('[data-ed-status]')).toBeNull();
    expect(container.querySelector('.skripte-badge--success')?.textContent).toBe('Freigegeben');
  });

  it('speichert die Wahl und zieht Kopf und Liste nach', async () => {
    await oeffne({ status: 'entwurf' });

    waehle(STATUS_FELD, 'final');
    await vi.waitFor(() => expect(mockService.setzeSkriptStatus).toHaveBeenCalledWith('s1', 'final'));

    expect(view.skript.status).toBe('final');
    expect(view.skripte[0].status).toBe('final');
    expect(statusLabel(container)).toBe('Final');
    expect(window.toastSystem.show).toHaveBeenCalledWith('Skript-Status aktualisiert', 'success');
  });

  it('nimmt den Status bei einem Fehler zurück', async () => {
    await oeffne({ status: 'entwurf' });
    mockService.setzeSkriptStatus.mockRejectedValueOnce(new Error('RLS'));

    waehle(STATUS_FELD, 'final');
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('RLS', 'error'));

    expect(view.skript.status).toBe('entwurf');
    expect(statusLabel(container)).toBe('Entwurf');
  });

  it('überhört die Status-Selects der Tabelle und fremde Skripte', async () => {
    await oeffne({ status: 'entwurf' });

    waehle('skript_status', 'final');
    waehle(STATUS_FELD, 'final', 's2');
    await Promise.resolve();

    expect(mockService.setzeSkriptStatus).not.toHaveBeenCalled();
  });

  it('hört nach dem Abbau nicht mehr zu', async () => {
    await oeffne({ status: 'entwurf' });
    await view.cleanup();

    waehle(STATUS_FELD, 'final');
    await Promise.resolve();

    expect(mockService.setzeSkriptStatus).not.toHaveBeenCalled();
  });
});

describe('Status-Optionen und Speichern', () => {
  it('lässt "Rückfragen offen" nur verlassen, nicht von Hand setzen', () => {
    const fragen = (aktuell) => skriptStatusOptions(aktuell).find((o) => o.value === 'fragen');
    expect(fragen('entwurf').disabled).toBe(true);
    expect(fragen('fragen').disabled).toBe(false);
    expect(skriptStatusOptions('entwurf').every((o) => o.color)).toBe(true);
  });

  it('setzt mit dem Status den Freigabe-Haken der Videos', async () => {
    const ctx = { updateSkript: vi.fn(async () => {}), setVideosSkriptFreigegeben: vi.fn(async () => {}) };

    await skripteSkriptDatenMethoden.setzeSkriptStatus.call(ctx, 's1', 'freigegeben');
    expect(ctx.updateSkript).toHaveBeenCalledWith('s1', { status: 'freigegeben' });
    expect(ctx.setVideosSkriptFreigegeben).toHaveBeenLastCalledWith('s1', true);

    await skripteSkriptDatenMethoden.setzeSkriptStatus.call(ctx, 's1', 'final');
    expect(ctx.setVideosSkriptFreigegeben).toHaveBeenLastCalledWith('s1', false);
  });
});
