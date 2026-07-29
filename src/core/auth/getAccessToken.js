// Access-Token fuer Aufrufe an Netlify Functions.
//
// Hintergrund: getSession() liefert den Token aus dem localStorage und prueft
// ihn nicht gegen den Server. Wurde die Session serverseitig entfernt - etwa
// durch einen Logout mit globalem Scope in einem anderen Tab - bleibt der Token
// bis zum Ablauf signaturgueltig. RLS-Abfragen laufen deshalb weiter, waehrend
// jede Function mit auth.getUser() in session_not_found und damit in einen 401
// laeuft. Dieser Zombie-Zustand soll nicht als kryptischer Fehler enden,
// sondern in einem sauberen Logout mit Hinweis.

/** Sekunden Puffer, ab denen ein Token vorsorglich erneuert wird */
const EXPIRY_BUFFER_SECONDS = 60;

let deadSessionHandled = false;

export class SessionExpiredError extends Error {
  constructor(message = 'Sitzung abgelaufen – bitte neu anmelden.') {
    super(message);
    this.name = 'SessionExpiredError';
    this.sessionDead = true;
  }
}

function isExpiring(session) {
  if (!session?.expires_at) return false;
  return session.expires_at - EXPIRY_BUFFER_SECONDS <= Math.floor(Date.now() / 1000);
}

/** Session erzwungen erneuern; gibt den neuen Token oder null zurueck */
export async function refreshAccessToken() {
  try {
    const { data, error } = await window.supabase.auth.refreshSession();
    if (error) {
      console.warn('Session-Refresh fehlgeschlagen:', error.message);
      return null;
    }
    return data?.session?.access_token || null;
  } catch (error) {
    console.warn('Session-Refresh fehlgeschlagen:', error);
    return null;
  }
}

/**
 * Gueltigen Access-Token holen. Ist die Session abgelaufen oder fehlt sie,
 * wird einmal refresht; bleibt es dabei, folgt ein sauberer Logout.
 * @param {{ autoLogout?: boolean }} [options]
 * @returns {Promise<string>}
 */
export async function getAccessToken({ autoLogout = true } = {}) {
  let token = null;

  try {
    const { data } = await window.supabase.auth.getSession();
    const session = data?.session;
    if (session?.access_token && !isExpiring(session)) {
      token = session.access_token;
    }
  } catch (error) {
    console.warn('Session konnte nicht gelesen werden:', error);
  }

  if (!token) token = await refreshAccessToken();
  if (token) {
    // Nach einem Login ohne Reload muss der Schutz wieder scharf sein
    deadSessionHandled = false;
    return token;
  }

  if (autoLogout) await handleDeadSession();
  throw new SessionExpiredError();
}

/**
 * Fetch auf eine Netlify Function mit Bearer-Token. Meldet die Function einen
 * 401 mit `session_dead`, wird einmal refresht und wiederholt - hilft sonst
 * nichts, landet der Nutzer auf dem Login.
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
export async function authorizedFetch(path, options = {}) {
  const token = await getAccessToken();

  const send = (bearer) => fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${bearer}`
    }
  });

  let response = await send(token);
  if (response.status !== 401) return response;

  const info = await response.clone().json().catch(() => null);
  if (!info?.session_dead) return response;

  const fresh = await refreshAccessToken();
  if (fresh && fresh !== token) {
    response = await send(fresh);
    if (response.status !== 401) return response;
  }

  await handleDeadSession(info.error);
  throw new SessionExpiredError(info.error);
}

/** Tote Session: Hinweis zeigen und zurueck auf den Login */
export async function handleDeadSession(message) {
  if (deadSessionHandled) return;
  deadSessionHandled = true;

  const text = message || 'Sitzung abgelaufen – bitte neu anmelden.';
  console.warn('Session ist serverseitig nicht mehr gueltig:', text);
  window.toastSystem?.show(text, 'error');

  try {
    if (typeof window.handleLogout === 'function') {
      await window.handleLogout();
    } else {
      await window.supabase?.auth?.signOut({ scope: 'local' });
      window.location.reload();
    }
  } catch (error) {
    console.error('Logout nach toter Session fehlgeschlagen:', error);
    window.location.reload();
  }
}
