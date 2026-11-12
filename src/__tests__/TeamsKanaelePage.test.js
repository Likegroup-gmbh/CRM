import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFakeSupabase } from './fixtures/fakeSupabase.js';

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(),
}));

const { authorizedFetch } = await import('../core/auth/getAccessToken.js');
const { TeamsKanaelePage } = await import('../modules/admin/TeamsKanaelePage.js');
const { webhookUrlFehler } = await import('../modules/admin/teamsKanalDrawer.js');
const { AdminPage } = await import('../modules/admin/AdminPage.js');
const { NavigationSystem } = await import('../modules/navigation/NavigationSystem.js');

const URL_OK = 'https://prod-01.westeurope.logic.azure.com/workflows/a/invoke?sig=1';
const FORGE = 'u-forge';
const ACME = 'u-acme';

function db(overrides = {}) {
  return createFakeSupabase({
    tabellen: {
      teams_kanal: [
        { id: 'k1', name: 'Test', webhook_url: URL_OK, aktiv: true, letzte_meldung_at: null, letzter_fehler: null, letzter_fehler_at: null },
      ],
      teams_kanal_unternehmen: [{ kanal_id: 'k1', unternehmen_id: FORGE }],
      unternehmen: [
        { id: FORGE, firmenname: 'FORGEWORKS AG', ist_test: false },
        { id: ACME, firmenname: 'Acme', ist_test: true },
      ],
      ...overrides,
    },
  });
}

const created = [];
async function openPage() {
  const page = new TeamsKanaelePage();
  created.push(page);
  await page.init();
  await page.ready;
  return page;
}

const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const drawer = () => document.getElementById('teams-kanal-drawer');
const feld = (name) => drawer().querySelector(`[data-tk-feld="${name}"]`);
const haken = (id) => drawer().querySelector(`[data-tk-unternehmen][value="${id}"]`);
const absenden = () => drawer().querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
const zuordnung = () => window.supabase.db.teams_kanal_unternehmen.map(z => `${z.kanal_id}:${z.unternehmen_id}`).sort();

describe('TeamsKanaelePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.supabase = db();
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn((el, html) => { el.innerHTML = html; });
    window.content = document.createElement('div');
    document.body.appendChild(window.content);
    window.isAdmin = vi.fn(() => true);
    window.currentUser = { id: 'admin-1', permissions: {} };
    window.toastSystem = { show: vi.fn() };
    window.confirmationModal = { open: vi.fn(async () => ({ confirmed: true })) };
  });

  afterEach(() => {
    while (created.length) created.pop().destroy();
    window.content?.remove();
    document.querySelectorAll('.drawer-panel, .drawer-overlay').forEach(el => el.remove());
    delete window.toastSystem;
    delete window.confirmationModal;
  });

  it('listet Kanäle mit Unternehmen und Stand', async () => {
    await openPage();
    const zeile = window.content.querySelector('[data-tk-kanal="k1"]');
    expect(zeile.textContent).toContain('Test');
    expect(zeile.textContent).toContain('FORGEWORKS AG');
    expect(zeile.textContent).toContain('Noch keine Meldung');
    expect(window.content.textContent).toContain('1 Kanäle · 1 aktiv');
  });

  it('zeigt einen Fehler, der neuer ist als die letzte Meldung, und markiert inaktive Kanäle', async () => {
    window.supabase = db({
      teams_kanal: [{
        id: 'k1', name: 'Test', webhook_url: URL_OK, aktiv: false,
        letzte_meldung_at: new Date(Date.now() - 3600e3).toISOString(),
        letzter_fehler: 'HTTP 404', letzter_fehler_at: new Date(Date.now() - 60e3).toISOString(),
      }],
    });
    await openPage();
    const zeile = window.content.querySelector('[data-tk-kanal="k1"]');
    expect(zeile.querySelector('.status-badge.danger')).not.toBeNull();
    expect(zeile.textContent).toContain('HTTP 404');
    expect(zeile.textContent).toContain('Inaktiv');
  });

  it('ohne Kanal ein Hinweis statt Tabelle', async () => {
    window.supabase = db({ teams_kanal: [], teams_kanal_unternehmen: [] });
    await openPage();
    expect(window.content.querySelector('table')).toBeNull();
    expect(window.content.textContent).toContain('Noch kein Teams-Kanal');
  });

  it('legt einen Kanal mit Unternehmen an und prüft den Workflow-Link', async () => {
    window.supabase = db({ teams_kanal: [], teams_kanal_unternehmen: [] });
    await openPage();
    click(window.content.querySelector('[data-tk-neu]'));
    expect(drawer()).not.toBeNull();

    feld('name').value = 'Team Forge';
    feld('webhook_url').value = 'https://example.com/hook';
    haken(FORGE).checked = true;
    absenden();
    expect(drawer().querySelector('[data-tk-fehler]').hidden).toBe(false);
    expect(window.supabase.db.teams_kanal).toHaveLength(0);

    feld('webhook_url').value = URL_OK;
    absenden();
    await vi.waitFor(() => expect(window.supabase.db.teams_kanal).toHaveLength(1));
    const kanal = window.supabase.db.teams_kanal[0];
    expect(kanal).toMatchObject({ name: 'Team Forge', webhook_url: URL_OK, aktiv: true, created_by: 'admin-1' });
    await vi.waitFor(() => expect(zuordnung()).toEqual([`${kanal.id}:${FORGE}`]));
    expect(window.toastSystem.show).toHaveBeenCalledWith('Teams-Kanal „Team Forge“ gespeichert.', 'success');
    await vi.waitFor(() => expect(window.content.textContent).toContain('Team Forge'));
  });

  it('Bearbeiten speichert nur die Änderung der Unternehmen', async () => {
    await openPage();
    click(window.content.querySelector('[data-tk-bearbeiten="k1"]'));
    expect(haken(FORGE).checked).toBe(true);
    // Abgedeckte Unternehmen stehen oben
    expect(drawer().querySelector('[data-tk-unternehmen]').value).toBe(FORGE);

    haken(FORGE).checked = false;
    haken(ACME).checked = true;
    feld('aktiv').checked = false;
    absenden();
    await vi.waitFor(() => expect(zuordnung()).toEqual([`k1:${ACME}`]));
    expect(window.supabase.db.teams_kanal[0].aktiv).toBe(false);
  });

  it('Testmeldung ruft teams-kanal und meldet das Ergebnis', async () => {
    authorizedFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
    await openPage();
    click(window.content.querySelector('[data-tk-test="k1"]'));
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith(expect.stringContaining('Testmeldung an „Test“ abgeschickt'), 'success'));
    const [pfad, opts] = authorizedFetch.mock.calls[0];
    expect(pfad).toBe('/.netlify/functions/teams-kanal');
    expect(JSON.parse(opts.body)).toEqual({ aktion: 'test', kanal_id: 'k1' });

    authorizedFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: false, fehler: 'HTTP 404' }) });
    await vi.waitFor(() => expect(window.content.querySelector('[data-tk-test="k1"]')?.disabled).toBe(false));
    click(window.content.querySelector('[data-tk-test="k1"]'));
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Testmeldung fehlgeschlagen: HTTP 404', 'error'));
  });

  it('Löschen fragt nach und entfernt den Kanal', async () => {
    await openPage();
    click(window.content.querySelector('[data-tk-loeschen="k1"]'));
    await vi.waitFor(() => expect(window.supabase.db.teams_kanal).toHaveLength(0));
    expect(window.confirmationModal.open).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(window.content.textContent).toContain('Noch kein Teams-Kanal'));
  });

  it('Löschen abgebrochen lässt den Kanal stehen', async () => {
    window.confirmationModal.open.mockResolvedValueOnce({ confirmed: false });
    await openPage();
    click(window.content.querySelector('[data-tk-loeschen="k1"]'));
    await vi.waitFor(() => expect(window.confirmationModal.open).toHaveBeenCalled());
    await Promise.resolve();
    expect(window.supabase.db.teams_kanal).toHaveLength(1);
  });

  it('Link-Prüfung im Browser wie auf dem Server', () => {
    expect(webhookUrlFehler(URL_OK)).toBeNull();
    expect(webhookUrlFehler('https://x.environment.api.powerplatform.com/powerautomate/y')).toBeNull();
    expect(webhookUrlFehler('http://prod-01.logic.azure.com/x')).toMatch(/https/);
    expect(webhookUrlFehler('https://hooks.slack.com/x')).toMatch(/Microsoft Workflows/);
    expect(webhookUrlFehler('')).toMatch(/Link/);
  });

  it('ist über die Admin-Hülle erreichbar', async () => {
    const admin = new AdminPage();
    await admin.init('teams-kanaele');
    await admin.ready;
    expect(window.setHeadline).toHaveBeenCalledWith('Accounting – Teams-Kanäle');
    expect(window.content.querySelector('[data-tk-neu]')).not.toBeNull();
    admin.destroy();
  });

  it('Nav-Eintrag nur für Admins', () => {
    document.body.insertAdjacentHTML('beforeend', '<nav id="main-nav"></nav>');
    window.canCreateProject = () => false;
    window.canViewAccounting = () => true;
    const nav = new NavigationSystem();
    nav.renderNavigation('/admin/teams-kanaele');
    expect(document.getElementById('main-nav').innerHTML).toContain('/admin/teams-kanaele');

    window.isAdmin = () => false;
    nav.renderNavigation('/admin');
    expect(document.getElementById('main-nav').innerHTML).not.toContain('/admin/teams-kanaele');
    document.getElementById('main-nav').remove();
  });
});
