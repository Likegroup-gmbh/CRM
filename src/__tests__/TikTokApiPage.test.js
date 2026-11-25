import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(),
}));

const { authorizedFetch } = await import('../core/auth/getAccessToken.js');
const { TikTokApiPage } = await import('../modules/admin/TikTokApiPage.js');
const { ergebnisHtml, minSek } = await import('../modules/admin/tiktokApiRender.js');
const { AdminPage } = await import('../modules/admin/AdminPage.js');
const { NavigationSystem } = await import('../modules/navigation/NavigationSystem.js');

const RUN_ID = '3KH8gEpp4d8uQSe8T';
const lauf = (status, extra = {}) => ({
  runId: RUN_ID, status, datasetId: 'ds1', startedAt: '2026-11-25T12:00:00.000Z', finishedAt: null,
  usageTotalUsd: 0.0123, konsoleUrl: `https://console.apify.com/view/runs/${RUN_ID}`,
  fertig: ['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'].includes(status), statusText: null, ...extra,
});
const ergebnis = {
  videos: [{
    id: 'v1', url: 'https://www.tiktok.com/@lea/video/1', autor: 'lea', text: 'Mein <b>Video</b>', datum: '2026-11-20T10:00:00.000Z',
    aufrufe: 12345, likes: 678, kommentare: 9, shares: 3, gespeichert: 2, dauer: 74, cover: null, werbung: true, angepinnt: false, quelle: 'profil',
  }],
  profile: [{ name: 'lea', nickName: 'Lea', url: 'https://www.tiktok.com/@lea', follower: 2200000, likes: 5000, videos: 40, folgt: 1, verifiziert: true, privat: false, avatar: null, bio: null }],
  fehler: [{ eingabe: 'privat', url: null, code: 'PROFILE_PRIVATE', text: 'Profile is private' }],
  roh: [{ id: 'v1' }, { errorCode: 'PROFILE_PRIVATE' }],
};
const antwort = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const bodies = () => authorizedFetch.mock.calls.map(([, init]) => JSON.parse(init.body));

const created = [];
async function openPage() {
  const page = new TikTokApiPage();
  page.pollPauseMs = 0;
  created.push(page);
  await page.init();
  return page;
}
const $ = (sel) => window.content.querySelector(sel);
const feld = (name) => $(`[data-tt-feld="${name}"]`);
const absenden = () => $('[data-tt-form]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

describe('TikTok-API (Admin)', () => {
  beforeEach(() => {
    authorizedFetch.mockReset();
    window.setContentSafely = vi.fn((el, html) => { el.innerHTML = html; });
    window.setHeadline = vi.fn();
    window.content = document.createElement('div');
    document.body.appendChild(window.content);
    window.isAdmin = vi.fn(() => true);
    window.currentUser = { id: 'admin-1', permissions: {} };
    window.toastSystem = { show: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    while (created.length) created.pop().destroy();
    window.content?.remove();
    delete window.toastSystem;
    console.error.mockRestore();
  });

  it('startet einen Lauf, pollt bis fertig und zeigt Profile, Videos und Fehler', async () => {
    authorizedFetch
      .mockResolvedValueOnce(antwort(200, { ok: true, lauf: lauf('RUNNING') }))
      .mockResolvedValueOnce(antwort(200, { ok: true, lauf: lauf('SUCCEEDED', { finishedAt: '2026-11-25T12:00:42.000Z' }), ergebnis }));
    await openPage();
    feld('videos').value = 'https://www.tiktok.com/@lea/video/1';
    feld('profile').value = '@lea';
    feld('anzahl').value = '5';
    absenden();

    await vi.waitFor(() => expect($('.tt-table tbody tr')).not.toBeNull());
    expect(bodies()).toEqual([
      { aktion: 'starten', videos: 'https://www.tiktok.com/@lea/video/1', profile: '@lea', anzahl: 5 },
      { aktion: 'stand', runId: RUN_ID },
    ]);
    expect($('.tt-lauf').textContent).toContain('Fertig');
    expect($('.tt-lauf').textContent).toContain('0:42');
    expect($('.tt-lauf a').getAttribute('href')).toBe(`https://console.apify.com/view/runs/${RUN_ID}`);
    expect($('.tt-profil').textContent).toContain('@lea');
    expect($('.tt-profil').textContent).toContain('2,2');
    expect($('.tt-table').textContent).toContain('12.345');
    expect($('.tt-table').textContent).toContain('Werbung');
    expect(window.content.textContent).toContain('PROFILE_PRIVATE');
    expect($('.tt-roh-json').textContent).toContain('"errorCode": "PROFILE_PRIVATE"');
    expect($('[data-tt-start]').disabled).toBe(false);
    expect($('[data-tt-abbrechen]')).toBeNull();
    expect(window.toastSystem.show).toHaveBeenCalledWith('TikTok-Scraper fertig: 1 Videos.', 'success');
  });

  it('zeigt die Fehlermeldung der Function und gibt den Knopf wieder frei', async () => {
    authorizedFetch.mockResolvedValueOnce(antwort(400, { error: 'Kein TikTok-Profil: „x“' }));
    await openPage();
    feld('profile').value = 'x';
    absenden();

    await vi.waitFor(() => expect($('.tt-fehler')?.textContent).toBe('Kein TikTok-Profil: „x“'));
    expect($('[data-tt-start]').disabled).toBe(false);
    expect($('.tt-table')).toBeNull();
  });

  it('bricht einen laufenden Lauf ab', async () => {
    let standFreigeben;
    authorizedFetch
      .mockResolvedValueOnce(antwort(200, { ok: true, lauf: lauf('RUNNING') }))
      .mockImplementationOnce(() => new Promise((resolve) => { standFreigeben = resolve; }))
      .mockResolvedValueOnce(antwort(200, { ok: true, lauf: lauf('ABORTING') }));
    await openPage();
    feld('profile').value = 'lea';
    absenden();

    await vi.waitFor(() => expect($('[data-tt-abbrechen]')).not.toBeNull());
    $('[data-tt-abbrechen]').click();
    await vi.waitFor(() => expect(bodies()).toContainEqual({ aktion: 'abbrechen', runId: RUN_ID }));
    await vi.waitFor(() => expect($('.tt-lauf').textContent).toContain('Wird abgebrochen'));

    standFreigeben(antwort(200, { ok: true, lauf: lauf('ABORTED'), ergebnis: { ...ergebnis, videos: [], profile: [] } }));
    await vi.waitFor(() => expect($('.tt-lauf').textContent).toContain('Abgebrochen'));
    expect(window.content.textContent).toContain('Keine Videos im Ergebnis.');
  });

  it('pollt nach dem Verlassen der Seite nicht weiter', async () => {
    authorizedFetch.mockResolvedValue(antwort(200, { ok: true, lauf: lauf('RUNNING') }));
    const page = await openPage();
    feld('profile').value = 'lea';
    absenden();
    await vi.waitFor(() => expect(authorizedFetch.mock.calls.length).toBeGreaterThanOrEqual(2));
    page.destroy();
    const anzahl = authorizedFetch.mock.calls.length;
    await new Promise((r) => setTimeout(r, 20));
    expect(authorizedFetch.mock.calls.length).toBeLessThanOrEqual(anzahl + 1);
  });

  it('rendert gescrapte Texte escaped und nur https-Links', () => {
    const html = ergebnisHtml({
      ...ergebnis,
      videos: [{ ...ergebnis.videos[0], url: 'javascript:alert(1)', cover: 'http://x/y.jpg' }],
      profile: [{ ...ergebnis.profile[0], url: 'javascript:alert(1)' }],
    });
    const box = document.createElement('div');
    box.innerHTML = html;
    expect(box.querySelector('b')).toBeNull();
    expect(box.textContent).toContain('Mein <b>Video</b>');
    expect(box.querySelector('a[href^="javascript"]')).toBeNull();
    expect(box.querySelector('img')).toBeNull();
    expect(minSek(74)).toBe('1:14');
    expect(minSek(NaN)).toBe('–');
  });

  it('ist über die Admin-Hülle erreichbar', async () => {
    const admin = new AdminPage();
    await admin.init('tiktok-api');
    await admin.ready;
    expect(window.setHeadline).toHaveBeenCalledWith('Accounting – TikTok-API');
    expect($('[data-tt-form]')).not.toBeNull();
    admin.destroy();
  });

  it('Nav-Eintrag nur für Admins', () => {
    document.body.insertAdjacentHTML('beforeend', '<nav id="main-nav"></nav>');
    window.canCreateProject = () => false;
    window.canViewAccounting = () => true;
    const nav = new NavigationSystem();
    nav.renderNavigation('/admin/tiktok-api');
    expect(document.getElementById('main-nav').innerHTML).toContain('/admin/tiktok-api');
    expect(document.getElementById('main-nav').textContent).toContain('TikTok-API');

    window.isAdmin = () => false;
    nav.renderNavigation('/admin');
    expect(document.getElementById('main-nav').innerHTML).not.toContain('/admin/tiktok-api');
    document.getElementById('main-nav').remove();
  });
});
