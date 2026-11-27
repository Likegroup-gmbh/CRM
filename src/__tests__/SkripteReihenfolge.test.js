import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../modules/skripte/SkripteService.js', () => ({
  skripteService: { updateSkripteSortierung: vi.fn(async () => {}) }
}));

import { skripteService } from '../modules/skripte/SkripteService.js';
import { renderSkripteTabelle } from '../modules/kampagne/KampagneDetailSkripte.js';
import { bindSkripteReihenfolge, loeseSkripteReihenfolge } from '../modules/kampagne/skripteTabelleDrag.js';

function detailMit(skripte) {
  return {
    isKunde: false,
    kampagneId: 'k1',
    produktionId: 'p1',
    linien: [],
    _workflowData: { skripte }
  };
}

const skripte = [
  { id: 'a', titel: 'Alpha', status: 'entwurf', created_at: '2026-02-02T00:00:00Z' },
  { id: 'b', titel: 'Beta', status: 'entwurf', created_at: '2026-02-01T00:00:00Z' }
];

function dragEvent(type) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  event.dataTransfer = { effectAllowed: 'move', setData() {} };
  return event;
}

describe('Skripte-Tabelle Reihenfolge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.canEdit = () => true;
    window.toastSystem = { show: vi.fn() };
    skripteService.updateSkripteSortierung.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.canEdit;
    delete window.toastSystem;
  });

  it('zeigt den Ziehgriff, wenn Skripte bearbeitet werden dürfen', async () => {
    const html = await renderSkripteTabelle(detailMit(skripte));
    expect(html).toContain('drag-handle');
    expect(html).toContain('Reihenfolge ändern');
  });

  it('zeigt keinen Ziehgriff für Kunden', async () => {
    window.canEdit = () => true;
    const detail = detailMit(skripte);
    detail.isKunde = true;
    const html = await renderSkripteTabelle(detail);
    expect(html).not.toContain('drag-handle');
  });

  it('speichert die neue Reihenfolge nach dem Ziehen', async () => {
    const detail = detailMit(skripte.map((s) => ({ ...s })));
    document.body.innerHTML = `<div id="workflow-pane-skripte">${await renderSkripteTabelle(detail)}</div>`;
    bindSkripteReihenfolge(detail);

    const [erste, zweite] = document.querySelectorAll('tr.skripte-row');
    zweite.querySelector('.drag-handle').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    zweite.dispatchEvent(dragEvent('dragstart'));
    erste.dispatchEvent(dragEvent('dragover'));
    zweite.dispatchEvent(dragEvent('dragend'));

    expect([...document.querySelectorAll('tr.skripte-row')].map((row) => row.dataset.id)).toEqual(['b', 'a']);
    await vi.waitFor(() => {
      expect(skripteService.updateSkripteSortierung).toHaveBeenCalledWith(['b', 'a']);
    });
    expect(detail._workflowData.skripte.map((s) => s.id)).toEqual(['b', 'a']);
    loeseSkripteReihenfolge(detail);
  });
});
