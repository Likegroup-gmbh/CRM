import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/auswertung/auswertungPostsDaten.js', () => ({ ladePost: vi.fn() }));

const daten = await import('../modules/auswertung/auswertungPostsDaten.js');
const { warteAufKi, laufDauer, schrittLabel, START_FRIST_MS, LAUF_FRIST_MS } = await import('../modules/auswertung/auswertungKiLauf.js');

const lauf = (schritt, extra = {}) => ({ id: 'p1', kiStatus: 'laeuft', kiSchritt: schritt, kiGestartetAt: 'T1', ...extra });
const fertig = { id: 'p1', kiStatus: null, kiSchritt: null, confidence: { views: 1, reach: 0.6 } };

describe('KI-Lauf beobachten', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ['info', 'warn', 'error'].forEach(art => vi.spyOn(console, art).mockImplementation(() => {}));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    daten.ladePost.mockReset();
  });

  it('meldet jeden Schrittwechsel einmal und gibt den fertigen Post zurück', async () => {
    daten.ladePost
      .mockResolvedValueOnce(lauf('gestartet'))
      .mockResolvedValueOnce(lauf('ki'))
      .mockResolvedValueOnce(lauf('ki'))
      .mockResolvedValueOnce(fertig);
    const onSchritt = vi.fn();
    const ergebnis = warteAufKi('p1', { onSchritt, schritt: 'wartet', lauf: 'T1' });
    await vi.advanceTimersByTimeAsync(8000);
    await expect(ergebnis).resolves.toBe(fertig);
    expect(onSchritt.mock.calls.map(([p]) => p.kiSchritt)).toEqual(['gestartet', 'ki']);
    expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/^\[Auswertung KI p1\] fertig nach 8\.0 s: 2 Felder/), ['views', 'reach']);
  });

  it('meldet sich die Function nicht, gilt der Lauf nach 20 s als nicht gestartet', async () => {
    daten.ladePost.mockResolvedValue(lauf('wartet'));
    const ergebnis = warteAufKi('p1', { schritt: 'wartet', lauf: 'T1' });
    const erwartung = expect(ergebnis).rejects.toMatchObject({ name: 'KiFristError', nichtGestartet: true, schritt: 'wartet' });
    await vi.advanceTimersByTimeAsync(START_FRIST_MS + 2000);
    await erwartung;
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/Netlify-Logs von post-screenshot-background/));
  });

  it('hängt der Lauf in einem Schritt, scheitert er nach 120 s', async () => {
    daten.ladePost.mockResolvedValue(lauf('ki'));
    const ergebnis = warteAufKi('p1', { schritt: 'wartet', lauf: 'T1' });
    const erwartung = expect(ergebnis).rejects.toMatchObject({ nichtGestartet: false, schritt: 'ki', message: 'Die KI hat nach 120 s nicht geantwortet.' });
    await vi.advanceTimersByTimeAsync(LAUF_FRIST_MS + 2000);
    await erwartung;
  });

  it('ein neuer Lauf startet die Fristen neu', async () => {
    const t0 = Date.now();
    daten.ladePost.mockImplementation(async () => (Date.now() - t0 < 100000 ? lauf('ki') : lauf('ki', { kiGestartetAt: 'T2' })));
    const ergebnis = warteAufKi('p1', { schritt: 'ki', lauf: 'T1' });
    let fehler = null;
    ergebnis.catch((e) => { fehler = e; });
    await vi.advanceTimersByTimeAsync(200000);
    expect(fehler).toBeNull();
    await vi.advanceTimersByTimeAsync(30000);
    expect(fehler?.name).toBe('KiFristError');
  });

  it('Abfragefehler brechen nicht ab', async () => {
    daten.ladePost.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(fertig);
    const ergebnis = warteAufKi('p1', { schritt: 'ki', lauf: 'T1' });
    await vi.advanceTimersByTimeAsync(4000);
    await expect(ergebnis).resolves.toBe(fertig);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/Abfrage fehlgeschlagen/), 'offline');
  });

  it('Abbruch über das Signal gibt null zurück, die Laufzeit endet', async () => {
    daten.ladePost.mockResolvedValue(lauf('ki'));
    const abort = new AbortController();
    const ergebnis = warteAufKi('p1', { signal: abort.signal, schritt: 'ki', lauf: 'T1' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(laufDauer('p1')).toBe(5000);
    abort.abort();
    await expect(ergebnis).resolves.toBeNull();
    expect(laufDauer('p1')).toBe(0);
  });

  it('Schritte haben Klartext, Unbekanntes fällt auf „KI liest …“', () => {
    expect(schrittLabel('ki')).toBe('KI liest die Zahlen');
    expect(schrittLabel(null)).toBe('KI liest …');
  });
});
