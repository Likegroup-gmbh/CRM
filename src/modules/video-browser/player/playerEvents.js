// playerEvents.js
// Maus und Tastatur im Vorschau-Player. Liefert eine Funktion zum Abmelden zurück.
//
// Tasten (Fokus im Player): Leertaste Play/Pause, F Vollbild, M Ton,
// , und . ein Bild zurück/vor (auch Shift + Pfeil), Pfeil = 5 s.

import { cycleSpeed, seek, setVolume, stepFrame, toggle, toggleMute } from './playerControls.js';
import { toggleFullscreen } from './playerLayout.js';

const SEEK_STEP = 5;

const isTyping = (e) => e.target.closest('textarea, input:not([type="range"])');

function onClick(p, e) {
  if (e.target.closest('[data-vb-play]')) { toggle(p); return; }
  if (e.target.closest('[data-vb-fs]')) { toggleFullscreen(p); return; }
  const frameBtn = e.target.closest('[data-vb-frame]');
  if (frameBtn) { stepFrame(p, Number(frameBtn.dataset.vbFrame)); return; }
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
  if (!isTyping(e) && !modifier) {
    if (e.key === ',') { e.preventDefault(); stepFrame(p, -1); return; }
    if (e.key === '.') { e.preventDefault(); stepFrame(p, 1); return; }
    if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMute(p); return; }
  }
  if (e.target === p.slider) {
    // Native Schrittweite (0,1 s) ist für die Tastatur zu fein: eigene Sprünge, mit Shift ein Bild.
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (dir) {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) stepFrame(p, dir);
      else seek(p, p.time + dir * SEEK_STEP);
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
  // Ziehen und Klicken auf den Regler erledigt das native Range-Input.
  const seekInput = () => seek(p, Number(slider.value));
  const volumeChange = () => setVolume(p, Number(volumeInput.value));

  host.addEventListener('click', click);
  host.addEventListener('keydown', key);
  host.addEventListener('dblclick', dblClick);
  slider?.addEventListener('input', seekInput);
  volumeInput?.addEventListener('input', volumeChange);

  return () => {
    host.removeEventListener('click', click);
    host.removeEventListener('keydown', key);
    host.removeEventListener('dblclick', dblClick);
    slider?.removeEventListener('input', seekInput);
    volumeInput?.removeEventListener('input', volumeChange);
  };
}
