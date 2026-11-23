import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../modules/kampagne/KampagneDetailWorkflow.js', () => ({ patchWorkflowItem: vi.fn() }));
vi.mock('../modules/kampagne/skriptFreigabeSync.js', async (importOriginal) => ({
  ...(await importOriginal()),
  syncSkriptFreigabeLocal: vi.fn()
}));

import { openSkripteChannel, closeSkripteChannel } from '../modules/kampagne/kampagneSkripteChannel.js';
import { syncSkriptFreigabeLocal } from '../modules/kampagne/skriptFreigabeSync.js';
import { makeSupabase, withAuth, flush } from './kampagneRealtimeTestKit.js';

describe('kampagneSkripteChannel', () => {
  let channels;
  let supabase;
  let detail;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const made = makeSupabase();
    channels = made.channels;
    supabase = made.supabase;
    window.supabase = supabase;
    detail = { kampagneId: 'k1', _isMounted: true };
  });

  afterEach(() => {
    closeSkripteChannel(detail);
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete window.supabase;
  });

  it('abonniert UPDATEs der Kampagne erst mit Nutzer-Token', async () => {
    withAuth(supabase, { session: { access_token: 't1' } });
    const offen = openSkripteChannel(detail);
    expect(channels).toHaveLength(0);
    await offen;

    expect(supabase.realtime.setAuth).toHaveBeenCalledWith('t1');
    expect(channels[0].name).toBe('kampagne-skripte-k1');
    expect(channels[0].handlers[0].opts).toMatchObject({ event: 'UPDATE', table: 'skripte', filter: 'kampagne_id=eq.k1' });
  });

  it('Gast ohne Session: kein Abo, bis eine Session kommt', async () => {
    const auth = withAuth(supabase, { session: null });
    await openSkripteChannel(detail);
    expect(channels).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);

    auth.session = { access_token: 't2' };
    auth.emit('SIGNED_IN', auth.session);
    await flush();

    expect(channels).toHaveLength(1);
  });

  it('Schliessen waehrend der Token-Pruefung verwirft das Abo', async () => {
    withAuth(supabase, { session: { access_token: 't1' } });
    const offen = openSkripteChannel(detail);
    closeSkripteChannel(detail);
    await offen;

    expect(channels).toHaveLength(0);
  });

  it('nach "invalid column for filter" erst Session erneuern, dann neu abonnieren', async () => {
    const auth = withAuth(supabase, { session: { access_token: 't1' } });
    await openSkripteChannel(detail);

    channels[0].statusCb('CHANNEL_ERROR', new Error('invalid column for filter kampagne_id'));
    expect(supabase.removeChannel).toHaveBeenCalledWith(channels[0]);
    await vi.advanceTimersByTimeAsync(5000);

    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(channels).toHaveLength(2);
  });

  it('patcht nur bei abweichendem Status', async () => {
    await openSkripteChannel(detail);
    detail._workflowData = { skripte: [{ id: 's1', status: 'entwurf' }] };
    const cb = channels[0].handlers[0].cb;

    cb({ new: { id: 's1', status: 'entwurf' } });
    expect(syncSkriptFreigabeLocal).not.toHaveBeenCalled();

    cb({ new: { id: 's1', status: 'freigegeben' } });
    expect(syncSkriptFreigabeLocal).toHaveBeenCalledWith(
      detail, 's1', { freigegeben: true, status: 'freigegeben' }, expect.any(Function)
    );
  });
});
