import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const editorMock = vi.hoisted(() => ({ instanzen: [] }));

vi.mock('../modules/skripte/SkriptEditorView.js', () => ({
  SkriptEditorView: class {
    constructor() {
      this.render = vi.fn(async () => {});
      this.cleanup = vi.fn(async () => {});
      editorMock.instanzen.push(this);
    }
  }
}));

vi.mock('../modules/skripte/SkripteService.js', () => ({
  skripteService: {
    loadSkripte: vi.fn(async () => [
      { id: 's1', titel: 'Erstes', status: 'entwurf', created_at: '2026-01-02' },
      { id: 's2', titel: 'Zweites', status: 'final', created_at: '2026-01-03' }
    ]),
    updateSkript: vi.fn(),
    setVideosSkriptFreigegeben: vi.fn()
  }
}));

const { oeffneSkript } = await import('../modules/skripte/skriptOeffnen.js');
const {
  mountSkriptePane,
  oeffneSkriptImPane,
  skriptEditorOffen,
  unmountSkriptePane,
  zeigeSkriptListe
} = await import('../modules/kampagne/KampagneDetailSkripte.js');

function detailStub() {
  return {
    kampagneId: 'k1',
    produktionId: 'p1',
    linieId: 'b1',
    linien: [{ id: 'b1', name: 'Linie 1' }],
    kampagneData: { unternehmen_id: 'u1' },
    activeWorkflowTab: 'skripte',
    isKunde: false,
    _workflowData: {}
  };
}

function aktuellerEditor() {
  return editorMock.instanzen[editorMock.instanzen.length - 1];
}

describe('Skripte-Tab der Kampagne', () => {
  beforeEach(() => {
    editorMock.instanzen.length = 0;
    document.body.innerHTML = '<div class="workflow-pane" id="workflow-pane-skripte" data-pane="skripte"></div>';
    window.history.replaceState({}, '', '/produktion/p1?tab=skripte');
    window.navigateTo = vi.fn();
    window.canEdit = () => true;
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('zeigt ohne ?skript= die Tabelle', async () => {
    await mountSkriptePane(detailStub());

    expect(document.querySelectorAll('.data-table--skripte tbody tr')).toHaveLength(2);
    expect(skriptEditorOffen(detailStub())).toBe(false);
  });

  it('öffnet den Editor im Pane, ohne die Seite zu wechseln', async () => {
    const detail = detailStub();
    await oeffneSkriptImPane(detail, 's2');

    const pane = document.getElementById('workflow-pane-skripte');
    expect(pane.querySelector('[data-skripte-editor]')).not.toBeNull();
    expect(pane.querySelector('.data-table--skripte')).toBeNull();
    expect(aktuellerEditor().render).toHaveBeenCalledWith(
      pane.querySelector('[data-skripte-editor]'),
      's2',
      expect.objectContaining({ einbettung: expect.any(Object) })
    );
    expect(new URLSearchParams(window.location.search).get('skript')).toBe('s2');
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('skripte');
    expect(window.navigateTo).not.toHaveBeenCalled();
    expect(skriptEditorOffen(detail)).toBe(true);
  });

  it('merkt sich beim Skript-Wechsel im Editor die URL', async () => {
    const detail = detailStub();
    await oeffneSkriptImPane(detail, 's1');
    const { einbettung } = aktuellerEditor().render.mock.calls[0][2];

    einbettung.onSkriptChange('s2');

    expect(new URLSearchParams(window.location.search).get('skript')).toBe('s2');
    expect(detail._skriptOffenId).toBe('s2');
  });

  it('legt neue Skripte mit dem Kontext der Produktion an', async () => {
    const detail = detailStub();
    await oeffneSkriptImPane(detail, 's1');
    const { einbettung } = aktuellerEditor().render.mock.calls[0][2];

    expect(einbettung.neuPrefill()).toMatchObject({
      unternehmen_id: 'u1',
      kampagne_id: 'k1',
      produktion_id: 'p1',
      briefing_id: 'b1'
    });
  });

  it('„Alle Skripte“ führt zurück zur Tabelle und räumt URL und Editor ab', async () => {
    const detail = detailStub();
    await oeffneSkriptImPane(detail, 's1');
    const editor = aktuellerEditor();

    document.querySelector('[data-skripte-zurueck]').click();
    await vi.waitFor(() => expect(document.querySelector('.data-table--skripte')).not.toBeNull());

    expect(editor.cleanup).toHaveBeenCalled();
    expect(skriptEditorOffen(detail)).toBe(false);
    expect(new URLSearchParams(window.location.search).has('skript')).toBe(false);
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('skripte');
  });

  it('Löschen im Editor (onClose) führt zur Tabelle', async () => {
    const detail = detailStub();
    await oeffneSkriptImPane(detail, 's1');
    const { einbettung } = aktuellerEditor().render.mock.calls[0][2];

    einbettung.onClose();
    await vi.waitFor(() => expect(document.querySelector('.data-table--skripte')).not.toBeNull());

    expect(window.navigateTo).not.toHaveBeenCalled();
  });

  it('öffnet beim Laden das Skript aus ?skript=', async () => {
    window.history.replaceState({}, '', '/produktion/p1?tab=skripte&skript=s2');
    const detail = detailStub();

    await mountSkriptePane(detail);

    expect(aktuellerEditor().render).toHaveBeenCalledWith(expect.anything(), 's2', expect.anything());
    expect(skriptEditorOffen(detail)).toBe(true);
  });

  it('fällt bei einem fremden Skript in ?skript= auf die Tabelle zurück', async () => {
    window.history.replaceState({}, '', '/produktion/p1?tab=skripte&skript=fremd');
    const detail = detailStub();

    await mountSkriptePane(detail);

    expect(editorMock.instanzen).toHaveLength(0);
    expect(document.querySelector('.data-table--skripte')).not.toBeNull();
    expect(new URLSearchParams(window.location.search).has('skript')).toBe(false);
  });

  it('Tab verlassen baut den Editor ab und nimmt ?skript= aus der URL', async () => {
    const detail = detailStub();
    await oeffneSkriptImPane(detail, 's1');
    const editor = aktuellerEditor();

    unmountSkriptePane(detail, { url: true });

    await vi.waitFor(() => expect(editor.cleanup).toHaveBeenCalled());
    expect(skriptEditorOffen(detail)).toBe(false);
    expect(new URLSearchParams(window.location.search).has('skript')).toBe(false);
  });

  it('lädt die Tabelle nach dem Editor frisch', async () => {
    const detail = detailStub();
    detail._workflowData.skripte = [{ id: 'alt', titel: 'Veraltet', status: 'entwurf' }];

    await zeigeSkriptListe(detail);

    expect(document.querySelectorAll('.data-table--skripte tbody tr')).toHaveLength(2);
  });
});

describe('oeffneSkript', () => {
  beforeEach(() => {
    window.navigateTo = vi.fn();
  });

  it('geht ohne Host auf die Skript-Seite', () => {
    oeffneSkript('s1');
    expect(window.navigateTo).toHaveBeenCalledWith('/skripte/s1');
  });

  it('bleibt im Host, wenn der das Event abfängt', () => {
    const handler = (e) => e.preventDefault();
    window.addEventListener('skript-oeffnen', handler);
    oeffneSkript('s1');
    window.removeEventListener('skript-oeffnen', handler);
    expect(window.navigateTo).not.toHaveBeenCalled();
  });
});
