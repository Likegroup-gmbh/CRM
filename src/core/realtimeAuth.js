// realtimeAuth.js
// Realtime prueft Filter und RLS mit der Rolle aus dem Token des Sockets. Ohne Nutzer-Session
// (Gast-Client mit JWT nur im fetch-Header, Session nach dem Ruhezustand noch nicht erneuert)
// laeuft ein Abo als anon: Filter auf Spalten ohne anon-Recht scheitern mit "invalid column for
// filter ...", alle anderen Abos bleiben wegen RLS stumm. Jeder Fehlversuch kostet die Datenbank
// eine Subscription-Pruefung. Deshalb erst mit Nutzer-Token abonnieren.

const SESSION_EVENTS = new Set(['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED']);

/** Ohne Auth-API (Test-Fakes) gibt es kein Token zu pruefen. */
export function realtimeAuthAktiv(supabase = window.supabase) {
  return typeof supabase?.auth?.getSession === 'function';
}

/** Setzt das Nutzer-Token am Realtime-Socket. -> true, wenn abonniert werden darf. */
export async function ensureRealtimeAuth(supabase = window.supabase) {
  if (!realtimeAuthAktiv(supabase)) return true;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return false;
    await supabase.realtime?.setAuth?.(token);
    return true;
  } catch (err) {
    console.warn('REALTIME: Session nicht lesbar:', err);
    return false;
  }
}

/** Nach einem als anon abgelehnten Abo: Session erneuern, dann Token setzen. */
export async function refreshRealtimeAuth(supabase = window.supabase) {
  try {
    await supabase?.auth?.refreshSession?.();
  } catch (err) {
    console.warn('REALTIME: Session-Refresh fehlgeschlagen:', err);
  }
  return ensureRealtimeAuth(supabase);
}

/**
 * Ruft fn einmal, sobald eine Session da ist (Login, Token-Refresh). -> Abmelden.
 * fn laeuft entkoppelt: Supabase-Aufrufe direkt im Auth-Callback koennen haengen bleiben.
 */
export function beiSession(fn, supabase = window.supabase) {
  let erledigt = false;
  let sub = null;
  const abmelden = () => {
    erledigt = true;
    sub?.data?.subscription?.unsubscribe?.();
    sub = null;
  };
  sub = supabase?.auth?.onAuthStateChange?.((event, session) => {
    if (erledigt || !SESSION_EVENTS.has(event) || !session?.access_token) return;
    abmelden();
    setTimeout(fn, 0);
  }) || null;
  if (erledigt) abmelden();
  return abmelden;
}
