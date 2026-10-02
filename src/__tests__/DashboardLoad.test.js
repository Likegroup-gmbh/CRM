import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DASHBOARD_ENDPOINT,
  invalidateDashboard,
  loadDashboard,
  prefetchDashboard,
} from '../modules/stakeholder/daten/dashboardLoad.js';
import { DASHBOARD_VERSION } from '../modules/stakeholder/daten/stakeholderDashboard.js';
import { startFinanzbestandPrefetch, startHoverPrefetch } from '../core/budget/finanzbestandBoot.js';

// Dashboard-Load: Function im Normalfall, Browser-Rechnung als Fallback.
// Frische-Vertrag wie beim Finanzbestand: kein Cache, nur In-Flight und
// ein einmal uebernommener Prefetch.

const ERGEBNIS = {
  version: DASHBOARD_VERSION,
  geladenAm: 42,
  zeilen: [{ id: 'a1' }],
  contractingOhneAuftrag: {},
  monatsauswertung: { months: [] },
  unternehmen: [],
  berichtsstaende: [],
};

const RPC_BUNDLE = {
  auftraege: [{ id: 'x1', is_draft: false, nettobetrag: 100, unternehmen_id: 'u1' }],
  unternehmen: [{ id: 'u1', firmenname: 'F', ist_test: false }],
};

function jsonAntwort(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (body === undefined) throw new Error('kein JSON');
      return body;
    },
  };
}

function mockSupabase({ token = 'tok', rpcBundle = RPC_BUNDLE } = {}) {
  const rpc = vi.fn(async () => ({ data: rpcBundle, error: null }));
  return {
    rpc,
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: token ? { access_token: token, expires_at: Math.floor(Date.now() / 1000) + 3600 } : null },
      })),
      refreshSession: vi.fn(async () => ({ data: { session: null }, error: { message: 'nein' } })),
    },
  };
}

describe('loadDashboard', () => {
  let fetchMock;

  beforeEach(() => {
    invalidateDashboard();
    fetchMock = vi.fn(async () => jsonAntwort(200, ERGEBNIS));
    vi.stubGlobal('fetch', fetchMock);
    window.supabase = mockSupabase();
  });

  afterEach(() => {
    invalidateDashboard();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('holt das Ergebnis von der Function mit Bearer-Token', async () => {
    const sb = window.supabase;
    const ergebnis = await loadDashboard(sb);

    expect(ergebnis.zeilen).toEqual([{ id: 'a1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, optionen] = fetchMock.mock.calls[0];
    expect(url).toBe(DASHBOARD_ENDPOINT);
    expect(optionen.headers.Authorization).toBe('Bearer tok');
    expect(optionen.cache).toBe('no-store');
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  it('cached nichts: jeder Aufruf laedt neu', async () => {
    await loadDashboard(window.supabase);
    await loadDashboard(window.supabase);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('teilt einen laufenden Load mit parallelen Callern', async () => {
    const [a, b] = await Promise.all([loadDashboard(window.supabase), loadDashboard(window.supabase)]);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([404, 501, 503])('rechnet im Browser, wenn die Function mit %i antwortet', async (status) => {
    fetchMock.mockResolvedValue(jsonAntwort(status, { error: 'weg' }));
    const ergebnis = await loadDashboard(window.supabase);

    expect(window.supabase.rpc).toHaveBeenCalledWith('stakeholder_finanzbestand');
    expect(ergebnis.zeilen.map(z => z.id)).toEqual(['x1']);
    expect(ergebnis.version).toBe(DASHBOARD_VERSION);
  });

  it('fragt nach einem 404 in derselben Sitzung nicht noch einmal', async () => {
    fetchMock.mockResolvedValue(jsonAntwort(404, undefined));
    await loadDashboard(window.supabase);
    await loadDashboard(window.supabase);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.supabase.rpc).toHaveBeenCalledTimes(2);

    // Logout/Invalidate: beim naechsten Mal wird wieder gefragt.
    invalidateDashboard();
    await loadDashboard(window.supabase);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rechnet im Browser bei Netzfehler, Nicht-JSON und fremdem Schema', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect((await loadDashboard(window.supabase)).zeilen[0].id).toBe('x1');

    fetchMock.mockResolvedValueOnce(jsonAntwort(200, undefined)); // SPA-Fallback-HTML
    expect((await loadDashboard(window.supabase)).zeilen[0].id).toBe('x1');

    fetchMock.mockResolvedValueOnce(jsonAntwort(200, { ...ERGEBNIS, version: 99 }));
    expect((await loadDashboard(window.supabase)).zeilen[0].id).toBe('x1');
  });

  it('rechnet im Browser, wenn kein Token da ist, ohne abzumelden', async () => {
    window.supabase = mockSupabase({ token: null });
    window.handleLogout = vi.fn();
    const ergebnis = await loadDashboard(window.supabase);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(ergebnis.zeilen[0].id).toBe('x1');
    expect(window.handleLogout).not.toHaveBeenCalled();
    delete window.handleLogout;
  });

  it('wirft bei fehlendem Zugriff statt still im Browser zu rechnen', async () => {
    fetchMock.mockResolvedValue(jsonAntwort(403, { error: 'Kein Zugriff', code: 'forbidden' }));
    await expect(loadDashboard(window.supabase)).rejects.toMatchObject({
      message: 'Kein Zugriff',
      code: 'forbidden',
    });
    expect(window.supabase.rpc).not.toHaveBeenCalled();
  });

  it('wirft bei ungueltiger Sitzung', async () => {
    fetchMock.mockResolvedValue(jsonAntwort(401, { error: 'Sitzung ungültig', session_dead: true }));
    await expect(loadDashboard(window.supabase)).rejects.toMatchObject({ name: 'SessionExpiredError' });
  });

  it('wirft bei einem Rechenfehler der Function', async () => {
    fetchMock.mockResolvedValue(jsonAntwort(500, { error: 'Dashboard konnte nicht gerechnet werden.' }));
    await expect(loadDashboard(window.supabase)).rejects.toThrow('nicht gerechnet');
  });

  it('weist einen Aufruf ohne Supabase ab', async () => {
    await expect(loadDashboard(null)).rejects.toThrow('Supabase nicht verfügbar');
  });

  describe('Prefetch', () => {
    it('uebernimmt einen frischen Prefetch genau einmal', async () => {
      prefetchDashboard(window.supabase);
      await loadDashboard(window.supabase);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await loadDashboard(window.supabase);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('startet keinen zweiten Prefetch neben einem frischen', async () => {
      prefetchDashboard(window.supabase);
      prefetchDashboard(window.supabase);
      await loadDashboard(window.supabase);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('schluckt einen Prefetch-Fehler und laedt dann selbst', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonAntwort(403, { error: 'Kein Zugriff' }))
        .mockResolvedValueOnce(jsonAntwort(200, ERGEBNIS));

      prefetchDashboard(window.supabase);
      const ergebnis = await loadDashboard(window.supabase);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(ergebnis.zeilen).toEqual([{ id: 'a1' }]);
    });

    it('invalidate verwirft den Prefetch', async () => {
      prefetchDashboard(window.supabase);
      invalidateDashboard();
      await loadDashboard(window.supabase);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('Boot und Hover waehlen den Vorlauf nach Route', () => {
    it('Dashboard-Routen starten den Dashboard-Vorlauf, nicht den Rohzeilen-Load', async () => {
      const sb = window.supabase;
      expect(startFinanzbestandPrefetch(sb, '/admin', { getItem: () => null })).toBe(true);
      await loadDashboard(sb);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sb.rpc).not.toHaveBeenCalled();
    });

    it('Hover auf das Dashboard startet den Dashboard-Vorlauf', async () => {
      const sb = window.supabase;
      expect(startHoverPrefetch(sb, '/admin?x=1', true)).toBe(true);
      await loadDashboard(sb);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('Datenqualitaet startet den Rohzeilen-Load, nicht die Function', () => {
      const sb = window.supabase;
      expect(startHoverPrefetch(sb, '/admin/datenqualitaet', true)).toBe(true);
      expect(sb.rpc).toHaveBeenCalledWith('stakeholder_finanzbestand');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
