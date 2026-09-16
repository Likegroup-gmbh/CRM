// ChannelBadge.js
// Kleines dauerhaftes v2-Pill oben rechts. Nur wenn VITE_APP_CHANNEL=v2
// (lokal .env, Netlify [context.v2]). Sitzt am body, damit Login und App
// dasselbe Badge sehen — nicht der Deploy-Banner in VersionCheck.

import { CONFIG } from './ConfigSystem.js';

export function initChannelBadge() {
  if (typeof document === 'undefined') return;
  if (CONFIG.APP.CHANNEL !== 'v2') return;
  if (document.querySelector('.channel-badge')) return;

  const badge = document.createElement('div');
  badge.className = 'channel-badge';
  badge.textContent = 'v2';
  badge.setAttribute('aria-label', 'Vorschau Version 2');
  badge.title = 'Parallelbetrieb: v2-Vorschau';

  const mount = () => document.body.append(badge);
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
}
