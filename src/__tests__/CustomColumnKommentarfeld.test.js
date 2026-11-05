import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VideoFeedbackSaveController } from '../core/videoFeedback/VideoFeedbackSaveController.js';
import { VideoFeedbackBinding } from '../modules/kampagne/VideoFeedbackBinding.js';
import { renderCustomCell, renderCustomHeader } from '../modules/kampagne/columns/CustomColumnRenderer.js';

function makeCommentField({ columnId = 'c1', entityId = 'v1', value = 'Text' } = {}) {
  const ta = document.createElement('textarea');
  ta.dataset.customColumnId = columnId;
  ta.dataset.entityId = entityId;
  ta.value = value;
  return ta;
}

describe('Kommentar-Spalte: Autosave ueber VideoFeedbackSaveController', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('erkennt Kommentarfelder eigener Spalten als editierbares Feedback-Feld', () => {
    const ta = makeCommentField();
    expect(VideoFeedbackBinding.isCustomCommentField(ta)).toBe(true);
    expect(VideoFeedbackBinding.isEditableFeedbackField(ta)).toBe(true);
    ta.readOnly = true;
    expect(VideoFeedbackBinding.isEditableFeedbackField(ta)).toBe(false);
  });

  it('speichert debounced und genau einmal ueber table.handleFieldUpdate', async () => {
    const table = { handleFieldUpdate: vi.fn(async () => true), _rowHeightSync: { schedule: vi.fn() } };
    const controller = new VideoFeedbackSaveController(table, { debounceMs: 800 });
    const field = makeCommentField({ value: 'a' });

    controller.schedule(field);
    field.value = 'ab';
    controller.schedule(field);
    expect(table.handleFieldUpdate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(800);
    expect(table.handleFieldUpdate).toHaveBeenCalledTimes(1);
    expect(table.handleFieldUpdate.mock.calls[0][0].value).toBe('ab');
  });

  it('Key unterscheidet Spalten derselben Zeile und ist dirty bis zum Save', () => {
    const table = { handleFieldUpdate: vi.fn(async () => true) };
    const controller = new VideoFeedbackSaveController(table);
    const a = makeCommentField({ columnId: 'c1' });
    const b = makeCommentField({ columnId: 'c2' });
    controller.schedule(a);
    expect(controller.isDirty('v1', 'c1', 'custom')).toBe(true);
    expect(controller.isDirty('v1', 'c2', 'custom')).toBe(false);
    expect(controller._key(a)).not.toBe(controller._key(b));
  });

  it('gleicht doppelte Textareas desselben Kommentarfeldes an', async () => {
    const table = { handleFieldUpdate: vi.fn(async () => true), _rowHeightSync: { schedule: vi.fn() } };
    const controller = new VideoFeedbackSaveController(table);
    const a = makeCommentField({ value: 'neu' });
    const b = makeCommentField({ value: 'alt' });
    document.body.append(a, b);
    await controller.flushField(a);
    expect(b.value).toBe('neu');
    a.remove(); b.remove();
  });
});

describe('Kommentar-Spalte: Rendering', () => {
  const col = {
    id: 'cc-1', uuid: 'c1', label: 'Feedback Konzept', dataCol: 'cc-c1',
    fieldType: 'comment', entityType: 'kooperation', visibleForKunden: true, editableByKunden: false
  };
  const table = (isKunde) => ({ hiddenColumns: [], isKundeRole: () => isKunde });

  beforeEach(() => {
    window.permissionSystem = { canEdit: () => true };
  });

  it('rendert eine Auto-Resize-Textarea mit Spalten-/Entity-Bezug und Breitenklasse', () => {
    const html = renderCustomCell(col, { id: 'k1' }, [], { getCustomColumnValue: () => 'Zeile1\nZeile2' }, table(false));
    expect(html).toContain('<textarea');
    expect(html).toContain('auto-resize-textarea');
    expect(html).toContain('data-custom-column-id="c1"');
    expect(html).toContain('data-entity-id="k1"');
    expect(html).toContain('col-custom-comment');
    expect(html).not.toContain(' readonly');
    expect(renderCustomHeader(col, [], false)).toContain('col-custom-comment');
  });

  it('Kunde: readonly ohne Freigabe, editierbar mit editableByKunden', () => {
    window.permissionSystem = { canEdit: () => false };
    const store = { getCustomColumnValue: () => '' };
    const ro = renderCustomCell(col, { id: 'k1' }, [], store, table(true));
    expect(ro).toContain('readonly');
    const rw = renderCustomCell({ ...col, editableByKunden: true }, { id: 'k1' }, [], store, table(true));
    expect(rw).not.toContain('readonly');
  });
});
