// kampagneRealtimeChannel.js
// Ein gemeinsamer Realtime-Channel pro Kampagne fuer Videotabelle und Kanban.
//
// Warum: Jeder Wechsel Tabelle/Kanban und jede Navigation hat den Channel samt
// 8 Subscriptions ab- und neu aufgebaut (realtime.subscription: tausende
// Deletes, dazu je Aufbau eine Tabellenpruefung). Hier bleibt der Channel
// ueber kurze Unterbrechungen bestehen:
//  - Listener melden sich an/ab, der Channel lebt per Referenzzaehler.
//  - Nach dem letzten Abmelden wartet er GRACE_MS, bevor er abgebaut wird.
//  - Pro Tabelle ein Event '*' statt je INSERT/UPDATE/DELETE (4 statt 8 Zeilen).
//  - Reconnect mit Backoff. Nach Reconnect und nach laengerem Hintergrund-Tab
//    bekommen die Listener onResync, damit verpasste Events nachgeladen werden
//    (Realtime liefert hoechstens einmal, nichts wird nachgeliefert).

export const GRACE_MS = 30000;
export const RECONNECT_BASE_MS = 2000;
export const RECONNECT_MAX_MS = 30000;
// Kuerzer im Hintergrund: kein Refetch, die Verbindung hat vermutlich gehalten.
export const RESYNC_AFTER_HIDDEN_MS = 20000;

const registry = new Map();
let visibilityBound = false;
let hiddenAt = null;

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
    return;
  }
  const away = hiddenAt ? Date.now() - hiddenAt : 0;
  hiddenAt = null;
  if (away < RESYNC_AFTER_HIDDEN_MS) return;
  for (const entry of registry.values()) notifyResync(entry);
}

function bindVisibility() {
  if (visibilityBound || typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', onVisibilityChange);
  visibilityBound = true;
}

function unbindVisibility() {
  if (!visibilityBound || registry.size > 0) return;
  document.removeEventListener('visibilitychange', onVisibilityChange);
  visibilityBound = false;
  hiddenAt = null;
}

function notifyResync(entry) {
  for (const listener of [...entry.listeners]) {
    try {
      listener.onResync?.();
    } catch (err) {
      console.warn('REALTIME: onResync fehlgeschlagen:', err);
    }
  }
}

function dispatch(entry, table, payload) {
  for (const listener of [...entry.listeners]) {
    try {
      listener.onChange?.(table, payload);
    } catch (err) {
      console.warn('REALTIME: Listener-Fehler:', err);
    }
  }
}

function buildChannel(entry) {
  const { kampagneId } = entry;
  const route = (table) => (payload) => dispatch(entry, table, payload);

  return window.supabase
    .channel(`kampagne-koops-videos-${kampagneId}`, {
      config: { broadcast: { self: false } }
    })
    // Videos und Kommentare lassen sich nicht nach Kampagne filtern. Die
    // Listener pruefen die Zugehoerigkeit selbst.
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kooperation_videos' }, route('kooperation_videos'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kooperation_video_comment' }, route('kooperation_video_comment'))
    // INSERT/UPDATE serverseitig auf die Kampagne filtern: Realtime prueft sonst
    // jede Aenderung aller Kampagnen per RLS pro Subscriber.
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'kooperationen',
      filter: `kampagne_id=eq.${kampagneId}`
    }, route('kooperationen'))
    // DELETE kann nicht nach Nicht-PK-Spalten filtern und bleibt ungefiltert.
    // Doppelte Zustellung ist harmlos, das Entfernen ist idempotent.
    .on('postgres_changes', {
      event: 'DELETE', schema: 'public', table: 'kooperationen'
    }, route('kooperationen'));
}

function connect(entry) {
  if (entry.channel || !window.supabase?.channel) return;

  const channel = buildChannel(entry);
  entry.channel = channel;

  channel.subscribe((status, err) => {
    // Status eines bereits ersetzten oder abgebauten Channels ignorieren.
    if (entry.channel !== channel) return;

    if (status === 'SUBSCRIBED') {
      entry.attempt = 0;
      if (entry.needsResync) {
        entry.needsResync = false;
        notifyResync(entry);
      }
      return;
    }

    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      if (status === 'CHANNEL_ERROR') console.error('REALTIME: Channel Error:', err);
      entry.needsResync = true;
      scheduleReconnect(entry);
    }
  });
}

function disconnect(entry) {
  clearTimeout(entry.reconnectTimer);
  entry.reconnectTimer = null;
  const channel = entry.channel;
  entry.channel = null;
  if (channel) window.supabase?.removeChannel?.(channel);
}

function scheduleReconnect(entry) {
  if (entry.reconnectTimer || entry.listeners.size === 0) return;
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** entry.attempt, RECONNECT_MAX_MS);
  entry.attempt += 1;
  entry.reconnectTimer = setTimeout(() => {
    entry.reconnectTimer = null;
    if (entry.listeners.size === 0) return;
    disconnect(entry);
    connect(entry);
  }, delay);
}

function teardown(entry) {
  clearTimeout(entry.graceTimer);
  entry.graceTimer = null;
  disconnect(entry);
  if (registry.get(entry.kampagneId) === entry) registry.delete(entry.kampagneId);
  unbindVisibility();
}

/**
 * Meldet einen Listener am Kampagnen-Channel an.
 * listener = { onChange(table, payload), onResync() }
 * Gibt eine Funktion zum Abmelden zurueck.
 */
export function acquireKampagneChannel(kampagneId, listener) {
  if (!kampagneId || !listener) return () => {};

  let entry = registry.get(kampagneId);
  if (!entry) {
    entry = {
      kampagneId,
      listeners: new Set(),
      channel: null,
      graceTimer: null,
      reconnectTimer: null,
      attempt: 0,
      needsResync: false
    };
    registry.set(kampagneId, entry);
  }

  clearTimeout(entry.graceTimer);
  entry.graceTimer = null;
  entry.listeners.add(listener);
  bindVisibility();
  connect(entry);

  let released = false;
  return function release() {
    if (released) return;
    released = true;
    entry.listeners.delete(listener);
    if (entry.listeners.size > 0) return;
    clearTimeout(entry.reconnectTimer);
    entry.reconnectTimer = null;
    clearTimeout(entry.graceTimer);
    entry.graceTimer = setTimeout(() => teardown(entry), GRACE_MS);
  };
}

// Nur fuer Tests: alles sofort abbauen.
export function __resetKampagneChannels() {
  for (const entry of [...registry.values()]) teardown(entry);
  registry.clear();
  unbindVisibility();
}
