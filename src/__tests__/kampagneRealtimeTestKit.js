// Gemeinsame Fakes fuer die Kampagnen-Realtime-Tests (Channel, Resync, Auth).
import { vi } from 'vitest';

export function makeSupabase() {
  const channels = [];
  const supabase = {
    channel: vi.fn((name) => {
      const api = {
        name,
        handlers: [],
        statusCb: null,
        on: vi.fn((_type, opts, cb) => { api.handlers.push({ opts, cb }); return api; }),
        subscribe: vi.fn((cb) => { api.statusCb = cb; return api; })
      };
      channels.push(api);
      return api;
    }),
    removeChannel: vi.fn()
  };
  return { supabase, channels };
}

/** Haengt eine Auth-API mit steuerbarer Session an; emit() spielt onAuthStateChange ab. */
export function withAuth(supabase, { session = null } = {}) {
  const listeners = new Set();
  const auth = {
    session,
    listeners,
    getSession: vi.fn(async () => ({ data: { session: auth.session } })),
    refreshSession: vi.fn(async () => ({ data: { session: auth.session } })),
    onAuthStateChange: vi.fn((cb) => {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: vi.fn(() => listeners.delete(cb)) } } };
    }),
    emit(event, s) {
      for (const cb of [...listeners]) cb(event, s);
    }
  };
  supabase.auth = auth;
  supabase.realtime = { setAuth: vi.fn(async () => {}) };
  return auth;
}

export function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Offene Promises (getSession, setAuth) unter Fake-Timern abarbeiten. */
export async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}
