import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(),
}));

const { authorizedFetch } = await import('../core/auth/getAccessToken.js');
const { MedienablagePage, UMZUG_POLL_MS } = await import('../modules/admin/MedienablagePage.js');
const { AdminPage } = await import('../modules/admin/AdminPage.js');
const { NavigationSystem } = await import('../modules/navigation/NavigationSystem.js');

// Medienablage-Seite: Stand und Aktionen laufen ueber ablage-stand.
// authorizedFetch ist gemockt und antwortet je nach aktion.
const STUNDE = 60 * 60 * 1000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

function stand(overrides = {}) {
  return {
    konfig: { konfiguriert: true, site_url: 'https://x.sharepoint.com/sites/m', drive_id: 'd1' },
    einstellung: { notschalter: false },
    stand: [{
      drive_id: 'd1',
      letzter_lauf: iso(-5 * 60 * 1000),
      letzter_erfolg: iso(-5 * 60 * 1000),
      letzte_meldung: '12 Änderungen übernommen',
      fehler: null,
      fehler_seit: null,
      abo_ablauf: iso(72 * STUNDE + 60 * 1000),
      voll_abgleich_noetig: false,
      quota_used: 512 * 1024 ** 3,
      quota_total: 1024 * 1024 ** 3,
      zert_ablauf: iso(10 * 24 * STUNDE),
      rechte_lauf: iso(-STUNDE),
      rechte_fehler: null,
    }],
    zaehler: { offen: 3, fehler: 1, unzugeordnet: 1, erledigt_24h: 40 },
    unzugeordnet: [{ item_id: 'i1', name: 'clip.mov', pfad: '/Unsortiert/clip.mov', grund: 'kein_ordner', geaendert_at: iso(-STUNDE), geaendert_von: 'Anna', groesse: 5 * 1024 ** 2 }],
    fehler: [{ item_id: 'i2', name: 'kaputt.mp4', pfad: '/A/kaputt.mp4', grund: 'timeout', versuche: 2, naechster_versuch: iso(STUNDE) }],
    unternehmen: [
      { id: 'u1', firmenname: 'Acme', ablage_ziel: 'dropbox', ist_test: false, dateien_sharepoint: 0, dateien_dropbox: 120 },
      { id: 'u2', firmenname: 'Test GmbH', ablage_ziel: 'sharepoint', ist_test: true, dateien_sharepoint: 10, dateien_dropbox: 4 },
    ],
    umzug: [{ unternehmen_id: 'u2', offen: 2, fertig: 6, fehler: 0 }],
    dokumente: [
      { id: 'u1', dokument_ablage_ziel: 'dropbox', sharepoint: 0, dropbox: 7, storage: 3 },
      { id: 'u2', dokument_ablage_ziel: 'sharepoint', sharepoint: 2, dropbox: 1, storage: 0 },
    ],
    dokument_umzug: [],
    ...overrides,
  };
}

let aktuellerStand = stand();

function antwort(data, status = 200) {
  return { ok: status < 400, status, json: async () => data };
}

const bodies = () => authorizedFetch.mock.calls.map(([, opts]) => JSON.parse(opts.body));
const aktionen = () => bodies().filter(b => b.aktion !== 'stand');

const created = [];
async function openPage() {
  const page = new MedienablagePage();
  created.push(page);
  await page.init();
  await page.ready;
  return page;
}

const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

// Der Standard-Stand hat einen laufenden Umzug, die Seite loggt ihn
const konsole = {};
const umzugLogs = (art = 'log') => konsole[art].mock.calls.map(([t]) => String(t)).filter(t => t.startsWith('[Medienablage]'));

describe('MedienablagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const art of ['log', 'info', 'warn', 'error']) konsole[art] = vi.spyOn(console, art).mockImplementation(() => {});
    aktuellerStand = stand();
    authorizedFetch.mockImplementation(async (_path, opts) => {
      const body = JSON.parse(opts.body);
      if (body.aktion === 'stand') return antwort(structuredClone(aktuellerStand));
      if (body.aktion === 'umzug_starten') return antwort({ ok: true, angelegt: 4 });
      return antwort({ ok: true });
    });
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn((el, html) => { el.innerHTML = html; });
    window.content = document.createElement('div');
    document.body.appendChild(window.content);
    window.isAdmin = vi.fn(() => true);
    window.toastSystem = { show: vi.fn() };
    window.confirmationModal = { open: vi.fn(async () => ({ confirmed: true })) };
  });

  afterEach(() => {
    while (created.length) created.pop().destroy();
    vi.useRealTimers();
    for (const spy of Object.values(konsole)) spy.mockRestore();
    window.content?.remove();
    delete window.toastSystem;
    delete window.confirmationModal;
  });

  it('laedt den Stand ueber ablage-stand und rendert die Statuskarten', async () => {
    await openPage();
    expect(authorizedFetch).toHaveBeenCalledWith('/.netlify/functions/ablage-stand', expect.objectContaining({ method: 'POST' }));
    expect(bodies()[0]).toEqual({ aktion: 'stand' });

    const karten = [...window.content.querySelectorAll('.ma-karte')];
    const labels = karten.map(k => k.querySelector('.ma-karte-label').textContent);
    expect(labels).toEqual(['Abgleich', 'Eingang', 'Webhook-Abo', 'Zertifikat', 'Speicher', 'Rechte-Abgleich']);

    const text = (label) => karten.find(k => k.textContent.includes(label)).textContent;
    expect(text('Abgleich')).toContain('Vor 5 Minuten');
    expect(text('Webhook-Abo')).toContain('Läuft in 3 Tagen ab');
    expect(text('Speicher')).toContain('50 %');
    expect(text('Speicher')).toContain('512 von 1.024 GB belegt');
    // Zertifikat laeuft in 10 Tagen ab: unter der 30-Tage-Grenze, also gelb
    expect(karten.find(k => k.textContent.includes('Zertifikat')).classList).toContain('ma-karte--warn');

    // Weiche, Umzug und Eingang
    expect(window.content.textContent).toContain('Testunternehmen');
    expect(window.content.textContent).toContain('Umzug läuft · 6 von 8');
    expect(window.content.querySelector('[data-ma-erneut="i1"]')).not.toBeNull();
    expect(window.content.querySelector('[data-ma-ignorieren="i1"]')).not.toBeNull();
    expect(window.content.querySelector('[data-ma-erneut="i2"]')).not.toBeNull();
  });

  it('zeigt "nicht konfiguriert" ohne Karten und Weiche', async () => {
    aktuellerStand = stand({ konfig: { konfiguriert: false, site_url: null, drive_id: null } });
    await openPage();
    expect(window.content.textContent).toContain('SharePoint ist nicht konfiguriert');
    expect(window.content.querySelector('.ma-karte')).toBeNull();
    expect(window.content.querySelector('[data-ma-weiche]')).toBeNull();
  });

  it('Notschalter fragt nach, schaltet ein und laedt neu', async () => {
    await openPage();
    const schalter = window.content.querySelector('[data-ma-notschalter]');
    expect(schalter.getAttribute('aria-pressed')).toBe('false');

    aktuellerStand = stand({ einstellung: { notschalter: true } });
    click(schalter);

    await vi.waitFor(() => expect(aktionen()).toEqual([{ aktion: 'notschalter', an: true }]));
    expect(window.confirmationModal.open).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(window.content.querySelector('[data-ma-notschalter]').getAttribute('aria-pressed')).toBe('true'));
    expect(window.toastSystem.show).toHaveBeenCalledWith('Notschalter aktiv: alle Uploads gehen nach Dropbox.', 'success');
  });

  it('Notschalter bleibt aus, wenn die Rueckfrage abgebrochen wird', async () => {
    window.confirmationModal.open.mockResolvedValueOnce({ confirmed: false });
    await openPage();
    click(window.content.querySelector('[data-ma-notschalter]'));
    await vi.waitFor(() => expect(window.confirmationModal.open).toHaveBeenCalled());
    await Promise.resolve();
    expect(aktionen()).toEqual([]);
  });

  it('Notschalter ausschalten braucht keine Rueckfrage', async () => {
    aktuellerStand = stand({ einstellung: { notschalter: true } });
    await openPage();
    click(window.content.querySelector('[data-ma-notschalter]'));
    await vi.waitFor(() => expect(aktionen()).toEqual([{ aktion: 'notschalter', an: false }]));
    expect(window.confirmationModal.open).not.toHaveBeenCalled();
  });

  it('Weiche auf SharePoint fragt nach und schickt unternehmen_id und ziel', async () => {
    await openPage();
    const select = window.content.querySelector('[data-ma-weiche="u1"]');
    select.value = 'sharepoint';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => expect(aktionen()).toEqual([{ aktion: 'weiche', unternehmen_id: 'u1', ziel: 'sharepoint' }]));
    expect(window.confirmationModal.open).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Acme: neue Uploads gehen nach SharePoint.', 'success'));
    // Nach der Aktion wird der Stand neu geladen
    await vi.waitFor(() => expect(bodies().filter(b => b.aktion === 'stand')).toHaveLength(2));
  });

  it('Weiche zurueck auf Dropbox ohne Rueckfrage', async () => {
    await openPage();
    const select = window.content.querySelector('[data-ma-weiche="u2"]');
    select.value = 'dropbox';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(aktionen()).toEqual([{ aktion: 'weiche', unternehmen_id: 'u2', ziel: 'dropbox' }]));
    expect(window.confirmationModal.open).not.toHaveBeenCalled();
  });

  it('abgebrochene Weiche setzt die Auswahl zurueck', async () => {
    window.confirmationModal.open.mockResolvedValueOnce({ confirmed: false });
    await openPage();
    const select = window.content.querySelector('[data-ma-weiche="u1"]');
    select.value = 'sharepoint';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(select.value).toBe('dropbox'));
    expect(aktionen()).toEqual([]);
  });

  it('Eingang, Abgleich und Umzug schicken ihre Aktionen', async () => {
    await openPage();
    const flush = () => vi.waitFor(() => expect(window.content.querySelector('[aria-busy]')).toBeNull());

    click(window.content.querySelector('[data-ma-erneut="i1"]'));
    await vi.waitFor(() => expect(aktionen()).toHaveLength(1));
    await flush();
    click(window.content.querySelector('[data-ma-ignorieren="i1"]'));
    await vi.waitFor(() => expect(aktionen()).toHaveLength(2));
    await flush();
    click(window.content.querySelector('[data-ma-aktion="voll_abgleich"]'));
    await vi.waitFor(() => expect(aktionen()).toHaveLength(3));
    await flush();

    // Umzug: u2 laeuft noch, deshalb ohne laufenden Umzug neu laden
    aktuellerStand = stand({ umzug: [] });
    authorizedFetch.mockClear();
    created.pop().destroy();
    await openPage();
    click(window.content.querySelector('[data-ma-umzug="u2"]'));
    await vi.waitFor(() => expect(aktionen()).toEqual([{ aktion: 'umzug_starten', unternehmen_id: 'u2' }]));
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Umzug gestartet: 4 Dateien.', 'success'));
  });

  it('Dokumente: eigener Notschalter, eigene Weiche (bereich dokumente), eigener Umzug', async () => {
    await openPage();
    const flush = () => vi.waitFor(() => expect(window.content.querySelector('[aria-busy]')).toBeNull());
    expect(window.content.textContent).toContain('Weiche Dokumente');
    expect(window.content.querySelector('[data-ma-dokument-umzug="u2"]')).not.toBeNull();
    expect(window.content.querySelector('[data-ma-dokument-umzug="u1"]')).toBeNull();

    click(window.content.querySelector('[data-ma-notschalter-dokumente]'));
    await vi.waitFor(() => expect(aktionen()).toEqual([{ aktion: 'notschalter', bereich: 'dokumente', an: true }]));
    await flush();

    const select = window.content.querySelector('[data-ma-dokument-weiche="u1"]');
    select.value = 'sharepoint';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(aktionen()).toHaveLength(2));
    expect(aktionen()[1]).toEqual({ aktion: 'weiche', bereich: 'dokumente', unternehmen_id: 'u1', ziel: 'sharepoint' });
    await flush();

    click(window.content.querySelector('[data-ma-dokument-umzug="u2"]'));
    await vi.waitFor(() => expect(aktionen()).toHaveLength(3));
    expect(aktionen()[2]).toEqual({ aktion: 'dokument_umzug_starten', unternehmen_id: 'u2' });
  });

  it('laedt waehrend eines Umzugs nach und loggt jeden Fortschritt in der Konsole', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // Jeder Stand-Abruf ist einen Schritt weiter: Medien eine Datei je Abruf, Dokumente bis 2
    let schritt = 0;
    authorizedFetch.mockImplementation(async (_path, opts) => {
      const body = JSON.parse(opts.body);
      if (body.aktion !== 'stand') return antwort({ ok: true });
      const medien = Math.min(schritt, 50);
      const dok = Math.min(schritt, 2);
      schritt += 1;
      return antwort(stand({
        umzug: [{ unternehmen_id: 'u2', offen: 50 - medien, fertig: medien, fehler: 0, uebersprungen: 0 }],
        dokument_umzug: [{ unternehmen_id: 'u2', offen: 2 - dok, fertig: dok, fehler: 0, uebersprungen: 0 }],
      }));
    });
    const standAbrufe = () => bodies().filter(b => b.aktion === 'stand').length;

    await openPage();
    for (let i = 0; i < 50; i += 1) await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);

    expect(umzugLogs().filter(t => t.startsWith('[Medienablage] Umzug (Test GmbH)'))).toEqual([
      ...Array.from({ length: 50 }, (_, n) => `[Medienablage] Umzug (Test GmbH): ${n} von 50`),
      '[Medienablage] Umzug (Test GmbH): 50 von 50 · abgeschlossen',
    ]);
    expect(umzugLogs().filter(t => t.startsWith('[Medienablage] Dokument-Umzug'))).toEqual([
      '[Medienablage] Dokument-Umzug (Test GmbH): 0 von 2',
      '[Medienablage] Dokument-Umzug (Test GmbH): 1 von 2',
      '[Medienablage] Dokument-Umzug (Test GmbH): 2 von 2 · abgeschlossen',
    ]);
    expect(window.content.textContent).toContain('Umgezogen: 50');

    // Nichts mehr offen: kein weiteres Nachladen
    expect(standAbrufe()).toBe(51);
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS * 5);
    expect(standAbrufe()).toBe(51);
  });

  it('loggt Fehler und Uebersprungene mit und zaehlt sie als abgeschlossen', async () => {
    aktuellerStand = stand({ umzug: [{ unternehmen_id: 'u2', offen: 3, fertig: 5, fehler: 1, uebersprungen: 1 }] });
    await openPage();
    expect(umzugLogs()).toEqual(['[Medienablage] Umzug (Test GmbH): 7 von 10 (1 Fehler, 1 übersprungen)']);
  });

  it('ohne offenen Umzug kein Log und kein Nachladen, destroy beendet das Nachladen', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const standAbrufe = () => bodies().filter(b => b.aktion === 'stand').length;
    aktuellerStand = stand({ umzug: [{ unternehmen_id: 'u2', offen: 0, fertig: 8, fehler: 0 }] });
    await openPage();
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS * 3);
    expect(standAbrufe()).toBe(1);
    expect(umzugLogs()).toEqual([]);

    aktuellerStand = stand();
    created.pop().destroy();
    authorizedFetch.mockClear();
    const page = await openPage();
    expect(standAbrufe()).toBe(1);
    page.destroy();
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS * 3);
    expect(standAbrufe()).toBe(1);
  });

  it('Nachladen waehrend des Umzugs laesst Fokus und Cursor in der Suche', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await openPage();
    const suche = window.content.querySelector('[data-ma-suche]');
    suche.focus();
    suche.value = 'tes';
    suche.dispatchEvent(new Event('input', { bubbles: true }));

    aktuellerStand = stand({ umzug: [{ unternehmen_id: 'u2', offen: 1, fertig: 7, fehler: 0 }] });
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);

    const neu = window.content.querySelector('[data-ma-suche]');
    expect(neu).not.toBe(suche);
    expect(document.activeElement).toBe(neu);
    expect(neu.value).toBe('tes');
    expect(neu.selectionStart).toBe(3);
    expect(window.content.textContent).toContain('Umzug läuft · 7 von 8');
  });

  const meldung = (id, extra) => ({
    id, unternehmen_id: 'u2', bereich: 'medien', typ: 'video', status: 'offen', grund: 'x', versuche: 0, max_versuche: 6,
    naechster_versuch: null, datei: `${id}.mp4`, quelle: `/Acme/${id}.mp4`, ...extra,
  });

  it('loggt Fehler je Datei: endgueltig, Wiederholung, uebersprungen, wartet, und jeden neuen Versuch einmal', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const meldungen = [
      meldung('a', { status: 'fehler', grund: 'dropbox_fehlt', versuche: 1 }),
      meldung('b', { grund: 'dropbox_503', versuche: 2 }),
      meldung('c', { status: 'uebersprungen', grund: 'leer' }),
      meldung('d', { grund: 'wartet_auf_abgleich' }),
      meldung('e', { bereich: 'dokumente', typ: 'vertrag', status: 'fehler', grund: 'storage_fehlt', versuche: 6, datei: 'Vertrag.pdf' }),
    ];
    aktuellerStand = stand({
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
    aktuellerStand = { ...aktuellerStand, umzug_meldungen: [...meldungen.slice(0, 1), meldung('b', { grund: 'dropbox_503', versuche: 3 }), ...meldungen.slice(2)] };
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(umzugLogs('warn')).toHaveLength(3);
    expect(umzugLogs('warn')[2]).toBe('[Medienablage] Umzug (Test GmbH): b.mp4 Versuch 3 von 6 fehlgeschlagen: dropbox_503');
    expect(umzugLogs('error')).toHaveLength(2);
  });

  it('Meldungen von Umzuegen, die beim Oeffnen schon fertig waren, bleiben still', async () => {
    aktuellerStand = stand({
      umzug: [{ unternehmen_id: 'u2', offen: 0, fertig: 7, fehler: 1, uebersprungen: 0 }],
      umzug_meldungen: [meldung('a', { status: 'fehler', grund: 'dropbox_fehlt', versuche: 1 })],
    });
    await openPage();
    expect(umzugLogs('error')).toEqual([]);
  });

  it('schickt beobachtete Umzuege beim Nachladen mit: auch der Fehler an der letzten Datei kommt an', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await openPage();
    expect(bodies()[0]).toEqual({ aktion: 'stand' });

    aktuellerStand = stand({
      umzug: [{ unternehmen_id: 'u2', offen: 0, fertig: 7, fehler: 1, uebersprungen: 0 }],
      umzug_meldungen: [meldung('z', { status: 'fehler', grund: 'groesse_falsch', versuche: 6 })],
    });
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(bodies()[1]).toEqual({ aktion: 'stand', umzug_ids: ['u2'] });
    expect(umzugLogs()).toContain('[Medienablage] Umzug (Test GmbH): 8 von 8 (1 Fehler) · abgeschlossen');
    expect(umzugLogs('error')).toEqual(['[Medienablage] Umzug (Test GmbH): z.mp4 endgültig fehlgeschlagen nach 6 Versuchen: groesse_falsch']);
  });

  it('meldet einen pausierten Umzug (Notschalter, Weiche) einmal und wenn er weiterlaeuft', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    aktuellerStand = stand({ einstellung: { notschalter: true } });
    await openPage();
    expect(umzugLogs('warn')).toEqual(['[Medienablage] Umzug (Test GmbH): pausiert, Notschalter ist aktiv']);

    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(umzugLogs('warn')).toHaveLength(1);

    aktuellerStand = stand();
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(umzugLogs('info')).toEqual(['[Medienablage] Umzug (Test GmbH): läuft weiter']);

    const [, u2] = aktuellerStand.unternehmen;
    aktuellerStand = stand({ unternehmen: [aktuellerStand.unternehmen[0], { ...u2, ablage_ziel: 'dropbox' }] });
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(umzugLogs('warn')[1]).toBe('[Medienablage] Umzug (Test GmbH): pausiert, Weiche steht auf Dropbox');
  });

  it('meldet, wenn der Stand beim Nachladen nicht kommt, und versucht es weiter', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await openPage();
    authorizedFetch.mockImplementationOnce(async () => antwort({ error: 'Graph nicht erreichbar' }, 502));
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(umzugLogs('warn')).toEqual(['[Medienablage] Stand konnte nicht nachgeladen werden, neuer Versuch in 3 s: Graph nicht erreichbar']);
    expect(window.toastSystem.show).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(UMZUG_POLL_MS);
    expect(bodies().filter(b => b.aktion === 'stand')).toHaveLength(3);
  });

  it('meldet einen Serverfehler als Toast', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await openPage();
    authorizedFetch.mockImplementationOnce(async () => antwort({ error: 'Graph nicht erreichbar' }, 502));
    click(window.content.querySelector('[data-ma-aktion="jetzt_abgleichen"]'));
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Fehlgeschlagen: Graph nicht erreichbar', 'error'));
    spy.mockRestore();
  });

  it('Suche blendet nicht passende Unternehmen aus', async () => {
    await openPage();
    const suche = window.content.querySelector('[data-ma-suche]');
    suche.value = 'acm';
    suche.dispatchEvent(new Event('input', { bubbles: true }));
    const rows = [...window.content.querySelectorAll('.ma-row')];
    // Medien- und Dokument-Weiche filtern gemeinsam
    expect(rows.filter(r => !r.hidden).map(r => r.dataset.maName)).toEqual(['acme', 'acme']);
  });

  it('ist ueber die Admin-Huelle als Unterseite erreichbar', async () => {
    const admin = new AdminPage();
    await admin.init('medienablage');
    await admin.ready;
    expect(window.setHeadline).toHaveBeenCalledWith('Accounting – Medienablage');
    expect(window.content.querySelector('[data-ma-notschalter]')).not.toBeNull();
    admin.destroy();
  });

  it('Nav-Eintrag nur fuer Admins', () => {
    document.body.insertAdjacentHTML('beforeend', '<nav id="main-nav"></nav>');
    window.currentUser = { permissions: {} };
    window.canCreateProject = () => false;
    window.canViewAccounting = () => true;
    const nav = new NavigationSystem();
    nav.renderNavigation('/admin/medienablage');
    expect(document.getElementById('main-nav').innerHTML).toContain('/admin/medienablage');

    window.isAdmin = () => false;
    nav.renderNavigation('/admin');
    expect(document.getElementById('main-nav').innerHTML).not.toContain('/admin/medienablage');
    document.getElementById('main-nav').remove();
  });
});
