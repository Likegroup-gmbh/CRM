import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { erzeugeReportPdf } = vi.hoisted(() => ({ erzeugeReportPdf: vi.fn() }));
vi.mock('../modules/report-pdf/reportPdfJob.js', () => ({
  SCHRITTE: { render: 'Seiten werden gesetzt …' },
  erzeugeReportPdf
}));

const { listProduktionen } = vi.hoisted(() => ({ listProduktionen: vi.fn() }));
vi.mock('../modules/produktion/ProduktionService.js', () => ({ listProduktionen }));

const { AdminPage } = await import('../modules/admin/AdminPage.js');

const KAMPAGNEN = [{
  id: 'k1',
  kampagnenname: 'Herbst',
  marke: { markenname: 'Marke X' },
  unternehmen: null,
  posts: [{ produktion_id: 'p2' }, { produktion_id: 'p2' }]
}];

let query;
function supabaseMock() {
  query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    ilike: vi.fn(() => query),
    then: (resolve) => resolve({ data: KAMPAGNEN, error: null })
  };
  return { from: vi.fn(() => query) };
}

const flush = async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); };
const root = () => window.content.querySelector('[data-pv-page]');
const vorschau = () => root().querySelector('[data-pv-vorschau]').srcdoc;
const kachelAnzahl = () => (vorschau().match(/class="rp-kachel"/g) || []).length;

function setze(el, wert, typ = 'input') {
  el.value = String(wert);
  el.dispatchEvent(new Event(typ, { bubbles: true }));
}

describe('PDF-Vorlagen: Seite', () => {
  let page;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    erzeugeReportPdf.mockReset();
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn((el, html) => { el.innerHTML = html; });
    window.content = document.createElement('div');
    document.body.appendChild(window.content);
    window.isAdmin = vi.fn(() => true);
    window.supabase = supabaseMock();
    page = new AdminPage();
  });

  afterEach(() => {
    page.destroy();
    window.content.remove();
    vi.useRealTimers();
  });

  it('rendert unter /admin/pdf-vorlagen die Vorschau mit 8 Beispiel-Posts', async () => {
    await page.init('pdf-vorlagen');
    expect(window.setHeadline).toHaveBeenCalledWith('Accounting – PDF-Vorlagen');
    expect(vorschau()).toContain('<!doctype html>');
    expect(kachelAnzahl()).toBe(8);
    expect(vorschau()).toContain('Seite 3 von 3');
  });

  it('Regler für Anzahl und Kacheln je Seite rendern die Vorschau neu', async () => {
    await page.init('pdf-vorlagen');
    setze(root().querySelector('[data-pv-anzahl]'), 11);
    vi.advanceTimersByTime(200);
    expect(kachelAnzahl()).toBe(11);
    expect(root().querySelector('[data-pv-stand]').textContent).toBe('11 Posts in der Vorschau');
    expect(vorschau()).toContain('Seite 4 von 4');

    root().querySelector('[data-pv-max-opt][data-value="6"]').click();
    vi.advanceTimersByTime(200);
    expect(vorschau()).toContain('Seite 3 von 3');
  });

  it('Produktion: listet Kampagnen und leert die Vorschau bis zur Wahl', async () => {
    await page.init('pdf-vorlagen');
    root().querySelector('[data-pv-quelle-opt][data-value="produktion"]').click();
    await flush();
    const optionen = [...root().querySelectorAll('[data-pv-kampagne] option')].map(o => o.textContent);
    expect(optionen).toEqual(['Kampagne wählen', 'Herbst · Marke X']);
    expect(root().querySelector('[data-pv-produktion]').disabled).toBe(true);
    expect(vorschau()).toBe('');
    expect(query.select.mock.calls[0][0]).toContain('kooperation_post!inner');
    expect(query.eq).toHaveBeenCalledWith('posts.status', 'confirmed');
  });

  it('Produktion: bietet nur Produktionen mit bestätigten Posts an', async () => {
    listProduktionen.mockResolvedValue([{ id: 'p1', name: 'Leer' }, { id: 'p2', name: 'Mit Posts' }, { id: 'p3', name: 'Auch leer' }]);
    await page.init('pdf-vorlagen');
    root().querySelector('[data-pv-quelle-opt][data-value="produktion"]').click();
    await flush();
    const select = root().querySelector('[data-pv-kampagne]');
    page.activePage.ladeProduktionVm = vi.fn();
    setze(select, 'k1', 'change');
    await flush();
    expect(listProduktionen).toHaveBeenCalledWith('k1');
    const optionen = [...root().querySelectorAll('[data-pv-produktion] option')].map(o => o.textContent);
    expect(optionen).toEqual(['Produktion wählen', 'Mit Posts']);
    expect(page.activePage.produktionId).toBe('p2');
  });

  it('PDF erzeugen schickt das View-Model und die Kacheln je Seite', async () => {
    erzeugeReportPdf.mockImplementation(async ({ onSchritt }) => { onSchritt('render'); });
    await page.init('pdf-vorlagen');
    root().querySelector('[data-pv-max-opt][data-value="4"]').click();
    root().querySelector('[data-pv-pdf]').click();
    await flush();
    expect(erzeugeReportPdf).toHaveBeenCalledTimes(1);
    const { vm, maxJeSeite } = erzeugeReportPdf.mock.calls[0][0];
    expect(maxJeSeite).toBe(4);
    expect(vm.kacheln).toHaveLength(8);
    expect(root().querySelector('[data-pv-status]').textContent).toBe('PDF heruntergeladen.');
  });

  it('meldet Fehler beim Erzeugen im Status', async () => {
    erzeugeReportPdf.mockRejectedValue(new Error('Chromium weg'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await page.init('pdf-vorlagen');
    root().querySelector('[data-pv-pdf]').click();
    await flush();
    expect(root().querySelector('[data-pv-status]').textContent).toBe('PDF fehlgeschlagen: Chromium weg');
    expect(root().querySelector('[data-pv-status]').dataset.art).toBe('fehler');
  });
});
