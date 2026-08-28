import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseJwtPayload,
  isJwtExpired,
  getGuestSession,
  saveGuestSession,
  clearGuestSession,
  clearAllGuestSessions,
  listStoredGuestSessions,
  hasStoredGuestSessions,
  syntheticGuestUser,
  applyGuestJwt,
} from '../modules/share/guestSession.js';
import App from '../core/App.js';

function makeJwt(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=+$/g, '');
  const body = btoa(JSON.stringify(payload)).replace(/=+$/g, '');
  return `${header}.${body}.sig`;
}

describe('guestSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('parseJwtPayload liest Claims', () => {
    const jwt = makeJwt({ share_id: 'abc', exp: 9999999999, name: 'Pat' });
    expect(parseJwtPayload(jwt)).toMatchObject({ share_id: 'abc', name: 'Pat' });
  });

  it('isJwtExpired erkennt abgelaufene Tokens', () => {
    expect(isJwtExpired(makeJwt({ exp: 1 }))).toBe(true);
    expect(isJwtExpired(makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }))).toBe(false);
  });

  it('speichert und lädt Session pro Token, expired fliegt raus', () => {
    const token = 'a'.repeat(32);
    saveGuestSession(token, { jwt: makeJwt({ exp: Math.floor(Date.now() / 1000) + 60 }), name: 'Pat' });
    expect(getGuestSession(token).name).toBe('Pat');
    expect(hasStoredGuestSessions()).toBe(true);

    saveGuestSession('dead'.padEnd(32, '0'), { jwt: makeJwt({ exp: 1 }), name: 'Alt' });
    const listed = listStoredGuestSessions();
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('Pat');

    clearGuestSession(token);
    expect(getGuestSession(token)).toBeNull();
    clearAllGuestSessions();
    expect(hasStoredGuestSessions()).toBe(false);
  });

  it('syntheticGuestUser hat rolle gast und id null (kein benutzer-FK)', () => {
    const user = syntheticGuestUser('Eileen', 'p1');
    expect(user).toMatchObject({ id: null, name: 'Eileen', rolle: 'gast', participant_id: 'p1' });
  });

  it('applyGuestJwt hängt den Token an den Client und an App.supabase', () => {
    const client = { from: vi.fn() };
    window.CONFIG = { SUPABASE: { URL: 'https://example.supabase.co', KEY: 'anon' } };
    window.__supabaseCreateClient = vi.fn(() => client);
    applyGuestJwt('jwt-token');
    expect(window.supabase).toBe(client);
    expect(App.get('supabase')).toBe(client);
    expect(window.__supabaseCreateClient).toHaveBeenCalled();
  });
});
