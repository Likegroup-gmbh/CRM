import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initGuestShare, renderGuestNoAccess } from '../modules/share/GuestShareApp.js';
import { saveGuestSession, clearAllGuestSessions } from '../modules/share/guestSession.js';

function makeJwt(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=+$/g, '');
  const body = btoa(JSON.stringify(payload)).replace(/=+$/g, '');
  return `${header}.${body}.sig`;
}

const TOKEN = 'b'.repeat(48);
const SHARE = {
  valid: true,
  shareId: '11111111-1111-1111-1111-111111111111',
  entityType: 'sourcing',
  entityId: '22222222-2222-2222-2222-222222222222',
  rechte: 'feedback',
  entityName: 'Rückgabe Deal',
  label: 'Marketing',
};

describe('GuestShareApp', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllGuestSessions();
    document.body.innerHTML = `
      <div id="login-root"></div>
      <div id="app-root" style="display:none"></div>
    `;
    window.guestShare = null;
    window.CONFIG = { SUPABASE: { URL: 'https://example.supabase.co', KEY: 'anon-key' } };
    window.__supabaseCreateClient = vi.fn(() => ({ from: vi.fn() }));
    window.moduleRegistry = { navigateTo: vi.fn().mockResolvedValue(undefined) };
    window.supabase = {
      functions: { invoke: vi.fn() },
    };
  });

  it('resolve → Code+Name-Maske wenn kein JWT gespeichert', async () => {
    window.supabase.functions.invoke.mockResolvedValue({ data: SHARE, error: null });
    await initGuestShare(TOKEN);
    expect(document.getElementById('guest-name-input')).not.toBeNull();
    expect(document.getElementById('guest-verify-code')).not.toBeNull();
    expect(document.querySelectorAll('.otp-input')).toHaveLength(6);
  });

  it('gespeichertes JWT überspringt die Maske und rendert die Liste', async () => {
    const jwt = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, share_id: SHARE.shareId });
    saveGuestSession(TOKEN, { jwt, name: 'Pat', ...SHARE });
    window.supabase.functions.invoke.mockResolvedValue({ data: SHARE, error: null });

    await initGuestShare(TOKEN);

    expect(window.__supabaseCreateClient).toHaveBeenCalled();
    expect(window.currentUser).toMatchObject({ rolle: 'gast', name: 'Pat', id: null });
    expect(window.guestShare.allowedRoute).toBe(`/sourcing/${SHARE.entityId}`);
    expect(window.moduleRegistry.navigateTo).toHaveBeenCalledWith(`/sourcing/${SHARE.entityId}`, true);
    expect(document.getElementById('app-root').classList.contains('guest-mode')).toBe(true);
  });

  it('verify mit Code+Name speichert JWT und öffnet die Liste', async () => {
    window.supabase.functions.invoke
      .mockResolvedValueOnce({ data: SHARE, error: null })
      .mockResolvedValueOnce({
        data: { ...SHARE, jwt: makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }), name: 'Eileen', participantId: 'p1' },
        error: null,
      });

    const invoke = window.supabase.functions.invoke;
    await initGuestShare(TOKEN);
    document.getElementById('guest-name-input').value = 'Eileen';
    document.querySelectorAll('.otp-input').forEach((el, i) => { el.value = String(i + 1); });
    await document.getElementById('guest-verify-code').click();
    await vi.waitFor(() => {
      expect(window.moduleRegistry.navigateTo).toHaveBeenCalled();
    });
    expect(invoke).toHaveBeenCalledWith('share-list', {
      body: { action: 'verify', token: TOKEN, code: '123456', name: 'Eileen' },
    });
    expect(window.currentUser.name).toBe('Eileen');
  });

  it('zeigt Rate-Limit-Fehler ohne die Liste zu öffnen', async () => {
    window.supabase.functions.invoke
      .mockResolvedValueOnce({ data: SHARE, error: null })
      .mockResolvedValueOnce({ data: { error: 'Zu viele Versuche. Bitte 15 Minuten warten.' }, error: { message: '429' } });

    await initGuestShare(TOKEN);
    document.getElementById('guest-name-input').value = 'Pat Schmidt';
    document.querySelectorAll('.otp-input').forEach((el) => { el.value = '1'; });
    await document.getElementById('guest-verify-code').click();
    await vi.waitFor(() => {
      expect(document.getElementById('guest-error').textContent).toContain('Zu viele Versuche');
    });
    expect(window.moduleRegistry.navigateTo).not.toHaveBeenCalled();
  });

  it('Sperrseite listet lokal gespeicherte Zugänge ohne DB-Query', async () => {
    const jwt = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    saveGuestSession(TOKEN, { jwt, name: 'Pat', entityType: 'sourcing', entityName: 'Rückgabe Deal' });
    await renderGuestNoAccess();
    const link = document.querySelector('.guest-share-link');
    expect(link.getAttribute('href')).toBe(`/share/${TOKEN}`);
    expect(link.textContent).toContain('Rückgabe Deal');
    expect(window.supabase.functions.invoke).not.toHaveBeenCalled();
  });
});
