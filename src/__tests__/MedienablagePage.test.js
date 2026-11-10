import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(),
}));

const { authorizedFetch } = await import('../core/auth/getAccessToken.js');
const { MedienablagePage } = await import('../modules/admin/MedienablagePage.js');
const { AdminPage } = await import('../modules/admin/AdminPage.js');
const { NavigationSystem } = await import('../modules/navigation/NavigationSystem.js');

// Medienablage-Seite: Stand und Aktionen laufen ueber ablage-stand.
// authorizedFetch ist gemockt und antwortet je nach aktion.
const STUNDE = 60 * 60 * 1000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

function stand(overrides = {}) {
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
    ...overrides,
  };
}

let aktuellerStand = stand();

function antwort(data, status = 200) {
  return { ok: status < 400, status, json: async () => data };
}

const bodies = () => authorizedFetch.mock.calls.map(([, opts]) => JSON.parse(opts.body));
const aktionen = () => bodies().filter(b => b.aktion !== 'stand');

const created = [];
async function openPage() {
  const page = new MedienablagePage();
  created.push(page);
  await page.init();
  await page.ready;
  return page;
}

const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

describe('MedienablagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aktuellerStand = stand();
    authorizedFetch.mockImplementation(async (_path, opts) => {
      const body = JSON.parse(opts.body);
      if (body.aktion === 'stand') return antwort(structuredClone(aktuellerStand));
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
    window.content?.remove();
    delete window.toastSystem;
    delete window.confirmationModal;
  });

  it('laedt den Stand ueber ablage-stand und rendert die Statuskarten', async () => {
    await openPage();
    expect(authorizedFetch).toHaveBeenCalledWith('/.netlify/functions/ablage-stand', expect.objectContaining({ method: 'POST' }));
    expect(bodies()[0]).toEqual({ aktion: 'stand' });

    const karten = [...window.content.querySelectorAll('.ma-karte')];
    const labels = karten.map(k => k.querySelector('.ma-karte-label').textContent);
    expect(labels).toEqual(['Abgleich', 'Eingang', 'Webhook-Abo', 'Zertifikat', 'Speicher', 'Rechte-Abgleich']);

    const text = (label) => karten.find(k => k.textContent.includes(label)).textContent;
    expect(text('Abgleich')).toContain('Vor 5 Minuten');
    expect(text('Webhook-Abo')).toContain('Läuft in 3 Tagen ab');
    expect(text('Speicher')).toContain('50 %');
    expect(text('Speicher')).toContain('512 von 1.024 GB belegt');
    // Zertifikat laeuft in 10 Tagen ab: unter der 30-Tage-Grenze, also gelb
    expect(karten.find(k => k.textContent.includes('Zertifikat')).classList).toContain('ma-karte--warn');

    // Weiche, Umzug und Eingang
    expect(window.content.textContent).toContain('Testunternehmen');
    expect(window.content.textContent).toContain('Umzug läuft · 6 von 8');
    expect(window.content.querySelector('[data-ma-erneut="i1"]')).not.toBeNull();
    expect(window.content.querySelector('[data-ma-ignorieren="i1"]')).not.toBeNull();
    expect(window.content.querySelector('[data-ma-erneut="i2"]')).not.toBeNull();
  });

  it('zeigt "nicht konfiguriert" ohne Karten und Weiche', async () => {
    aktuellerStand = stand({ konfig: { konfiguriert: false, site_url: null, drive_id: null } });
    await openPage();
    expect(window.content.textContent).toContain('SharePoint ist nicht konfiguriert');
    expect(window.content.querySelector('.ma-karte')).toBeNull();
    expect(window.content.querySelector('[data-ma-weiche]')).toBeNull();
  });

  it('Notschalter fragt nach, schaltet ein und laedt neu', async () => {
    await openPage();
    const schalter = window.content.querySelector('[data-ma-notschalter]');
    expect(schalter.getAttribute('aria-pressed')).toBe('false');

    aktuellerStand = stand({ einstellung: { notschalter: true } });
    click(schalter);

    await vi.waitFor(() => expect(aktionen()).toEqual([{ aktion: 'notschalter', an: true }]));
    expect(window.confirmationModal.open).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(window.content.querySelector('[data-ma-notschalter]').getAttribute('aria-pressed')).toBe('true'));
    expect(window.toastSystem.show).toHaveBeenCalledWith('Notschalter aktiv: alle Uploads gehen nach Dropbox.', 'success');
  });

  it('Notschalter bleibt aus, wenn die Rueckfrage abgebrochen wird', async () => {
    window.confirmationModal.open.mockResolvedValueOnce({ confirmed: false });
    await openPage();
    click(window.content.querySelector('[data-ma-notschalter]'));
    await vi.waitFor(() => expect(window.confirmationModal.open).toHaveBeenCalled());
    await Promise.resolve();
    expect(aktionen()).toEqual([]);
  });

  it('Notschalter ausschalten braucht keine Rueckfrage', async () => {
    aktuellerStand = stand({ einstellung: { notschalter: true } });
    await openPage();
    click(window.content.querySelector('[data-ma-notschalter]'));
    await vi.waitFor(() => expect(aktionen()).toEqual([{ aktion: 'notschalter', an: false }]));
    expect(window.confirmationModal.open).not.toHaveBeenCalled();
  });

  it('Weiche auf SharePoint fragt nach und schickt unternehmen_id und ziel', async () => {
    await openPage();
    const select = window.content.querySelector('[data-ma-weiche="u1"]');
    select.value = 'sharepoint';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => expect(aktionen()).toEqual([{ aktion: 'weiche', unternehmen_id: 'u1', ziel: 'sharepoint' }]));
    expect(window.confirmationModal.open).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Acme: neue Uploads gehen nach SharePoint.', 'success'));
    // Nach der Aktion wird der Stand neu geladen
    await vi.waitFor(() => expect(bodies().filter(b => b.aktion === 'stand')).toHaveLength(2));
  });

  it('Weiche zurueck auf Dropbox ohne Rueckfrage', async () => {
    await openPage();
    const select = window.content.querySelector('[data-ma-weiche="u2"]');
    select.value = 'dropbox';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(aktionen()).toEqual([{ aktion: 'weiche', unternehmen_id: 'u2', ziel: 'dropbox' }]));
    expect(window.confirmationModal.open).not.toHaveBeenCalled();
  });

  it('abgebrochene Weiche setzt die Auswahl zurueck', async () => {
    window.confirmationModal.open.mockResolvedValueOnce({ confirmed: false });
    await openPage();
    const select = window.content.querySelector('[data-ma-weiche="u1"]');
    select.value = 'sharepoint';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(select.value).toBe('dropbox'));
    expect(aktionen()).toEqual([]);
  });

  it('Eingang, Abgleich und Umzug schicken ihre Aktionen', async () => {
    await openPage();
    const flush = () => vi.waitFor(() => expect(window.content.querySelector('[aria-busy]')).toBeNull());

    click(window.content.querySelector('[data-ma-erneut="i1"]'));
    await vi.waitFor(() => expect(aktionen()).toHaveLength(1));
    await flush();
    click(window.content.querySelector('[data-ma-ignorieren="i1"]'));
    await vi.waitFor(() => expect(aktionen()).toHaveLength(2));
    await flush();
    click(window.content.querySelector('[data-ma-aktion="voll_abgleich"]'));
    await vi.waitFor(() => expect(aktionen()).toHaveLength(3));
    await flush();

    // Umzug: u2 laeuft noch, deshalb ohne laufenden Umzug neu laden
    aktuellerStand = stand({ umzug: [] });
    authorizedFetch.mockClear();
    created.pop().destroy();
    await openPage();
    click(window.content.querySelector('[data-ma-umzug="u2"]'));
    await vi.waitFor(() => expect(aktionen()).toEqual([{ aktion: 'umzug_starten', unternehmen_id: 'u2' }]));
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Umzug gestartet: 4 Dateien.', 'success'));
  });

  it('meldet einen Serverfehler als Toast', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await openPage();
    authorizedFetch.mockImplementationOnce(async () => antwort({ error: 'Graph nicht erreichbar' }, 502));
    click(window.content.querySelector('[data-ma-aktion="jetzt_abgleichen"]'));
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Fehlgeschlagen: Graph nicht erreichbar', 'error'));
    spy.mockRestore();
  });

  it('Suche blendet nicht passende Unternehmen aus', async () => {
    await openPage();
    const suche = window.content.querySelector('[data-ma-suche]');
    suche.value = 'acm';
    suche.dispatchEvent(new Event('input', { bubbles: true }));
    const rows = [...window.content.querySelectorAll('.ma-row')];
    expect(rows.filter(r => !r.hidden).map(r => r.dataset.maName)).toEqual(['acme']);
  });

  it('ist ueber die Admin-Huelle als Unterseite erreichbar', async () => {
    const admin = new AdminPage();
    await admin.init('medienablage');
    await admin.ready;
    expect(window.setHeadline).toHaveBeenCalledWith('Accounting – Medienablage');
    expect(window.content.querySelector('[data-ma-notschalter]')).not.toBeNull();
    admin.destroy();
  });

  it('Nav-Eintrag nur fuer Admins', () => {
    document.body.insertAdjacentHTML('beforeend', '<nav id="main-nav"></nav>');
    window.currentUser = { permissions: {} };
    window.canCreateProject = () => false;
    window.canViewAccounting = () => true;
    const nav = new NavigationSystem();
    nav.renderNavigation('/admin/medienablage');
    expect(document.getElementById('main-nav').innerHTML).toContain('/admin/medienablage');

    window.isAdmin = () => false;
    nav.renderNavigation('/admin');
    expect(document.getElementById('main-nav').innerHTML).not.toContain('/admin/medienablage');
    document.getElementById('main-nav').remove();
  });
});
