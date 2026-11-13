// ablageLink
// Lese-Link fuer Dateien in der SharePoint-Ablage. ablage-link liefert je Datei eine vorab
// authentifizierte Download-URL (~1 h gueltig, Range-faehig), direkt nutzbar als <video src>,
// <img src> und fuer Blob-Downloads. Die webUrl in file_url braucht eine Microsoft-Anmeldung
// und taugt weder zum Abspielen noch fuer Kunden.
//
// Aufrufe derselben BATCH_MS werden zu einem Call gesammelt (hoechstens MAX_BATCH Dateien),
// gleiche Dateien teilen sich die laufende Anfrage. Cache je `{typ}:{id}:{etag}` bis
// PUFFER_MS vor Ablauf; ein neues etag (Replace, Umbenennen) fragt neu.

import { authorizedFetch } from '../auth/getAccessToken.js';
import { DROPBOX_UPLOAD } from './schalter.js';

/** Spalten der Ablage an allen vier Asset-Tabellen (Migration 20261201_medienablage). */
export const ABLAGE_SELECT = 'ablage, drive_id, item_id, etag, ctag, breite, hoehe';

/** Asset-Spalten plus Ablage-Spalten; bei DROPBOX_UPLOAD ohne, die gibt es auf Live noch nicht. */
export const mitAblage = (spalten, ablageSpalten = ABLAGE_SELECT) =>
  (DROPBOX_UPLOAD ? spalten : `${spalten}, ${ablageSpalten}`);

const ENDPOINT = '/.netlify/functions/ablage-link';
const BATCH_MS = 25;
const MAX_BATCH = 100;
const PUFFER_MS = 5 * 60 * 1000;

/** key -> { url, laeuft_ab, expires } */
const cache = new Map();
/** key -> Promise */
const inflight = new Map();
let queue = new Map();
let timer = null;

/** True, wenn die Datei in SharePoint liegt (sonst Dropbox). */
export function istSharePoint(asset) {
  return asset?.ablage === 'sharepoint';
}

export function _clearAblageLinkCache() {
  cache.clear();
  inflight.clear();
  queue = new Map();
  clearTimeout(timer);
  timer = null;
}

async function requestLinks(items) {
  const resp = await authorizedFetch(ENDPOINT, { method: 'POST', body: JSON.stringify({ items }) });
  if (!resp.ok) throw new Error(`ablage-link ${resp.status}`);
  return resp.json();
}

async function flush() {
  clearTimeout(timer);
  timer = null;
  const batch = [...queue.values()];
  queue = new Map();
  if (!batch.length) return;

  const items = [...new Map(batch.map(({ typ, id }) => [`${typ}:${id}`, { typ, id }])).values()];
  let antwort;
  try {
    antwort = await requestLinks(items);
  } catch (err) {
    batch.forEach((e) => e.reject(err));
    return;
  }

  for (const e of batch) {
    // Dokument-Typen (vertrag, rechnung, ...) antworten unter `${typ}:${id}`
    const link = antwort?.links?.[e.id] ?? antwort?.links?.[`${e.typ}:${e.id}`];
    if (!link?.url) {
      e.resolve(null);
      continue;
    }
    const result = { url: link.url, laeuft_ab: link.laeuft_ab || null };
    const ablauf = Date.parse(link.laeuft_ab);
    if (Number.isFinite(ablauf)) cache.set(e.key, { ...result, expires: ablauf - PUFFER_MS });
    e.resolve(result);
  }
}

/**
 * Lese-Link einer SharePoint-Datei.
 * @param {{ typ: 'video'|'story'|'still'|'roh', id: string, etag?: string|null }} datei
 * @returns {Promise<{ url: string, laeuft_ab: string|null }|null>} null, wenn die Datei fehlt
 *          oder nicht freigegeben ist; Netz-/Serverfehler werfen
 */
export async function ablageLink({ typ, id, etag } = {}) {
  // Optimistische Zeilen (tmp-…, "Final markieren") gibt es serverseitig noch nicht
  if (!typ || !id || String(id).startsWith('tmp-')) return null;
  const key = `${typ}:${id}:${etag || ''}`;

  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return { url: hit.url, laeuft_ab: hit.laeuft_ab };
  if (hit) cache.delete(key);
  if (inflight.has(key)) return inflight.get(key);

  const promise = new Promise((resolve, reject) => {
    queue.set(key, { key, typ, id, resolve, reject });
    if (queue.size >= MAX_BATCH) void flush();
    else if (!timer) timer = setTimeout(() => void flush(), BATCH_MS);
  }).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
