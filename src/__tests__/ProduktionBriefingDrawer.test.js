import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const listKopierQuellen = vi.fn();
const duplicateBriefingMitHinweis = vi.fn();

vi.mock('../modules/briefing/duplicateBriefing.js', () => ({
  listKopierQuellen: (...args) => listKopierQuellen(...args),
  duplicateBriefingMitHinweis: (...args) => duplicateBriefingMitHinweis(...args)
}));

const { openProduktionBriefingDrawer } = await import('../modules/produktion/ProduktionBriefingDrawer.js');

const QUELLE = { id: 'b1', label: 'Serum Nano', sub: 'Serum – Produktion 1', data: {} };

function makeDetail(overrides = {}) {
  return {
    mode: 'workflow',
    kampagneId: 'kamp-1',
    produktionId: 'prod-1',
    kampagneData: { kampagnenname: 'Serum', unternehmen_id: 'u1', marke_id: 'm1' },
    produktion: { id: 'prod-1', name: 'Serum – Produktion 1' },
    linien: [{ id: 'b1', name: 'Serum' }],
    reloadLinien: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

const modal = () => document.querySelector('.overlay-modal');
const confirmBtn = () => modal().querySelector('[data-action="confirm"]');
const kopieBtn = () => modal().querySelector('[data-modus="kopie"]');
const vorschau = () => modal().querySelector('[data-vorschau]').textContent;

async function waehleQuelle() {
  kopieBtn().click();
  await vi.waitFor(() => expect(modal().querySelector('[data-rel-add-id]')).not.toBeNull());
  modal().querySelector('[data-rel-add-id]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
}

describe('ProduktionBriefingDrawer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    listKopierQuellen.mockReset().mockResolvedValue([QUELLE]);
    duplicateBriefingMitHinweis.mockReset().mockResolvedValue({ id: 'neu-1', produktion_id: 'prod-1' });
    window.navigateTo = vi.fn();
    window.toastSystem = { show: vi.fn() };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('startet im Modus „Neu“ und geht wie bisher ins Formular', async () => {
    await openProduktionBriefingDrawer(makeDetail(), { produktionId: 'prod-1' });

    expect(modal().querySelector('[data-quelle-feld]').hidden).toBe(true);
    expect(confirmBtn().textContent).toBe('Weiter zum Briefing');

    modal().querySelector('[name="zusatz"]').value = 'Launch';
    confirmBtn().click();

    expect(window.navigateTo).toHaveBeenCalledTimes(1);
    const url = new URL(window.navigateTo.mock.calls[0][0], 'http://local');
    expect(url.pathname).toBe('/briefing/new');
    expect(url.searchParams.get('titel')).toBe('Serum – Launch');
    expect(url.searchParams.get('produktion')).toBe('prod-1');
    expect(duplicateBriefingMitHinweis).not.toHaveBeenCalled();
    expect(modal()).toBeNull();
  });

  it('wechselt im Kopier-Modus Button-Text und sperrt, bis eine Quelle gewählt ist', async () => {
    await openProduktionBriefingDrawer(makeDetail(), { produktionId: 'prod-1' });

    kopieBtn().click();

    expect(modal().querySelector('[data-quelle-feld]').hidden).toBe(false);
    expect(confirmBtn().textContent).toBe('Duplizieren');
    expect(confirmBtn().disabled).toBe(true);

    confirmBtn().click();
    expect(duplicateBriefingMitHinweis).not.toHaveBeenCalled();
  });

  it('sucht Quellen in der Kampagne und zeigt nach der Wahl Chip und Titelvorschau', async () => {
    await openProduktionBriefingDrawer(makeDetail(), { produktionId: 'prod-1' });
    await waehleQuelle();

    expect(listKopierQuellen).toHaveBeenCalledWith('kamp-1', '');
    const chip = modal().querySelector('[data-quelle-chip]');
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toContain('Serum Nano');
    expect(chip.textContent).toContain('Serum – Produktion 1');
    expect(vorschau()).toBe('Titel: Serum Nano – Kopie');
    expect(confirmBtn().disabled).toBe(false);
  });

  it('zählt die Vorschau hoch, wenn „– Kopie“ in der Produktion schon vergeben ist', async () => {
    const detail = makeDetail({ linien: [{ id: 'b1', name: 'Serum Nano' }, { id: 'b2', name: 'Serum Nano – Kopie' }] });
    await openProduktionBriefingDrawer(detail, { produktionId: 'prod-1' });
    await waehleQuelle();

    expect(vorschau()).toBe('Titel: Serum Nano – Kopie 2');
  });

  it('dupliziert mit Quelle, Produktion und Zusatz-Titel und schaltet die Kopie als Linie aktiv', async () => {
    const detail = makeDetail();
    await openProduktionBriefingDrawer(detail, { produktionId: 'prod-1' });
    await waehleQuelle();
    modal().querySelector('[name="zusatz"]').value = 'Winter';
    modal().querySelector('[name="zusatz"]').dispatchEvent(new Event('input'));
    expect(vorschau()).toBe('Titel: Serum – Winter');

    confirmBtn().click();
    await vi.waitFor(() => expect(detail.reloadLinien).toHaveBeenCalled());

    expect(duplicateBriefingMitHinweis).toHaveBeenCalledWith('b1', { produktionId: 'prod-1', titel: 'Serum – Winter' });
    expect(detail.reloadLinien).toHaveBeenCalledWith({ linieId: 'neu-1' });
    expect(window.navigateTo).not.toHaveBeenCalled();
    expect(modal()).toBeNull();
  });

  it('übergibt ohne Zusatz keinen Titel, damit „– Kopie“ greift', async () => {
    await openProduktionBriefingDrawer(makeDetail(), { produktionId: 'prod-1' });
    await waehleQuelle();

    confirmBtn().click();
    await vi.waitFor(() => expect(duplicateBriefingMitHinweis).toHaveBeenCalled());

    expect(duplicateBriefingMitHinweis).toHaveBeenCalledWith('b1', { produktionId: 'prod-1', titel: null });
  });

  it('navigiert außerhalb des Workflows auf die Produktion mit der Kopie als Linie', async () => {
    const detail = makeDetail({ mode: 'overview' });
    await openProduktionBriefingDrawer(detail, { produktionId: 'prod-1' });
    await waehleQuelle();

    confirmBtn().click();
    await vi.waitFor(() => expect(window.navigateTo).toHaveBeenCalled());

    expect(window.navigateTo).toHaveBeenCalledWith('/produktion/prod-1?tab=briefing&linie=neu-1');
    expect(detail.reloadLinien).not.toHaveBeenCalled();
  });

  it('bleibt offen und entsperrt den Button, wenn das Duplizieren scheitert', async () => {
    duplicateBriefingMitHinweis.mockResolvedValue(null);
    const detail = makeDetail();
    await openProduktionBriefingDrawer(detail, { produktionId: 'prod-1' });
    await waehleQuelle();

    confirmBtn().click();
    await vi.waitFor(() => expect(duplicateBriefingMitHinweis).toHaveBeenCalled());
    await vi.waitFor(() => expect(confirmBtn().disabled).toBe(false));

    expect(modal()).not.toBeNull();
    expect(detail.reloadLinien).not.toHaveBeenCalled();
  });

  it('entfernt die Auswahl über das Kreuz im Chip', async () => {
    await openProduktionBriefingDrawer(makeDetail(), { produktionId: 'prod-1' });
    await waehleQuelle();

    modal().querySelector('[data-quelle-entfernen]').click();

    expect(modal().querySelector('[data-quelle-chip]').hidden).toBe(true);
    expect(confirmBtn().disabled).toBe(true);
  });

  it('sperrt „Aus Briefing kopieren“, wenn die Kampagne noch kein Briefing hat', async () => {
    listKopierQuellen.mockResolvedValue([]);
    await openProduktionBriefingDrawer(makeDetail(), { produktionId: 'prod-1' });

    expect(kopieBtn().disabled).toBe(true);
    expect(kopieBtn().title).toContain('noch kein Briefing');
  });

  it('sperrt „Aus Briefing kopieren“ ohne Ziel-Produktion', async () => {
    await openProduktionBriefingDrawer(makeDetail({ produktionId: null }), {});

    expect(kopieBtn().disabled).toBe(true);
    expect(listKopierQuellen).not.toHaveBeenCalled();
  });
});
