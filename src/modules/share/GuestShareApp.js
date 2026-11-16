// GuestShareApp.js
// Gast-Zugang ohne Account: /share/:token
//
// Ablauf:
//  1. Token über shareApi.resolve auflösen
//  2. Login auf dem Gerät? Liste per RLS sichtbar → ins Konto weiterleiten;
//     sonst Mitarbeiter → Vorschau als Gast (1 h, nur lesen, nicht gespeichert)
//  3. Gespeichertes Gast-JWT für diesen Token? → Liste direkt
//  4. Sonst: 6-stelliger Code + Name → verify → Gast-JWT (30 Tage)
//  5. Gast-Shell (keine Navigation), nur die geteilte Liste

import { permissionSystem } from '../../core/PermissionSystem.js';
import { ensureSpriteMounted, icon } from '../../core/icons/IconSystem.js';
import {
  applyGuestJwt,
  clearGuestSession,
  getGuestSession,
  syntheticGuestUser,
} from './guestSession.js';
import { mountGuestAccountBar } from './guestLockPage.js';
import { renderMessage } from './guestMessage.js';
import { renderOnboarding } from './guestOnboarding.js';
import { accountEntry, detectAccountSession } from './guestAccountEntry.js';
import { shareApi } from './shareApi.js';
export { renderGuestNoAccess } from './guestLockPage.js';

const ENTITY_ROUTES = {
  kampagne: (id) => `/kampagne/${id}`,
  sourcing: (id) => `/castings/${id}`,
  strategie: (id) => `/konzepte/${id}`,
  skript: (id) => `/skripte/${id}`,
  skript_paket: () => '/skripte',
};

const UNGUELTIG = 'Dieser Link ist ungültig oder wurde widerrufen.';

export async function initGuestShare(token) {
  const loginRoot = document.getElementById('login-root');
  const appRoot = document.getElementById('app-root');
  if (appRoot) appRoot.style.display = 'none';
  if (loginRoot) loginRoot.style.display = '';

  renderMessage(loginRoot, 'Link wird geprüft …');

  let share;
  try {
    share = await shareApi.resolve(token);
  } catch (err) {
    console.error('Share-Resolve fehlgeschlagen:', err);
    renderMessage(loginRoot, 'Der Link konnte nicht geprüft werden. Bitte später erneut versuchen.', true);
    return;
  }

  if (!share?.valid) {
    // Nur eine ausdrückliche Absage des Servers löscht die Sitzung, kein Netzwerkfehler.
    if (share?.valid === false) clearGuestSession(token);
    renderMessage(loginRoot, share?.fehler || UNGUELTIG, true);
    return;
  }

  const konto = await accountEntry(token, share);
  if (konto?.route) {
    window.location.replace(konto.route);
    return;
  }
  if (konto?.vorschau) {
    await enterGuestApp(token, { ...share, ...konto.vorschau }, { vorschau: true });
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

  renderOnboarding(loginRoot, token, share, (data) => enterGuestApp(token, { ...share, ...data }));
}

async function enterGuestApp(token, share, { vorschau = false } = {}) {
  const loginRoot = document.getElementById('login-root');
  const appRoot = document.getElementById('app-root');
  renderMessage(loginRoot, 'Wird geladen …');

  if (!share.jwt) {
    renderMessage(loginRoot, 'Anmeldung fehlgeschlagen. Bitte den Link erneut öffnen.', true);
    return;
  }

  // Muss vor applyGuestJwt laufen: danach ist window.supabase der Gast-Client.
  const hasAccountSession = vorschau || await detectAccountSession();

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
    entityName: share.entityName || '',
    rechte: share.rechte,
    allowedRoute: route,
    name: share.name,
    vorschau,
  };

  const user = syntheticGuestUser(share.name, share.participantId);
  window.currentUser = user;
  permissionSystem.setUserPermissions(user);
  permissionSystem.setScopedPermissions([]);

  ensureSpriteMounted();

  appRoot.classList.add('guest-mode');
  appRoot.style.display = '';
  loginRoot.style.display = 'none';
  if (!vorschau) mountGuestAccountBar(appRoot, { token, route, entityType: share.entityType });

  if (hasAccountSession) mountBackToDashboard(appRoot, { vorschau });

  await window.moduleRegistry.navigateTo(route, true);
}

// Der Gast-Client ersetzt window.supabase und der Router ist auf die geteilte
// Liste gesperrt. Zurück ins Dashboard geht deshalb nur per vollem Reload.
function mountBackToDashboard(appRoot, { vorschau = false } = {}) {
  const main = appRoot?.querySelector('.main-content');
  if (!main || main.querySelector('.guest-back-bar')) return;

  const bar = document.createElement('div');
  bar.className = 'guest-back-bar';
  bar.innerHTML = `
    <a class="guest-back-link" href="/">
      ${icon('arrow-left')}
      <span>Zum Dashboard</span>
    </a>
    ${vorschau ? '<span class="guest-preview-hint">Vorschau als Gast · nur lesen</span>' : ''}`;
  bar.querySelector('.guest-back-link').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/';
  });
  main.prepend(bar);
}
