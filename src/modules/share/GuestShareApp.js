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
    <div class="guest-onboarding">
      <div class="guest-onboarding-card">
        <h2>Geteilte ${label}</h2>
        <p class="guest-onboarding-info">
          Dieser Zugang ist für <strong>${escapeHtml(share.email)}</strong> bestimmt.
          Zur Bestätigung senden wir einen 6-stelligen Code an diese E-Mail-Adresse.
        </p>

        <div id="guest-step-name">
          <label class="label" for="guest-name-input">Ihr Name</label>
          <input type="text" id="guest-name-input" class="input" placeholder="Vor- und Nachname"
                 value="${escapeHtml(share.gastName || '')}" autocomplete="name">
          <button id="guest-send-code" class="primary-btn guest-btn">Code anfordern</button>
        </div>

        <div id="guest-step-code" style="display:none;">
          <label class="label" for="guest-code-input">Sicherheitscode</label>
          <input type="text" id="guest-code-input" class="input" inputmode="numeric" maxlength="6"
                 placeholder="6-stelliger Code" autocomplete="one-time-code">
          <button id="guest-verify-code" class="primary-btn guest-btn">Bestätigen</button>
          <button id="guest-resend-code" class="guest-link-btn">Code erneut senden</button>
        </div>

        <p id="guest-error" class="guest-onboarding-error" style="display:none;"></p>
      </div>
    </div>
  `;

  const nameInput = document.getElementById('guest-name-input');
  const codeInput = document.getElementById('guest-code-input');
  const errorEl = document.getElementById('guest-error');

  const showError = (msg) => {
    errorEl.textContent = msg;
    errorEl.style.display = '';
  };
  const clearError = () => { errorEl.style.display = 'none'; };

  const sendCode = async (btn) => {
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
    btn.textContent = btn.id === 'guest-send-code' ? 'Code anfordern' : 'Code erneut senden';
    if (error) {
      console.error('OTP-Versand fehlgeschlagen:', error);
      showError('Der Code konnte nicht gesendet werden. Bitte kurz warten und erneut versuchen.');
      return;
    }
    document.getElementById('guest-step-name').style.display = 'none';
    document.getElementById('guest-step-code').style.display = '';
    codeInput.focus();
  };

  document.getElementById('guest-send-code').addEventListener('click', (e) => sendCode(e.currentTarget));
  document.getElementById('guest-resend-code').addEventListener('click', (e) => {
    e.preventDefault();
    sendCode(e.currentTarget);
  });

  const verify = async () => {
    clearError();
    const code = codeInput.value.trim();
    if (!/^\d{6}$/.test(code)) {
      showError('Bitte geben Sie den 6-stelligen Code ein.');
      return;
    }
    const btn = document.getElementById('guest-verify-code');
    btn.disabled = true;
    btn.textContent = 'Wird geprüft …';
    const { error } = await window.supabase.auth.verifyOtp({
      email: share.email,
      token: code,
      type: 'email',
    });
    btn.disabled = false;
    btn.textContent = 'Bestätigen';
    if (error) {
      console.error('OTP-Verifikation fehlgeschlagen:', error);
      showError('Der Code ist ungültig oder abgelaufen.');
      return;
    }
    await enterGuestApp(token, share, nameInput.value.trim());
  };

  document.getElementById('guest-verify-code').addEventListener('click', verify);
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') verify(); });
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
      .select('token, entity_type, created_at')
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    shares = data || [];
  } catch (e) {
    console.warn('Shares konnten nicht geladen werden:', e);
  }

  const shareLinks = shares.map((s) => {
    const label = ENTITY_LABELS[s.entity_type] || 'Liste';
    return `
      <a class="guest-share-link" href="/share/${escapeHtml(s.token)}">
        <span>${label} öffnen</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </a>`;
  }).join('');

  loginRoot.innerHTML = `
    <div class="guest-onboarding">
      <div class="guest-onboarding-card">
        <h2>Kein Zugriff auf diesen Bereich</h2>
        <p class="guest-onboarding-info">
          Danke für Ihr Interesse — Ihr Zugang gilt nur für die mit Ihnen geteilten Listen.
        </p>
        ${shares.length > 0 ? `
          <div class="guest-share-links">${shareLinks}</div>
        ` : `
          <p class="guest-onboarding-info" style="margin-bottom:16px;">
            Ihr Zugang wurde widerrufen oder es liegen keine geteilten Listen vor.
          </p>
        `}
        <button id="guest-logout-btn" class="guest-link-btn">Abmelden</button>
      </div>
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

function renderMessage(root, text, isError = false) {
  if (!root) return;
  root.innerHTML = `
    <div class="guest-onboarding">
      <div class="guest-onboarding-card">
        <p class="${isError ? 'guest-onboarding-error' : ''}" style="margin:0;">${escapeHtml(text)}</p>
      </div>
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
