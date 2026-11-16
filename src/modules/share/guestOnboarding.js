// Code-Maske der Gastseite: Name + 6-stelliger Code → verify → Gast-JWT (30 Tage, gespeichert).

import { escapeHtml } from '../../core/format.js';
import { ENTITY_LABELS } from './guestLockPage.js';
import { saveGuestSession } from './guestSession.js';
import { shareApi } from './shareApi.js';

const NAME_KEY = 'cj24.guestName';

function onboardingSubtitle(share) {
  if (share.entityType === 'skript_paket' && share.entityName) return share.entityName;
  const label = ENTITY_LABELS[share.entityType] || 'Liste';
  return share.entityName ? `${label} „${share.entityName}“` : label;
}

function maskeHtml(share) {
  const label = ENTITY_LABELS[share.entityType] || 'Liste';
  const storedName = localStorage.getItem(NAME_KEY) || '';
  const otp = Array.from({ length: 6 }, (_, i) => `
              <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="${i === 0 ? 'one-time-code' : 'off'}">`).join('');
  return `
    <div class="login-split-container">
      <div class="login-left">
        <div class="login-box auth-card">
          <div class="login-logo-wrapper">
            <img src="/assets/background/Logo-Icon-gray.svg" alt="Logo" class="login-logo">
          </div>
          <h1 class="auth-title">Geteilte ${label}</h1>
          <p class="auth-subtitle">${escapeHtml(onboardingSubtitle(share))}</p>

          <div class="form-box guest-form">
            <label class="label" for="guest-name-input">Ihr Name</label>
            <input type="text" id="guest-name-input" class="input" placeholder="Vor- und Nachname"
                   value="${escapeHtml(storedName)}" autocomplete="name" maxlength="80">
          </div>

          <p class="auth-subtitle guest-code-label">6-stelliger Zugangscode</p>
          <div class="otp-container">
            <div class="otp-inputs" id="guest-otp-inputs">${otp}
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
}

/** `onVerified(data)` läuft nach erfolgreichem verify, die Sitzung ist dann schon gespeichert. */
export function renderOnboarding(root, token, share, onVerified) {
  root.innerHTML = maskeHtml(share);

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
      const data = await shareApi.verify({ token, code, name });
      if (!data.ok || !data.jwt) {
        showError(data.fehler || 'Der Code ist ungültig.');
        otpInputs.forEach((input) => { if (input.value) input.classList.add('error'); });
        setTimeout(() => clearOtp(), 1500);
        return;
      }
      localStorage.setItem(NAME_KEY, name);
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
      await onVerified({ ...data, name: data.name || name });
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
