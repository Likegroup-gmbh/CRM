import { describe, it, expect, beforeEach, vi } from 'vitest';
import { completeKampagne, completionMessage } from '../modules/kampagne/completeKampagne.js';
import { ActionConfig } from '../core/actions/ActionConfig.js';

function supabaseFor(handlers) {
  const calls = [];
  const client = {
    calls,
    from(table) {
      const state = { table, op: 'select', payload: null, ids: null };
      const builder = {
        select() { state.op = 'select'; return builder; },
        update(payload) { state.op = 'update'; state.payload = payload; return builder; },
        eq() { return builder; },
        in(_column, ids) { state.ids = ids; return builder; },
        maybeSingle() {
          calls.push({ ...state, method: 'maybeSingle' });
          return Promise.resolve(handlers.kampagne);
        },
        then(resolve, reject) {
          const snapshot = { ...state };
          calls.push(snapshot);
          const key = snapshot.op === 'update' ? 'update' : snapshot.table;
          return Promise.resolve(handlers[key]).then(resolve, reject);
        }
      };
      return builder;
    }
  };
  return client;
}

describe('completionMessage', () => {
  it('nennt Kooperationen ohne Video', () => {
    expect(completionMessage({ koopCount: 2, ohneVideo: 1 }).text)
      .toBe('Eine Kooperation hat kein Video. Die Kampagne bleibt offen.');
    expect(completionMessage({ koopCount: 3, ohneVideo: 2 }).text)
      .toContain('2 Kooperationen haben kein Video.');
  });

  it('meldet Erfolg, wenn der Trigger die Kampagne schließt', () => {
    expect(completionMessage({ koopCount: 1, ohneVideo: 0, isCompleted: true }).type).toBe('success');
  });
});

describe('completeKampagne', () => {
  let toasts;

  beforeEach(() => {
    toasts = [];
    window.toastSystem = { show: (text, type) => toasts.push({ text, type }) };
  });

  it('gibt vorhandene Videos frei und meldet Kooperationen ohne Video', async () => {
    const supabase = supabaseFor({
      kooperationen: { data: [{ id: 'k1' }, { id: 'k2' }], error: null },
      kooperation_videos: { data: [{ id: 'v1', kooperation_id: 'k1', freigabe: false }], error: null },
      update: { error: null }
    });
    const result = await completeKampagne('kampagne-1', {
      supabase,
      confirm: async () => true,
      toast: (text, type) => toasts.push({ text, type })
    });

    expect(result.cancelled).toBe(false);
    expect(result.isCompleted).toBe(false);
    expect(result.ohneVideo).toBe(1);
    const update = supabase.calls.find((call) => call.op === 'update');
    expect(update.payload).toEqual({ freigabe: true });
    expect(update.ids).toEqual(['v1']);
    expect(toasts[0].type).toBe('warning');
    expect(toasts[0].text).toContain('Eine Kooperation hat kein Video.');
  });

  it('meldet die abgeschlossene Kampagne, wenn jedes Video freigegeben ist', async () => {
    const supabase = supabaseFor({
      kooperationen: { data: [{ id: 'k1' }], error: null },
      kooperation_videos: { data: [{ id: 'v1', kooperation_id: 'k1', freigabe: false }], error: null },
      update: { error: null },
      kampagne: { data: { is_completed: true }, error: null }
    });
    const result = await completeKampagne('kampagne-1', {
      supabase,
      confirm: async () => true,
      toast: (text, type) => toasts.push({ text, type })
    });
    expect(result.isCompleted).toBe(true);
    expect(toasts[0]).toEqual({ text: 'Kampagne abgeschlossen.', type: 'success' });
  });

  it('bricht ohne Schreiben ab, wenn der Dialog abgelehnt wird', async () => {
    const supabase = supabaseFor({});
    const result = await completeKampagne('kampagne-1', {
      supabase,
      confirm: async () => false,
      toast: (text, type) => toasts.push({ text, type })
    });
    expect(result).toEqual({ cancelled: true });
    expect(supabase.calls).toEqual([]);
    expect(toasts).toEqual([]);
  });
});

describe('Aktionsmenü Kampagne', () => {
  it('zeigt Kampagne abschließen für Admins und nicht für Kunden', () => {
    const admin = ActionConfig.get('kampagne', 'admin');
    const kunde = ActionConfig.get('kampagne', 'kunde');
    expect(admin.actions.some((action) => action.label === 'Kampagne abschließen')).toBe(true);
    expect(kunde.actions.some((action) => action.id === 'complete-kampagne')).toBe(false);
  });
});
