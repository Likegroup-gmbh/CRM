// kampagneRealtimeChannel.js
// Ein gemeinsamer Realtime-Channel pro Kampagne fuer Videotabelle und Video-Browser.
//
// Warum: Jeder Wechsel Tabelle/Kanban und jede Navigation hat den Channel samt
// 8 Subscriptions ab- und neu aufgebaut (realtime.subscription: tausende
// Deletes, dazu je Aufbau eine Tabellenpruefung). Hier bleibt der Channel
// ueber kurze Unterbrechungen bestehen:
//  - Listener melden sich an/ab, der Channel lebt per Referenzzaehler.
//  - Nach dem letzten Abmelden wartet er GRACE_MS, bevor er abgebaut wird.
//  - Pro Tabelle ein Event '*' statt je INSERT/UPDATE/DELETE.
//  - Reconnect mit Backoff. Nach Reconnect und nach laengerem Hintergrund-Tab
//    bekommen die Listener onResync, damit verpasste Events nachgeladen werden
//    (Realtime liefert hoechstens einmal, nichts wird nachgeliefert).
//  - Zwei Channels (Teile) mit eigenem Reconnect: Ein abgelehntes Abo (z. B.
//    Tabelle fehlt in der Publikation) laesst den ganzen Channel scheitern.
//    Der Medien-Stand ist neu und darf Videos und Kommentare nicht mitreissen.

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

function bindKern(channel, kampagneId, route) {
  return channel
    // Videos, Kommentare und Werte eigener Spalten lassen sich nicht nach
    // Kampagne filtern. Die Listener pruefen die Zugehoerigkeit selbst.
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kooperation_videos' }, route('kooperation_videos'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kooperation_video_comment' }, route('kooperation_video_comment'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kooperation_video_zeitkommentar' }, route('kooperation_video_zeitkommentar'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kooperation_still_comment' }, route('kooperation_still_comment'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_column_values' }, route('custom_column_values'))
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

// Eine Zeile pro Kooperation, ein Trigger auf den Asset-Tabellen setzt sie:
// neue, geaenderte oder geloeschte Medien (auch aus SharePoint).
function bindMedien(channel, kampagneId, route) {
  return channel.on('postgres_changes', {
    event: '*', schema: 'public', table: 'kooperation_medien_stand',
    filter: `kampagne_id=eq.${kampagneId}`
  }, route('kooperation_medien_stand'));
}

const TEILE = [
  { key: 'kern', name: (id) => `kampagne-koops-videos-${id}`, bind: bindKern },
  { key: 'medien', name: (id) => `kampagne-medien-${id}`, bind: bindMedien }
];

function buildChannel(entry, teil) {
  const { kampagneId } = entry;
  const route = (table) => (payload) => dispatch(entry, table, payload);
  const channel = window.supabase.channel(teil.def.name(kampagneId), {
    config: { broadcast: { self: false } }
  });
  return teil.def.bind(channel, kampagneId, route);
}

function connect(entry) {
  for (const teil of entry.teile) connectTeil(entry, teil);
}

function connectTeil(entry, teil) {
  if (teil.channel || !window.supabase?.channel) return;

  const channel = buildChannel(entry, teil);
  teil.channel = channel;

  channel.subscribe((status, err) => {
    // Status eines bereits ersetzten oder abgebauten Channels ignorieren.
    if (teil.channel !== channel) return;

    if (status === 'SUBSCRIBED') {
      teil.attempt = 0;
      teil.fehlerGemeldet = false;
      if (teil.needsResync) {
        teil.needsResync = false;
        notifyResync(entry);
      }
      return;
    }

    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      // Ein abgelehntes Abo scheitert bei jedem Versuch: nur einmal bis zum naechsten Erfolg melden
      if (status === 'CHANNEL_ERROR' && !teil.fehlerGemeldet) {
        teil.fehlerGemeldet = true;
        console.error(`REALTIME: Channel Error (${teil.def.key}):`, err);
      }
      teil.needsResync = true;
      scheduleReconnect(entry, teil);
    }
  });
}

function disconnect(entry) {
  for (const teil of entry.teile) disconnectTeil(teil);
}

function disconnectTeil(teil) {
  clearTimeout(teil.reconnectTimer);
  teil.reconnectTimer = null;
  const channel = teil.channel;
  teil.channel = null;
  if (channel) window.supabase?.removeChannel?.(channel);
}

function clearReconnects(entry) {
  for (const teil of entry.teile) {
    clearTimeout(teil.reconnectTimer);
    teil.reconnectTimer = null;
  }
}

function scheduleReconnect(entry, teil) {
  if (teil.reconnectTimer || entry.listeners.size === 0) return;
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** teil.attempt, RECONNECT_MAX_MS);
  teil.attempt += 1;
  teil.reconnectTimer = setTimeout(() => {
    teil.reconnectTimer = null;
    if (entry.listeners.size === 0) return;
    disconnectTeil(teil);
    connectTeil(entry, teil);
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
      teile: TEILE.map((def) => ({
        def,
        channel: null,
        reconnectTimer: null,
        attempt: 0,
        needsResync: false,
        fehlerGemeldet: false
      })),
      graceTimer: null
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
    clearReconnects(entry);
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
