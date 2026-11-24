// playerEvents.js
// Maus und Tastatur im Vorschau-Player. Liefert eine Funktion zum Abmelden zurück.
//
// Tasten (Fokus im Player): Leertaste Play/Pause, F Vollbild, M Ton, Pfeil auf der Zeitleiste = 5 s.
// Die Steuerleiste liegt im Bild und blendet beim Abspielen nach kurzer Ruhe der Maus aus.

import { cycleSpeed, seek, setVolume, toggle, toggleMute } from './playerControls.js';
import { toggleFullscreen } from './playerLayout.js';

const SEEK_STEP = 5;
const IDLE_MS = 2500;

const isTyping = (e) => e.target.closest('textarea, input:not([type="range"])');

// Nur Tastaturfokus hält die Leiste offen; ein angeklickter Knopf behält in Chrome den Fokus.
function keyboardFocus(root) {
  try { return !!root.querySelector(':focus-visible'); } catch { return false; }
}

function wake(p) {
  p.root.classList.remove('is-idle');
  clearTimeout(p.idleTimer);
  p.idleTimer = setTimeout(() => {
    if (!p.destroyed && p.playing && !keyboardFocus(p.root)) p.root.classList.add('is-idle');
  }, IDLE_MS);
}

function onClick(p, e) {
  if (e.target.closest('[data-vb-play]')) { toggle(p); return; }
  if (e.target.closest('[data-vb-fs]')) { toggleFullscreen(p); return; }
  if (e.target.closest('[data-vb-speed]')) { cycleSpeed(p); return; }
  if (e.target.closest('[data-vb-mute]')) { toggleMute(p); return; }
  const marker = e.target.closest('.vb-marker');
  if (marker) {
    e.stopPropagation();
    seek(p, Number(marker.dataset.seek));
    p.onMarker?.(marker.dataset.commentId);
    return;
  }
  if (e.target.closest('[data-vb-media]') && !p.isStill) toggle(p);
}

function onKey(p, e) {
  const modifier = e.metaKey || e.ctrlKey || e.altKey;
  if ((e.key === 'f' || e.key === 'F') && !modifier && !isTyping(e)) {
    e.preventDefault();
    toggleFullscreen(p);
    return;
  }
  if (p.isStill) return;
  wake(p);
  if (!isTyping(e) && !modifier && (e.key === 'm' || e.key === 'M')) {
    e.preventDefault();
    toggleMute(p);
    return;
  }
  if (e.target === p.slider) {
    // Native Schrittweite (0,1 s) ist für die Tastatur zu fein: eigene Sprünge.
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (dir) {
      e.preventDefault();
      e.stopPropagation();
      seek(p, p.time + dir * SEEK_STEP);
    } else if (e.key === ' ') { e.preventDefault(); toggle(p); }
    return;
  }
  if (e.target.closest('textarea, input')) return;
  if (e.key === ' ' && e.target.closest('.vb-player')) { e.preventDefault(); toggle(p); }
}

export function bindPlayerEvents(p) {
  const { host, slider, volumeInput } = p;
  const click = (e) => onClick(p, e);
  const key = (e) => onKey(p, e);
  const dblClick = (e) => { if (e.target.closest('[data-vb-media]')) toggleFullscreen(p); };
  const move = () => wake(p);
  // Ziehen und Klicken auf den Regler erledigt das native Range-Input.
  const seekInput = () => seek(p, Number(slider.value));
  const volumeChange = () => setVolume(p, Number(volumeInput.value));

  host.addEventListener('click', click);
  host.addEventListener('keydown', key);
  host.addEventListener('dblclick', dblClick);
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerdown', move);
  slider?.addEventListener('input', seekInput);
  volumeInput?.addEventListener('input', volumeChange);

  return () => {
    clearTimeout(p.idleTimer);
    host.removeEventListener('click', click);
    host.removeEventListener('keydown', key);
    host.removeEventListener('dblclick', dblClick);
    host.removeEventListener('pointermove', move);
    host.removeEventListener('pointerdown', move);
    slider?.removeEventListener('input', seekInput);
    volumeInput?.removeEventListener('input', volumeChange);
  };
}
