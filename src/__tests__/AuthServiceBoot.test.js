import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from '../modules/auth/AuthService.js';

// Boot-Kette: getUser() und die benutzer-Zeile laufen parallel, und das
// Erst-Laden navigiert nicht selbst (main.js macht das danach).

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

function setup({ getUserResult, benutzer }) {
  const getUserGate = deferred();
  const order = [];
  const benutzerQuery = {
    select: vi.fn(() => benutzerQuery),
    eq: vi.fn(() => benutzerQuery),
    single: vi.fn(() => {
      order.push('benutzer');
      return Promise.resolve({ data: benutzer, error: null });
    }),
  };
  const permsQuery = {
    select: vi.fn(() => permsQuery),
    eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };
  const channel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) };

  window.supabase = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'auth-1', email: 'a@b.de' } } },
        error: null,
      })),
      getUser: vi.fn(() => {
        order.push('getUser');
        return getUserGate.promise;
      }),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn((table) => (table === 'benutzer' ? benutzerQuery : permsQuery)),
    channel: vi.fn(() => channel),
  };
  window.moduleRegistry = { navigateTo: vi.fn() };
  window.navigationSystem = { init: vi.fn() };
  window.setupHeaderUI = vi.fn();
  window.isKunde = () => false;
  window.canViewAccounting = () => false;

  return { getUserGate, getUserResult, order };
}

describe('AuthService.checkAuth Boot-Kette', () => {
  let auth;

  beforeEach(() => {
    auth = new AuthService();
    auth.updateHeaderForRole = vi.fn();
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.supabase;
    delete window.moduleRegistry;
    delete window.navigationSystem;
    delete window.setupHeaderUI;
    delete window.currentUser;
  });

  it('startet getUser und benutzer-Load ohne aufeinander zu warten', async () => {
    const ctx = setup({
      benutzer: { id: 'b1', rolle: 'admin', name: 'Ada', email: 'a@b.de', freigeschaltet: true },
    });

    const lauf = auth.checkAuth();
    // getUser ist noch offen, die benutzer-Query muss trotzdem schon laufen.
    await vi.waitFor(() => expect(ctx.order).toEqual(['getUser', 'benutzer']));

    ctx.getUserGate.resolve({ data: {}, error: null });
    expect(await lauf).toBe(true);
    expect(window.currentUser.id).toBe('b1');
  });

  it('navigiert und initialisiert beim Boot nicht selbst', async () => {
    const ctx = setup({
      benutzer: { id: 'b1', rolle: 'admin', name: 'Ada', email: 'a@b.de', freigeschaltet: true },
    });
    ctx.getUserGate.resolve({ data: {}, error: null });

    await auth.checkAuth();

    expect(window.moduleRegistry.navigateTo).not.toHaveBeenCalled();
    expect(window.navigationSystem.init).not.toHaveBeenCalled();
    expect(window.setupHeaderUI).not.toHaveBeenCalled();
    expect(auth.updateHeaderForRole).toHaveBeenCalledWith('admin');
  });

  it('meldet ab und lehnt ab, wenn getUser die Session verwirft', async () => {
    const ctx = setup({
      benutzer: { id: 'b1', rolle: 'admin', name: 'Ada', email: 'a@b.de', freigeschaltet: true },
    });
    ctx.getUserGate.resolve({ data: {}, error: { code: 'session_not_found', message: 'weg' } });

    expect(await auth.checkAuth()).toBe(false);
    expect(window.supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(window.currentUser).toBeUndefined();
  });

  it('loadCurrentUser ausserhalb des Boots navigiert weiter', async () => {
    setup({
      benutzer: { id: 'b1', rolle: 'admin', name: 'Ada', email: 'a@b.de', freigeschaltet: true },
    });

    await auth.loadCurrentUser('auth-1');

    expect(window.moduleRegistry.navigateTo).toHaveBeenCalledTimes(1);
    expect(window.navigationSystem.init).toHaveBeenCalledTimes(1);
  });
});
