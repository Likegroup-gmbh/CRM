// GuestShareApp.js
// Gast-Zugang ohne Account: /share/:token
//
// Ablauf:
//  1. Token via Edge Function 'share-list' (action: resolve) auflösen
//  2. Bestehende Session prüfen (muss zur Share-E-Mail gehören)
//  3. Ohne Session: Name + 6-stelliger E-Mail-Code (Supabase-OTP) — einmal pro Gerät
//  4. Danach: Gast-Shell (keine Navigation), nur die geteilte Liste

import { permissionSystem } from '../../core/PermissionSystem.js';

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

  // 1) Token auflösen
  let share;
  try {
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: { action: 'resolve', token },
    });
    if (error) {
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
    renderMessage(loginRoot, share?.error || 'Dieser Link ist ungültig oder wurde widerrufen.', true);
    return;
  }

  // 2) Bestehende Session prüfen
  const { data: { session } } = await window.supabase.auth.getSession();
  if (session) {
    if ((session.user.email || '').toLowerCase() === share.email.toLowerCase()) {
      await enterGuestApp(token, share);
      return;
    }
    // Session eines anderen Nutzers → abmelden, Gast-Onboarding starten
    await window.supabase.auth.signOut();
  }

  renderOnboarding(loginRoot, token, share);
}

// ---------------------------------------------------------------------
// Onboarding-UI (Name + OTP)
// ---------------------------------------------------------------------

function renderOnboarding(root, token, share) {
  const label = ENTITY_LABELS[share.entityType] || 'Liste';
  root.innerHTML = `
    <div class="login-split-container">
      <div class="login-left">
        <div class="login-box auth-card">
          <div class="login-logo-wrapper">
            <img src="/assets/background/Logo-Icon-gray.svg" alt="Logo" class="login-logo">
          </div>
          <h1 class="auth-title">Geteilte ${label}</h1>

          <div id="guest-step-name">
            <p class="auth-subtitle">Dieser Zugang ist bestimmt für:</p>
            <div class="email-address">${escapeHtml(share.email)}</div>
            <div class="form-box guest-form">
              <label class="label" for="guest-name-input">Ihr Name</label>
              <input type="text" id="guest-name-input" class="input" placeholder="Vor- und Nachname"
                     value="${escapeHtml(share.gastName || '')}" autocomplete="name">
            </div>
            <button id="guest-send-code" class="verify-button">Code anfordern</button>
            <p class="guest-onboarding-note">
              Zur Bestätigung senden wir einen 6-stelligen Code an diese E-Mail-Adresse.
              Ein Account oder Passwort ist nicht nötig.
            </p>
          </div>

          <div id="guest-step-code" style="display:none;">
            <p class="auth-subtitle">Wir haben einen 6-stelligen Code gesendet an:</p>
            <div class="email-address">${escapeHtml(share.email)}</div>
            <div class="otp-container">
              <div class="otp-inputs" id="guest-otp-inputs">
                <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
                <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
                <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
                <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
                <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
                <input type="text" class="otp-input" maxlength="1" inputmode="numeric" autocomplete="off">
              </div>
              <button id="guest-verify-code" class="verify-button">Code bestätigen</button>
            </div>
            <div class="resend-container">
              <span class="resend-text">Code nicht erhalten? </span>
              <button id="guest-resend-code" class="resend-button">Code erneut senden</button>
            </div>
          </div>

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

  const sendCode = async (btn, idleLabel) => {
    clearError();
    const name = nameInput.value.trim();
    if (!name) {
      showError('Bitte geben Sie Ihren Namen ein.');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Wird gesendet …';
    // shouldCreateUser: false — der Gast-Auth-User wurde beim Teilen angelegt
    const { error } = await window.supabase.auth.signInWithOtp({
      email: share.email,
      options: { shouldCreateUser: false },
    });
    btn.disabled = false;
    btn.textContent = idleLabel;
    if (error) {
      console.error('OTP-Versand fehlgeschlagen:', error);
      showError('Der Code konnte nicht gesendet werden. Bitte kurz warten und erneut versuchen.');
      return;
    }
    document.getElementById('guest-step-name').style.display = 'none';
    document.getElementById('guest-step-code').style.display = '';
    clearOtp();
  };

  document.getElementById('guest-send-code').addEventListener('click', (e) =>
    sendCode(e.currentTarget, 'Code anfordern'));
  document.getElementById('guest-resend-code').addEventListener('click', (e) => {
    e.preventDefault();
    sendCode(e.currentTarget, 'Code erneut senden');
  });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendCode(document.getElementById('guest-send-code'), 'Code anfordern');
  });

  let isVerifying = false;
  const verify = async () => {
    if (isVerifying) return;
    clearError();
    const code = getCode();
    if (!/^\d{6}$/.test(code)) {
      showError('Bitte geben Sie den 6-stelligen Code ein.');
      return;
    }
    const btn = document.getElementById('guest-verify-code');
    isVerifying = true;
    btn.disabled = true;
    btn.textContent = 'Wird geprüft …';
    const { error } = await window.supabase.auth.verifyOtp({
      email: share.email,
      token: code,
      type: 'email',
    });
    isVerifying = false;
    btn.disabled = false;
    btn.textContent = 'Code bestätigen';
    if (error) {
      console.error('OTP-Verifikation fehlgeschlagen:', error);
      showError('Der Code ist ungültig oder abgelaufen.');
      otpInputs.forEach((input) => { if (input.value) input.classList.add('error'); });
      setTimeout(() => clearOtp(), 1500);
      return;
    }
    await enterGuestApp(token, share, nameInput.value.trim());
  };

  // OTP-Boxen: Auto-Advance, Backspace, Pfeiltasten, Paste, Auto-Verify
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
      if (getCode().length === 6) {
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
        verify();
      }
    });
  });

  document.getElementById('guest-verify-code').addEventListener('click', verify);
}

// ---------------------------------------------------------------------
// Gast-Shell starten
// ---------------------------------------------------------------------

async function enterGuestApp(token, share, enteredName = '') {
  const loginRoot = document.getElementById('login-root');
  const appRoot = document.getElementById('app-root');
  renderMessage(loginRoot, 'Liste wird geladen …');

  const { data: { session } } = await window.supabase.auth.getSession();
  if (!session) {
    renderMessage(loginRoot, 'Anmeldung fehlgeschlagen. Bitte den Link erneut öffnen.', true);
    return;
  }

  // Benutzer-Zeile laden (+ Name speichern, falls neu eingegeben)
  const { data: benutzer, error } = await window.supabase
    .from('benutzer')
    .select('*')
    .eq('auth_user_id', session.user.id)
    .single();

  if (error || !benutzer) {
    console.error('Gast-Benutzer konnte nicht geladen werden:', error);
    renderMessage(loginRoot, 'Zugang konnte nicht geladen werden.', true);
    return;
  }

  if (enteredName && enteredName !== benutzer.name) {
    const { error: nameError } = await window.supabase
      .from('benutzer')
      .update({ name: enteredName })
      .eq('id', benutzer.id);
    if (!nameError) benutzer.name = enteredName;
  }

  const route = ENTITY_ROUTES[share.entityType]?.(share.entityId);
  if (!route) {
    renderMessage(loginRoot, 'Unbekannter Listen-Typ.', true);
    return;
  }

  // Gast-Kontext global setzen (ModuleRegistry-Routensperre + readonly-Checks)
  window.guestShare = {
    token,
    entityType: share.entityType,
    entityId: share.entityId,
    rechte: share.rechte,
    allowedRoute: route,
  };

  window.currentUser = benutzer;
  permissionSystem.setUserPermissions(benutzer);
  permissionSystem.setScopedPermissions([]);

  // Letzten Zugriff protokollieren (SECURITY DEFINER RPC)
  try {
    await window.supabase.rpc('touch_list_share', { p_token: token });
  } catch (e) {
    console.warn('touch_list_share fehlgeschlagen:', e);
  }

  // Shell: keine Sidebar, keine Header-Aktionen
  appRoot.classList.add('guest-mode');
  appRoot.style.display = '';
  loginRoot.style.display = 'none';

  // URL bleibt /share/<token> (Reload-fähig), Inhalt = geteilte Entität
  await window.moduleRegistry.navigateTo(route, true);
}

// ---------------------------------------------------------------------
// Sperrseite: Gast ruft normale App-URL statt Share-Link auf
// ---------------------------------------------------------------------

export async function renderGuestNoAccess() {
  const loginRoot = document.getElementById('login-root');
  const appRoot = document.getElementById('app-root');
  if (appRoot) appRoot.style.display = 'none';
  if (loginRoot) loginRoot.style.display = '';

  // Aktive Shares des Gasts laden (RLS: nur eigene, nicht widerrufene)
  let shares = [];
  try {
    const { data } = await window.supabase
      .from('list_shares')
      .select('token, entity_type, entity_id, created_at')
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    shares = data || [];
  } catch (e) {
    console.warn('Shares konnten nicht geladen werden:', e);
  }

  // Namen der geteilten Entitäten nachladen (RLS: Gast sieht genau diese Zeilen)
  const nameById = await loadShareEntityNames(shares);

  const shareLinks = shares.map((s) => {
    const label = ENTITY_LABELS[s.entity_type] || 'Liste';
    const name = nameById.get(s.entity_id);
    return `
      <a class="guest-share-link" href="/share/${escapeHtml(s.token)}">
        <span class="guest-share-link-text">
          <span class="guest-share-link-title">${label} öffnen</span>
          ${name ? `<span class="guest-share-link-subtitle">${escapeHtml(name)}</span>` : ''}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
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
            Danke für Ihr Interesse — Ihr Zugang gilt nur für die mit Ihnen geteilten Listen.
          </p>
          ${shares.length > 0 ? `
            <div class="guest-share-links">${shareLinks}</div>
          ` : `
            <p class="guest-onboarding-note">
              Ihr Zugang wurde widerrufen oder es liegen keine geteilten Listen vor.
            </p>
          `}
          <button id="guest-logout-btn" class="resend-button">Abmelden</button>
        </div>
      </div>
      <div class="login-right"></div>
    </div>
  `;

  document.getElementById('guest-logout-btn')?.addEventListener('click', async () => {
    try {
      await window.supabase.auth.signOut();
    } finally {
      window.location.href = '/';
    }
  });
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

// Lädt die Anzeigenamen der geteilten Entitäten batchweise pro Typ.
// Fehler sind unkritisch: ohne Namen entfällt nur der Untertext.
async function loadShareEntityNames(shares) {
  const idsByType = { kampagne: [], sourcing: [], strategie: [] };
  for (const s of shares) {
    if (idsByType[s.entity_type] && s.entity_id) idsByType[s.entity_type].push(s.entity_id);
  }

  const nameById = new Map();
  const queries = [];

  if (idsByType.kampagne.length > 0) {
    queries.push(
      window.supabase
        .from('kampagne')
        .select('id, eigener_name, kampagnenname')
        .in('id', idsByType.kampagne)
        .then(({ data }) => {
          for (const k of data || []) nameById.set(k.id, k.eigener_name || k.kampagnenname);
        })
    );
  }
  if (idsByType.sourcing.length > 0) {
    queries.push(
      window.supabase
        .from('creator_auswahl')
        .select('id, name')
        .in('id', idsByType.sourcing)
        .then(({ data }) => {
          for (const row of data || []) nameById.set(row.id, row.name);
        })
    );
  }
  if (idsByType.strategie.length > 0) {
    queries.push(
      window.supabase
        .from('strategie')
        .select('id, name')
        .in('id', idsByType.strategie)
        .then(({ data }) => {
          for (const row of data || []) nameById.set(row.id, row.name);
        })
    );
  }

  try {
    await Promise.allSettled(queries);
  } catch (e) {
    console.warn('Entitätsnamen konnten nicht geladen werden:', e);
  }
  return nameById;
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
            ? `<div class="auth-alert auth-alert--error" style="margin-bottom:0;">${escapeHtml(text)}</div>`
            : `<p class="auth-subtitle" style="margin-bottom:0;">${escapeHtml(text)}</p>`}
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
