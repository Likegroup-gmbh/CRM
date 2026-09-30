import { afterEach, describe, expect, it, vi } from 'vitest';
import { activateWorkflowTab } from '../modules/kampagne/KampagneDetailWorkflow.js';
import { creatorAuswahlService } from '../modules/creator-auswahl/CreatorAuswahlService.js';

function shell() {
  document.body.innerHTML = `
    <div class="kampagne-detail-body" data-workflow="casting">
      <div class="kampagne-workflow-tabs">
        <button class="tab-button active" data-workflow-tab="casting">Casting</button>
        <button class="tab-button" data-workflow-tab="produktion">Produktion</button>
        <button class="tab-button" data-workflow-tab="skripte">Skripte</button>
      </div>
      <div class="workflow-pane" id="workflow-pane-casting" data-pane="casting">worksheet</div>
      <div class="workflow-pane" id="workflow-pane-skripte" data-pane="skripte" hidden>skripte</div>
    </div>
  `;
}

function detailStub() {
  return {
    activeWorkflowTab: 'casting',
    currentView: 'table',
    kampagneId: 'k1',
    produktionId: 'p1',
    _isMounted: true,
    _workflowLoaded: { casting: true },
    _workflowData: { skripte: [{ id: 's1' }] },
    _castingListen: [{ id: 'L1', name: 'Casting A' }],
    castingWorksheet: {
      listeId: 'L1',
      destroy: vi.fn()
    },
    kooperationenVideoTable: { updateTabCounts: vi.fn(), destroy: vi.fn() }
  };
}

describe('Workflow-Tab schließen (Casting)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('baut das Casting-Worksheet beim Wechsel ab', async () => {
    window.isAdmin = () => true;
    shell();
    const detail = detailStub();
    const { destroy } = detail.castingWorksheet;

    await activateWorkflowTab(detail, 'produktion');

    expect(destroy).toHaveBeenCalled();
    expect(detail.castingWorksheet).toBeNull();
    expect(document.getElementById('workflow-pane-casting').innerHTML).toBe('');
    expect(detail.kooperationenVideoTable.destroy).not.toHaveBeenCalled();
    expect(detail.kooperationenVideoTable.updateTabCounts).toHaveBeenCalled();
  });

  it('mountet beim Erstbesuch über denselben Pfad', async () => {
    window.isAdmin = () => true;
    shell();
    const detail = detailStub();
    detail.castingWorksheet = null;
    detail.activeWorkflowTab = 'produktion';
    detail._workflowLoaded = {};
    vi.spyOn(creatorAuswahlService, 'getListenByKampagneId').mockResolvedValue([]);

    await activateWorkflowTab(detail, 'casting');

    expect(creatorAuswahlService.getListenByKampagneId).toHaveBeenCalledWith('k1', { produktionId: 'p1' });
    expect(document.getElementById('workflow-pane-casting').textContent).toContain('Keine Casting-Liste');
  });

  it('rendert einen fertigen Prefetch ohne zweiten Listen-Fetch und ohne Spinner', async () => {
    window.isAdmin = () => true;
    shell();
    const detail = detailStub();
    detail.castingWorksheet = null;
    detail.activeWorkflowTab = 'produktion';
    detail._workflowLoaded = {};
    detail._castingPrefetch = {
      settled: true,
      consumed: false,
      value: { listen: [], selectedId: null, worksheet: null },
      promise: Promise.resolve({ listen: [], selectedId: null, worksheet: null })
    };
    const fetchListen = vi.spyOn(creatorAuswahlService, 'getListenByKampagneId');

    await activateWorkflowTab(detail, 'casting');

    expect(fetchListen).not.toHaveBeenCalled();
    expect(detail._castingPrefetch).toBeNull();
    const pane = document.getElementById('workflow-pane-casting');
    expect(pane.textContent).toContain('Keine Casting-Liste');
    expect(pane.querySelector('.table-loading-spinner')).toBeNull();
  });

  it('verwirft einen stale Mount, wenn inzwischen weggeschaltet wurde', async () => {
    window.isAdmin = () => true;
    shell();
    const detail = detailStub();
    detail.castingWorksheet = null;
    detail.activeWorkflowTab = 'produktion';
    detail._workflowLoaded = {};

    let resolveListen;
    vi.spyOn(creatorAuswahlService, 'getListenByKampagneId')
      .mockImplementation(() => new Promise((resolve) => { resolveListen = resolve; }));

    const first = activateWorkflowTab(detail, 'casting');
    await activateWorkflowTab(detail, 'produktion');
    resolveListen([]);
    await first;

    expect(document.getElementById('workflow-pane-casting').innerHTML).toBe('');
    expect(detail._workflowLoaded.casting).toBe(false);
  });
});

describe('Workflow-Tab schließen (nicht migrierte Panes)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('leert ein HTML-Pane und behält den Daten-Cache', async () => {
    window.isAdmin = () => true;
    shell();
    const detail = detailStub();
    detail.activeWorkflowTab = 'skripte';
    detail._workflowLoaded = { skripte: true };

    await activateWorkflowTab(detail, 'produktion');

    expect(detail._workflowLoaded.skripte).toBe(false);
    expect(document.getElementById('workflow-pane-skripte').innerHTML).toBe('');
    expect(detail._workflowData.skripte).toEqual([{ id: 's1' }]);
    expect(detail.kooperationenVideoTable.destroy).not.toHaveBeenCalled();
  });
});
