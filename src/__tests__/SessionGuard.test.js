// Tests fuer den Zombie-Session-Schutz:
//   1. Server: verify-auth liefert den Grund statt eines anonymen 401
//   2. Client: authorizedFetch refresht einmal und loggt sonst sauber aus
//
// Hintergrund: Ein Logout mit globalem Scope loescht die Session-Zeile fuer
// alle Geraete. Der Token im anderen Tab bleibt bis zum Ablauf signaturgueltig,
// RLS-Abfragen laufen also weiter - nur auth.getUser() in den Netlify Functions
// antwortet mit session_not_found.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { authErrorBody } = require('../../netlify/functions/_shared/verify-auth.js');

describe('verify-auth – Fehlerkoerper', () => {
  it('macht aus session_not_found eine verstaendliche Meldung', () => {
    const body = authErrorBody({ code: 'session_not_found', error: 'Session from session_id claim in JWT does not exist' });

    expect(body.error).toBe('Sitzung abgelaufen – bitte neu anmelden.');
    expect(body.code).toBe('session_not_found');
    expect(body.session_dead).toBe(true);
    expect(body.detail).toContain('session_id');
  });

  it('markiert einen fehlenden Token ebenfalls als tote Session', () => {
    const body = authErrorBody({ code: 'no_token', error: 'Kein Token im Authorization-Header' });

    expect(body.session_dead).toBe(true);
  });

  it('laesst unbekannte Codes generisch, ohne Logout zu erzwingen', () => {
    const body = authErrorBody({ code: 'invalid_token', error: 'irgendwas' });

    expect(body.error).toBe('Nicht autorisiert');
    expect(body.session_dead).toBe(false);
  });
});

describe('authorizedFetch – tote Session', () => {
  let authorizedFetch;
  let getAccessToken;
  let refreshCalls;

  const futureSession = (token) => ({
    access_token: token,
    expires_at: Math.floor(Date.now() / 1000) + 3600
  });

  function setupSupabase({ session, refreshed }) {
    refreshCalls = 0;
    window.supabase = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session }, error: null })),
        refreshSession: vi.fn(async () => {
          refreshCalls += 1;
          return refreshed
            ? { data: { session: futureSession(refreshed) }, error: null }
            : { data: { session: null }, error: { message: 'refresh_token_not_found' } };
        }),
        signOut: vi.fn(async () => ({ error: null }))
      }
    };
  }

  function deadResponse() {
    return new Response(
      JSON.stringify({ error: 'Sitzung abgelaufen – bitte neu anmelden.', code: 'session_not_found', session_dead: true }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  beforeEach(async () => {
    vi.resetModules();
    ({ authorizedFetch, getAccessToken } = await import('../core/auth/getAccessToken.js'));
    window.handleLogout = vi.fn(async () => {});
    window.toastSystem = { show: vi.fn() };
  });

  afterEach(() => {
    delete window.supabase;
    delete window.handleLogout;
    delete window.toastSystem;
    vi.unstubAllGlobals();
  });

  it('schickt den Bearer-Token der aktiven Session mit', async () => {
    setupSupabase({ session: futureSession('tok-1') });
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await authorizedFetch('/.netlify/functions/x', { method: 'POST', body: '{}' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-1');
    expect(refreshCalls).toBe(0);
  });

  it('erneuert einen ablaufenden Token vor dem Request', async () => {
    setupSupabase({
      session: { access_token: 'alt', expires_at: Math.floor(Date.now() / 1000) + 5 },
      refreshed: 'neu'
    });

    await expect(getAccessToken()).resolves.toBe('neu');
    expect(refreshCalls).toBe(1);
  });

  it('wiederholt den Request einmal, wenn der Refresh eine neue Session bringt', async () => {
    setupSupabase({ session: futureSession('tot'), refreshed: 'frisch' });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(deadResponse())
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await authorizedFetch('/.netlify/functions/x', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer frisch');
    expect(window.handleLogout).not.toHaveBeenCalled();
  });

  it('loggt aus und wirft sessionDead, wenn auch der Refresh scheitert', async () => {
    setupSupabase({ session: futureSession('tot'), refreshed: null });
    vi.stubGlobal('fetch', vi.fn(async () => deadResponse()));

    await expect(authorizedFetch('/.netlify/functions/x', { method: 'POST' }))
      .rejects.toMatchObject({ sessionDead: true });

    expect(window.handleLogout).toHaveBeenCalledTimes(1);
    expect(window.toastSystem.show).toHaveBeenCalledWith('Sitzung abgelaufen – bitte neu anmelden.', 'error');
  });

  it('laesst einen 401 ohne session_dead unangetastet durch', async () => {
    setupSupabase({ session: futureSession('tok') });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'Nicht autorisiert', code: 'invalid_token', session_dead: false }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )));

    const response = await authorizedFetch('/.netlify/functions/x', { method: 'POST' });

    expect(response.status).toBe(401);
    expect(window.handleLogout).not.toHaveBeenCalled();
  });
});
