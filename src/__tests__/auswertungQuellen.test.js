import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abrufGrund, nurSpeichern } from '../modules/auswertung/auswertungQuellen.js';
import { bild, einheit, montiere, post, warte } from './auswertungErfassenTestKit.js';

vi.mock('../modules/auswertung/auswertungPostsSpeichern.js', () => ({
  beendeKiLauf: vi.fn(),
  bestaetigePost: vi.fn(),
  bildFehler: vi.fn(() => null),
  ladeScreenshotsHoch: vi.fn(),
  legePostAn: vi.fn(),
  loeschePost: vi.fn(async () => {}),
  nimmBestaetigungZurueck: vi.fn(),
  rufeLinkAb: vi.fn(),
  setzeKiStatus: vi.fn(),
  speicherePost: vi.fn(),
  starteScreenshotLesen: vi.fn(async () => {}),
  screenshotUrls: vi.fn(async () => [])
}));
vi.mock('../modules/auswertung/auswertungKiLauf.js', async (original) => ({
  ...(await original()),
  warteAufKi: vi.fn(() => new Promise(() => {}))
}));

const speichern = await import('../modules/auswertung/auswertungPostsSpeichern.js');
const kiLauf = await import('../modules/auswertung/auswertungKiLauf.js');

const REEL = 'https://www.instagram.com/reel/C9xYz12AbC/';

describe('Link: was „Abrufen“ kann', () => {
  it.each([
    ['', 'Link zum Post einfügen.'],
    ['instagram.com/reel/abc', 'Der Link muss mit https:// beginnen.'],
    ['https://www.instagram.com/stories/creator1/3456789/', /Stories liefert die Instagram-API nicht/],
    ['https://www.tiktok.com/@creator1/video/123', /TikTok ist nicht angebunden/],
    ['https://youtu.be/abc', 'Abrufen geht nur mit Instagram-Links.'],
    ['https://www.instagram.com/creator1/', /Im Link fehlt der Post/]
  ])('%s → gesperrt', (link, grund) => {
    expect(abrufGrund(link)).toEqual(typeof grund === 'string' ? grund : expect.stringMatching(grund));
  });

  it('Reels, Posts und Links mit Handle gehen', () => {
    expect(abrufGrund(REEL)).toBeNull();
    expect(abrufGrund('https://www.instagram.com/p/C9xYz12AbC/?igsh=1')).toBeNull();
    expect(abrufGrund('https://www.instagram.com/creator1/reel/C9xYz12AbC/')).toBeNull();
  });

  it('Story- und TikTok-Links werden gespeichert, nur nicht abgerufen', () => {
    expect(nurSpeichern('https://www.tiktok.com/@creator1/video/123')).toBe(true);
    expect(nurSpeichern(REEL)).toBe(false);
    expect(nurSpeichern('kein link')).toBe(false);
  });
});

function einfuegen(dateien, ziel = document) {
  const ev = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clipboardData', { value: { files: dateien, items: [] } });
  ziel.dispatchEvent(ev);
  return ev;
}

function ablegen(ziel, dateien) {
  const ev = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: { files: dateien, items: [], types: ['Files'] } });
  ziel.dispatchEvent(ev);
  return ev;
}

const hochgeladen = (p, files) => ({ ...p, kiStatus: 'laeuft', screenshots: files.length, screenshotPfade: files.map((_, i) => `ka1/${p.id}/${i}.png`) });

describe('Screenshot: Cmd+V und Ablegen', () => {
  let ansicht;
  beforeEach(() => {
    window.toastSystem = { show: vi.fn() };
    speichern.legePostAn.mockImplementation(async felder => post('n1', felder.einheitId, { plattform: felder.plattform, source: felder.source || 'manuell', link: felder.link || null, postedAt: null, measuredAt: felder.measuredAt || null }));
    speichern.ladeScreenshotsHoch.mockImplementation(async (p, files) => hochgeladen(p, files));
  });
  afterEach(() => { ansicht?.abbauen(); vi.clearAllMocks(); });

  it('Cmd+V auf „Fehlt“ legt den Post an, lädt hoch und zeigt „KI liest …“', async () => {
    ansicht = montiere({ einheiten: [einheit(1)] });
    const ev = einfuegen([bild()]);
    await warte();
    expect(ev.defaultPrevented).toBe(true);
    expect(speichern.legePostAn).toHaveBeenCalledWith({ einheitId: 'video:v1', plattform: 'ig_reel', dateiId: null, source: 'ki' });
    expect(speichern.starteScreenshotLesen).toHaveBeenCalledWith('n1');
    expect(kiLauf.warteAufKi).toHaveBeenCalledWith('n1', expect.anything());
    expect(ansicht.zeilen()).toEqual([{ key: 'post:n1', status: 'liest', aktiv: true }]);
    expect(ansicht.root.querySelector('[data-erfassen-zeilen]').textContent).toContain('KI liest …');
  });

  it('Text in der Zwischenablage lässt die Ansicht in Ruhe', async () => {
    ansicht = montiere({ einheiten: [einheit(1)] });
    const ev = einfuegen([new File(['hallo'], 'notiz.txt', { type: 'text/plain' })]);
    await warte();
    expect(ev.defaultPrevented).toBe(false);
    expect(speichern.legePostAn).not.toHaveBeenCalled();
  });

  it('ungültige Bilder werden übersprungen und genannt', async () => {
    speichern.bildFehler.mockImplementation(f => (f.name === 'gross.png' ? 'Bild ist größer als 10 MB.' : null));
    ansicht = montiere({ einheiten: [einheit(1)], posts: [post('p1', 'video:v1')] });
    einfuegen([bild('gross.png'), bild('ok.png')]);
    await warte();
    expect(window.toastSystem.show).toHaveBeenCalledWith('1 Bild übersprungen: Bild ist größer als 10 MB.', 'warning', undefined, undefined);
    expect(speichern.ladeScreenshotsHoch.mock.calls[0][1].map(f => f.name)).toEqual(['ok.png']);
    speichern.bildFehler.mockImplementation(() => null);
  });

  it('Ablegen auf einer anderen Zeile hängt den Screenshot an deren Post', async () => {
    ansicht = montiere({ einheiten: [einheit(1), einheit(2)], posts: [post('p1', 'video:v1'), post('p2', 'video:v2', { status: 'confirmed', metrics: { views: 5 } })] });
    expect(ansicht.zustand.erfassen.auswahl).toBe('post:p1');
    ablegen(ansicht.root.querySelector('[data-erfassen-eintrag="post:p2"]'), [bild()]);
    await warte();
    expect(speichern.legePostAn).not.toHaveBeenCalled();
    expect(speichern.ladeScreenshotsHoch.mock.calls[0][0].id).toBe('p2');
    expect(ansicht.zeilen().find(z => z.key === 'post:p2')).toMatchObject({ status: 'liest', aktiv: true });
  });

  it('scheitert der Start nach dem Upload, steht der Post auf Fehler', async () => {
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    speichern.starteScreenshotLesen.mockRejectedValueOnce(new Error('Function nicht erreichbar'));
    speichern.setzeKiStatus.mockImplementation(async (p, kiStatus, kiFehler) => ({ ...p, kiStatus, kiFehler }));
    ansicht = montiere({ einheiten: [einheit(1)], posts: [post('p1', 'video:v1')] });
    einfuegen([bild()]);
    await warte();
    expect(speichern.setzeKiStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), 'fehler', 'Function nicht erreichbar');
    expect(ansicht.zeilen()[0].status).toBe('fehler');
    expect(ansicht.root.querySelector('.erfassen-fehler').textContent).toContain('Function nicht erreichbar');
  });

  it('KI fertig: Felder gefüllt, unsichere markiert, Getipptes bleibt', async () => {
    let fertig;
    kiLauf.warteAufKi.mockImplementationOnce(() => new Promise((resolve) => { fertig = resolve; }));
    ansicht = montiere({ einheiten: [einheit(1)], posts: [post('p1', 'video:v1', { kiStatus: 'laeuft', screenshots: 1 })] });
    const account = ansicht.form().querySelector('[name="accountHandle"]');
    account.value = 'creator1';
    account.dispatchEvent(new Event('input', { bubbles: true }));

    fertig(post('p1', 'video:v1', { source: 'ki', screenshots: 1, metrics: { views: 4210, reach: 3900 }, confidence: { views: 0.97, reach: 0.55 } }));
    await warte();
    const f = ansicht.form();
    expect(ansicht.zeilen()[0].status).toBe('pruefen');
    expect(f.querySelector('[data-kennzahl="views"]').value).toBe('4.210');
    expect(f.querySelector('[data-feld="reach"]').classList.contains('is-unsicher')).toBe(true);
    expect(f.querySelector('[name="accountHandle"]').value).toBe('creator1');
    expect(window.toastSystem.show).toHaveBeenCalledWith('Hook 1: 2 Felder aus 1 Screenshot gelesen · 1 bitte prüfen', 'warning', undefined, undefined);
  });
});

describe('Link: Abrufen und Speichern', () => {
  let ansicht;
  beforeEach(() => {
    window.toastSystem = { show: vi.fn() };
    speichern.legePostAn.mockImplementation(async felder => post('n1', felder.einheitId, { plattform: felder.plattform, link: felder.link || null, postedAt: null, measuredAt: felder.measuredAt || null }));
  });
  afterEach(() => { ansicht?.abbauen(); vi.clearAllMocks(); });

  function tippe(link) {
    const input = ansicht.form().querySelector('[data-erfassen-link]');
    input.value = link;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input;
  }

  it('Reel-Link: Abrufen legt an und übernimmt die Zahlen, der Eintrag bleibt gewählt und an seinem Platz', async () => {
    speichern.rufeLinkAb.mockImplementation(async id => post(id, 'video:v1', { link: REEL, source: 'api', status: 'confirmed', metrics: { views: 31504, likes: 1200 } }));
    ansicht = montiere({ einheiten: [einheit(1), einheit(2)] });
    tippe(REEL);
    const knopf = ansicht.form().querySelector('[data-erfassen-aktion="abrufen"]');
    expect(knopf.disabled).toBe(false);
    knopf.click();
    await warte();
    expect(speichern.legePostAn).toHaveBeenCalledWith({ einheitId: 'video:v1', plattform: 'ig_reel', dateiId: null, link: REEL });
    expect(speichern.rufeLinkAb).toHaveBeenCalledWith('n1');
    expect(window.toastSystem.show).toHaveBeenCalledWith('Hook 1: 31.504 Aufrufe von Instagram übernommen.', 'success', undefined, undefined);
    expect(ansicht.zeilen()[0]).toMatchObject({ key: 'post:n1', status: 'erfasst' });
    expect(ansicht.zustand.erfassen.auswahl).toBe('post:n1');
    expect(ansicht.zustand.erfassen.fertig).toBe(false);
    expect(ansicht.form().querySelector('[name="views"], [data-kennzahl="views"]')).not.toBeNull();
  });

  it('Story-Link: Abrufen bleibt aus, Enter speichert den Link und öffnet die Felder', async () => {
    const story = 'https://www.instagram.com/stories/creator1/3456789/';
    ansicht = montiere({ einheiten: [einheit(1, { art: 'story' })] });
    const input = tippe(story);
    expect(ansicht.form().querySelector('[data-erfassen-aktion="abrufen"]').disabled).toBe(true);
    expect(ansicht.form().querySelector('[data-erfassen-link-hinweis]').textContent).toMatch(/Story-Insights/);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await warte();
    expect(speichern.rufeLinkAb).not.toHaveBeenCalled();
    expect(speichern.legePostAn).toHaveBeenCalledWith(expect.objectContaining({ einheitId: 'video:v1', plattform: 'ig_story', link: story }));
    expect(ansicht.form().querySelector('[data-kennzahl="linkClicks"]')).not.toBeNull();
  });

  it('Abruf-Fehler: Toast, der Post bleibt offen', async () => {
    speichern.rufeLinkAb.mockRejectedValueOnce(Object.assign(new Error('Instagram antwortet gerade nicht.'), { retryable: true }));
    ansicht = montiere({ einheiten: [einheit(1)] });
    tippe(REEL);
    ansicht.form().querySelector('[data-erfassen-aktion="abrufen"]').click();
    await warte();
    expect(window.toastSystem.show).toHaveBeenCalledWith('Instagram antwortet gerade nicht.', 'warning', undefined, undefined);
    expect(ansicht.zeilen()[0]).toMatchObject({ key: 'post:n1', status: 'pruefen' });
    expect(ansicht.form().hasAttribute('aria-busy')).toBe(false);
  });
});
