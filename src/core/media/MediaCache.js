// MediaCache
// In-Memory-Blob-Cache fuer Medien (Video/Story/Bild): laedt eine Datei einmal
// als Blob herunter und liefert beim erneuten Oeffnen sofort eine object-URL
// (kein Netz, kein erneutes Laden).
//
// Hintergrund: Dropbox-CDN-Antworten kommen mit `cache-control: max-age=60`,
// der Browser-HTTP-Cache haelt grosse Medien also nicht. Dieser Cache ueberlebt
// das Schliessen/Oeffnen des Players (modulweit, session-scoped).
//
// Key-Konvention: Der Aufrufer baut einen stabilen Content-Key
// `{typ}:{id}:{created_at}`. created_at aendert sich bei jedem Upload UND beim
// Replace (gleiche id) -> nie alte Bytes, keine Invalidierung noetig.

const DEFAULT_BUDGET_BYTES = 600 * 1024 * 1024;   // Gesamt-RAM-Budget (LRU)
const DEFAULT_MAX_FILE_BYTES = 300 * 1024 * 1024; // pro Datei nicht cachen, wenn groesser

// key -> { url, bytes, lastAccess }
const _cache = new Map();
// key -> Promise<string|null> (laufende Downloads deduplizieren)
const _inflight = new Map();

let _budgetBytes = DEFAULT_BUDGET_BYTES;
let _totalBytes = 0;
let _pinnedKey = null;

/** Setzt das Gesamt-Budget (v. a. fuer Tests). */
export function configureMediaCache({ budgetBytes } = {}) {
  if (Number.isFinite(budgetBytes) && budgetBytes >= 0) {
    _budgetBytes = budgetBytes;
    _evictIfNeeded();
  }
}

/** Leert den Cache vollstaendig und gibt alle object-URLs frei (Tests/Reset). */
export function _clearMediaCache() {
  for (const entry of _cache.values()) {
    try { URL.revokeObjectURL(entry.url); } catch (_) { /* noop */ }
  }
  _cache.clear();
  _inflight.clear();
  _totalBytes = 0;
  _pinnedKey = null;
  _budgetBytes = DEFAULT_BUDGET_BYTES;
}

/** Markiert den Key des aktuell sichtbaren Mediums – wird nie evicted/revoked. */
export function pin(key) {
  _pinnedKey = key || null;
}

export function unpin() {
  _pinnedKey = null;
}

/** Gecachte object-URL oder null. Aktualisiert die LRU-Position. */
export function getObjectUrl(key) {
  if (!key) return null;
  const entry = _cache.get(key);
  if (!entry) return null;
  entry.lastAccess = Date.now();
  return entry.url;
}

/**
 * Stellt sicher, dass die Datei als Blob im Cache liegt. Fetch-/CORS-Fehler
 * werden still verschluckt (der Player laeuft dann ueber die Stream-URL weiter).
 * Laufende Downloads desselben Keys werden dedupliziert.
 *
 * @param {string} key - stabiler Content-Key
 * @param {string} sourceUrl - aufgeloeste Stream-/Raw-URL
 * @param {{ maxBytes?: number }} [options]
 * @returns {Promise<string|null>} object-URL oder null
 */
export function ensure(key, sourceUrl, options = {}) {
  if (!key || !sourceUrl) return Promise.resolve(null);

  const existing = _cache.get(key);
  if (existing) {
    existing.lastAccess = Date.now();
    return Promise.resolve(existing.url);
  }
  if (_inflight.has(key)) return _inflight.get(key);

  const maxFileBytes = options.maxBytes || DEFAULT_MAX_FILE_BYTES;

  const promise = (async () => {
    try {
      const res = await fetch(sourceUrl);
      if (!res.ok) return null;

      // Frueh abbrechen, wenn die Datei zu gross ist (kein Voll-Download).
      const lenHeader = res.headers.get('content-length');
      if (lenHeader && Number(lenHeader) > maxFileBytes) return null;

      const blob = await res.blob();
      if (blob.size > maxFileBytes) return null;

      // Race: waehrend des Downloads koennte derselbe Key bereits gefuellt sein.
      const already = _cache.get(key);
      if (already) {
        already.lastAccess = Date.now();
        return already.url;
      }

      const url = URL.createObjectURL(blob);
      _cache.set(key, { url, bytes: blob.size, lastAccess: Date.now() });
      _totalBytes += blob.size;
      _evictIfNeeded();
      return url;
    } catch (_) {
      return null; // CORS/Netz -> still ignorieren
    } finally {
      _inflight.delete(key);
    }
  })();

  _inflight.set(key, promise);
  return promise;
}

/** LRU: aelteste Eintraege freigeben, bis das Budget eingehalten ist. */
function _evictIfNeeded() {
  if (_totalBytes <= _budgetBytes) return;
  const sorted = [..._cache.entries()].sort(
    (a, b) => a[1].lastAccess - b[1].lastAccess
  );
  for (const [key, entry] of sorted) {
    if (_totalBytes <= _budgetBytes) break;
    if (key === _pinnedKey) continue; // aktives Medium nie wegwerfen
    try { URL.revokeObjectURL(entry.url); } catch (_) { /* noop */ }
    _cache.delete(key);
    _totalBytes -= entry.bytes;
  }
}
