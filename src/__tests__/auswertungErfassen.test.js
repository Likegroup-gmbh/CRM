import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomDatePicker } from '../core/components/CustomDatePicker.js';
import { eintraegeAus, gefiltert, naechsterEintrag, zaehle } from '../modules/auswertung/auswertungArbeitsliste.js';
import {
  bestaetigungsTeil, messWarnung, pflichtFehler, renderKennzahlFelder, zahlAusEingabe
} from '../modules/auswertung/auswertungFormular.js';
import { herkunftText } from '../modules/auswertung/auswertungFormat.js';
import { einheit, modellAus, montiere, post, warte } from './auswertungErfassenTestKit.js';

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
  starteScreenshotLesen: vi.fn(),
  screenshotUrls: vi.fn(async () => [])
}));
vi.mock('../modules/auswertung/auswertungKiLauf.js', async (original) => ({
  ...(await original()),
  warteAufKi: vi.fn(() => new Promise(() => {}))
}));

const speichern = await import('../modules/auswertung/auswertungPostsSpeichern.js');

const EINHEITEN = [einheit(1), einheit(2), einheit(3), einheit(4, { erwartet: false })];
const POSTS = [
  post('p1', 'video:v1', { status: 'confirmed', metrics: { views: 900 } }),
  post('p2', 'video:v2', { source: 'ki', metrics: { views: 1200, reach: 800 }, confidence: { views: 0.95, reach: 0.6 }, screenshots: 1 }),
  post('p3', 'video:v3', { kiStatus: 'laeuft' })
];

describe('Arbeitsliste: Status, Sortierung, Filter', () => {
  it('Prüfen → KI liest → Fehlt → Optional → Erfasst', () => {
    const modell = modellAus([...EINHEITEN, einheit(5)], POSTS);
    expect(eintraegeAus(modell).map(e => [e.key, e.status])).toEqual([
      ['post:p2', 'pruefen'],
      ['post:p3', 'liest'],
      ['einheit:video:v5', 'fehlt'],
      ['einheit:video:v4', 'optional'],
      ['post:p1', 'erfasst']
    ]);
  });

  it('Zähler und Filter: KI liest zählt zu Prüfen, Optional nur zu Alle', () => {
    const eintraege = eintraegeAus(modellAus([...EINHEITEN, einheit(5)], POSTS));
    expect(zaehle(eintraege)).toEqual({ alle: 5, pruefen: 2, fehlt: 1, erfasst: 1 });
    expect(gefiltert(eintraege, 'fehlt').map(e => e.key)).toEqual(['einheit:video:v5']);
  });

  it('nach dem Bestätigen: nächster Prüfen, sonst Fehlt', () => {
    const eintraege = eintraegeAus(modellAus([...EINHEITEN, einheit(5)], POSTS));
    expect(naechsterEintrag(eintraege, 'post:p1').key).toBe('post:p2');
    expect(naechsterEintrag(eintraege, 'post:p2').key).toBe('einheit:video:v5');
  });
});

describe('Formular: Zahlen, Pflicht, Messregel, Plattformwechsel', () => {
  it('liest deutsche Schreibweisen', () => {
    expect(zahlAusEingabe('31.504', 'views')).toBe(31504);
    expect(zahlAusEingabe('31 504', 'views')).toBe(31504);
    expect(zahlAusEingabe('12,5', 'avgWatchSec')).toBe(12.5);
    expect(zahlAusEingabe('38 %', 'completionPct')).toBe(38);
    expect(zahlAusEingabe('', 'views')).toBeNull();
    expect(zahlAusEingabe('1.2', 'views')).toBeNaN();
    expect(zahlAusEingabe('140', 'completionPct')).toBeNaN();
  });

  it('Pflicht sind Plattform, Aufrufe und Postdatum', () => {
    const teil = { plattform: 'ig_reel', postedAt: '2026-11-01', metrics: { views: 10 } };
    expect(pflichtFehler(teil)).toBeNull();
    expect(pflichtFehler({ ...teil, metrics: {} })).toEqual({ name: 'm:views', text: 'Aufrufe fehlen.' });
    expect(pflichtFehler({ ...teil, postedAt: null }).name).toBe('postedAt');
    expect(pflichtFehler({ ...teil, metrics: { views: 10, likes: NaN } }).text).toMatch(/Likes/);
  });

  it('warnt unter der Messregel, blockt aber nicht', () => {
    expect(messWarnung('2026-11-01', '2026-11-04')).toMatch(/3 Tage nach dem Post.*7 Tage/);
    expect(messWarnung('2026-11-01', '2026-11-08')).toBe('');
    expect(messWarnung('2026-11-05', '2026-11-01')).toMatch(/vor Gepostet/);
    expect(messWarnung(null, '2026-11-01')).toBe('');
  });

  it('Plattformwechsel: gleiche Felder behalten ihren Wert, fremde fallen weg', () => {
    const html = renderKennzahlFelder('ig_story', { views: 1200, comments: 40, linkClicks: 7 });
    expect(html).toContain('data-kennzahl="linkClicks"');
    expect(html).toContain('data-kennzahl="stickerTaps"');
    expect(html).toContain('value="1.200"');
    expect(html).not.toContain('data-kennzahl="comments"');
  });

  it('Bestätigen: Werte anderer Plattformen weg, gelesene Felder behalten ihren Schlüssel mit 1', () => {
    const vorher = post('p2', 'video:v2', { confidence: { views: 0.6, comments: 0.9 } });
    const teil = bestaetigungsTeil(vorher, { plattform: 'ig_story', postedAt: '2026-11-01', metrics: { views: 1200, comments: 40, exits: 3 } });
    expect(teil.metrics).toEqual({ views: 1200, exits: 3 });
    expect(teil.confidence).toEqual({ views: 1 });
  });

  it('Herkunft nennt Quelle, unsichere Felder und wer bestätigt hat', () => {
    expect(herkunftText(POSTS[1])).toBe('Von der KI aus 1 Screenshot gelesen · 1 Feld unsicher');
    expect(herkunftText({ ...POSTS[0], source: 'api', confirmedBy: 'Mara' })).toBe('Per Link von Instagram abgerufen · bestätigt von Mara');
  });
});

describe('Ansicht: Auswahl, Tastatur, Bestätigen & weiter', () => {
  let ansicht;
  beforeEach(() => { window.toastSystem = { show: vi.fn() }; });
  afterEach(() => { ansicht?.abbauen(); vi.clearAllMocks(); });

  it('wählt zuerst den ersten Prüfen-Eintrag und markiert unsichere Felder', () => {
    ansicht = montiere({ einheiten: EINHEITEN, posts: POSTS });
    expect(ansicht.zeilen()[0]).toMatchObject({ key: 'post:p2', aktiv: true });
    const reach = ansicht.form().querySelector('[data-feld="reach"]');
    expect(reach.classList.contains('is-unsicher')).toBe(true);
    expect(ansicht.form().querySelector('[data-feld="views"]').classList.contains('is-unsicher')).toBe(false);
  });

  it('die Markierung verschwindet beim Bearbeiten', () => {
    ansicht = montiere({ einheiten: EINHEITEN, posts: POSTS });
    const input = ansicht.form().querySelector('[data-kennzahl="reach"]');
    input.value = '810';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.closest('.erfassen-feld').classList.contains('is-unsicher')).toBe(false);
  });

  it('↓ wechselt zum nächsten Eintrag', () => {
    ansicht = montiere({ einheiten: EINHEITEN, posts: POSTS });
    const erste = ansicht.root.querySelector('[data-erfassen-eintrag="post:p2"]');
    erste.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(ansicht.zustand.erfassen.auswahl).toBe('post:p3');
    expect(ansicht.form().dataset.eintrag).toBe('post:p3');
  });

  it('Ziel aus der Tabelle wählt den Post und setzt den Filter zurück', () => {
    ansicht = montiere({ einheiten: EINHEITEN, posts: POSTS, zustand: { ziel: { postId: 'p1' }, erfassen: { filter: 'pruefen', auswahl: null, fertig: false } } });
    expect(ansicht.zustand.erfassen).toMatchObject({ filter: 'alle', auswahl: 'post:p1' });
  });

  it('fehlende Pflicht hält den Fokus im Feld, nichts wird gespeichert', async () => {
    ansicht = montiere({ einheiten: EINHEITEN, posts: [post('p2', 'video:v2', { metrics: {} })] });
    ansicht.form().requestSubmit();
    await warte();
    expect(speichern.bestaetigePost).not.toHaveBeenCalled();
    expect(document.activeElement?.dataset.kennzahl).toBe('views');
    expect(ansicht.form().querySelector('[data-erfassen-hinweis]').textContent).toBe('Aufrufe fehlen.');
  });

  it('Enter bestätigt und springt zum nächsten offenen Eintrag', async () => {
    speichern.bestaetigePost.mockImplementation(async (p, teil) => ({ ...p, ...teil, status: 'confirmed', confirmedBy: 'Mara' }));
    ansicht = montiere({ einheiten: [...EINHEITEN, einheit(5)], posts: POSTS });
    ansicht.form().requestSubmit();
    await warte();
    const [vorher, teil] = speichern.bestaetigePost.mock.calls[0];
    expect(vorher.id).toBe('p2');
    expect(teil).toMatchObject({ plattform: 'ig_reel', metrics: { views: 1200, reach: 800 }, confidence: { views: 1, reach: 1 } });
    expect(ansicht.zustand.erfassen.auswahl).toBe('einheit:video:v5');
    expect(ansicht.root.querySelector('.erfassen-fehlt')).not.toBeNull();
    expect(ansicht.zeilen().find(z => z.key === 'post:p2').status).toBe('erfasst');
    expect(window.toastSystem.show).toHaveBeenCalledWith('Hook 2 bestätigt.', 'success', undefined, expect.objectContaining({ action: expect.objectContaining({ label: 'Rückgängig' }) }));
  });

  it('ohne Post stehen die Felder leer da; Bestätigen legt den Post erst dann an und bestätigt ihn', async () => {
    speichern.legePostAn.mockImplementation(async f => post('n1', f.einheitId, { plattform: f.plattform, metrics: {} }));
    speichern.bestaetigePost.mockImplementation(async (p, teil) => ({ ...p, ...teil, status: 'confirmed' }));
    ansicht = montiere({ einheiten: [einheit(1)] });
    const form = ansicht.form();
    expect(form.querySelector('[name="plattform"]').value).toBe('ig_reel');
    expect(form.querySelector('[data-kennzahl="views"]').value).toBe('');
    expect(form.querySelector('[data-erfassen-aktion="verwerfen"]')).toBeNull();
    form.requestSubmit();
    await warte();
    expect(speichern.legePostAn).not.toHaveBeenCalled();
    expect(form.querySelector('[data-erfassen-hinweis]').textContent).toBe('Aufrufe fehlen.');

    const views = form.querySelector('[data-kennzahl="views"]');
    views.value = '1.200';
    CustomDatePicker.setValue(form.querySelector('[name="postedAt"]'), '2026-11-01');
    form.requestSubmit();
    await warte();
    expect(speichern.legePostAn).toHaveBeenCalledWith(expect.objectContaining({ einheitId: 'video:v1', plattform: 'ig_reel' }));
    expect(speichern.bestaetigePost).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }), expect.objectContaining({ metrics: { views: 1200 } }));
    expect(ansicht.zeilen().find(z => z.key === 'post:n1').status).toBe('erfasst');
  });

  it('Verwerfen nimmt den Post sofort aus der Liste, gelöscht wird erst nach der Frist', async () => {
    vi.useFakeTimers();
    try {
      ansicht = montiere({ einheiten: EINHEITEN, posts: POSTS });
      ansicht.root.querySelector('[data-erfassen-aktion="verwerfen"]').click();
      expect(ansicht.posts().some(p => p.id === 'p2')).toBe(false);
      expect(speichern.loeschePost).not.toHaveBeenCalled();
      vi.advanceTimersByTime(6000);
      expect(speichern.loeschePost).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }));
    } finally {
      vi.useRealTimers();
    }
  });
});
