// GuestShareApp.js
// Gast-Zugang ohne Account: /share/:token
//
// Ablauf:
//  1. Token via Edge Function 'share-list' (action: resolve) auflösen
//  2. Gespeichertes Gast-JWT für diesen Token? → Liste direkt
//  3. Sonst: 6-stelliger Code + Name → verify → Gast-JWT (30 Tage)
//  4. Gast-Shell (keine Navigation), nur die geteilte Liste

import { permissionSystem } from '../../core/PermissionSystem.js';
import { icon, ensureSpriteMounted } from '../../core/icons/IconSystem.js';
import {
  applyGuestJwt,
  clearAllGuestSessions,
  clearGuestSession,
  getGuestSession,
  listStoredGuestSessions,
  saveGuestSession,
  syntheticGuestUser,
} from './guestSession.js';

const ENTITY_ROUTES = {
  kampagne: (id) => `/kampagne/${id}`,
  sourcing: (id) => `/sourcing/${id}`,
  strategie: (id) => `/strategie/${id}`,
};

const ENTITY_LABELS = {
  kampagne: 'Kampagne',
  sourcing: 'Sourcing-Liste',
  strategie: 'Strategie-Liste',
};

export async function initGuestShare(token) {
  const loginRoot = document.getElementById('login-root');
  const appRoot = document.getElementById('app-root');
  if (appRoot) appRoot.style.display = 'none';
  if (loginRoot) loginRoot.style.display = '';

  renderMessage(loginRoot, 'Link wird geprüft …');

  let share;
  try {
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: { action: 'resolve', token },
    });
    if (error && !data?.valid && !data?.error) {
      const detail = await readFunctionError(error);
      renderMessage(loginRoot, detail || 'Dieser Link ist ungültig oder wurde widerrufen.', true);
      return;
    }
    share = data;
  } catch (err) {
    console.error('Share-Resolve fehlgeschlagen:', err);
    renderMessage(loginRoot, 'Der Link konnte nicht geprüft werden. Bitte später erneut versuchen.', true);
    return;
  }

  if (!share?.valid) {
    clearGuestSession(token);
    renderMessage(loginRoot, share?.error || 'Dieser Link ist ungültig oder wurde widerrufen.', true);
    return;
  }

  const stored = getGuestSession(token);
  if (stored?.jwt) {
    await enterGuestApp(token, {
      ...share,
      jwt: stored.jwt,
      name: stored.name,
      participantId: stored.participantId,
    });
    return;
  }

  renderOnboarding(loginRoot, token, share);
}

function renderOnboarding(root, token, share) {
  const label = ENTITY_LABELS[share.entityType] || 'Liste';
  const listName = share.entityName ? ` „${share.entityName}“` : '';
  const storedName = localStorage.getItem('cj24.guestName') || '';

  root.innerHTML = `
    <div class="login-split-container">
      <div class="login-left">
        <div class="login-box auth-card">
          <div class="login-logo-wrapper">
            <img src="/assets/background/Logo-Icon-gray.svg" alt="Logo" class="login-logo">
          </div>
          <h1 class="auth-title">Geteilte ${label}</h1>
          <p class="auth-subtitle">${escapeHtml(listName ? label + listName : label)}</p>

          <div class="form-box guest-form">
            <label class="label" for="guest-name-input">Ihr Name</label>
            <input type="text" id="guest-name-input" class="input" placeholder="Vor- und Nachname"
                   value="${escapeHtml(storedName)}" autocomplete="name" maxlength="80">
          </div>

          <p class="auth-subtitle guest-code-label">6-stelliger Zugangscode</p>
          <div class="otp-container">
            <div class="otp-inputs" id="guest-otp-inputs">
              <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="one-time-code">
              <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
              <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
              <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
              <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
              <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
            </div>
            <button id="guest-verify-code" class="verify-button">Zugang öffnen</button>
          </div>
          <p class="guest-onboarding-note">
            Den Code finden Sie in der Einladungsmail. Ein Account ist nicht nötig.
            Die Sitzung bleibt 30 Tage auf diesem Gerät gültig.
          </p>

          <div id="guest-error" class="auth-alert auth-alert--error" style="display:none;"></div>
        </div>
      </div>
      <div class="login-right"></div>
    </div>
  `;

  const nameInput = document.getElementById('guest-name-input');
  const otpInputs = Array.from(root.querySelectorAll('.otp-input'));
  const errorEl = document.getElementById('guest-error');

  const showError = (msg) => {
    errorEl.textContent = msg;
    errorEl.style.display = '';
  };
  const clearError = () => { errorEl.style.display = 'none'; };

  const getCode = () => otpInputs.map((i) => i.value).join('');
  const updateOtpStyling = () => {
    otpInputs.forEach((input) => {
      input.classList.remove('filled', 'error');
      if (input.value) input.classList.add('filled');
    });
  };
  const clearOtp = (focus = true) => {
    otpInputs.forEach((input) => { input.value = ''; });
    updateOtpStyling();
    if (focus) otpInputs[0].focus();
  };

  let isVerifying = false;
  const verify = async () => {
    if (isVerifying) return;
    clearError();
    const name = nameInput.value.trim();
    if (name.length < 2) {
      showError('Bitte Ihren Namen eingeben (mindestens 2 Zeichen).');
      nameInput.focus();
      return;
    }
    const code = getCode();
    if (!/^\d{6}$/.test(code)) {
      showError('Bitte den 6-stelligen Code eingeben.');
      return;
    }
    const btn = document.getElementById('guest-verify-code');
    isVerifying = true;
    btn.disabled = true;
    btn.textContent = 'Wird geprüft …';

    try {
      const { data, error } = await window.supabase.functions.invoke('share-list', {
        body: { action: 'verify', token, code, name },
      });
      const errMsg = data?.error || (error ? (await readFunctionError(error)) : null);
      if (errMsg || !data?.jwt) {
        showError(errMsg || 'Der Code ist ungültig.');
        otpInputs.forEach((input) => { if (input.value) input.classList.add('error'); });
        setTimeout(() => clearOtp(), 1500);
        return;
      }
      localStorage.setItem('cj24.guestName', name);
      saveGuestSession(token, {
        jwt: data.jwt,
        name: data.name || name,
        shareId: data.shareId,
        entityType: data.entityType,
        entityId: data.entityId,
        rechte: data.rechte,
        entityName: data.entityName,
        participantId: data.participantId,
      });
      await enterGuestApp(token, { ...share, ...data, name: data.name || name });
    } catch (err) {
      console.error('Share-Verify fehlgeschlagen:', err);
      showError('Prüfung fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      isVerifying = false;
      btn.disabled = false;
      btn.textContent = 'Zugang öffnen';
    }
  };

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') otpInputs[0].focus();
  });

  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const value = e.target.value;
      if (!/^\d$/.test(value) && value !== '') {
        e.target.value = '';
        return;
      }
      if (value && index < otpInputs.length - 1) {
        setTimeout(() => {
          otpInputs[index + 1].focus();
          otpInputs[index + 1].select();
        }, 10);
      }
      updateOtpStyling();
      if (getCode().length === 6 && nameInput.value.trim().length >= 2) {
        setTimeout(() => verify(), 200);
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        otpInputs[index - 1].focus();
        otpInputs[index - 1].value = '';
        updateOtpStyling();
      }
      if (e.key === 'ArrowLeft' && index > 0) otpInputs[index - 1].focus();
      if (e.key === 'ArrowRight' && index < otpInputs.length - 1) otpInputs[index + 1].focus();
      if (e.key === 'Enter') verify();
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (pasteData.length === 6) {
        otpInputs.forEach((otp, i) => { otp.value = pasteData[i] || ''; });
        updateOtpStyling();
        if (nameInput.value.trim().length >= 2) verify();
      }
    });
  });

  document.getElementById('guest-verify-code').addEventListener('click', verify);
  nameInput.focus();
}

async function enterGuestApp(token, share) {
  const loginRoot = document.getElementById('login-root');
  const appRoot = document.getElementById('app-root');
  renderMessage(loginRoot, 'Liste wird geladen …');

  if (!share.jwt) {
    renderMessage(loginRoot, 'Anmeldung fehlgeschlagen. Bitte den Link erneut öffnen.', true);
    return;
  }

  try {
    applyGuestJwt(share.jwt);
  } catch (err) {
    console.error(err);
    renderMessage(loginRoot, 'Zugang konnte nicht eingerichtet werden.', true);
    return;
  }

  const route = ENTITY_ROUTES[share.entityType]?.(share.entityId);
  if (!route) {
    renderMessage(loginRoot, 'Unbekannter Listen-Typ.', true);
    return;
  }

  window.guestShare = {
    token,
    entityType: share.entityType,
    entityId: share.entityId,
    rechte: share.rechte,
    allowedRoute: route,
    name: share.name,
  };

  const user = syntheticGuestUser(share.name, share.participantId);
  window.currentUser = user;
  permissionSystem.setUserPermissions(user);
  permissionSystem.setScopedPermissions([]);

  ensureSpriteMounted();

  appRoot.classList.add('guest-mode');
  appRoot.style.display = '';
  loginRoot.style.display = 'none';

  await window.moduleRegistry.navigateTo(route, true);
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
          <button id="guest-logout-btn" class="resend-button">Abmelden</button>
        </div>
      </div>
      <div class="login-right"></div>
    </div>
  `;

  document.getElementById('guest-logout-btn')?.addEventListener('click', () => {
    clearAllGuestSessions();
    window.guestShare = null;
    window.location.href = '/';
  });
}

function renderMessage(root, text, isError = false) {
  if (!root) return;
  root.innerHTML = `
    <div class="login-split-container">
      <div class="login-left">
        <div class="login-box auth-card">
          <div class="login-logo-wrapper">
            <img src="/assets/background/Logo-Icon-gray.svg" alt="Logo" class="login-logo">
          </div>
          ${isError
            ? `<div class="auth-alert auth-alert--error guest-flush">${escapeHtml(text)}</div>`
            : `<p class="auth-subtitle guest-flush">${escapeHtml(text)}</p>`}
        </div>
      </div>
      <div class="login-right"></div>
    </div>
  `;
}

async function readFunctionError(error) {
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const body = await error.context.json();
      return body?.error || null;
    }
  } catch { /* ignore */ }
  return null;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
