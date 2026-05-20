/** Accounts mit automatischem Dev-Mode (ListenerMonitor etc.) in Production. */
export const DEV_MODE_EMAILS = new Set([
  'philip@creatorjobs.com',
]);

export function isDevModeEmail(email) {
  return Boolean(email && DEV_MODE_EMAILS.has(String(email).toLowerCase()));
}

export function getSessionEmailFromStorage() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('sb-') || !key.endsWith('-auth-token')) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const email = parsed?.user?.email ?? parsed?.currentSession?.user?.email;
      if (email) return email;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

export function shouldActivateDevMode() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true;
  if (localStorage.getItem('devMode')) return true;
  return isDevModeEmail(getSessionEmailFromStorage());
}
