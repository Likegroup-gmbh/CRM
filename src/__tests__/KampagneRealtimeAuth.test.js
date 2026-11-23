import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  acquireKampagneChannel,
  __resetKampagneChannels,
  RECONNECT_BASE_MS
} from '../modules/kampagne/kampagneRealtimeChannel.js';
import { makeSupabase, withAuth, setVisibility, flush } from './kampagneRealtimeTestKit.js';

// Als anon abonniert scheitert der Medien-Filter am Spaltenrecht ("invalid column for filter
// kampagne_id") und alle anderen Abos bleiben wegen RLS stumm. Abo erst mit Nutzer-Token.
describe('kampagneRealtimeChannel Auth', () => {
  let channels;
  let supabase;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const made = makeSupabase();
    channels = made.channels;
    supabase = made.supabase;
    window.supabase = supabase;
  });

  afterEach(() => {
    __resetKampagneChannels();
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete window.supabase;
    setVisibility('visible');
  });

  it('abonniert erst, nachdem das Nutzer-Token am Socket gesetzt ist', async () => {
    withAuth(supabase, { session: { access_token: 't1' } });
    acquireKampagneChannel('k1', { onChange: vi.fn() });
    expect(channels).toHaveLength(0);

    await flush();

    expect(channels.map((c) => c.name)).toEqual(['kampagne-koops-videos-k1', 'kampagne-medien-k1']);
    expect(supabase.realtime.setAuth).toHaveBeenCalledWith('t1');
    expect(supabase.realtime.setAuth.mock.invocationCallOrder[0])
      .toBeLessThan(channels[0].subscribe.mock.invocationCallOrder[0]);
  });

  it('ohne Session kein Abo und kein Retry-Takt, erst nach dem Login', async () => {
    const auth = withAuth(supabase, { session: null });
    acquireKampagneChannel('k1', { onChange: vi.fn() });
    await flush();

    expect(channels).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);

    auth.session = { access_token: 't2' };
    auth.emit('SIGNED_IN', auth.session);
    await flush();

    expect(channels).toHaveLength(2);
    expect(supabase.realtime.setAuth).toHaveBeenCalledWith('t2');
  });

  it('erneuert die Session, wenn das Abo als anon abgelehnt wurde', async () => {
    const auth = withAuth(supabase, { session: { access_token: 't1' } });
    acquireKampagneChannel('k1', { onChange: vi.fn() });
    await flush();

    channels[1].statusCb('CHANNEL_ERROR', new Error('invalid column for filter kampagne_id'));
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);

    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(channels.map((c) => c.name)).toEqual([
      'kampagne-koops-videos-k1', 'kampagne-medien-k1', 'kampagne-medien-k1'
    ]);
  });

  it('andere Fehler reconnecten ohne Session-Refresh', async () => {
    const auth = withAuth(supabase, { session: { access_token: 't1' } });
    acquireKampagneChannel('k1', { onChange: vi.fn() });
    await flush();

    channels[0].statusCb('TIMED_OUT');
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);

    expect(auth.refreshSession).not.toHaveBeenCalled();
    expect(channels).toHaveLength(3);
  });

  it('Abbau waehrend der Token-Pruefung abonniert nicht mehr', async () => {
    withAuth(supabase, { session: { access_token: 't1' } });
    acquireKampagneChannel('k1', { onChange: vi.fn() });
    __resetKampagneChannels();

    await flush();

    expect(channels).toHaveLength(0);
  });

  it('meldet das Warten auf die Session beim Abbau ab', async () => {
    const auth = withAuth(supabase, { session: null });
    acquireKampagneChannel('k1', { onChange: vi.fn() });
    await flush();
    expect(auth.listeners.size).toBe(2);

    __resetKampagneChannels();

    expect(auth.listeners.size).toBe(0);
  });
});
