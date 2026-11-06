// Sperrseite und der Weg aus der Gast-Ansicht ins Kundenkonto.

import { icon } from '../../core/icons/IconSystem.js';
import { beginAccountLogin } from './accountReturn.js';
import { clearAllGuestSessions, listStoredGuestSessions } from './guestSession.js';

export const ENTITY_LABELS = {
  kampagne: 'Kampagne',
  sourcing: 'Casting-Liste',
  strategie: 'Konzept',
  skript: 'Skript',
  skript_paket: 'Skripte',
};

export function mountGuestAccountBar(appRoot, { token, route, entityType }) {
  const paket = entityType === 'skript_paket';
  mountAccountBar(appRoot, () => {
    beginAccountLogin({
      back: `/share/${token}`,
      after: paket ? 'package' : 'list',
    });
    window.location.href = paket ? '/' : route;
  });
}

function mountAccountBar(appRoot, onClick) {
  appRoot.querySelector('.guest-account-bar')?.remove();
  const bar = document.createElement('div');
  bar.className = 'guest-account-bar';
  bar.innerHTML = `<button type="button" class="mdc-btn mdc-btn--secondary" id="guest-account-login">Mit Kundenkonto anmelden</button>`;
  appRoot.prepend(bar);
  bar.querySelector('#guest-account-login').addEventListener('click', onClick);
}

export async function renderGuestNoAccess() {
  const loginRoot = document.getElementById('login-root');
  const appRoot = document.getElementById('app-root');
  if (appRoot) appRoot.style.display = 'none';
  if (loginRoot) loginRoot.style.display = '';

  const shares = listStoredGuestSessions();

  const shareLinks = shares.map((s) => {
    const label = ENTITY_LABELS[s.entityType] || 'Liste';
    const name = s.entityName;
    return `
      <a class="guest-share-link" href="/share/${escapeHtml(s.token)}">
        <span class="guest-share-link-text">
          <span class="guest-share-link-title">${label} öffnen</span>
          ${name ? `<span class="guest-share-link-subtitle">${escapeHtml(name)}</span>` : ''}
        </span>
        ${icon('arrow-right')}
      </a>`;
  }).join('');

  loginRoot.innerHTML = `
    <div class="login-split-container">
      <div class="login-left">
        <div class="login-box auth-card">
          <div class="login-logo-wrapper">
            <img src="/assets/background/Logo-Icon-gray.svg" alt="Logo" class="login-logo">
          </div>
          <h1 class="auth-title">Kein Zugriff auf diesen Bereich</h1>
          <p class="auth-subtitle guest-onboarding-note">
            Ihr Zugang gilt nur für die mit Ihnen geteilten Listen.
          </p>
          ${shares.length > 0 ? `
            <div class="guest-share-links">${shareLinks}</div>
          ` : `
            <p class="guest-onboarding-note">
              Es liegen auf diesem Gerät keine gespeicherten Zugänge vor.
            </p>
          `}
          <button type="button" id="guest-account-login" class="verify-button">Mit Kundenkonto anmelden</button>
          <button id="guest-logout-btn" class="resend-button">Abmelden</button>
        </div>
      </div>
      <div class="login-right"></div>
    </div>
  `;

  document.getElementById('guest-account-login')?.addEventListener('click', () => {
    beginAccountLogin({ back: 'lock', after: 'home' });
    window.location.href = '/';
  });

  document.getElementById('guest-logout-btn')?.addEventListener('click', () => {
    clearAllGuestSessions();
    window.guestShare = null;
    window.location.href = '/';
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
