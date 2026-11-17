import { describe, it, expect, vi, afterEach } from 'vitest';
import { stand, antwort, fortschrittAus, medienablageUmgebung } from './medienablageTestKit.js';

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(),
}));

const { authorizedFetch } = await import('../core/auth/getAccessToken.js');
const { MedienablagePage, UMZUG_POLL_MS } = await import('../modules/admin/MedienablagePage.js');

// Laufende Umzuege: die Seite laedt im Takt nur den Fortschritt (aktion fortschritt) nach,
// loggt in die Konsole und holt am Ende einmal den vollen Stand.
const t = medienablageUmgebung({ authorizedFetch, MedienablagePage });
const { zustand, openPage, bodies, abrufe, umzugLogs, konsole } = t;

const meldung = (id, extra) => ({
  id, unternehmen_id: 'u2', bereich: 'medien', typ: 'video', status: 'offen', grund: 'x', versuche: 0, max_versuche: 6,
  naechster_versuch: null, datei: `${id}.mp4`, quelle: `/Acme/${id}.mp4`, ...extra,
});

const fakeTimer = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

describe('Medienablage: Umzug beobachten', () => {
  afterEach(() => {
    delete document.hidden;
  });

  it('laedt waehrend eines Umzugs nur den Fortschritt nach, loggt jeden Schritt und holt am Ende einmal den vollen Stand', async () => {
    fakeTimer();
    // Jeder Abruf ist einen Schritt weiter: Medien eine Datei je Abruf, Dokumente bis 2
    let schritt = 0;
    authorizedFetch.mockImplementation(async (_path, opts) => {
      const body = JSON.parse(opts.body);
      if (body.aktion !== 'stand' && body.aktion !== 'fortschritt') return antwort({ ok: true });
      const medien = Math.min(schritt, 50);
      const dok = Math.min(schritt, 2);
      schritt += 1;
      const s = stand({
        umzug: [{ unternehmen_id: 'u2', offen: 50 - medien, fertig: medien, fehler: 0, uebersprungen: 0 }],
        dokument_umzug: [{ unternehmen_id: 'u2', offen: 2 - dok, fertig: dok, fehler: 0, uebersprungen: 0 }],
      });
      return antwort(body.aktion === 'stand' ? s : fortschrittAus(s, body.umzug_ids));
    });

    await openPage();
    for (let i = 0; i < 50; i += 1) await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS * 5);

    expect(umzugLogs().filter(l => l.startsWith('[Medienablage] Umzug (Test GmbH)'))).toEqual([
      ...Array.from({ length: 50 }, (_, n) => `[Medienablage] Umzug (Test GmbH): ${n} von 50`),
      '[Medienablage] Umzug (Test GmbH): 50 von 50 · abgeschlossen',
    ]);
    expect(umzugLogs().filter(l => l.startsWith('[Medienablage] Dokument-Umzug'))).toEqual([
      '[Medienablage] Dokument-Umzug (Test GmbH): 0 von 2',
      '[Medienablage] Dokument-Umzug (Test GmbH): 1 von 2',
      '[Medienablage] Dokument-Umzug (Test GmbH): 2 von 2 · abgeschlossen',
    ]);
    expect(window.content.textContent).toContain('Umgezogen: 50');

    // Voller Stand nur beim Oeffnen und nach dem Ende, dazwischen 50 leichte Abrufe
    expect(abrufe('stand')).toBe(2);
    expect(abrufe('fortschritt')).toBe(50);
    expect(bodies().at(-1)).toEqual({ aktion: 'stand' });

    // Nichts mehr offen: kein weiteres Nachladen
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS * 5);
    expect(abrufe('stand') + abrufe('fortschritt')).toBe(52);
  });

  it('loggt Fehler und Uebersprungene mit und zaehlt sie als abgeschlossen', async () => {
    zustand.stand = stand({ umzug: [{ unternehmen_id: 'u2', offen: 3, fertig: 5, fehler: 1, uebersprungen: 1 }] });
    await openPage();
    expect(umzugLogs()).toEqual(['[Medienablage] Umzug (Test GmbH): 7 von 10 (1 Fehler, 1 übersprungen)']);
  });

  it('ohne offenen Umzug kein Log und kein Nachladen, destroy beendet das Nachladen', async () => {
    fakeTimer();
    zustand.stand = stand({ umzug: [{ unternehmen_id: 'u2', offen: 0, fertig: 8, fehler: 0 }] });
    await openPage();
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS * 3);
    expect(abrufe('stand')).toBe(1);
    expect(abrufe('fortschritt')).toBe(0);
    expect(umzugLogs()).toEqual([]);

    zustand.stand = stand();
    t.created.pop().destroy();
    authorizedFetch.mockClear();
    const page = await openPage();
    expect(abrufe('stand')).toBe(1);
    page.destroy();
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS * 3);
    expect(abrufe('stand')).toBe(1);
    expect(abrufe('fortschritt')).toBe(0);
  });

  it('im Hintergrund-Tab kein Abruf, sichtbar geht es im naechsten Takt weiter', async () => {
    fakeTimer();
    await openPage();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS * 5);
    expect(abrufe('fortschritt')).toBe(0);

    delete document.hidden;
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(abrufe('fortschritt')).toBe(1);
    expect(abrufe('stand')).toBe(1);
  });

  it('Nachladen waehrend des Umzugs laesst Fokus und Cursor in der Suche', async () => {
    fakeTimer();
    await openPage();
    const suche = window.content.querySelector('[data-ma-suche]');
    suche.focus();
    suche.value = 'tes';
    suche.dispatchEvent(new Event('input', { bubbles: true }));

    zustand.stand = stand({ umzug: [{ unternehmen_id: 'u2', offen: 1, fertig: 7, fehler: 0 }] });
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);

    const neu = window.content.querySelector('[data-ma-suche]');
    expect(neu).not.toBe(suche);
    expect(document.activeElement).toBe(neu);
    expect(neu.value).toBe('tes');
    expect(neu.selectionStart).toBe(3);
    expect(window.content.textContent).toContain('Umzug läuft · 7 von 8');
  });

  it('loggt Fehler je Datei: endgueltig, Wiederholung, uebersprungen, wartet, und jeden neuen Versuch einmal', async () => {
    fakeTimer();
    const meldungen = [
      meldung('a', { status: 'fehler', grund: 'dropbox_fehlt', versuche: 1 }),
      meldung('b', { grund: 'dropbox_503', versuche: 2 }),
      meldung('c', { status: 'uebersprungen', grund: 'leer' }),
      meldung('d', { grund: 'wartet_auf_abgleich' }),
      meldung('e', { bereich: 'dokumente', typ: 'vertrag', status: 'fehler', grund: 'storage_fehlt', versuche: 6, datei: 'Vertrag.pdf' }),
    ];
    zustand.stand = stand({
      umzug: [{ unternehmen_id: 'u2', offen: 3, fertig: 5, fehler: 1, uebersprungen: 1 }],
      dokument_umzug: [{ unternehmen_id: 'u2', offen: 1, fertig: 0, fehler: 1, uebersprungen: 0 }],
      umzug_meldungen: meldungen,
    });
    await openPage();

    expect(umzugLogs('error')).toEqual([
      '[Medienablage] Umzug (Test GmbH): a.mp4 endgültig fehlgeschlagen nach 1 Versuch: dropbox_fehlt',
      '[Medienablage] Dokument-Umzug (Test GmbH): Vertrag.pdf endgültig fehlgeschlagen nach 6 Versuchen: storage_fehlt',
    ]);
    expect(umzugLogs('warn')).toEqual([
      '[Medienablage] Umzug (Test GmbH): b.mp4 Versuch 2 von 6 fehlgeschlagen: dropbox_503',
      '[Medienablage] Umzug (Test GmbH): c.mp4 übersprungen: leer',
    ]);
    expect(umzugLogs('info')).toEqual(['[Medienablage] Umzug (Test GmbH): d.mp4 wartet: wartet_auf_abgleich']);
    expect(konsole.error.mock.calls[0][1]).toMatchObject({ quelle: '/Acme/a.mp4', typ: 'video', versuche: 1 });

    // Gleicher Stand: nichts doppelt. Neuer Versuch an b: genau eine neue Zeile
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(umzugLogs('warn')).toHaveLength(2);
    zustand.stand = { ...zustand.stand, umzug_meldungen: [...meldungen.slice(0, 1), meldung('b', { grund: 'dropbox_503', versuche: 3 }), ...meldungen.slice(2)] };
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(umzugLogs('warn')).toHaveLength(3);
    expect(umzugLogs('warn')[2]).toBe('[Medienablage] Umzug (Test GmbH): b.mp4 Versuch 3 von 6 fehlgeschlagen: dropbox_503');
    expect(umzugLogs('error')).toHaveLength(2);
  });

  it('Meldungen von Umzuegen, die beim Oeffnen schon fertig waren, bleiben still', async () => {
    zustand.stand = stand({
      umzug: [{ unternehmen_id: 'u2', offen: 0, fertig: 7, fehler: 1, uebersprungen: 0 }],
      umzug_meldungen: [meldung('a', { status: 'fehler', grund: 'dropbox_fehlt', versuche: 1 })],
    });
    await openPage();
    expect(umzugLogs('error')).toEqual([]);
  });

  it('schickt beobachtete Umzuege beim Nachladen mit: auch der Fehler an der letzten Datei kommt an', async () => {
    fakeTimer();
    await openPage();
    expect(bodies()[0]).toEqual({ aktion: 'stand' });

    zustand.stand = stand({
      umzug: [{ unternehmen_id: 'u2', offen: 0, fertig: 7, fehler: 1, uebersprungen: 0 }],
      umzug_meldungen: [meldung('z', { status: 'fehler', grund: 'groesse_falsch', versuche: 6 })],
    });
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(bodies()[1]).toEqual({ aktion: 'fortschritt', umzug_ids: ['u2'] });
    expect(umzugLogs()).toContain('[Medienablage] Umzug (Test GmbH): 8 von 8 (1 Fehler) · abgeschlossen');
    expect(umzugLogs('error')).toEqual(['[Medienablage] Umzug (Test GmbH): z.mp4 endgültig fehlgeschlagen nach 6 Versuchen: groesse_falsch']);
    // Danach einmal der volle Stand, ohne die Meldung doppelt zu loggen
    expect(bodies()[2]).toEqual({ aktion: 'stand' });
    expect(umzugLogs('error')).toHaveLength(1);
  });

  it('meldet einen pausierten Umzug (Notschalter, Weiche) einmal und wenn er weiterlaeuft', async () => {
    fakeTimer();
    zustand.stand = stand({ einstellung: { notschalter: true } });
    await openPage();
    expect(umzugLogs('warn')).toEqual(['[Medienablage] Umzug (Test GmbH): pausiert, Notschalter ist aktiv']);

    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(umzugLogs('warn')).toHaveLength(1);

    zustand.stand = stand();
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(umzugLogs('info')).toEqual(['[Medienablage] Umzug (Test GmbH): läuft weiter']);

    const [, u2] = zustand.stand.unternehmen;
    zustand.stand = stand({ unternehmen: [zustand.stand.unternehmen[0], { ...u2, ablage_ziel: 'dropbox' }] });
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(umzugLogs('warn')[1]).toBe('[Medienablage] Umzug (Test GmbH): pausiert, Weiche steht auf Dropbox');
  });

  it('meldet, wenn der Fortschritt beim Nachladen nicht kommt, und versucht es weiter', async () => {
    fakeTimer();
    await openPage();
    authorizedFetch.mockImplementationOnce(async () => antwort({ error: 'Graph nicht erreichbar' }, 502));
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(umzugLogs('warn')).toEqual(['[Medienablage] Stand konnte nicht nachgeladen werden, neuer Versuch in 3 s: Graph nicht erreichbar']);
    expect(window.toastSystem.show).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(abrufe('fortschritt')).toBe(2);
    expect(abrufe('stand')).toBe(1);
  });
});
