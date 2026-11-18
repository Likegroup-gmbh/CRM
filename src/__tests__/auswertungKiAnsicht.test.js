import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { einheit, montiere, post, warte } from './auswertungErfassenTestKit.js';

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

const liest = (extra = {}) => post('p1', 'video:v1', {
  source: 'ki', kiStatus: 'laeuft', kiSchritt: 'ki', kiGestartetAt: 'T1', screenshots: 2, screenshotPfade: ['ka1/p1/a.jpg', 'ka1/p1/b.jpg'], ...extra
});

describe('KI-Lauf in der Erfassen-Ansicht', () => {
  let ansicht;
  beforeEach(() => {
    window.toastSystem = { show: vi.fn() };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    speichern.beendeKiLauf.mockImplementation(async (p, grund) => ({ ...p, kiStatus: 'fehler', kiFehler: grund }));
  });
  afterEach(() => {
    ansicht?.abbauen();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('zeigt Schritt, Sekunden und Abbrechen, das Bild nennt den Schritt', () => {
    ansicht = montiere({ einheiten: [einheit(1)], posts: [liest()] });
    const hinweis = ansicht.root.querySelector('[data-erfassen-ki-lauf]');
    expect(hinweis.textContent).toMatch(/KI liest 2 Screenshots/);
    expect(hinweis.textContent).toMatch(/Schritt 3 von 4: KI liest die Zahlen/);
    expect(hinweis.querySelector('[data-ki-sekunden]').textContent).toBe('0 s');
    expect(hinweis.querySelector('[data-erfassen-aktion="abbrechen"]').disabled).toBe(false);
    expect(ansicht.root.querySelector('.erfassen-shots__liest').textContent).toBe('KI liest die Zahlen');
    expect(kiLauf.warteAufKi).toHaveBeenCalledWith('p1', expect.objectContaining({ schritt: 'ki', lauf: 'T1' }));
  });

  it('ein neuer Schritt zeichnet den Hinweis neu', () => {
    ansicht = montiere({ einheiten: [einheit(1)], posts: [liest({ kiSchritt: 'wartet' })] });
    const { onSchritt } = kiLauf.warteAufKi.mock.calls[0][1];
    onSchritt(liest({ kiSchritt: 'speichern' }));
    expect(ansicht.root.querySelector('[data-erfassen-ki-lauf]').textContent).toMatch(/Schritt 4 von 4: Wird gespeichert/);
  });

  it('Abbrechen beendet das Warten und steht als Fehler mit Schritt am Post', async () => {
    ansicht = montiere({ einheiten: [einheit(1)], posts: [liest()] });
    const { signal } = kiLauf.warteAufKi.mock.calls[0][1];
    ansicht.root.querySelector('[data-erfassen-aktion="abbrechen"]').click();
    await warte();
    expect(signal.aborted).toBe(true);
    expect(speichern.beendeKiLauf).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), 'Abgebrochen.');
    expect(ansicht.zeilen()[0].status).toBe('fehler');
    const fehler = ansicht.root.querySelector('.erfassen-fehler').textContent;
    expect(fehler).toMatch(/Abgebrochen\./);
    expect(fehler).toMatch(/Bei Schritt: KI liest die Zahlen/);
    expect(ansicht.root.querySelector('[data-erfassen-aktion="erneut"]')).not.toBeNull();
    expect(window.toastSystem.show).toHaveBeenCalledWith('Lesen abgebrochen.', 'info', undefined, undefined);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/\[Auswertung KI p1\] vom Team abgebrochen bei Schritt „ki“/));
  });

  it('war die KI beim Abbrechen schon fertig, bleibt ihr Ergebnis', async () => {
    speichern.beendeKiLauf.mockImplementation(async p => ({ ...p, kiStatus: null, kiSchritt: null, metrics: { views: 4210 }, confidence: { views: 0.97 } }));
    ansicht = montiere({ einheiten: [einheit(1)], posts: [liest()] });
    ansicht.root.querySelector('[data-erfassen-aktion="abbrechen"]').click();
    await warte();
    expect(ansicht.zeilen()[0].status).toBe('pruefen');
    expect(ansicht.form().querySelector('[data-kennzahl="views"]').value).toBe('4.210');
    expect(window.toastSystem.show).toHaveBeenCalledWith(expect.stringMatching(/1 Feld aus 2 Screenshots gelesen/), 'success', undefined, undefined);
  });

  it('läuft eine Frist ab, steht der Fehler am Post statt nur im Toast', async () => {
    let scheitern;
    kiLauf.warteAufKi.mockImplementationOnce(() => new Promise((_, reject) => { scheitern = reject; }));
    ansicht = montiere({ einheiten: [einheit(1)], posts: [liest({ kiSchritt: 'wartet' })] });
    scheitern(new kiLauf.KiFristError('Die KI ist nicht gestartet. Erneut versuchen oder manuell eintragen.', { schritt: 'wartet', nichtGestartet: true }));
    await warte();
    await warte();
    expect(speichern.beendeKiLauf).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), 'Die KI ist nicht gestartet. Erneut versuchen oder manuell eintragen.');
    expect(ansicht.zeilen()[0].status).toBe('fehler');
    expect(ansicht.root.querySelector('.erfassen-fehler').textContent).toMatch(/Bei Schritt: Wird gestartet/);
  });

  it('Erneut versuchen beobachtet den neuen Lauf', async () => {
    speichern.setzeKiStatus.mockImplementation(async p => ({ ...p, kiStatus: 'laeuft', kiFehler: null, kiSchritt: 'wartet', kiGestartetAt: 'T2' }));
    ansicht = montiere({ einheiten: [einheit(1)], posts: [liest({ kiStatus: 'fehler', kiFehler: 'Abgebrochen.' })] });
    ansicht.root.querySelector('[data-erfassen-aktion="erneut"]').click();
    await warte();
    expect(speichern.setzeKiStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), 'laeuft');
    expect(speichern.starteScreenshotLesen).toHaveBeenCalledWith('p1');
    expect(kiLauf.warteAufKi).toHaveBeenCalledWith('p1', expect.objectContaining({ schritt: 'wartet', lauf: 'T2' }));
  });
});
