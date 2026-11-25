import { describe, it, expect, vi } from 'vitest';
import { stand, antwort, click, medienablageUmgebung } from './medienablageTestKit.js';

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(),
}));

const { authorizedFetch } = await import('../core/auth/getAccessToken.js');
const { MedienablagePage } = await import('../modules/admin/MedienablagePage.js');
const { AdminPage } = await import('../modules/admin/AdminPage.js');
const { NavigationSystem } = await import('../modules/navigation/NavigationSystem.js');

// Medienablage-Seite: Stand und Aktionen laufen ueber ablage-stand.
// authorizedFetch ist gemockt und antwortet je nach aktion.
const t = medienablageUmgebung({ authorizedFetch, MedienablagePage });
const { zustand, openPage, bodies, aktionen } = t;
const flush = () => vi.waitFor(() => expect(window.content.querySelector('[aria-busy]')).toBeNull());

describe('MedienablagePage', () => {
  it('laedt den Stand ueber ablage-stand und rendert Karten, Umsortieren, Finale und Eingang', async () => {
    await openPage();
    expect(authorizedFetch).toHaveBeenCalledWith('/.netlify/functions/ablage-stand', expect.objectContaining({ method: 'POST' }));
    expect(bodies()).toEqual([{ aktion: 'stand' }]);

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

    expect(window.content.querySelector('[data-ma-umsortieren="u1"]')).not.toBeNull();
    expect(window.content.textContent).toContain('Testunternehmen');
    expect(window.content.textContent).toContain('6 Finale im Finder');
    expect(window.content.querySelector('[data-ma-erneut="i1"]')).not.toBeNull();
    expect(window.content.querySelector('[data-ma-ignorieren="i1"]')).not.toBeNull();
    expect(window.content.querySelector('[data-ma-erneut="i2"]')).not.toBeNull();
  });

  it('keine Spur mehr von Weiche, Notschalter, Umzug oder Dropbox', async () => {
    await openPage();
    for (const sel of ['[data-ma-weiche]', '[data-ma-notschalter]', '[data-ma-umzug]', '[data-ma-dokument-weiche]', '[data-ma-dokument-umzug]']) {
      expect(window.content.querySelector(sel)).toBeNull();
    }
    expect(window.content.textContent).not.toMatch(/Dropbox/i);
  });

  it('zeigt "nicht konfiguriert" ohne Karten und Umsortieren', async () => {
    zustand.stand = stand({ konfig: { konfiguriert: false, site_url: null, drive_id: null } });
    await openPage();
    expect(window.content.textContent).toContain('SharePoint ist nicht konfiguriert');
    expect(window.content.textContent).toContain('Ohne Site und Drive sind keine Uploads möglich');
    expect(window.content.querySelector('.ma-karte')).toBeNull();
    expect(window.content.querySelector('[data-ma-umsortieren]')).toBeNull();
  });

  it('Eingang und Abgleich schicken ihre Aktionen und laden danach neu', async () => {
    await openPage();

    click(window.content.querySelector('[data-ma-erneut="i1"]'));
    await vi.waitFor(() => expect(aktionen()).toEqual([{ aktion: 'erneut', item_id: 'i1' }]));
    await flush();
    click(window.content.querySelector('[data-ma-ignorieren="i1"]'));
    await vi.waitFor(() => expect(aktionen()).toHaveLength(2));
    expect(aktionen()[1]).toEqual({ aktion: 'ignorieren', item_id: 'i1' });
    await flush();
    click(window.content.querySelector('[data-ma-aktion="voll_abgleich"]'));
    await vi.waitFor(() => expect(aktionen()).toHaveLength(3));
    expect(aktionen()[2]).toEqual({ aktion: 'voll_abgleich' });
    await vi.waitFor(() => expect(bodies().filter(b => b.aktion === 'stand').length).toBeGreaterThanOrEqual(2));
  });

  it('Umsortieren: erst Trockenlauf, dann mit den Zahlen bestaetigen und starten', async () => {
    zustand.antworten.umsortieren_planen = { zaehler: { bereich: { marken: 1, kampagnen: 2 }, dateien: 5, videos: 3, storys: 1, bilder: 1, ordner: 2 } };
    zustand.antworten.umsortieren_starten = { angestossen: true };
    await openPage();

    click(window.content.querySelector('[data-ma-umsortieren="u1"]'));
    await vi.waitFor(() => expect(aktionen()).toEqual([
      { aktion: 'umsortieren_planen', unternehmen_id: 'u1' },
      { aktion: 'umsortieren_starten', unternehmen_id: 'u1' },
    ]));
    expect(window.confirmationModal.open.mock.calls[0][0].message).toContain('5 Dateien');
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Umsortieren läuft im Hintergrund.', 'success'));
  });

  it('Umsortieren ohne Arbeit: nur Trockenlauf, keine Rueckfrage', async () => {
    zustand.antworten.umsortieren_planen = { zaehler: {} };
    await openPage();
    click(window.content.querySelector('[data-ma-umsortieren="u2"]'));
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith(expect.stringContaining('alles liegt schon'), 'success'));
    expect(aktionen()).toEqual([{ aktion: 'umsortieren_planen', unternehmen_id: 'u2' }]);
    expect(window.confirmationModal.open).not.toHaveBeenCalled();
  });

  it('Finale spiegeln: Trockenlauf, Rueckfrage, Start', async () => {
    zustand.antworten.final_spiegel_planen = { ohne_kopie: 2, ohne_kopie_bytes: 1024 ** 3, fehler: 0, entfernt: 0 };
    zustand.antworten.final_spiegel_starten = { eingereiht: 2 };
    await openPage();
    click(window.content.querySelector('[data-ma-final-spiegel]'));
    await vi.waitFor(() => expect(aktionen()).toEqual([{ aktion: 'final_spiegel_planen' }, { aktion: 'final_spiegel_starten' }]));
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Finale werden gespiegelt: 2 Kopien eingereiht.', 'success'));
  });

  it('meldet einen Serverfehler als Toast', async () => {
    await openPage();
    authorizedFetch.mockImplementationOnce(async () => antwort({ error: 'Graph nicht erreichbar' }, 502));
    click(window.content.querySelector('[data-ma-aktion="jetzt_abgleichen"]'));
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Fehlgeschlagen: Graph nicht erreichbar', 'error'));
  });

  it('Suche blendet nicht passende Unternehmen aus', async () => {
    await openPage();
    const suche = window.content.querySelector('[data-ma-suche]');
    suche.value = 'acm';
    suche.dispatchEvent(new Event('input', { bubbles: true }));
    const rows = [...window.content.querySelectorAll('.ma-row')];
    expect(rows.filter(r => !r.hidden).map(r => r.dataset.maName)).toEqual(['acme']);
    expect(window.content.querySelector('[data-ma-suche-leer]').hidden).toBe(true);

    suche.value = 'nichts';
    suche.dispatchEvent(new Event('input', { bubbles: true }));
    expect(window.content.querySelector('[data-ma-suche-leer]').hidden).toBe(false);
  });

  it('ist ueber die Admin-Huelle als Unterseite erreichbar', async () => {
    const admin = new AdminPage();
    await admin.init('medienablage');
    await admin.ready;
    expect(window.setHeadline).toHaveBeenCalledWith('Accounting – Medienablage');
    expect(window.content.querySelector('[data-ma-umsortieren]')).not.toBeNull();
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
