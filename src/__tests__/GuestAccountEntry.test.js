// Eingang über ein bestehendes Login: Konto-Weiterleitung per RLS-Probe, sonst Mitarbeiter-Vorschau.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { accountEntry, accountRouteFor } from '../modules/share/guestAccountEntry.js';
import { initGuestShare } from '../modules/share/GuestShareApp.js';
import { clearAllGuestSessions, listStoredGuestSessions } from '../modules/share/guestSession.js';

const TOKEN = 'c'.repeat(48);
const LISTE = { valid: true, shareId: 's1', entityType: 'sourcing', entityId: 'cast-1', rechte: 'feedback' };
const PAKET = { valid: true, shareId: 's2', entityType: 'skript_paket', entityId: 'paket-1', rechte: 'feedback', entityName: 'Sommer' };

function probe(result) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result))),
  };
  return chain;
}

function login({ session = true, rls = { data: null, error: null }, invoke = vi.fn() } = {}) {
  const chain = probe(rls);
  window.supabase = {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: session ? { user: { id: 'u1' } } : null } }) },
    from: vi.fn(() => chain),
    functions: { invoke },
  };
  return chain;
}

const verboten = { data: null, error: { context: { status: 403, json: async () => ({ error: 'Nur Mitarbeiter haben Zugriff.' }) } } };

describe('accountEntry', () => {
  it('ohne Login: weder Probe noch Vorschau', async () => {
    login({ session: false });
    expect(await accountEntry(TOKEN, LISTE)).toBeNull();
    expect(window.supabase.from).not.toHaveBeenCalled();
    expect(window.supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('leitet ins Konto, wenn die RLS die Liste zeigt', async () => {
    const chain = login({ rls: { data: { id: 'cast-1' }, error: null } });
    expect(await accountEntry(TOKEN, LISTE)).toEqual({ route: '/castings/cast-1' });
    expect(window.supabase.from).toHaveBeenCalledWith('creator_auswahl');
    expect(chain.eq).toHaveBeenCalledWith('id', 'cast-1');
    expect(window.supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('fällt bei leerer Probe auf die Vorschau zurück und bei 403 auf den Code', async () => {
    const invoke = vi.fn().mockResolvedValue(verboten);
    login({ invoke });
    expect(await accountEntry(TOKEN, LISTE)).toBeNull();
    expect(invoke).toHaveBeenCalledWith('share-list', { body: { action: 'preview', token: TOKEN } });
  });

  it('wertet einen Fehler der Probe als "kein Zugriff"', async () => {
    login({ rls: new Error('offline') });
    expect(await accountRouteFor(LISTE)).toBeNull();
    login({ rls: { data: null, error: { message: 'permission denied' } } });
    expect(await accountRouteFor(LISTE)).toBeNull();
  });

  it('fragt beim Skript-Paket keine Tabelle ab, sondern direkt die Vorschau', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { jwt: 'x.y.z', rechte: 'ansehen', vorschau: true }, error: null });
    login({ invoke });
    const ergebnis = await accountEntry(TOKEN, PAKET);
    expect(window.supabase.from).not.toHaveBeenCalled();
    expect(ergebnis.vorschau).toMatchObject({ jwt: 'x.y.z', rechte: 'ansehen' });
  });
});

describe('initGuestShare mit Mitarbeiter-Vorschau', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllGuestSessions();
    document.body.innerHTML = `
      <div id="login-root"></div>
      <div id="app-root" style="display:none"><main class="main-content"></main></div>
    `;
    window.CONFIG = { SUPABASE: { URL: 'https://example.supabase.co', KEY: 'anon-key' } };
    window.__supabaseCreateClient = vi.fn(() => ({ from: vi.fn() }));
    window.moduleRegistry = { navigateTo: vi.fn().mockResolvedValue(undefined) };
  });

  it('öffnet das Paket ohne Code, nur lesend und ohne gespeicherte Sitzung', async () => {
    const invoke = vi.fn(async (_name, { body }) => {
      if (body.action === 'resolve') return { data: PAKET, error: null };
      return {
        data: { ...PAKET, jwt: 'h.p.s', rechte: 'ansehen', name: 'Vorschau: Oli', participantId: null, vorschau: true },
        error: null,
      };
    });
    login({ invoke });

    await initGuestShare(TOKEN);

    expect(document.getElementById('guest-verify-code')).toBeNull();
    expect(window.guestShare).toMatchObject({ rechte: 'ansehen', vorschau: true, allowedRoute: '/skripte' });
    expect(window.currentUser).toMatchObject({ rolle: 'gast', name: 'Vorschau: Oli' });
    expect(listStoredGuestSessions()).toEqual([]);
    expect(document.querySelector('.guest-preview-hint')?.textContent).toContain('Vorschau als Gast');
    expect(document.querySelector('.guest-back-link')).not.toBeNull();
    expect(document.querySelector('.guest-account-bar')).toBeNull();
  });

  it('zeigt Nicht-Mitarbeitern mit Login die Code-Maske', async () => {
    const invoke = vi.fn(async (_name, { body }) => (
      body.action === 'resolve' ? { data: PAKET, error: null } : verboten
    ));
    login({ invoke });

    await initGuestShare(TOKEN);

    expect(document.getElementById('guest-verify-code')).not.toBeNull();
    expect(window.moduleRegistry.navigateTo).not.toHaveBeenCalled();
  });
});
