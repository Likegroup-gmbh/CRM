// videoBrowserMedia.js
// Schnelles Laden der Medien im Videos-Tab. Nutzt dieselben Bausteine wie der Medien-Player
// (core/media): Temp-Link-Cache, Blob-Cache und Content-Keys.
//
// - Quelle: Blob aus dem Cache, sonst die Vorschaudatei (nur wenn der Adapter
//   `vorschau_bereit` gesetzt hat, also Revision passt und Rollout an ist), sonst das
//   Original. Fehlt der Vorschau-Link, wird das Original gestreamt.
// - Link vorab auflösen: beim Öffnen einer Ablage für alle Dateien darin. Vorschau-Links
//   kommen für den ganzen Ordner in einem Call und gelten für die Token-Laufzeit,
//   Dropbox-Links einzeln über den Temp-Link-Cache.
// - Nachbarn vorwärmen: eine Datei nach der anderen, Videos nur bis zu den Metadaten
//   (Verbindung, Moov-Box, erstes Bild), Standbilder ganz in den Blob-Cache. Das aktive Video
//   lädt nur der Player selbst, als Stream: ein zweiter Voll-Download würde ihm die
//   Bandbreite nehmen.

import { resolveStreamUrl, prefetchStreamUrl } from '../../core/media/mediaSrc.js';
import * as MediaCache from '../../core/media/MediaCache.js';
import { authorizedFetch } from '../../core/auth/getAccessToken.js';
import { cacheKeyFor, isRiskyFormat, lookupFor, lookupPath } from '../../core/media/player/mediaIdentity.js';

const CACHE_TYPE = { video: 'video', story: 'story', still: 'bild' };
const MAX_PREFETCH = 8;
const DROPBOX_HOSTS = ['https://dl.dropboxusercontent.com', 'https://www.dropbox.com'];
const VORSCHAU_ENDPOINT = '/.netlify/functions/vorschau-link';
/** Vorschau-Link so lange vor Ablauf neu holen: jeder Range-Request braucht ein gültiges Token. */
const VORSCHAU_MARGIN_MS = 30 * 60 * 1000;
/** Kein Link (noch nicht fertig, kein Zugriff) oder abgebrochen: so lange Original. */
const VORSCHAU_NEGATIV_MS = 2 * 60 * 1000;
const VORSCHAU_FEHLER_MS = 10 * 60 * 1000;
/** Länger wartet das erste Bild nicht auf den Vorschau-Link, dann Original. */
const VORSCHAU_WARTEN_MS = 3000;

let preconnected = false;
const preconnectedOrigins = new Set();

function preconnect(href) {
  if (typeof document === 'undefined' || preconnectedOrigins.has(href)) return;
  preconnectedOrigins.add(href);
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = href;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

/** Verbindung zu Dropbox schon vor dem ersten Klick aufbauen (einmalig). */
export function preconnectMedia() {
  if (preconnected) return;
  preconnected = true;
  DROPBOX_HOSTS.forEach(preconnect);
}

/** Datei-Infos eines Baum-Items (oder direkt eines Assets). */
export function mediaOf(item) {
  const record = item?.asset || item || {};
  const lookup = lookupFor(record);
  const type = CACHE_TYPE[item?.type] || null;
  const key = type ? cacheKeyFor(type, record) : null;
  const vorschau = item?.type === 'video' && !!record.vorschau_bereit && !!record.id;
  return {
    record,
    lookup,
    key,
    // Eigener Content-Key: Vorschaudatei und Original sind verschiedene Bytes.
    vorschauKey: vorschau && key ? `${key}:vorschau` : null,
    vorschau,
    risky: !vorschau && isRiskyFormat(lookupPath(lookup)),
    hasSource: !!lookupPath(lookup)
  };
}

/** Blob-URL, wenn die Datei schon im Cache liegt (sofort nutzbar, kein Warten). */
export function cachedUrl(item) {
  const { key } = mediaOf(item);
  return key ? MediaCache.getObjectUrl(key) : null;
}

/* ---- Vorschau-Links ---- */

/** assetId -> { url|null, refreshAt } */
const vorschauLinks = new Map();
/** assetId -> laufender Batch */
const vorschauInflight = new Map();

const gueltig = (entry) => !!entry && Date.now() < entry.refreshAt;
const negativ = (id, ms) => vorschauLinks.set(id, { url: null, refreshAt: Date.now() + ms });

async function ladeVorschauLinks(ids) {
  const resp = await authorizedFetch(VORSCHAU_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ assetIds: ids })
  });
  if (!resp.ok) throw new Error(`vorschau-link ${resp.status}`);
  const { links = {}, ttlSec = 0 } = await resp.json();
  const ttlMs = ttlSec * 1000;
  const refreshAt = Date.now() + ttlMs - Math.min(VORSCHAU_MARGIN_MS, ttlMs / 2);
  for (const id of ids) {
    if (links[id]) vorschauLinks.set(id, { url: links[id], refreshAt });
    else negativ(id, VORSCHAU_NEGATIV_MS);
  }
  const first = Object.values(links)[0];
  if (first) preconnect(new URL(first).origin);
}

/** Vorschau-Links für mehrere Assets in einem Call (bereits gültige und laufende werden nicht erneut geholt). */
function holeVorschauLinks(ids) {
  const fehlend = ids.filter((id) => !gueltig(vorschauLinks.get(id)) && !vorschauInflight.has(id));
  if (fehlend.length) {
    const batch = ladeVorschauLinks(fehlend)
      .catch((err) => console.warn('[Video-Cache] Vorschau-Links nicht geladen:', err.message))
      .finally(() => fehlend.forEach((id) => vorschauInflight.delete(id)));
    fehlend.forEach((id) => vorschauInflight.set(id, batch));
  }
  return Promise.all(ids.map((id) => vorschauInflight.get(id))).then(() => {});
}

async function vorschauUrl(record) {
  if (!gueltig(vorschauLinks.get(record.id))) {
    let timer = null;
    const timeout = new Promise((resolve) => { timer = setTimeout(resolve, VORSCHAU_WARTEN_MS); });
    await Promise.race([holeVorschauLinks([record.id]), timeout]);
    clearTimeout(timer);
  }
  const entry = vorschauLinks.get(record.id);
  return gueltig(entry) ? entry.url : null;
}

/**
 * Abspielbare Quelle einer Datei. Vorschaudatei nur bei `vorschau_bereit`, sonst und bei
 * jedem Problem mit dem Vorschau-Link das Original.
 * @param {object} item
 * @param {{ original?: boolean }} [opts] original: Vorschau überspringen (nach Fehler)
 * @returns {Promise<{ url: string|null, quelle: 'vorschau'|'original' }>}
 */
export async function resolveSource(item, { original = false } = {}) {
  const media = mediaOf(item);
  if (media.vorschau && !original) {
    const url = await vorschauUrl(media.record);
    if (url) return { url, quelle: 'vorschau' };
  }
  const url = await resolveStreamUrl(media.lookup);
  return { url: url || null, quelle: 'original' };
}

/** Vorschau-Link einer Datei verwerfen (Abspielen schlug fehl): eine Weile nur Original. */
export function dropVorschauLink(item) {
  const { record } = mediaOf(item);
  if (record.id) negativ(record.id, VORSCHAU_FEHLER_MS);
}

/** Netz-URL einer Datei (Vorschau oder Original). */
export function networkUrl(item) {
  return resolveSource(item).then((s) => s.url);
}

/** Nur für Tests */
export function _resetVorschauLinks() {
  vorschauLinks.clear();
  vorschauInflight.clear();
}

/**
 * Links aller abspielbaren Dateien vorab auflösen (billig). Vorschau-Links des Ordners in
 * einem Call, Dropbox-Temp-Links nur für Dateien ohne Vorschaudatei.
 */
export function prefetchLinks(items) {
  preconnectMedia();
  const vorschauIds = [];
  let n = 0;
  for (const item of items || []) {
    if (!CACHE_TYPE[item?.type]) continue;
    const { record, hasSource, vorschau } = mediaOf(item);
    if (vorschau) {
      vorschauIds.push(record.id);
      continue;
    }
    if (!hasSource || n >= MAX_PREFETCH) continue;
    prefetchStreamUrl(record);
    n += 1;
  }
  if (vorschauIds.length) holeVorschauLinks(vorschauIds);
}

const WARM_TIMEOUT_MS = 8000;
let warmRun = 0;
let warmHost = null;
/** key -> verstecktes <video preload=metadata> eines Nachbarn */
const warmEls = new Map();

function warmContainer() {
  if (warmHost?.isConnected) return warmHost;
  warmHost = document.createElement('div');
  warmHost.setAttribute('aria-hidden', 'true');
  warmHost.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
  document.body.appendChild(warmHost);
  return warmHost;
}

function releaseWarm(key) {
  const el = warmEls.get(key);
  if (!el) return;
  warmEls.delete(key);
  el.removeAttribute('src');
  el.load();
  el.remove();
}

function warmVideo(key, url) {
  return new Promise((resolve) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    el.playsInline = true;
    let timer = null;
    const done = () => { clearTimeout(timer); resolve(); };
    timer = setTimeout(done, WARM_TIMEOUT_MS);
    el.addEventListener('loadedmetadata', done, { once: true });
    el.addEventListener('error', done, { once: true });
    el.src = `${url}${url.includes('#') ? '' : '#t=0.001'}`;
    warmEls.set(key, el);
    warmContainer().appendChild(el);
  });
}

/** Schlüssel des vorgewärmten Elements: Vorschau und Original sind verschiedene Dateien. */
const warmKey = (media) => media.vorschauKey || media.key;

async function warmOne(item, run) {
  const media = mediaOf(item);
  const key = warmKey(media);
  if (!key || MediaCache.getObjectUrl(media.key) || warmEls.has(key)) return;
  // Dieselbe Quelle, die der Player beim Klick nimmt (Vorschau, sonst Original).
  const url = await networkUrl(item);
  if (!url || run !== warmRun) return;
  if (item.type === 'still') {
    if (!media.risky) await MediaCache.ensure(media.key, url);
    return;
  }
  if (typeof document !== 'undefined') await warmVideo(key, url);
}

/**
 * Nachbarn der gewählten Datei vorwärmen, höchstens ein Download gleichzeitig. Ein neuer
 * Aufruf bricht den vorherigen ab und gibt Elemente frei, die nicht mehr Nachbar sind.
 */
export async function warmNeighbors(items) {
  const run = ++warmRun;
  const list = (items || []).filter((item) => CACHE_TYPE[item?.type] && mediaOf(item).hasSource);
  const keep = new Set(list.map((item) => warmKey(mediaOf(item))));
  [...warmEls.keys()].forEach((key) => { if (!keep.has(key)) releaseWarm(key); });
  for (const item of list) {
    if (run !== warmRun) return;
    await warmOne(item, run).catch(() => {});
  }
}

/** Vorwärmen abbrechen und alle versteckten Elemente freigeben (Tab verlassen). */
export function stopWarming() {
  warmRun += 1;
  [...warmEls.keys()].forEach(releaseWarm);
}
