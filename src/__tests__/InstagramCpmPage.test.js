import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(),
}));

const { authorizedFetch } = await import('../core/auth/getAccessToken.js');
const { InstagramCpmPage } = await import('../modules/admin/InstagramCpmPage.js');
const { gridHtml } = await import('../modules/admin/instagramCpmGrid.js');
const { AdminPage } = await import('../modules/admin/AdminPage.js');
const { NavigationSystem } = await import('../modules/navigation/NavigationSystem.js');

const RUN_ID = '3KH8gEpp4d8uQSe8T';
const lauf = (status, extra = {}) => ({
  runId: RUN_ID, status, datasetId: 'ds1', startedAt: '2026-11-27T12:00:00.000Z', finishedAt: null,
  usageTotalUsd: 0.02, konsoleUrl: `https://console.apify.com/view/runs/${RUN_ID}`,
  fertig: ['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'].includes(status), statusText: null, ...extra,
});
const reel = (i, views, extra = {}) => ({
  id: `r${i}`, shortCode: `S${i}`, url: `https://www.instagram.com/reel/S${i}/`,
  datum: new Date(Date.UTC(2026, 10, 27) - i * 86400000).toISOString(),
  views, viewsAlt: null, likes: 100, kommentare: 12, dauer: 20,
  bild: `/.netlify/functions/instagram-bild?u=x${i}&s=y`, caption: `Reel ${i}`,
  werbung: null, verlinkt: [], collab: [], filter: null, filterText: null, ...extra,
});
// 32 Kandidaten um 250K, r2 ist ein Viral-Hit
const reels = Array.from({ length: 32 }, (_, i) => reel(i + 1, i === 1 ? 1500000 : 250000));
reels[4] = reel(5, 250000, { werbung: '#anzeige' });
const ergebnis = {
  profil: { name: 'lea', vollName: 'Lea', url: 'https://www.instagram.com/lea/' },
  reels,
  gefiltert: [reel(99, 900000, { filter: 'werbung_verlinkt', filterText: 'Werbung mit Verlinkung', werbung: '#werbung', verlinkt: ['brand'] })],
  fehler: [],
  roh: [{ id: 'r1' }],
};
const antwort = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const bodies = () => authorizedFetch.mock.calls.map(([, init]) => JSON.parse(init.body));

const created = [];
async function openPage() {
  const page = new InstagramCpmPage();
  page.pollPauseMs = 0;
  created.push(page);
  await page.init();
  return page;
}
const $ = (sel) => window.content.querySelector(sel);
const feld = (name) => $(`[data-ig-feld="${name}"]`);
const kachel = (id) => $(`[data-ig-reel="${id}"]`);
const absenden = () => $('[data-ig-form]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
const ohneNbsp = (s) => s.replace(/\u00a0/g, ' ');

async function mitErgebnis() {
  authorizedFetch
    .mockResolvedValueOnce(antwort(200, { ok: true, lauf: lauf('RUNNING') }))
    .mockResolvedValueOnce(antwort(200, { ok: true, lauf: lauf('SUCCEEDED'), ergebnis }));
  const page = await openPage();
  feld('profil').value = '@lea';
  absenden();
  await vi.waitFor(() => expect($('[data-ig-grid]')).not.toBeNull());
  return page;
}

describe('Instagram-CPM (Admin)', () => {
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

  it('scrapt, pollt und zeigt Grid, Range und Rausgefilterte', async () => {
    await mitErgebnis();
    expect(bodies()).toEqual([
      { aktion: 'starten', profil: '@lea', anzahl: 50 },
      { aktion: 'stand', runId: RUN_ID },
    ]);
    expect(window.content.querySelectorAll('[data-ig-grid] [data-ig-reel]')).toHaveLength(32);
    expect(kachel('r1').querySelector('img').getAttribute('src')).toBe('/.netlify/functions/instagram-bild?u=x1&s=y');
    expect(kachel('r1').textContent).toContain('250.000');
    expect(kachel('r1').textContent).toContain('12 Kommentare');
    expect(kachel('r5').textContent).toContain('Anzeige ohne Verlinkung');
    expect($('.ig-range').textContent).toContain('Median');
    expect($('.ig-gefiltert').textContent).toContain('Werbung mit Verlinkung');
    expect($('.ig-gefiltert').textContent).toContain('@brand');
    expect(window.toastSystem.show).toHaveBeenCalledWith('Instagram-Scraper fertig: 32 Reels im Grid.', 'success');
  });

  it('Viral-Hit ist vorab abgewählt, ein älteres Reel rückt in den 30er nach', async () => {
    await mitErgebnis();
    expect(kachel('r2').classList.contains('is-aus')).toBe(true);
    expect(kachel('r2').textContent).toContain('Ausreißer ↑');
    expect(kachel('r31').textContent).toContain('30er');
    expect(kachel('r32').textContent).toContain('außerhalb');
    expect(kachel('r13').textContent).toContain('12er');
  });

  it('Klick wählt ab und wieder an, die Fenster rücken mit', async () => {
    await mitErgebnis();
    kachel('r1').click();
    expect(kachel('r1').classList.contains('is-aus')).toBe(true);
    expect(kachel('r1').textContent).toContain('Abgewählt');
    expect(kachel('r32').textContent).toContain('30er');
    kachel('r1').click();
    expect(kachel('r1').classList.contains('is-aus')).toBe(false);
    expect(kachel('r32').textContent).toContain('außerhalb');
  });

  it('der Öffnen-Link schaltet die Kachel nicht um', async () => {
    await mitErgebnis();
    const link = kachel('r1').querySelector('[data-ig-link]');
    link.addEventListener('click', (e) => e.preventDefault());
    link.click();
    expect(kachel('r1').classList.contains('is-aus')).toBe(false);
  });

  it('rechnet erst auf Berechnen und markiert danach Änderungen als veraltet', async () => {
    await mitErgebnis();
    expect($('[data-ig-rechenweg]')).toBeNull();
    $('[data-ig-berechnen]').click();
    const wege = [...window.content.querySelectorAll('[data-ig-rechenweg]')].map((el) => ohneNbsp(el.textContent));
    expect(wege).toEqual([
      '3.000.000 / 12 = 250.000 Views → 250,00 × 25,00 € = 6.250,00 €',
      '7.500.000 / 30 = 250.000 Views → 250,00 × 25,00 € = 6.250,00 €',
    ]);
    expect($('[data-ig-veraltet]')).toBeNull();

    kachel('r2').click();
    expect($('[data-ig-veraltet]')).not.toBeNull();
    $('[data-ig-berechnen]').click();
    expect($('[data-ig-veraltet]')).toBeNull();
    expect(ohneNbsp($('[data-ig-auswertung="12"] [data-ig-rechenweg]').textContent)).toContain('4.250.000 / 12');

    $('[data-ig-zuruecksetzen]').click();
    expect(kachel('r2').classList.contains('is-aus')).toBe(true);
    expect($('[data-ig-veraltet]')).not.toBeNull();
  });

  it('TKP aus dem Formular geht in den Preis ein', async () => {
    await mitErgebnis();
    feld('tkp').value = '30';
    $('[data-ig-berechnen]').click();
    expect(ohneNbsp($('[data-ig-auswertung="30"]').textContent)).toContain('7.500,00 €');
  });

  it('Regeln anwenden setzt den Vorschlag neu', async () => {
    await mitErgebnis();
    $('[data-ig-regel="hoechstFaktor"]').value = '10';
    $('[data-ig-regel="mindestFaktor"]').value = '10';
    $('[data-ig-regeln-anwenden]').click();
    expect(kachel('r2').classList.contains('is-aus')).toBe(false);
  });

  it('zeigt die Fehlermeldung der Function', async () => {
    authorizedFetch.mockResolvedValueOnce(antwort(400, { error: 'Kein Instagram-Profil: „x“' }));
    await openPage();
    feld('profil').value = 'x';
    absenden();
    await vi.waitFor(() => expect($('.tt-fehler')?.textContent).toBe('Kein Instagram-Profil: „x“'));
    expect($('[data-ig-start]').disabled).toBe(false);
  });

  it('rendert Captions escaped und nur eigene Bild-Pfade', () => {
    const box = document.createElement('div');
    box.innerHTML = gridHtml([reel(1, 10, { caption: '<b>x</b>', bild: 'https://evil.com/a.jpg', url: 'javascript:alert(1)' })], () => ({ aus: false }));
    expect(box.querySelector('b')).toBeNull();
    expect(box.querySelector('img')).toBeNull();
    expect(box.querySelector('a')).toBeNull();
  });

  it('ist über die Admin-Hülle erreichbar und nur für Admins in der Nav', async () => {
    const admin = new AdminPage();
    await admin.init('instagram-cpm');
    expect(window.setHeadline).toHaveBeenCalledWith('Accounting – Instagram-CPM');
    expect($('[data-ig-form]')).not.toBeNull();
    admin.destroy();

    document.body.insertAdjacentHTML('beforeend', '<nav id="main-nav"></nav>');
    window.canCreateProject = () => false;
    window.canViewAccounting = () => true;
    const nav = new NavigationSystem();
    nav.renderNavigation('/admin/instagram-cpm');
    expect(document.getElementById('main-nav').innerHTML).toContain('/admin/instagram-cpm');
    window.isAdmin = () => false;
    nav.renderNavigation('/admin');
    expect(document.getElementById('main-nav').innerHTML).not.toContain('/admin/instagram-cpm');
    document.getElementById('main-nav').remove();
  });
});
