// PosterCache
// Poster (Standbild) je Datei, dauerhaft im Browser (ADR 0064). Gespeichert werden die Bytes
// in IndexedDB, nie die Signed URL: die lebt nur Minuten und dient nur dem einmaligen Download.
// Key wie beim Blob-Cache (cacheKeyFor): `{typ}:{id}:{created_at}`. Replace setzt created_at
// neu, alte Bytes werden also nie ausgeliefert.
//
// Reihenfolge je Anfrage: Speicher, IndexedDB, dann gesammelt in einem Call bei poster-urls.
// Ist das Poster dort noch nicht fertig, liefert getPoster null und der Aufrufer zeigt das
// Original; nach AUSSTEHEND_MS darf erneut gefragt werden.

import { authorizedFetch } from '../auth/getAccessToken.js';
import { cacheKeyFor } from './player/mediaIdentity.js';

const ENDPOINT = '/.netlify/functions/poster-urls';
const BATCH_MS = 30;
const MAX_BATCH = 100;
const AUSSTEHEND_MS = 30 * 1000;
const OHNE_MS = 10 * 60 * 1000;
const DB_NAME = 'crm-poster';
const STORE = 'poster';
// 5.000 Poster mal ca. 30 KB: Obergrenze ~150 MB je Browser
const MAX_EINTRAEGE = 5000;
const PRUNE_DELAY_MS = 5000;
// lastAccess nur selten schreiben, sonst kostet jeder Treffer einen Schreibzugriff
const TOUCH_MS = 24 * 60 * 60 * 1000;

const CACHE_TYPE = { video: 'video', story: 'story', still: 'bild', roh: 'roh' };

const req2p = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/** Älteste Einträge (nach lastAccess) löschen, bis MAX_EINTRAEGE eingehalten ist. */
function prune(db) {
  const os = db.transaction(STORE, 'readwrite').objectStore(STORE);
  const countReq = os.count();
  countReq.onsuccess = () => {
    let zuviel = countReq.result - MAX_EINTRAEGE;
    if (zuviel <= 0) return;
    const cursorReq = os.index('lastAccess').openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor || zuviel <= 0) return;
      cursor.delete();
      zuviel -= 1;
      cursor.continue();
    };
  };
}

/** IndexedDB-Speicher. Ohne IndexedDB (privater Modus, Tests) lehnt jede Operation ab. */
export function idbStore() {
  let dbPromise = null;
  const open = () => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB fehlt')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'key' }).createIndex('lastAccess', 'lastAccess');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blockiert'));
    });
    dbPromise.then((db) => setTimeout(() => { try { prune(db); } catch { /* noop */ } }, PRUNE_DELAY_MS), () => {});
    return dbPromise;
  };
  return {
    async get(key) {
      const db = await open();
      return req2p(db.transaction(STORE).objectStore(STORE).get(key));
    },
    async put(entry) {
      const db = await open();
      return req2p(db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry));
    },
    async touch(key, lastAccess) {
      const db = await open();
      const os = db.transaction(STORE, 'readwrite').objectStore(STORE);
      const req = os.get(key);
      req.onsuccess = () => { if (req.result) os.put({ ...req.result, lastAccess }); };
    }
  };
}

/** Flüchtiger Speicher mit derselben Schnittstelle (Tests). */
export function memoryStore() {
  const map = new Map();
  return {
    map,
    async get(key) { return map.get(key) || null; },
    async put(entry) { map.set(entry.key, entry); },
    async touch(key, lastAccess) { const e = map.get(key); if (e) map.set(key, { ...e, lastAccess }); }
  };
}

async function defaultRequestUrls(items) {
  // Ohne Supabase-Client gibt es keine Sitzung; authorizedFetch würde sonst ausloggen
  if (typeof window === 'undefined' || !window.supabase) {
    throw Object.assign(new Error('Supabase fehlt'), { status: 404 });
  }
  const resp = await authorizedFetch(ENDPOINT, { method: 'POST', body: JSON.stringify({ items }) });
  if (!resp.ok) {
    const err = new Error(`poster-urls ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

async function defaultDownload(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Poster ${resp.status}`);
  const blob = await resp.blob();
  if (!blob.size) throw new Error('Poster leer');
  return blob;
}

/**
 * @param {{ store?: object, requestUrls?: Function, download?: Function, toObjectUrl?: Function,
 *   now?: () => number, schedule?: Function }} [deps]
 */
export function createPosterCache({
  store = idbStore(),
  requestUrls = defaultRequestUrls,
  download = defaultDownload,
  toObjectUrl = (blob) => URL.createObjectURL(blob),
  now = () => Date.now(),
  schedule = (fn, ms) => setTimeout(fn, ms)
} = {}) {
  /** key -> object URL (Sitzung) */
  const urls = new Map();
  /** key -> Zeitpunkt, ab dem wieder gefragt werden darf */
  const sperre = new Map();
  const inflight = new Map();
  let queue = new Map();
  let timer = null;
  // poster-urls fehlt (z. B. lokal ohne Netlify): für die Sitzung nicht mehr fragen
  let disabled = false;

  function identity(item) {
    const asset = item?.asset || item;
    const cacheType = CACHE_TYPE[item?.type];
    if (!cacheType || !asset?.id || !asset?.file_path) return null;
    const key = cacheKeyFor(cacheType, asset);
    return key ? { key, typ: item.type, id: asset.id } : null;
  }

  function remember(key, blob) {
    const url = toObjectUrl(blob);
    urls.set(key, url);
    return url;
  }

  function enqueue(eintrag, versuch = 0) {
    return new Promise((resolve) => {
      queue.set(eintrag.key, { key: eintrag.key, typ: eintrag.typ, id: eintrag.id, versuch, resolve });
      if (queue.size >= MAX_BATCH) void flush();
      else if (!timer) timer = schedule(() => void flush(), BATCH_MS);
    });
  }

  async function laden(e) {
    try {
      const blob = await download(e.url);
      await store.put({ key: e.key, blob, lastAccess: now() }).catch(() => {});
      return remember(e.key, blob);
    } catch {
      // Signed URL abgelaufen oder Netzfehler: einmal mit frischem Link
      if (e.versuch < 1) return enqueue(e, e.versuch + 1);
      sperre.set(e.key, now() + AUSSTEHEND_MS);
      return null;
    }
  }

  async function flush() {
    timer = null;
    const batch = [...queue.values()];
    queue = new Map();
    if (!batch.length) return;

    let antwort;
    try {
      antwort = await requestUrls(batch.map(({ typ, id }) => ({ typ, id })));
    } catch (err) {
      if (err?.status === 404) disabled = true;
      batch.forEach((e) => { sperre.set(e.key, now() + AUSSTEHEND_MS); e.resolve(null); });
      return;
    }

    const ausstehend = new Set(antwort?.ausstehend || []);
    await Promise.all(batch.map(async (e) => {
      const url = antwort?.posters?.[e.id];
      if (!url) {
        sperre.set(e.key, now() + (ausstehend.has(e.id) ? AUSSTEHEND_MS : OHNE_MS));
        e.resolve(null);
        return;
      }
      e.resolve(await laden({ ...e, url }));
    }));
  }

  /**
   * Object URL des Posters oder null (keins vorhanden, noch in Arbeit, kein Zugriff).
   * @param {object} item Baum-Item ({ type, asset }) oder Asset mit `type`
   * @returns {Promise<string|null>}
   */
  function get(item) {
    const ident = identity(item);
    if (!ident || disabled) return Promise.resolve(null);
    const { key } = ident;
    if (urls.has(key)) return Promise.resolve(urls.get(key));
    if ((sperre.get(key) || 0) > now()) return Promise.resolve(null);
    if (inflight.has(key)) return inflight.get(key);

    const promise = (async () => {
      const hit = await store.get(key).catch(() => null);
      if (hit?.blob) {
        if (now() - (hit.lastAccess || 0) > TOUCH_MS) store.touch(key, now()).catch(() => {});
        return remember(key, hit.blob);
      }
      return enqueue(ident);
    })().finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  /** Nur bereits geladene Poster, synchron (z. B. `poster`-Attribut beim Erzeugen des <video>). */
  function peek(item) {
    const ident = identity(item);
    return ident ? urls.get(ident.key) || null : null;
  }

  return { get, peek };
}

let standard = null;
const cache = () => (standard ||= createPosterCache());

export const getPoster = (item) => cache().get(item);
export const peekPoster = (item) => cache().peek(item);

/** Poster vieler Dateien vorab holen (ein Call für alle), z. B. beim Öffnen einer Ablage. */
export function prefetchPosters(items) {
  (items || []).forEach((item) => { cache().get(item).catch(() => {}); });
}

/** Setzt die Standard-Instanz zurück (Tests). */
export function _resetPosterCache() {
  standard = null;
}
