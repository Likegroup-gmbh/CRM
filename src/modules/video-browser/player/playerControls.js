// playerControls.js
// Steuerung des Vorschau-Players: Play/Pause, Springen, Platzhalter-Simulation und die
// Review-Werkzeuge (Bild-Schritt, Geschwindigkeit, Ton). Bekommt den Player-Zustand `p`.

import { ICON_VOLUME, ICON_MUTE } from '../../../core/media/mediaPlayerIcons.js';
import { paintPlaying, paintTime } from './playerLayout.js';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
// HTML5-Video kennt keine Bildrate: Startwert, wird beim Abspielen aus den Frames gemessen.
export const DEFAULT_FRAME_SEC = 1 / 30;

const speedLabel = (rate) => `${String(rate).replace('.', ',')}×`;

export function seek(p, sec) {
  const target = Math.max(0, Math.min(p.duration || sec, sec));
  p.time = target;
  if (p.video) p.video.currentTime = target;
  if (p.simulated) {
    p.simulated.t = target;
    if (p.playing) startSimulation(p);
  }
  paintTime(p);
}

function startSimulation(p) {
  p.simTween?.kill();
  p.simTween = p.motion?.simulate(p.simulated, {
    duration: p.duration,
    onUpdate: () => { p.time = p.simulated.t; paintTime(p); },
    onComplete: () => { p.playing = false; paintPlaying(p); }
  });
}

export function play(p) {
  if (p.isStill) return;
  if (p.video) {
    p.video.play().catch(() => { /* Autoplay-Block: Nutzer klickt erneut */ });
  } else if (p.simulated) {
    if (p.time >= p.duration) { p.time = 0; p.simulated.t = 0; }
    p.playing = true;
    startSimulation(p);
    paintPlaying(p);
  }
}

export function pause(p) {
  if (p.video) p.video.pause();
  else if (p.simulated) {
    p.simTween?.kill();
    p.playing = false;
    paintPlaying(p);
  }
}

export const toggle = (p) => (p.playing ? pause(p) : play(p));

/* ---- Review-Werkzeuge: Bild-Schritt, Geschwindigkeit, Ton ---- */

export function applyMedia(p) {
  if (!p.video) return;
  p.video.playbackRate = p.rate;
  p.video.volume = p.volume;
  p.video.muted = p.muted;
}

export function paintControls(p) {
  if (!p.speedButton) return;
  p.speedButton.textContent = speedLabel(p.rate);
  p.speedButton.setAttribute('aria-label', `Wiedergabegeschwindigkeit ${speedLabel(p.rate)}, Klick wechselt`);
  const silent = p.muted || p.volume === 0;
  p.muteButton.innerHTML = silent ? ICON_MUTE : ICON_VOLUME;
  p.muteButton.setAttribute('aria-label', silent ? 'Ton einschalten' : 'Ton ausschalten');
  p.volumeInput.value = String(silent ? 0 : p.volume);
}

export function cycleSpeed(p) {
  p.rate = SPEEDS[(SPEEDS.indexOf(p.rate) + 1) % SPEEDS.length];
  applyMedia(p);
  paintControls(p);
}

export function toggleMute(p) {
  p.muted = !p.muted;
  if (!p.muted && p.volume === 0) p.volume = 0.5;
  applyMedia(p);
  paintControls(p);
}

export function setVolume(p, value) {
  p.volume = Math.max(0, Math.min(1, value));
  p.muted = p.volume === 0;
  applyMedia(p);
  paintControls(p);
}

/** Ein Bild vor oder zurück (dir = ±1). Hält an und landet in der Mitte des Ziel-Frames. */
export function stepFrame(p, dir) {
  if (p.isStill) return;
  pause(p);
  const index = Math.floor(p.time / p.frameSec + 0.001) + dir;
  seek(p, Math.max(0, index * p.frameSec + p.frameSec / 2));
}

/** Bildrate aus den tatsächlich gezeigten Frames messen (nur wo der Browser es kann). */
export function probeFrameRate(p, v) {
  if (typeof v.requestVideoFrameCallback !== 'function') return;
  let last = null;
  let samples = 0;
  let best = Infinity;
  const tick = (_now, meta) => {
    if (p.destroyed || v !== p.video) return;
    if (last !== null) {
      const delta = meta.mediaTime - last;
      // Sprünge (Seek) und Doppelmeldungen fallen durch die Grenzen, der kleinste Abstand ist ein Bild.
      if (delta > 0.004 && delta < 0.2) { best = Math.min(best, delta); samples += 1; }
    }
    last = meta.mediaTime;
    if (samples >= 12) { p.frameSec = best; return; }
    v.requestVideoFrameCallback(tick);
  };
  v.requestVideoFrameCallback(tick);
}
