// Testhilfen fuer die Medienablage-Seite: Stand-Fixture, gemockter Endpunkt ablage-stand
// (stand, fortschritt, Aktionen), Konsolen-Spies und Lebenszyklus der Seite.
// vi.mock('../core/auth/getAccessToken.js') bleibt in der Testdatei.

import { vi, beforeEach, afterEach } from 'vitest';

const STUNDE = 60 * 60 * 1000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();
const LESEND = new Set(['stand', 'fortschritt']);

export function stand(overrides = {}) {
  return {
    konfig: { konfiguriert: true, site_url: 'https://x.sharepoint.com/sites/m', drive_id: 'd1' },
    einstellung: { notschalter: false },
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
      { id: 'u1', firmenname: 'Acme', ablage_ziel: 'dropbox', ist_test: false, dateien_sharepoint: 0, dateien_dropbox: 120 },
      { id: 'u2', firmenname: 'Test GmbH', ablage_ziel: 'sharepoint', ist_test: true, dateien_sharepoint: 10, dateien_dropbox: 4 },
    ],
    umzug: [{ unternehmen_id: 'u2', offen: 2, fertig: 6, fehler: 0 }],
    dokumente: [
      { id: 'u1', dokument_ablage_ziel: 'dropbox', sharepoint: 0, dropbox: 7, storage: 3 },
      { id: 'u2', dokument_ablage_ziel: 'sharepoint', sharepoint: 2, dropbox: 1, storage: 0 },
    ],
    dokument_umzug: [],
    ...overrides,
  };
}

export function antwort(data, status = 200) {
  return { ok: status < 400, status, json: async () => data };
}

/** Antwort der Aktion fortschritt aus einem vollen Stand, wie der Server sie liefert: nur die beobachteten Unternehmen. */
export function fortschrittAus(s, umzugIds = []) {
  const ids = new Set(umzugIds);
  const nur = (liste) => (liste || []).filter((x) => ids.has(x.unternehmen_id));
  return {
    einstellung: s.einstellung,
    weichen: (s.unternehmen || []).filter((u) => ids.has(u.id)).map((u) => ({
      id: u.id,
      ablage_ziel: u.ablage_ziel,
      dokument_ablage_ziel: (s.dokumente || []).find((d) => d.id === u.id)?.dokument_ablage_ziel || 'dropbox',
    })),
    umzug: nur(s.umzug),
    dokument_umzug: nur(s.dokument_umzug),
    umzug_meldungen: nur(s.umzug_meldungen),
  };
}

export const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

/**
 * Registriert beforeEach/afterEach fuer die Seite. zustand.stand ist der volle Stand, den der
 * gemockte Endpunkt liefert; fortschritt rechnet sich daraus.
 */
export function medienablageUmgebung({ authorizedFetch, MedienablagePage }) {
  const zustand = { stand: stand() };
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
    authorizedFetch.mockImplementation(async (_path, opts) => {
      const body = JSON.parse(opts.body);
      if (body.aktion === 'stand') return antwort(structuredClone(zustand.stand));
      if (body.aktion === 'fortschritt') return antwort(structuredClone(fortschrittAus(zustand.stand, body.umzug_ids)));
      if (body.aktion === 'umzug_starten') return antwort({ ok: true, angelegt: 4 });
      return antwort({ ok: true });
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
    aktionen: () => bodies().filter((b) => !LESEND.has(b.aktion)),
    abrufe: (aktion) => bodies().filter((b) => b.aktion === aktion).length,
    umzugLogs: (art = 'log') => konsole[art].mock.calls.map(([t]) => String(t)).filter((t) => t.startsWith('[Medienablage]')),
    konsole,
  };
}
