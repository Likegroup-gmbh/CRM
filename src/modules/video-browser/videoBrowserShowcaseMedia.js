// videoBrowserShowcaseMedia.js
// Medien der Showcase-Kacheln, sparsam bei 30 bis 40+ Kacheln:
// - Poster: erst wenn die Kachel in den Sichtbereich kommt. Zuerst das fertige Poster aus dem
//   PosterCache (IndexedDB, sonst ein gesammelter Call für alle sichtbaren Kacheln, ADR 0064).
// - Fehlt es noch: Original, höchstens MAX_LOADING gleichzeitig. Bilder als <img>, Videos als
//   einzelnes Standbild (Canvas), danach wird die Quelle wieder freigegeben.
// - Hover: höchstens ein <video> gleichzeitig, stumm, in Schleife, erst beim Hover erzeugt.
//   Verlassen oder Wegscrollen stoppt es und gibt die Quelle frei. Touch und reduzierte Bewegung: keine Vorschau.
// Das Original kommt aus videoBrowserMedia (Temp-Link-Cache, Blob-Cache), wie im Detailbereich.

import { prefersReducedMotion } from '../../core/animation/gsap.js';
import { getPoster } from '../../core/media/PosterCache.js';
import { cachedUrl, networkUrl } from './videoBrowserMedia.js';

const MAX_LOADING = 4;
const POSTER_MAX_W = 480;
const LOAD_TIMEOUT_MS = 20000;

const withStart = (url) => `${url}${url.includes('#') ? '' : '#t=0.001'}`;

function releaseVideo(video) {
  if (!video) return;
  video.pause();
  video.removeAttribute('src');
  video.load();
  video.remove();
}

async function sourceOf(item) {
  return cachedUrl(item) || await networkUrl(item).catch(() => null);
}

/**
 * @param {{ motion?: object }} deps
 */
export function createShowcaseMedia({ motion } = {}) {
  let entries = new Map();
  // Fertige Poster bleiben über Neu-Renderings (Filter, Gruppieren) erhalten und werden nur umgehängt
  const posters = new Map();
  let observer = null;
  let current = null;
  let hoverVideo = null;
  let destroyed = false;
  let loading = 0;
  const queue = [];

  const pump = () => {
    while (!destroyed && loading < MAX_LOADING && queue.length) {
      const tile = queue.shift();
      if (!tile.isConnected || tile.dataset.poster) continue;
      loading += 1;
      loadPoster(tile).finally(() => { loading -= 1; pump(); });
    }
  };

  /** Bild in die Kachel hängen, sobald es geladen ist. @returns {Promise<boolean>} */
  function attachImage(tile, host, item, url) {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.className = 'vb-sc-tile__img';
      img.alt = '';
      // Kein loading="lazy": ein <img> außerhalb des DOMs lädt dann nie, load feuert nicht und der Slot bleibt belegt.
      img.decoding = 'async';
      const timer = setTimeout(() => { img.removeAttribute('src'); delete tile.dataset.poster; resolve(false); }, LOAD_TIMEOUT_MS);
      img.addEventListener('load', () => {
        clearTimeout(timer);
        if (tile.isConnected) host.appendChild(img);
        posters.set(item.id, img);
        tile.dataset.poster = 'done';
        resolve(true);
      }, { once: true });
      img.addEventListener('error', () => { clearTimeout(timer); delete tile.dataset.poster; resolve(false); }, { once: true });
      img.src = url;
    });
  }

  /** Fertiges Poster zeigen; fehlt es, übernimmt der Fallback über die Warteschlange. */
  async function showPoster(tile) {
    const item = entries.get(tile.dataset.itemId)?.item;
    const host = tile.querySelector('[data-vb-sc-media]');
    if (!item || !host || tile.dataset.poster) return;
    tile.dataset.poster = 'pending';
    const url = await getPoster(item).catch(() => null);
    if (destroyed || !tile.isConnected) { delete tile.dataset.poster; return; }
    if (url && await attachImage(tile, host, item, url)) return;
    delete tile.dataset.poster;
    queue.push(tile);
    pump();
  }

  /** Fallback ohne Poster: das Original (Standbild) bzw. das erste Bild des Videos. */
  async function loadPoster(tile) {
    const item = entries.get(tile.dataset.itemId)?.item;
    const host = tile.querySelector('[data-vb-sc-media]');
    if (!item || !host) return;
    tile.dataset.poster = 'pending';
    const url = await sourceOf(item);
    if (destroyed || !tile.isConnected || !url) { delete tile.dataset.poster; return; }

    if (item.type === 'still') {
      await attachImage(tile, host, item, url);
      return;
    }

    await new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      // Sicherung: ein hängender Download darf keinen der MAX_LOADING-Slots dauerhaft blockieren
      const timer = setTimeout(() => { delete tile.dataset.poster; done(); }, LOAD_TIMEOUT_MS);
      const done = () => { clearTimeout(timer); releaseVideo(video); resolve(); };
      video.addEventListener('loadeddata', () => {
        try {
          const w = Math.min(POSTER_MAX_W, video.videoWidth || POSTER_MAX_W);
          const h = Math.round(w * ((video.videoHeight || 1) / (video.videoWidth || 1)));
          const canvas = document.createElement('canvas');
          canvas.className = 'vb-sc-tile__img';
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(video, 0, 0, w, h);
          posters.set(item.id, canvas);
          if (tile.isConnected) { host.appendChild(canvas); tile.dataset.poster = 'done'; }
        } catch {
          delete tile.dataset.poster;
        }
        done();
      }, { once: true });
      video.addEventListener('error', () => { delete tile.dataset.poster; done(); }, { once: true });
      video.src = withStart(url);
    });
  }

  function stopHover() {
    if (!current) return;
    motion?.hoverOut(current);
    releaseVideo(hoverVideo);
    hoverVideo = null;
    current = null;
  }

  async function startHover(tile) {
    if (destroyed || prefersReducedMotion() || tile === current) return;
    stopHover();
    current = tile;
    const item = entries.get(tile.dataset.itemId)?.item;
    motion?.hoverIn(tile);
    if (!item || item.type === 'still') return;
    const url = await sourceOf(item);
    if (destroyed || current !== tile || !url) return;
    const video = document.createElement('video');
    video.className = 'vb-sc-tile__video';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('loadedmetadata', () => {
      if (current === tile && video.duration) motion?.hoverIn(tile, { duration: video.duration });
    }, { once: true });
    video.src = withStart(url);
    hoverVideo = video;
    tile.querySelector('[data-vb-sc-media]')?.appendChild(video);
    video.play().catch(() => { /* Autoplay-Block: Poster bleibt */ });
  }

  const tileOf = (target) => target?.closest?.('[data-vb-sc-tile]') || null;

  return {
    /** Nach jedem Rendern des Grids: Kacheln beobachten, Poster laden, wenn sie sichtbar werden. */
    observe(grid, list) {
      if (destroyed || !grid) return;
      stopHover();
      observer?.disconnect();
      queue.length = 0;
      entries = new Map(list.map(entry => [entry.item.id, entry]));
      grid.querySelectorAll('[data-vb-sc-tile]').forEach((tile) => {
        const poster = posters.get(tile.dataset.itemId);
        if (!poster) return;
        tile.querySelector('[data-vb-sc-media]')?.appendChild(poster);
        tile.dataset.poster = 'done';
      });
      if (typeof IntersectionObserver !== 'function') {
        grid.querySelectorAll('[data-vb-sc-tile]').forEach(tile => void showPoster(tile));
        return;
      }
      observer = new IntersectionObserver((records) => {
        for (const rec of records) {
          const tile = rec.target;
          if (rec.isIntersecting) {
            observer.unobserve(tile);
            // Alle Kacheln eines Callbacks fragen im selben Takt, der PosterCache sammelt sie zu einem Call
            if (!tile.dataset.poster) void showPoster(tile);
          } else if (tile === current) {
            stopHover();
          }
        }
      }, { rootMargin: '200px' });
      grid.querySelectorAll('[data-vb-sc-tile]').forEach(tile => observer.observe(tile));
    },

    /** Delegierte Hover-Erkennung am Grid, ein Listener statt einer je Kachel. */
    onPointerOver(e) {
      if (e.pointerType === 'touch') return;
      const tile = tileOf(e.target);
      if (!tile || tile === tileOf(e.relatedTarget)) return;
      void startHover(tile);
    },

    onPointerOut(e) {
      const tile = tileOf(e.target);
      if (!tile || tile !== current || tile === tileOf(e.relatedTarget)) return;
      stopHover();
    },

    stopHover,

    /** Rect der Kachel-Vorschau einer Datei (Ziel und Start der Vollansicht), `null` wenn nicht da. */
    frameRect(grid, itemId) {
      const tile = [...(grid?.querySelectorAll('[data-vb-sc-tile]') || [])].find(t => t.dataset.itemId === itemId);
      return tile?.querySelector('[data-vb-sc-frame]')?.getBoundingClientRect() || null;
    },

    destroy() {
      destroyed = true;
      stopHover();
      observer?.disconnect();
      queue.length = 0;
      posters.clear();
    }
  };
}
