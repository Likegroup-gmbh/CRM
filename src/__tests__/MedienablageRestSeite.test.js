import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(),
}));

const { authorizedFetch } = await import('../core/auth/getAccessToken.js');
const { MedienablagePage } = await import('../modules/admin/MedienablagePage.js');

// Rest-Sektion in der echten Seite: erscheint nach den Karten und ihr Knopf löst die Umzug-Aktion aus.
const antwort = (data) => ({ ok: true, status: 200, json: async () => data });
const aktionen = () => authorizedFetch.mock.calls.map(([, o]) => JSON.parse(o.body)).filter((b) => b.aktion !== 'stand');

const STAND = {
  konfig: { konfiguriert: true, site_url: 'https://x.sharepoint.com/sites/m', drive_id: 'd1' },
  einstellung: { notschalter: false },
  stand: [{ drive_id: 'd1' }],
  zaehler: { offen: 0, fehler: 0, unzugeordnet: 0, erledigt_24h: 0 },
  unzugeordnet: [],
  fehler: [],
  unternehmen: [{ id: 'u1', firmenname: 'Alpha GmbH', ablage_ziel: 'sharepoint', ist_test: false, dateien_sharepoint: 5, dateien_dropbox: 2 }],
  umzug: [{ unternehmen_id: 'u1', offen: 0, fertig: 5, fehler: 2, uebersprungen: 0 }],
  dokumente: [],
  dokument_umzug: [],
  umzug_rest: [
    { id: 'z1', unternehmen_id: 'u1', bereich: 'medien', typ: 'video', status: 'fehler', grund: 'onedrive_kein_zugriff', versuche: 6, datei: 'a.mp4', kampagne: 'Sommer', kooperation: 'Anna' },
    { id: 'z2', unternehmen_id: 'u1', bereich: 'medien', typ: 'video', status: 'fehler', grund: 'onedrive_kein_zugriff', versuche: 6, datei: 'b.mp4', kampagne: 'Sommer', kooperation: 'Ben' },
  ],
};

const created = [];

describe('MedienablagePage: Rest des Umzugs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const art of ['log', 'info', 'warn', 'error']) vi.spyOn(console, art).mockImplementation(() => {});
    authorizedFetch.mockImplementation(async (_p, opts) => {
      const body = JSON.parse(opts.body);
      if (body.aktion === 'stand') return antwort(structuredClone(STAND));
      return antwort({ ok: true, angelegt: 2 });
    });
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn((el, html) => { el.innerHTML = html; });
    window.content = document.createElement('div');
    document.body.appendChild(window.content);
    window.toastSystem = { show: vi.fn() };
  });

  afterEach(() => {
    while (created.length) created.pop().destroy();
    vi.restoreAllMocks();
    window.content?.remove();
    delete window.toastSystem;
  });

  async function oeffnen() {
    const page = new MedienablagePage();
    created.push(page);
    await page.init();
    await page.ready;
    return page;
  }

  it('zeigt den Rest direkt unter den Karten, vor Notschalter und Weiche', async () => {
    await oeffnen();
    const abschnitt = window.content.querySelector('.ma-rest');
    expect(abschnitt).not.toBeNull();
    expect(abschnitt.textContent).toContain('Übrig geblieben beim Umzug');
    expect(abschnitt.textContent).toContain('Kein Zugriff auf alte OneDrive-Links');
    expect(abschnitt.previousElementSibling.classList.contains('ma-stand')).toBe(true);
    expect(abschnitt.nextElementSibling.classList.contains('ma-notschalter')).toBe(true);
  });

  it('stößt mit "Erneut versuchen" den Umzug des Unternehmens an und lädt neu', async () => {
    await oeffnen();
    window.content.querySelector('[data-ma-rest-erneut="medien:u1"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(aktionen()).toEqual([{ aktion: 'umzug_starten', unternehmen_id: 'u1' }]));
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Alpha GmbH: 2 Dateien neu eingereiht.', 'success'));
  });
});
