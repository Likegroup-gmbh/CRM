// playerSource.js
// Quelle des Vorschau-Players laden: Blob aus dem Cache oder Original, Standbild,
// Platzhalter ohne Datei. Dazu Ready-Gate und Wiedergabe-Messung.
// Bekommt den Player-Zustand `p`.

import { createWiedergabeMessung, formatOf, perfNow } from '../../../core/media/mediaPerf.js';
import { lookupPath } from '../../../core/media/player/mediaIdentity.js';
import { cachedUrl, mediaOf, resolveSource } from '../videoBrowserMedia.js';
import { applyMedia, play, probeFrameRate } from './playerControls.js';
import { applySize, paintPlaying, paintTime, renderMarkers } from './playerLayout.js';

const FALLBACK_SEC = 30;

export function finishMessung(p) {
  const row = p.messung?.finish();
  p.messung = null;
  if (row) p.onMessung?.(row);
}

// Gate für das Vorwärmen der Nachbarn: erst wenn die aktive Quelle durchspielbar ist
// (oder fehlgeschlagen), damit sie die Bandbreite nicht teilen muss.
function resetReady(p) {
  p.ready = new Promise((resolve) => { p.markReady = resolve; });
}

function showStill(p, asset, url) {
  const { frame, mediaHost } = p;
  if (url) {
    const img = document.createElement('img');
    img.className = 'vb-player__img';
    img.alt = asset.name || 'Standbild';
    img.addEventListener('load', () => {
      frame.classList.remove('is-loading');
      if (img.naturalWidth && img.naturalHeight) {
        p.dims = { width: img.naturalWidth, height: img.naturalHeight };
        p.currentRatio = `${img.naturalWidth}:${img.naturalHeight}`;
        applySize(p, true);
      }
      p.markReady();
    }, { once: true });
    img.addEventListener('error', () => { frame.classList.remove('is-loading'); p.markReady(); }, { once: true });
    img.src = url;
    mediaHost.appendChild(img);
  } else {
    frame.classList.remove('is-loading');
    mediaHost.innerHTML = '<p class="vb-player__placeholder">Keine Vorschau verfügbar</p>';
    p.markReady();
  }
}

/** Ohne auflösbare Datei läuft ein Platzhalter mit simulierter Zeitleiste. */
function showPlaceholder(p, resumeAt) {
  p.messung.markFehler();
  finishMessung(p);
  p.markReady();
  p.frame.classList.remove('is-loading');
  p.simulated = { t: resumeAt };
  p.duration = FALLBACK_SEC;
  p.time = resumeAt;
  p.mediaHost.innerHTML = '<p class="vb-player__placeholder">Vorschau nicht verfügbar</p>';
  renderMarkers(p);
  paintTime(p);
  paintPlaying(p);
}

/**
 * @param {object} asset
 * @param {{ resumeAt?: number, resumePlay?: boolean }} [opts]
 */
export async function loadSource(p, asset, { resumeAt = 0, resumePlay = false } = {}) {
  const token = ++p.loadToken;
  const t0 = perfNow();
  const { frame, mediaHost } = p;
  finishMessung(p);
  resetReady(p);
  // Blob aus dem Cache steht sofort bereit, sonst das Original. Die Quelle bleibt bis zum
  // nächsten Laden fest (kein Wechsel der src mitten im Satz).
  const cached = cachedUrl(asset);
  if (!cached) frame.classList.add('is-loading');
  const src = cached
    ? { url: cached, quelle: 'blob' }
    : await resolveSource(asset).catch(() => ({ url: null, quelle: 'original' }));
  const url = src.url;
  if (p.destroyed || token !== p.loadToken) return;

  p.video?.pause();
  p.simTween?.kill();
  p.simulated = null;
  p.video = null;
  mediaHost.innerHTML = '';

  if (p.isStill) {
    showStill(p, asset, url);
    return;
  }

  const media = mediaOf(asset);
  p.messung = createWiedergabeMessung({
    quelle: src.quelle,
    format: formatOf(lookupPath(media.lookup)),
    assetId: media.record.id || null,
    t0
  });

  if (!url) {
    showPlaceholder(p, resumeAt);
    return;
  }

  const el = document.createElement('video');
  p.video = el;
  p.messung.attach(el);
  el.className = 'vb-player__video';
  el.playsInline = true;
  // Wie im Medien-Player: komplett vorladen und per #t auf das erste Bild springen, damit
  // die Vorschau ohne Play sichtbar ist. 0,001 s statt 0,1 s, sonst zählt das als bewegter Playhead.
  el.preload = 'auto';
  el.src = `${url}${url.includes('#') ? '' : '#t=0.001'}`;
  applyMedia(p);
  probeFrameRate(p, el);
  el.addEventListener('loadedmetadata', () => {
    if (p.destroyed || token !== p.loadToken) return;
    p.duration = el.duration || 0;
    // Rahmen folgt der echten Datei: jede Datei zeigt sich in ihrem eigenen Seitenverhältnis, ohne Beschnitt
    if (el.videoWidth && el.videoHeight) {
      p.dims = { width: el.videoWidth, height: el.videoHeight };
      const next = `${el.videoWidth}:${el.videoHeight}`;
      if (next !== p.currentRatio) {
        p.currentRatio = next;
        applySize(p, true);
      }
    }
    if (resumeAt) el.currentTime = Math.min(resumeAt, p.duration);
    renderMarkers(p);
    paintTime(p);
    if (resumePlay) play(p);
  }, { once: true });
  el.addEventListener('loadeddata', () => frame.classList.remove('is-loading'));
  el.addEventListener('canplaythrough', () => p.markReady(), { once: true });
  el.addEventListener('timeupdate', () => { p.time = el.currentTime; paintTime(p); });
  el.addEventListener('play', () => { p.playing = true; paintPlaying(p); });
  el.addEventListener('pause', () => { p.playing = false; paintPlaying(p); });
  el.addEventListener('ended', () => { p.playing = false; paintPlaying(p); });
  el.addEventListener('error', () => {
    p.markReady();
    frame.classList.remove('is-loading');
    mediaHost.innerHTML = '<p class="vb-player__placeholder">Die Datei kann nicht abgespielt werden.</p>';
  });
  mediaHost.appendChild(el);
}
