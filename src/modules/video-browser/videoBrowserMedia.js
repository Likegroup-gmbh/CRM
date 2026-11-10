// videoBrowserMedia.js
// Schnelles Laden der Medien im Videos-Tab. Nutzt dieselben Bausteine wie der Medien-Player
// (core/media): Temp-Link-Cache, Blob-Cache und Content-Keys.
//
// - Quelle: Blob aus dem Cache, sonst das Original als Stream.
// - Link vorab auflösen: beim Öffnen einer Ablage für alle Dateien darin, einzeln über den
//   Temp-Link-Cache.
// - Nachbarn vorwärmen: eine Datei nach der anderen, Videos nur bis zu den Metadaten
//   (Verbindung, Moov-Box, erstes Bild), Standbilder ganz in den Blob-Cache. Das aktive Video
//   lädt nur der Player selbst, als Stream: ein zweiter Voll-Download würde ihm die
//   Bandbreite nehmen.

import { resolveStreamUrl, prefetchStreamUrl } from '../../core/media/mediaSrc.js';
import * as MediaCache from '../../core/media/MediaCache.js';
import { cacheKeyFor, isRiskyFormat, lookupFor, lookupPath } from '../../core/media/player/mediaIdentity.js';
import { istSharePoint } from '../../core/ablage/ablageLink.js';

const CACHE_TYPE = { video: 'video', story: 'story', still: 'bild' };
const MAX_PREFETCH = 8;
const DROPBOX_HOSTS = ['https://dl.dropboxusercontent.com', 'https://www.dropbox.com'];

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

/** SharePoint-Host steht erst im Lese-Link (Tenant), daher erst nach dem ersten Link. */
function preconnectHostOf(url) {
  if (!url) return;
  try {
    preconnect(new URL(url).origin);
  } catch {
    // keine absolute URL
  }
}

/** Datei-Infos eines Baum-Items (oder direkt eines Assets). */
export function mediaOf(item) {
  const record = item?.asset || item || {};
  const lookup = lookupFor(record, item?.type);
  const type = CACHE_TYPE[item?.type] || null;
  const key = type ? cacheKeyFor(type, record) : null;
  return {
    record,
    lookup,
    key,
    risky: isRiskyFormat(lookupPath(lookup)),
    hasSource: !!lookupPath(lookup)
  };
}

/** Blob-URL, wenn die Datei schon im Cache liegt (sofort nutzbar, kein Warten). */
export function cachedUrl(item) {
  const { key } = mediaOf(item);
  return key ? MediaCache.getObjectUrl(key) : null;
}

/**
 * Abspielbare Quelle einer Datei: das Original über den Temp-Link-Cache.
 * @param {object} item
 * @returns {Promise<{ url: string|null, quelle: 'original' }>}
 */
export async function resolveSource(item) {
  const url = await resolveStreamUrl(mediaOf(item).lookup);
  return { url: url || null, quelle: 'original' };
}

/** Netz-URL einer Datei. */
export function networkUrl(item) {
  return resolveSource(item).then((s) => s.url);
}

/** Links aller abspielbaren Dateien vorab auflösen (billig). */
export function prefetchLinks(items) {
  preconnectMedia();
  let n = 0;
  for (const item of items || []) {
    if (!CACHE_TYPE[item?.type]) continue;
    const { lookup, hasSource } = mediaOf(item);
    if (!hasSource || n >= MAX_PREFETCH) continue;
    if (istSharePoint(lookup)) resolveStreamUrl(lookup).then(preconnectHostOf).catch(() => {});
    else prefetchStreamUrl(lookup);
    n += 1;
  }
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

async function warmOne(item, run) {
  const media = mediaOf(item);
  const { key } = media;
  if (!key || MediaCache.getObjectUrl(key) || warmEls.has(key)) return;
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
  const keep = new Set(list.map((item) => mediaOf(item).key));
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
