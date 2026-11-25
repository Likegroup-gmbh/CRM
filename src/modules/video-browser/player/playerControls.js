// playerControls.js
// Steuerung des Vorschau-Players: Play/Pause, Springen, Platzhalter-Simulation, Geschwindigkeit
// und Ton. Bekommt den Player-Zustand `p`.

import { ICON_VOLUME, ICON_MUTE } from '../../../core/media/mediaPlayerIcons.js';
import { paintPlaying, paintTime } from './playerLayout.js';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Ton gilt für alle Player der Sitzung: wer stummschaltet, bleibt beim Blättern stumm.
const audio = { volume: 1, muted: false };
export const startAudio = () => ({ ...audio });

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

/** Ohne Nutzergeste blockt der Browser Wiedergabe mit Ton: dann stumm starten, der Ton-Knopf zeigt es. */
function playVideo(p) {
  const v = p.video;
  v.play().catch((err) => {
    if (err?.name !== 'NotAllowedError' || p.muted || p.video !== v || p.destroyed) return;
    p.muted = true;
    applyMedia(p);
    paintControls(p);
    v.play().catch(() => { /* bleibt pausiert, Klick startet */ });
  });
}

export function play(p) {
  if (p.isStill) return;
  if (p.video) {
    playVideo(p);
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

/* ---- Geschwindigkeit und Ton ---- */

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
  const level = silent ? 0 : p.volume;
  p.muteButton.innerHTML = silent ? ICON_MUTE : ICON_VOLUME;
  p.muteButton.setAttribute('aria-label', silent ? 'Ton einschalten' : 'Ton ausschalten');
  p.volumeInput.value = String(level);
  p.volumeInput.style.setProperty('--p', `${Math.round(level * 100)}%`);
}

export function cycleSpeed(p) {
  p.rate = SPEEDS[(SPEEDS.indexOf(p.rate) + 1) % SPEEDS.length];
  applyMedia(p);
  paintControls(p);
}

function remember(p) {
  audio.volume = p.volume;
  audio.muted = p.muted;
  applyMedia(p);
  paintControls(p);
}

export function toggleMute(p) {
  p.muted = !p.muted;
  if (!p.muted && p.volume === 0) p.volume = 0.5;
  remember(p);
}

export function setVolume(p, value) {
  p.volume = Math.max(0, Math.min(1, value));
  p.muted = p.volume === 0;
  remember(p);
}
