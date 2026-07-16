import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VideoFeedbackSaveController } from '../core/videoFeedback/VideoFeedbackSaveController.js';
import { VideoTableFieldHandler } from '../modules/kampagne/VideoTableFieldHandler.js';
import { saveVideoFeedbackSlot } from '../core/videoFeedback/VideoFeedbackRepository.js';

function makeField({ id = 'v1', field = 'feedback_kunde_r1', value = 'Hallo' } = {}) {
  const ta = document.createElement('textarea');
  ta.dataset.entity = 'video';
  ta.dataset.id = id;
  ta.dataset.field = field;
  ta.value = value;
  return ta;
}

// ------------------------------------------------------------------
// Controller: Debounce / Dedup / Flush / Force-Save / Sibling-Sync
// ------------------------------------------------------------------
describe('VideoFeedbackSaveController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeController() {
    const saved = [];
    const table = {
      handleFieldUpdate: vi.fn(async (f) => { saved.push(f.value); return true; }),
      _rowHeightSync: { schedule: vi.fn() },
    };
    const controller = new VideoFeedbackSaveController(table, { debounceMs: 800 });
    return { controller, table, saved };
  }

  it('debounced: speichert erst nach der Tipp-Pause, genau einmal', async () => {
    const { controller, table } = makeController();
    const field = makeField({ value: 'a' });

    controller.schedule(field);
    field.value = 'ab';
    controller.schedule(field);
    field.value = 'abc';
    controller.schedule(field);

    expect(table.handleFieldUpdate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(800);

    expect(table.handleFieldUpdate).toHaveBeenCalledTimes(1);
    expect(table.handleFieldUpdate.mock.calls[0][0].value).toBe('abc');
  });

  it('flushField speichert sofort (ohne auf Debounce zu warten)', async () => {
    const { controller, table } = makeController();
    const field = makeField({ value: 'sofort' });

    await controller.flushField(field);

    expect(table.handleFieldUpdate).toHaveBeenCalledTimes(1);
  });

  it('blur direkt nach Autosave loest keinen zweiten Save aus (No-op-Dedup)', async () => {
    const { controller, table } = makeController();
    const field = makeField({ value: 'fertig' });

    controller.schedule(field);
    await vi.advanceTimersByTimeAsync(800);
    expect(table.handleFieldUpdate).toHaveBeenCalledTimes(1);

    // blur mit unveraendertem Wert -> kein erneuter Save
    await controller.flushField(field);
    expect(table.handleFieldUpdate).toHaveBeenCalledTimes(1);
  });

  it('flushAll speichert offene Felder auch ohne blur (Player schliessen/Weiter)', async () => {
    const { controller, table } = makeController();
    const field = makeField({ value: 'unsaved' });

    controller.schedule(field); // Pending, noch nicht gespeichert
    await controller.flushAll();

    expect(table.handleFieldUpdate).toHaveBeenCalledTimes(1);
    expect(table.handleFieldUpdate.mock.calls[0][0].value).toBe('unsaved');
    expect(controller.hasPending()).toBe(false);
  });

  it('Fehler: setError + Toast, Retry speichert erneut', async () => {
    const errors = [];
    window.toastSystem = { error: (m) => errors.push(m) };
    let attempt = 0;
    const table = {
      handleFieldUpdate: vi.fn(async () => { attempt += 1; return attempt > 1; }),
    };
    const controller = new VideoFeedbackSaveController(table, { debounceMs: 800 });
    const setErrorSpy = vi.spyOn(controller.status, 'setError');
    const field = makeField({ value: 'x' });

    await controller.flushField(field);
    expect(setErrorSpy).toHaveBeenCalledTimes(1);
    expect(errors.length).toBe(1);

    // Retry-Callback erneut ausfuehren -> jetzt erfolgreich
    const retry = setErrorSpy.mock.calls[0][1];
    field.value = 'x2';
    await retry();
    expect(attempt).toBe(2);
  });

  it('_syncSiblings spiegelt den Wert auf doppelte Textareas desselben Feldes', async () => {
    const { controller, table } = makeController();
    const a = makeField({ value: 'neu' });
    const b = makeField({ value: 'alt' });
    document.body.append(a, b);

    await controller.flushField(a);

    expect(b.value).toBe('neu');
    expect(table._rowHeightSync.schedule).toHaveBeenCalled();
    a.remove(); b.remove();
  });

  it('isDirty: pending markiert dirty, erfolgreicher Save loescht es', async () => {
    const { controller } = makeController();
    const field = makeField({ value: 'x' });

    controller.schedule(field);
    expect(controller.isDirty('v1', 'feedback_kunde_r1')).toBe(true);

    await vi.advanceTimersByTimeAsync(800);
    expect(controller.isDirty('v1', 'feedback_kunde_r1')).toBe(false);
  });

  it('isDirty: bleibt dirty nach fehlgeschlagenem Save (Realtime-Schutz)', async () => {
    window.toastSystem = { error: () => {} };
    const table = { handleFieldUpdate: vi.fn(async () => false) };
    const controller = new VideoFeedbackSaveController(table, { debounceMs: 800 });
    const field = makeField({ value: 'x' });

    await controller.flushField(field);
    expect(controller.isDirty('v1', 'feedback_kunde_r1')).toBe(true);
  });
});

// ------------------------------------------------------------------
// Repository: zentrale Schreiblogik (Upsert / Soft-Delete)
// ------------------------------------------------------------------
describe('VideoFeedbackRepository – saveVideoFeedbackSlot', () => {
  let calls;

  function installSupabaseMock() {
    calls = [];
    const builder = {
      _op: null,
      from(t) { calls.push(['from', t]); return this; },
      upsert(payload, opts) { this._op = 'upsert'; calls.push(['upsert', payload, opts]); return this; },
      update(payload) { this._op = 'update'; calls.push(['update', payload]); return this; },
      insert(payload) { this._op = 'insert'; calls.push(['insert', payload]); return this; },
      delete() { this._op = 'delete'; calls.push(['delete']); return this; },
      select() { return this; },
      single() { return this; },
      eq() { return this; },
      is() { return this; },
      then(resolve) {
        const result = this._op === 'upsert'
          ? { data: { id: 'cmt-1', video_id: 'v1', text: 'Hallo', runde: 1, feedback_typ: 'kunde' }, error: null }
          : { data: null, error: null };
        resolve(result);
      },
    };
    window.supabase = builder;
  }

  beforeEach(() => installSupabaseMock());

  it('Text -> upsert mit onConflict, liefert row und deleted=false', async () => {
    const { row, deleted } = await saveVideoFeedbackSlot({
      videoId: 'v1',
      slot: { runde: 1, feedback_typ: 'kunde', bucket: 'kundeR1' },
      text: 'Hallo',
      user: { id: 'u1', name: 'Tester' }
    });

    expect(deleted).toBe(false);
    expect(row).toMatchObject({ id: 'cmt-1' });
    const ops = calls.map(c => c[0]);
    expect(ops).toContain('upsert');
    expect(ops).not.toContain('delete');
    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall[2]).toEqual({ onConflict: 'video_id,runde,feedback_typ' });
    expect(upsertCall[1]).toMatchObject({ deleted_at: null });
  });

  it('Leerer Text -> Soft-Delete (update), liefert row=null und deleted=true', async () => {
    const { row, deleted } = await saveVideoFeedbackSlot({
      videoId: 'v1',
      slot: { runde: 1, feedback_typ: 'kunde', bucket: 'kundeR1' },
      text: '   ',
      user: { id: 'u1', name: 'Tester' }
    });

    expect(deleted).toBe(true);
    expect(row).toBeNull();
    const ops = calls.map(c => c[0]);
    expect(ops).toContain('update');
    expect(ops).not.toContain('upsert');
    expect(ops).not.toContain('delete');
    const updateCall = calls.find(c => c[0] === 'update');
    expect(updateCall[1].deleted_at).not.toBeNull();
  });
});

// ------------------------------------------------------------------
// FieldHandler: Upsert (Text) vs. Soft-Delete (leer)
// ------------------------------------------------------------------
describe('VideoTableFieldHandler – Feedback Upsert/Soft-Delete', () => {
  let calls;

  function installSupabaseMock() {
    calls = [];
    const builder = {
      _op: null,
      from(t) { calls.push(['from', t]); return this; },
      upsert(payload, opts) { this._op = 'upsert'; calls.push(['upsert', payload, opts]); return this; },
      update(payload) { this._op = 'update'; calls.push(['update', payload]); return this; },
      insert(payload) { this._op = 'insert'; calls.push(['insert', payload]); return this; },
      delete() { this._op = 'delete'; calls.push(['delete']); return this; },
      select() { return this; },
      single() { return this; },
      eq() { return this; },
      in() { return this; },
      is() { return this; },
      then(resolve) {
        const result = this._op === 'upsert'
          ? { data: { id: 'cmt-1', video_id: 'v1', text: 'Hallo', runde: 1, feedback_typ: 'kunde' }, error: null }
          : { data: null, error: null };
        resolve(result);
      },
    };
    window.supabase = builder;
  }

  beforeEach(() => {
    installSupabaseMock();
    window.currentUser = { id: 'u1', name: 'Tester' };
  });

  function makeTable() {
    return { store: null, videoComments: {}, kampagneId: 'k1' };
  }

  it('Text vorhanden -> upsert mit onConflict, kein delete; gibt true zurueck', async () => {
    const handler = new VideoTableFieldHandler(makeTable());
    const field = makeField({ id: 'v1', field: 'feedback_kunde_r1', value: 'Hallo' });

    const ok = await handler.handleFieldUpdate(field);

    expect(ok).toBe(true);
    const ops = calls.map(c => c[0]);
    expect(ops).toContain('upsert');
    expect(ops).not.toContain('delete');

    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall[2]).toEqual({ onConflict: 'video_id,runde,feedback_typ' });
    expect(upsertCall[1]).toMatchObject({
      video_id: 'v1', runde: 1, feedback_typ: 'kunde', text: 'Hallo', deleted_at: null,
    });
  });

  it('Runde 3: feedback_cj_r3 wird auf runde 3 gemappt', async () => {
    const handler = new VideoTableFieldHandler(makeTable());
    const field = makeField({ id: 'v1', field: 'feedback_cj_r3', value: 'Runde3' });

    const ok = await handler.handleFieldUpdate(field);

    expect(ok).toBe(true);
    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall[1]).toMatchObject({
      video_id: 'v1', runde: 3, feedback_typ: 'cj', text: 'Runde3', deleted_at: null,
    });
  });

  it('Leerer Text -> update (Soft-Delete) statt Hard-Delete; gibt true zurueck', async () => {
    const handler = new VideoTableFieldHandler(makeTable());
    const field = makeField({ id: 'v1', field: 'feedback_kunde_r1', value: '   ' });

    const ok = await handler.handleFieldUpdate(field);

    expect(ok).toBe(true);
    const ops = calls.map(c => c[0]);
    expect(ops).toContain('update');
    expect(ops).not.toContain('delete');
    expect(ops).not.toContain('upsert');

    const updateCall = calls.find(c => c[0] === 'update');
    expect(updateCall[1]).toHaveProperty('deleted_at');
    expect(updateCall[1].deleted_at).not.toBeNull();
  });
});
