// Testhilfen fuer die Medienablage-Seite: Stand-Fixture, gemockter Endpunkt ablage-stand
// (stand und Aktionen), Konsolen-Spies und Lebenszyklus der Seite.
// vi.mock('../core/auth/getAccessToken.js') bleibt in der Testdatei.

import { vi, beforeEach, afterEach } from 'vitest';

const STUNDE = 60 * 60 * 1000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

export function stand(overrides = {}) {
  return {
    konfig: { konfiguriert: true, site_url: 'https://x.sharepoint.com/sites/m', drive_id: 'd1' },
    stand: [{
      drive_id: 'd1',
      letzter_lauf: iso(-5 * 60 * 1000),
      letzter_erfolg: iso(-5 * 60 * 1000),
      letzte_meldung: '12 Änderungen übernommen',
      fehler: null,
      fehler_seit: null,
      abo_ablauf: iso(72 * STUNDE + 60 * 1000),
      voll_abgleich_noetig: false,
      quota_used: 512 * 1024 ** 3,
      quota_total: 1024 * 1024 ** 3,
      zert_ablauf: iso(10 * 24 * STUNDE),
      rechte_lauf: iso(-STUNDE),
      rechte_fehler: null,
    }],
    zaehler: { offen: 3, fehler: 1, unzugeordnet: 1, erledigt_24h: 40 },
    unzugeordnet: [{ item_id: 'i1', name: 'clip.mov', pfad: '/Unsortiert/clip.mov', grund: 'kein_ordner', geaendert_at: iso(-STUNDE), geaendert_von: 'Anna', groesse: 5 * 1024 ** 2 }],
    fehler: [{ item_id: 'i2', name: 'kaputt.mp4', pfad: '/A/kaputt.mp4', grund: 'timeout', versuche: 2, naechster_versuch: iso(STUNDE) }],
    unternehmen: [
      { id: 'u1', firmenname: 'Acme', ist_test: false },
      { id: 'u2', firmenname: 'Test GmbH', ist_test: true },
    ],
    final_spiegel: { offen: 0, fertig: 6, fehler: 0, entfernt: 0, ohne_kopie: 2, kopie_bytes: 3 * 1024 ** 3, ohne_kopie_bytes: 1024 ** 3 },
    ...overrides,
  };
}

export function antwort(data, status = 200) {
  return { ok: status < 400, status, json: async () => data };
}

export const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

/**
 * Registriert beforeEach/afterEach fuer die Seite. zustand.stand ist der Stand, den der
 * gemockte Endpunkt liefert; zustand.antworten ueberschreibt die Antwort je Aktion.
 */
export function medienablageUmgebung({ authorizedFetch, MedienablagePage }) {
  const zustand = { stand: stand(), antworten: {} };
  const created = [];
  const konsole = {};
  const bodies = () => authorizedFetch.mock.calls.map(([, opts]) => JSON.parse(opts.body));

  async function openPage() {
    const page = new MedienablagePage();
    created.push(page);
    await page.init();
    await page.ready;
    return page;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    for (const art of ['log', 'info', 'warn', 'error']) konsole[art] = vi.spyOn(console, art).mockImplementation(() => {});
    zustand.stand = stand();
    zustand.antworten = {};
    authorizedFetch.mockImplementation(async (_path, opts) => {
      const body = JSON.parse(opts.body);
      if (body.aktion === 'stand') return antwort(structuredClone(zustand.stand));
      return antwort(zustand.antworten[body.aktion] ?? { ok: true });
    });
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn((el, html) => { el.innerHTML = html; });
    window.content = document.createElement('div');
    document.body.appendChild(window.content);
    window.isAdmin = vi.fn(() => true);
    window.toastSystem = { show: vi.fn() };
    window.confirmationModal = { open: vi.fn(async () => ({ confirmed: true })) };
  });

  afterEach(() => {
    while (created.length) created.pop().destroy();
    vi.useRealTimers();
    for (const spy of Object.values(konsole)) spy.mockRestore();
    window.content?.remove();
    delete window.toastSystem;
    delete window.confirmationModal;
  });

  return {
    zustand,
    created,
    openPage,
    bodies,
    aktionen: () => bodies().filter((b) => b.aktion !== 'stand'),
    konsole,
  };
}
