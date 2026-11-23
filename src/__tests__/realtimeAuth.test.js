import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  realtimeAuthAktiv,
  ensureRealtimeAuth,
  refreshRealtimeAuth,
  beiSession
} from '../core/realtimeAuth.js';
import { makeSupabase, withAuth } from './kampagneRealtimeTestKit.js';

describe('realtimeAuth', () => {
  let supabase;

  beforeEach(() => {
    vi.useFakeTimers();
    supabase = makeSupabase().supabase;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ohne Auth-API gibt es nichts zu pruefen', async () => {
    expect(realtimeAuthAktiv(supabase)).toBe(false);
    expect(await ensureRealtimeAuth(supabase)).toBe(true);
  });

  it('setzt das Token der Session am Realtime-Socket', async () => {
    withAuth(supabase, { session: { access_token: 't1' } });

    expect(await ensureRealtimeAuth(supabase)).toBe(true);
    expect(supabase.realtime.setAuth).toHaveBeenCalledWith('t1');
  });

  it('ohne Session (Gast-Client) darf nicht abonniert werden', async () => {
    withAuth(supabase, { session: null });

    expect(await ensureRealtimeAuth(supabase)).toBe(false);
    expect(supabase.realtime.setAuth).not.toHaveBeenCalled();
  });

  it('eine nicht lesbare Session zaehlt als fehlend', async () => {
    const auth = withAuth(supabase, { session: { access_token: 't1' } });
    auth.getSession.mockRejectedValueOnce(new Error('lock'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await ensureRealtimeAuth(supabase)).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it('refresh erneuert die Session vor dem Token-Setzen', async () => {
    const auth = withAuth(supabase, { session: { access_token: 'alt' } });
    auth.refreshSession.mockImplementationOnce(async () => {
      auth.session = { access_token: 'neu' };
      return { data: { session: auth.session } };
    });

    expect(await refreshRealtimeAuth(supabase)).toBe(true);
    expect(supabase.realtime.setAuth).toHaveBeenCalledWith('neu');
  });

  it('beiSession ruft einmal, entkoppelt vom Auth-Callback, und meldet sich ab', () => {
    const auth = withAuth(supabase);
    const fn = vi.fn();
    beiSession(fn, supabase);

    auth.emit('INITIAL_SESSION', null);
    auth.emit('SIGNED_OUT', null);
    expect(auth.listeners.size).toBe(1);

    auth.emit('TOKEN_REFRESHED', { access_token: 't' });
    expect(fn).not.toHaveBeenCalled();
    expect(auth.listeners.size).toBe(0);
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('beiSession laesst sich vorher abmelden', () => {
    const auth = withAuth(supabase);
    const fn = vi.fn();
    const abmelden = beiSession(fn, supabase);

    abmelden();
    auth.emit('SIGNED_IN', { access_token: 't' });
    vi.advanceTimersByTime(0);

    expect(fn).not.toHaveBeenCalled();
    expect(auth.listeners.size).toBe(0);
  });
});
