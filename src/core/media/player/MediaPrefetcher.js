// MediaPrefetcher
// Beschleunigt das Blaettern im Player: Preconnect zu Dropbox, vorheriges
// Aufloesen von Nachbar-Assets/Temp-Links und Byte-Prefetch der Nachbarvideos.
// host = VideoPlayerLightbox: session (Items/Index/Tabelle), assetLoader, stage.

import { resolveStreamUrl } from '../mediaSrc.js';
import * as MediaCache from '../MediaCache.js';
import { isRiskyFormat, lookupPath } from './mediaIdentity.js';
import { resolveItemMedia, defaultPicksFor } from './resolveItemMedia.js';

export class MediaPrefetcher {
  constructor(host) {
    this.host = host;
    this._preconnected = false;
    this._container = null;
    this._bytePrefetch = new Map();
    this._prefetchTimerId = null;
  }

  addPreconnect() {
    if (this._preconnected) return;
    this._preconnected = true;
    ['https://dl.dropboxusercontent.com', 'https://www.dropbox.com'].forEach(href => {
      const l = document.createElement('link');
      l.rel = 'preconnect';
      l.href = href;
      l.crossOrigin = 'anonymous';
      document.head.appendChild(l);
    });
  }

  prefetchNeighborAssets() {
    const { items, index } = this.host.session;
    const { assetLoader } = this.host;
    [index - 1, index + 1].forEach(i => {
      const e = items[i];
      if (e && e.type === 'video' && !assetLoader.has(e.video.id)) {
        assetLoader.load(e.video.id).catch(() => {});
      }
    });
  }

  scheduleNeighborPrefetch() {
    const token = this.host.stage.token;
    const stage = this.host.stage.el();
    const video = stage?.querySelector('.vpl-video');
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      this._prefetchTimerId = null;
      if (token === this.host.stage.token) this.prefetchNeighbors();
    };
    // Nur fuer Story/Still/.mov. Kooperationsvideos startet der StageController
    // nach Headroom, nicht hier. canplaythrough oder 4s, damit der erste Start
    // die Leitung nicht mit Nachbar-Downloads teilt.
    if (video) {
      if (video.readyState >= 4) run();
      else video.addEventListener('canplaythrough', run, { once: true });
    }
    if (this._prefetchTimerId) clearTimeout(this._prefetchTimerId);
    this._prefetchTimerId = setTimeout(run, 4000);
  }

  prefetchNeighbors({ signal } = {}) {
    const { items, index } = this.host.session;
    const blobTasks = []; // Bild/Story: vollstaendig als Blob vorwaermen

    [index - 1, index + 1].forEach(i => {
      const e = items[i];
      if (!e || e.type === 'video') return;
      // Gleiche Default-Auswahl + gleicher Key wie der Player beim Oeffnen.
      const media = resolveItemMedia(e, defaultPicksFor(e, { table: this.host.session.table }));
      if (media.key && (media.lookup.file_path || media.lookup.file_url)) {
        blobTasks.push({ key: media.key, lookup: media.lookup });
      }
    });

    // Bild/Story-Nachbarn als Blob in den Cache (klein) -> instantes Oeffnen.
    blobTasks.forEach(t => {
      resolveStreamUrl(t.lookup)
        .then(url => { if (url) MediaCache.ensure(t.key, url); })
        .catch(() => {});
    });

    // Ein Video-Nachbar (lieber voraus, sonst zurueck). Storys/Bilder bleiben
    // kleine Blob-Tasks oben. Riskante Container nur als Metadaten.
    // signal: der StageController bricht den Video-Blob bei `waiting` ab.
    const videoIndices = this._oneVideoNeighbor();
    Promise.all(videoIndices.map(i => this._resolveVideoTask(items[i])))
      .then(tasks => {
        if (signal?.aborted) return;
        const metaUrls = [];
        for (const t of tasks) {
          if (!t) continue;
          if (t.risky) { metaUrls.push(t.url); continue; }
          MediaCache.ensure(t.key, t.url, signal ? { signal } : undefined);
        }
        if (!signal?.aborted) this._prefetchBytes(metaUrls);
      })
      .catch(() => {});
  }

  /** Ein Video-Nachbar: das naechste voraus, sonst das naechste zurueck. */
  _oneVideoNeighbor() {
    const ahead = this._nearestVideoIndices({ back: 0, ahead: 1 });
    if (ahead.length) return ahead;
    return this._nearestVideoIndices({ back: 1, ahead: 0 });
  }

  /** Indizes der naechsten Video-Items in beide Richtungen (vom aktuellen aus). */
  _nearestVideoIndices({ back = 1, ahead = 2 } = {}) {
    const { items, index } = this.host.session;
    const result = [];
    let n = 0;
    for (let i = index - 1; i >= 0 && n < back; i--) {
      if (items[i]?.type === 'video') { result.push(i); n++; }
    }
    n = 0;
    for (let i = index + 1; i < items.length && n < ahead; i++) {
      if (items[i]?.type === 'video') { result.push(i); n++; }
    }
    return result;
  }

  /**
   * Loest fuer ein Video-Item den Content-Key (analog
   * VideoPlayerLightbox.currentCacheKey: `video:{assetId}:{created_at}`) und die
   * Stream-URL auf. Liefert null, wenn schon gecacht oder nichts aufloesbar.
   * @returns {Promise<{key:string,url:string,risky:boolean}|null>}
   */
  async _resolveVideoTask(item) {
    const video = item?.video;
    if (!video?.id) return null;

    let assets = this.host.assetLoader.get(video.id);
    if (!assets) assets = await this.host.assetLoader.load(video.id).catch(() => null);
    if (!assets) return null;

    // Gleiche Default-Auswahl (inkl. Kunden-Final) wie der Player -> gleicher Key.
    const { assetLoader } = this.host;
    const { table } = this.host.session;
    const media = resolveItemMedia(item, defaultPicksFor(item, { assetLoader, assets, table }));
    const { key, lookup } = media;
    if (!key) return null;
    if (MediaCache.getObjectUrl(key)) return null; // schon vorgewaermt

    const url = await resolveStreamUrl(lookup).catch(() => null);
    if (!url) return null;

    return { key, url, risky: isRiskyFormat(lookupPath(lookup)) };
  }

  _ensureContainer() {
    if (this._container) return;
    const c = document.createElement('div');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
    document.body.appendChild(c);
    this._container = c;
  }

  _prefetchBytes(urls) {
    this._ensureContainer();
    const keep = new Set(urls);
    for (const [url, el] of this._bytePrefetch) {
      if (!keep.has(url)) {
        el.removeAttribute('src');
        el.load?.();
        el.remove();
        this._bytePrefetch.delete(url);
      }
    }
    for (const url of keep) {
      if (this._bytePrefetch.has(url)) continue;
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      v.src = url + (url.includes('#') ? '' : '#t=0.1');
      this._container.appendChild(v);
      this._bytePrefetch.set(url, v);
    }
  }

  cleanup() {
    if (this._prefetchTimerId) {
      clearTimeout(this._prefetchTimerId);
      this._prefetchTimerId = null;
    }
    this._bytePrefetch.forEach(el => {
      el.removeAttribute('src');
      el.load?.();
      el.remove();
    });
    this._bytePrefetch.clear();
    this._container?.remove();
    this._container = null;
  }
}
