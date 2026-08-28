import App from '../../core/App.js';

const STORAGE_KEY = 'cj24.guestShares';

export function parseJwtPayload(jwt) {
  try {
    const part = String(jwt || '').split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    return JSON.parse(atob(padded + pad));
  } catch {
    return null;
  }
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function isJwtExpired(jwt, nowMs = Date.now()) {
  const payload = typeof jwt === 'string' ? parseJwtPayload(jwt) : jwt;
  if (!payload?.exp) return true;
  return payload.exp * 1000 <= nowMs;
}

export function getGuestSession(token) {
  const entry = readAll()[token];
  if (!entry?.jwt) return null;
  if (isJwtExpired(entry.jwt)) {
    clearGuestSession(token);
    return null;
  }
  return entry;
}

export function saveGuestSession(token, session) {
  const all = readAll();
  all[token] = session;
  writeAll(all);
}

export function clearGuestSession(token) {
  const all = readAll();
  delete all[token];
  writeAll(all);
}

export function clearAllGuestSessions() {
  localStorage.removeItem(STORAGE_KEY);
}

export function listStoredGuestSessions() {
  return Object.entries(readAll())
    .filter(([, s]) => s?.jwt && !isJwtExpired(s.jwt))
    .map(([token, s]) => ({ token, ...s }));
}

export function hasStoredGuestSessions() {
  return listStoredGuestSessions().length > 0;
}

export function applyGuestJwt(jwt) {
  const createClient = window.__supabaseCreateClient;
  const url = window.CONFIG?.SUPABASE?.URL;
  const key = window.CONFIG?.SUPABASE?.KEY;
  if (!createClient || !url || !key) {
    throw new Error('Supabase-Client kann nicht mit Gast-JWT initialisiert werden.');
  }
  window.supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init = {}) => {
        const headers = new Headers(init.headers || {});
        headers.set('Authorization', `Bearer ${jwt}`);
        if (!headers.has('apikey')) headers.set('apikey', key);
        return window.fetch(input, { ...init, headers });
      },
    },
  });
  App.set('supabase', window.supabase);
}

export function syntheticGuestUser(name, participantId = null) {
  return {
    id: null,
    name: name || 'Gast',
    rolle: 'gast',
    email: null,
    freigeschaltet: true,
    participant_id: participantId,
  };
}
