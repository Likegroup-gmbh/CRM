// Geteilte SVG-Icons und Zeit-Formatierung fuer den Video-Player.
// Nutzt das zentrale IconSystem; Icons sind gefuellt (fill: currentColor).

import { icon } from '../icons/IconSystem.js';

export const ICON_PLAY = icon('play', { className: 'crm-icon--filled' });
export const ICON_PAUSE = icon('pause', { className: 'crm-icon--filled' });
export const ICON_VOLUME = icon('speaker-wave', { className: 'crm-icon--filled' });
export const ICON_MUTE = icon('speaker-x-mark', { className: 'crm-icon--filled' });
export const ICON_FS = icon('arrows-expand-filled', { className: 'crm-icon--filled' });
export const ICON_FS_EXIT = icon('arrows-collapse-filled', { className: 'crm-icon--filled' });
export const ICON_CLOSE = icon('x-mark', { className: 'crm-icon--filled' });
export const ICON_DROPBOX = icon('dropbox', { className: 'crm-icon--filled' });

export function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
