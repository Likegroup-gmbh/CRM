// ChannelBadge.js
// Kleines v2-Pill oben rechts (Parallelbetrieb). Sitzt am body, damit Login und App dasselbe
// Badge sehen — nicht der Deploy-Banner in VersionCheck.
// Zwei Bedingungen: VITE_APP_CHANNEL=v2 UND Schalter an. Der Schalter steht in schalter.json
// (channelBadge, aktuell AUS). VITE_CHANNEL_BADGE=on|off übersteuert die Datei (.env, Netlify),
// wirkt erst nach neuem Build. Aus = kein DOM, kein CSS-Import; der Rest des Moduls bleibt.

import { CONFIG } from '../ConfigSystem.js';
import schalter from './schalter.json';

export function channelBadgeAktiv(env = import.meta.env.VITE_CHANNEL_BADGE, datei = schalter) {
  const wert = String(env || '').toLowerCase();
  if (wert === 'on') return true;
  if (wert === 'off') return false;
  return datei.channelBadge === true;
}

export function initChannelBadge() {
  if (typeof document === 'undefined') return;
  if (!channelBadgeAktiv()) return;
  if (CONFIG.APP.CHANNEL !== 'v2') return;
  if (document.querySelector('.channel-badge')) return;

  import('./channel-badge.css');

  const badge = document.createElement('div');
  badge.className = 'channel-badge';
  badge.textContent = 'v2';
  badge.setAttribute('aria-label', 'Vorschau Version 2');
  badge.title = 'Parallelbetrieb: v2-Vorschau';

  const mount = () => document.body.append(badge);
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
}
