// swrCache.js
// Stale-while-revalidate fuer Listen: die zuletzt geladene Seite wird sofort
// gerendert, parallel laedt die Liste frisch nach. Rein im Speicher, pro User
// getrennt, ohne DOM. Das Ergebnis der frischen Abfrage gewinnt immer.
//
//   const key = swrKey(['kampagne', page, limit, filters]);
//   const cached = swrGet(key);          // null oder zuletzt gespeicherter Wert
//   ...frisch laden...
//   swrSet(key, fresh);
//   if (cached && swrEqual(cached, fresh)) { /* kein Re-Render noetig */ }

const MAX_ENTRIES = 40;
const MAX_AGE_MS = 15 * 60 * 1000;

const store = new Map();

function currentScope() {
  return globalThis.window?.currentUser?.id || null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Key pro User. Ohne eingeloggten User gibt es keinen Key (nichts wird gecacht). */
export function swrKey(parts) {
  const scope = currentScope();
  if (!scope) return null;
  return `${scope}|${JSON.stringify(parts)}`;
}

export function swrGet(key, { maxAgeMs = MAX_AGE_MS } = {}) {
  if (!key) return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > maxAgeMs) {
    store.delete(key);
    return null;
  }
  // Frische Kopie, damit Renderer den Cache nicht verfaelschen koennen.
  return clone(entry.value);
}

export function swrSet(key, value) {
  if (!key) return;
  store.delete(key);
  store.set(key, { value: clone(value), ts: Date.now() });
  while (store.size > MAX_ENTRIES) {
    store.delete(store.keys().next().value);
  }
}

export function swrEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Beim Logout / User-Wechsel aufrufen. */
export function swrClear() {
  store.clear();
}
