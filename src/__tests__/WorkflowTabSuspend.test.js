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
    _workflowLoaded: { casting: true },
    _workflowData: { skripte: [{ id: 's1' }] },
    castingWorksheet: { destroy: vi.fn() },
    kooperationenVideoTable: { updateTabCounts: vi.fn(), destroy: vi.fn() }
  };
}

describe('Workflow-Tab schließen', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('zerstört das Casting-Worksheet beim Wechsel und lädt es beim Zurückkommen neu', async () => {
    window.isAdmin = () => true;
    shell();
    const detail = detailStub();
    const destroy = detail.castingWorksheet.destroy;
    vi.spyOn(creatorAuswahlService, 'getListenByKampagneId').mockResolvedValue([]);

    await activateWorkflowTab(detail, 'produktion');

    expect(destroy).toHaveBeenCalled();
    expect(detail.castingWorksheet).toBeNull();
    expect(detail._workflowLoaded.casting).toBe(false);
    expect(document.getElementById('workflow-pane-casting').innerHTML).toBe('');
    expect(detail.kooperationenVideoTable.destroy).not.toHaveBeenCalled();
    expect(detail.kooperationenVideoTable.updateTabCounts).toHaveBeenCalled();
    expect(detail._workflowData.skripte).toEqual([{ id: 's1' }]);

    await activateWorkflowTab(detail, 'casting');

    expect(creatorAuswahlService.getListenByKampagneId).toHaveBeenCalledWith('k1', { produktionId: 'p1' });
    expect(detail._workflowLoaded.casting).toBe(true);
    expect(document.getElementById('workflow-pane-casting').textContent).toContain('Keine Casting-Liste');
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
