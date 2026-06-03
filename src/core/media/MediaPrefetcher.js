// MediaPrefetcher
// Beschleunigt das Blaettern im Player: Preconnect zu Dropbox, vorheriges
// Aufloesen von Nachbar-Assets/Temp-Links und Byte-Prefetch der Nachbarvideos.
// Greift ueber einen schlanken Kontext (ctx = Player) auf Items/State zu.

import { resolveStreamUrl } from './mediaSrc.js';
import * as MediaCache from './MediaCache.js';

export class MediaPrefetcher {
  constructor(ctx) {
    this.ctx = ctx;
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
    const { items, index, assetLoader } = this.ctx;
    [index - 1, index + 1].forEach(i => {
      const e = items[i];
      if (e && e.type === 'video' && !assetLoader.has(e.video.id)) {
        assetLoader.load(e.video.id).catch(() => {});
      }
    });
  }

  scheduleNeighborPrefetch() {
    const token = this.ctx._srcToken;
    const stage = this.ctx.lightbox?.contentEl?.querySelector('.media-viewer-stage');
    const video = stage?.querySelector('.vpl-video');
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      this._prefetchTimerId = null;
      if (token === this.ctx._srcToken) this.prefetchNeighbors();
    };
    if (video) {
      if (video.readyState >= 2) run();
      else video.addEventListener('loadeddata', run, { once: true });
    }
    if (this._prefetchTimerId) clearTimeout(this._prefetchTimerId);
    this._prefetchTimerId = setTimeout(run, 2500);
  }

  prefetchNeighbors() {
    const { items, index, storyVersions, storyAsset } = this.ctx;
    const videoLookups = []; // nur Metadaten (kein Voll-Download)
    const blobTasks = [];    // Bild/Story: vollstaendig als Blob vorwaermen

    [index - 1, index + 1].forEach(i => {
      const e = items[i];
      if (!e) return;
      if (e.type === 'video') {
        // Nur Metadaten-Prefetch (schnelles erstes Bild). KEIN voller Blob-
        // Prewarm: der wuerde Bandbreite vom aktiven Video abziehen. Instantes
        // Zurueckblaettern liefert stattdessen der Video-Element-Pool (Retention).
        videoLookups.push({
          file_path: e.video.currentAsset?.file_path || null,
          file_url: e.video.file_url || e.video.link_content || e.video.asset_url || null
        });
      } else if (e.type === 'story') {
        const versions = storyVersions(e.slot);
        const a = storyAsset(e.slot, versions[versions.length - 1] || 1);
        if (a?.id && (a.file_path || a.file_url)) {
          blobTasks.push({
            key: `story:${a.id}:${a.created_at || a.file_size || ''}`,
            lookup: { file_path: a.file_path || null, file_url: a.file_url || null }
          });
        }
      } else if (e.type === 'bild') {
        const img = e.image;
        if (img?.id && (img.file_path || img.file_url)) {
          blobTasks.push({
            key: `bild:${img.id}:${img.created_at || ''}`,
            lookup: { file_path: img.file_path || null, file_url: img.file_url || null }
          });
        }
      }
    });

    // Bild/Story-Nachbarn als Blob in den Cache (klein) -> instantes Oeffnen.
    blobTasks.forEach(t => {
      resolveStreamUrl(t.lookup)
        .then(url => { if (url) MediaCache.ensure(t.key, url); })
        .catch(() => {});
    });

    // Video-Nachbarn zusaetzlich mit Metadaten vorladen (schnelles erstes Bild).
    Promise.all(videoLookups.map(l => resolveStreamUrl(l).catch(() => null)))
      .then(urls => this._prefetchBytes(urls.filter(Boolean)));
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
