// playerLayout.js
// Anzeige des Vorschau-Players: Rahmengröße, Vollbild, Zeitanzeige, Play-Zustand, Marker.
// Alle Funktionen bekommen den Player-Zustand `p` (siehe VideoBrowserPlayer.js).

import { escapeHtml as esc } from '../../../core/format.js';
import { ICON_PLAY, ICON_PAUSE, ICON_FS, ICON_FS_EXIT, formatTime } from '../../../core/media/mediaPlayerIcons.js';
import { fitFrame, markerNah, markerProzent } from '../videoBrowserLogic.js';

const MIN_H = 320;
const MAX_H = 560;

/** Maximale Höhe der Vorschau: wächst mit dem Fenster, damit hohe Monitore nicht leer bleiben. */
const maxFrameHeight = () => Math.max(MIN_H, Math.min(MAX_H, Math.round(window.innerHeight * 0.55)));

const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
export const isFullscreen = (p) => fsEl() === p.root;

// Die Bühne füllt die Spaltenbreite, der Rahmen wird mittig hineingepasst (abzüglich Bühnen-Padding).
// Im Vollbild füllt die Bühne den Bildschirm, sonst gilt die Maximalhöhe.
function innerWidth(p) {
  const cs = getComputedStyle(p.stage);
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  return p.host.clientWidth - pad;
}

function size(p) {
  const full = isFullscreen(p);
  const maxW = Math.max(120, full ? p.stage.clientWidth : innerWidth(p));
  const maxH = full ? Math.max(120, p.stage.clientHeight) : (p.maxHeight ? p.maxHeight() : maxFrameHeight());
  return fitFrame(p.currentRatio, maxW, maxH);
}

export function applySize(p, animate) {
  const next = size(p);
  if (p.motion) p.motion.frameTo(p.frame, next, { animate });
  else { p.frame.style.width = `${next.w}px`; p.frame.style.height = `${next.h}px`; }
}

/* ---- Vollbild ---- */

export function toggleFullscreen(p) {
  if (isFullscreen(p)) {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    return;
  }
  const request = p.root.requestFullscreen || p.root.webkitRequestFullscreen;
  if (!request) return;
  const result = request.call(p.root);
  result?.catch?.(() => { /* Browser verweigert Vollbild: Vorschau bleibt wie sie ist */ });
}

export function onFullscreenChange(p) {
  if (p.destroyed) return;
  const fs = isFullscreen(p);
  p.root.classList.toggle('is-fullscreen', fs);
  p.fsButton.innerHTML = fs ? ICON_FS_EXIT : ICON_FS;
  p.fsButton.setAttribute('aria-label', fs ? 'Vollbild beenden' : 'Vollbild');
  p.fsButton.title = fs ? 'Vollbild beenden (Esc)' : 'Vollbild (F)';
  applySize(p, false);
}

/* ---- Anzeige ---- */

export function paintTime(p) {
  if (!p.timeEl) return;
  const { time, duration, slider } = p;
  p.timeEl.textContent = `${formatTime(time)} / ${formatTime(duration)}`;
  slider.max = String(duration || 0);
  slider.value = String(time);
  slider.style.setProperty('--p', `${markerProzent(time, duration)}%`);
  slider.setAttribute('aria-valuetext', `${formatTime(time)} von ${formatTime(duration)}`);
  p.markersEl?.querySelectorAll('.vb-marker').forEach((m) => {
    m.classList.toggle('is-near', markerNah(Number(m.dataset.seek), time));
  });
  p.onTime?.(time);
}

export function paintPlaying(p) {
  p.playButtons.forEach((b) => {
    b.setAttribute('aria-label', p.playing ? 'Pausieren' : 'Abspielen');
    b.innerHTML = p.playing ? ICON_PAUSE : ICON_PLAY;
  });
  p.root.classList.toggle('is-playing', p.playing);
  const big = p.host.querySelector('.vb-player__big');
  if (p.motion) p.motion.playButton(big, p.playing);
}

export function renderMarkers(p) {
  if (!p.markersEl) return;
  p.markersEl.innerHTML = p.markers.map((c) => `
      <button type="button" class="vb-marker" style="left: ${markerProzent(c.timecodeSec, p.duration)}%" data-seek="${c.timecodeSec}" data-comment-id="${esc(c.id)}" aria-label="Kommentar bei ${formatTime(c.timecodeSec)}: ${esc(c.text).slice(0, 80)}" title="${formatTime(c.timecodeSec)} · ${esc(c.text).slice(0, 80)}"></button>`).join('');
}
