// HeaderChatSlot.js
// Globaler Chat-Einstieg in der Topbar (.header-actions). Eine Seite
// registriert den Button beim Mount, auf allen anderen Routen ist er
// versteckt. Singleton: es kann immer nur ein Chat-Host aktiv sein.

import { icon } from '../icons/IconSystem.js';

export const HEADER_CHAT_BTN_ID = 'header-chat-toggle';

let _btn = null;
let _onClick = null;

function ensureButton() {
  if (_btn?.isConnected) return _btn;
  const actions = document.querySelector('.header-actions');
  if (!actions) return null;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = HEADER_CHAT_BTN_ID;
  btn.className = 'secondary-btn header-chat-toggle';
  btn.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = `${icon('ai-chat')}<span class="header-chat-dot" hidden></span>`;

  actions.insertBefore(btn, actions.firstChild);
  _btn = btn;
  return btn;
}

export function registerHeaderChatToggle({ onToggle, title = 'Chat öffnen' }) {
  const btn = ensureButton();
  if (!btn) return null;
  unregisterHeaderChatToggle();
  _onClick = onToggle;
  btn.addEventListener('click', onToggle);
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.hidden = false;
  return btn;
}

export function unregisterHeaderChatToggle() {
  if (_btn && _onClick) _btn.removeEventListener('click', _onClick);
  _onClick = null;
  if (_btn) {
    _btn.hidden = true;
    _btn.setAttribute('aria-expanded', 'false');
    _btn.classList.remove('is-offen');
    setHeaderChatDot(false);
  }
}

export function syncHeaderChatToggle(offen) {
  if (!_btn) return;
  _btn.setAttribute('aria-expanded', String(Boolean(offen)));
  _btn.classList.toggle('is-offen', Boolean(offen));
}

export function setHeaderChatDot(aktiv) {
  const dot = _btn?.querySelector('.header-chat-dot');
  if (dot) dot.hidden = !aktiv;
}
