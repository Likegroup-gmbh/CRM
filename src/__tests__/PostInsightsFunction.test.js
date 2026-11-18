import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { parseZahl, parseSekunden, felderAus, leseAntwort, aufgabe, SYSTEM } = require('../../netlify/functions/_shared/post-insights.js');
const { createHandler, screenshotPatch, screenshotPfade, bildFuerClaude } = require('../../netlify/functions/post-screenshot-background.js');
const { buildApiMessages, ClaudeTimeoutError } = require('../../netlify/functions/_shared/anthropic.js');

const POST_ID = '11111111-2222-3333-4444-555555555555';

describe('Zahlen parsen', () => {
  it.each([
    ['1,2 Tsd.', 1200],
    ['12.3K', 12300],
    ['1.234', 1234],
    ['1,234', 1234],
    ['12.345.678', 12345678],
    ['1,5 Mio.', 1500000],
    ['2M', 2000000],
    ['987', 987],
    [4321, 4321],
    ['38 %', 38]
  ])('%s → %s', (roh, zahl) => {
    expect(parseZahl(roh)).toBe(zahl);
  });

  it('Unlesbares ergibt null', () => {
    expect(parseZahl('—')).toBeNull();
    expect(parseZahl('')).toBeNull();
    expect(parseZahl(-3)).toBeNull();
    expect(parseZahl('ca. 5')).toBeNull();
  });

  it('Wiedergabezeit in Sekunden', () => {
    expect(parseSekunden('0:14')).toBe(14);
    expect(parseSekunden('1:05')).toBe(65);
    expect(parseSekunden('14 Sek.')).toBe(14);
    expect(parseSekunden('14 Sekunden')).toBe(14);
    expect(parseSekunden('1 Min. 5 Sek.')).toBe(65);
    expect(parseSekunden('12,5 s')).toBe(12.5);
  });
});

describe('Felder filtern', () => {
  it('nur Felder der Plattform, Zählwerte gerundet', () => {
    const felder = felderAus({
      views: { value: '12,3 Tsd.', confidence: 0.95 },
      linkClicks: { value: '41', confidence: 0.9 },
      saves: { value: '10', confidence: 0.9 },
      replies: { value: '', confidence: 1 }
    }, 'ig_story');
    expect(felder).toEqual({ views: { value: 12300, confidence: 0.95 }, linkClicks: { value: 41, confidence: 0.9 } });
  });

  it('Story nimmt Sticker-Taps und Likes, Link-Klicks bleiben getrennt', () => {
    const felder = felderAus({
      views: { value: '89,826', confidence: 1 },
      reach: { value: '75,404', confidence: 1 },
      likes: { value: '468', confidence: 1 },
      linkClicks: { value: '3,063', confidence: 1 },
      stickerTaps: { value: '136', confidence: 1 }
    }, 'ig_story');
    expect(Object.fromEntries(Object.entries(felder).map(([k, e]) => [k, e.value]))).toEqual({
      views: 89826, reach: 75404, likes: 468, linkClicks: 3063, stickerTaps: 136
    });
  });

  it('Konfidenz wird auf 0 bis 1 begrenzt, fehlt sie, gilt 0,5', () => {
    const felder = felderAus({ views: { value: 5, confidence: 3 }, reach: { value: 4 } }, 'ig_reel');
    expect(felder.views.confidence).toBe(1);
    expect(felder.reach.confidence).toBe(0.5);
  });
});

describe('Antwort zusammenführen', () => {
  it('je Feld gewinnt die höhere Konfidenz, Plattform nach den meisten Feldern', () => {
    const ergebnis = leseAntwort({
      screenshots: [
        { bild: 1, plattform: 'ig_story', accountHandle: '@Lea.Berg', fields: { views: { value: '1.200', confidence: 0.7 }, reach: { value: '900', confidence: 0.95 } } },
        { bild: 2, plattform: 'ig_story', fields: { views: { value: '1.250', confidence: 0.92 }, exits: { value: '31', confidence: 0.6 } } }
      ]
    }, { plattform: 'ig_reel' });
    expect(ergebnis.plattform).toBe('ig_story');
    expect(ergebnis.accountHandle).toBe('lea.berg');
    expect(ergebnis.felder).toEqual({
      views: { value: 1250, confidence: 0.92 },
      reach: { value: 900, confidence: 0.95 },
      exits: { value: 31, confidence: 0.6 }
    });
  });

  it('die genaue Zahl schlägt die gerundete aus der Kopfzeile, egal in welchem Bild', () => {
    const ergebnis = leseAntwort({
      screenshots: [
        { bild: 1, plattform: 'ig_story', fields: { reach: { value: '76,1 Tsd.', confidence: 1 }, views: { value: '89,826', confidence: 1 } } },
        { bild: 2, plattform: 'ig_story', fields: { reach: { value: '75,404', confidence: 0.9 }, linkClicks: { value: '3,063', confidence: 1 } } }
      ]
    }, { plattform: 'ig_story' });
    expect(ergebnis.felder).toEqual({
      reach: { value: 75404, confidence: 0.9 },
      views: { value: 89826, confidence: 1 },
      linkClicks: { value: 3063, confidence: 1 }
    });
  });

  it('der Prompt trennt Aufrufe und Betrachter und kennt Sticker-Taps', () => {
    expect(SYSTEM).toMatch(/reach: Betrachter/);
    expect(SYSTEM).toMatch(/„Betrachter“ nie als views/);
    expect(SYSTEM).toMatch(/stickerTaps: Auf Sticker getippt/);
  });

  it('ohne erkannte Plattform bleibt die des Posts', () => {
    expect(leseAntwort({ screenshots: [{ bild: 1, plattform: 'unbekannt', fields: {} }] }, { plattform: 'tiktok' }).plattform).toBe('tiktok');
  });

  it('der Auftrag nennt Anzahl und Plattform', () => {
    expect(aufgabe({ plattform: 'ig_story', anzahl: 2 })).toMatch(/2 Screenshots.*\n.*ig_story/);
  });
});

describe('Patch am Post', () => {
  const post = {
    id: POST_ID, kampagne_id: 'k1', plattform: 'ig_reel', api_raw: { media_type: 'VIDEO' },
    metrics: { views: 5000, likes: 120 }, confidence: null, posted_at: '2026-11-03', account_handle: 'lea', status: 'confirmed'
  };
  const gelesen = { plattform: 'ig_post', accountHandle: 'andere', postedAt: '2026-11-04', measuredAt: null, felder: { views: { value: 5300, confidence: 0.9 }, reach: { value: 3100, confidence: 0.7 } } };

  it('Screenshot gewinnt bei Konflikten, Rest bleibt, Ergebnis ist ein Entwurf', () => {
    const patch = screenshotPatch(post, gelesen, { heute: new Date('2026-11-18T09:00:00Z') });
    expect(patch.metrics).toEqual({ views: 5300, likes: 120, reach: 3100 });
    expect(patch.confidence).toEqual({ views: 0.9, reach: 0.7 });
    expect(patch).toMatchObject({
      status: 'draft', source: 'ki', ki_status: null, confirmed_by: null,
      plattform: 'ig_reel', account_handle: 'lea', posted_at: '2026-11-03', measured_at: '2026-11-18'
    });
  });

  it('ohne API-Abruf gilt die Plattform der KI', () => {
    expect(screenshotPatch({ ...post, api_raw: null }, gelesen).plattform).toBe('ig_post');
  });

  it('nur Pfade im Ordner des Posts, höchstens sechs', () => {
    const pfade = [`k1/${POST_ID}/a.png`, 'k2/x/b.png', `k1/${POST_ID}/../c.png`, ...Array.from({ length: 7 }, (_, i) => `k1/${POST_ID}/${i}.png`)];
    const ok = screenshotPfade({ ...post, screenshot_pfade: pfade });
    expect(ok).toHaveLength(6);
    expect(ok.every(p => p.startsWith(`k1/${POST_ID}/`) && !p.includes('..'))).toBe(true);
  });
});

describe('Bilder an Claude', () => {
  it('Bildblöcke stehen vor dem Text', () => {
    const [msg] = buildApiMessages({ userPrompt: 'lies', images: [{ base64: 'AAA', mediaType: 'image/jpeg' }] });
    expect(msg.content.map(c => c.type)).toEqual(['image', 'text']);
    expect(msg.content[0].source).toEqual({ type: 'base64', media_type: 'image/jpeg', data: 'AAA' });
  });
});

describe('Handler', () => {
  const LAUF = '2026-11-18T09:00:00.123456+00:00';
  const ANTWORT = { screenshots: [{ bild: 1, plattform: 'ig_story', fields: { views: { value: '2,4 Tsd.', confidence: 0.97 } } }] };

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  /** `trifftBis`: so viele Updates treffen den Lauf, danach gilt er als abgebrochen. */
  function setup({ zeile, antwort = ANTWORT, claudeFehler = null, trifftBis = Infinity } = {}) {
    const updates = [];
    const filter = [];
    const post = {
      id: POST_ID, kampagne_id: 'k1', plattform: 'ig_story', api_raw: null, metrics: {}, confidence: null,
      ki_status: 'laeuft', ki_gestartet_at: LAUF, screenshot_pfade: [`k1/${POST_ID}/a.png`], ...zeile
    };
    const caller = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: post, error: null }) }) }) }) };
    const service = {
      from: () => ({
        update: (patch) => {
          updates.push(patch);
          const bedingungen = {};
          const kette = {
            eq: (spalte, wert) => { bedingungen[spalte] = wert; return kette; },
            select: async () => {
              filter.push(bedingungen);
              return { data: updates.length <= trifftBis ? [{ id: POST_ID }] : [], error: null };
            }
          };
          return kette;
        }
      })
    };
    const ki = { abschliessen: vi.fn(), fehlgeschlagen: vi.fn() };
    const callClaude = claudeFehler ? vi.fn().mockRejectedValue(claudeFehler) : vi.fn().mockResolvedValue({ json: antwort, usage: {} });
    const handler = createHandler({
      verifyAuth: async () => ({ user: { id: 'u1' } }),
      callerClient: () => caller,
      serviceClient: () => service,
      starteKiRequest: async () => ki,
      bildLaden: async () => ({ base64: 'AAA', mediaType: 'image/jpeg', bytes: 3 }),
      callClaude,
      heute: () => new Date('2026-11-18T09:00:00Z')
    });
    const call = () => handler({ httpMethod: 'POST', headers: { authorization: 'Bearer jwt' }, body: JSON.stringify({ postId: POST_ID }) });
    return { call, updates, filter, callClaude, ki };
  }

  const schritte = (updates) => updates.filter(u => 'ki_schritt' in u).map(u => u.ki_schritt);

  it('meldet die Schritte, liest, schreibt einen Entwurf und protokolliert', async () => {
    const { call, updates, callClaude, ki } = setup();
    expect((await call()).statusCode).toBe(200);
    expect(schritte(updates)).toEqual(['gestartet', 'bilder', 'ki', 'speichern']);
    expect(callClaude.mock.calls[0][0]).toMatchObject({ timeoutMs: 60000, images: [{ base64: 'AAA', mediaType: 'image/jpeg' }] });
    expect(updates.at(-1)).toMatchObject({ status: 'draft', source: 'ki', ki_status: null, metrics: { views: 2400 } });
    expect(ki.abschliessen).toHaveBeenCalled();
  });

  it('schreibt nur in den eigenen Lauf', async () => {
    const { call, filter } = setup();
    await call();
    expect(filter.every(f => f.id === POST_ID && f.ki_status === 'laeuft' && f.ki_gestartet_at === LAUF)).toBe(true);
  });

  it('nichts lesbar: Fehler mit Grund am Post, der Schritt bleibt stehen', async () => {
    const { call, updates } = setup({ antwort: { screenshots: [{ bild: 1, fields: {} }] } });
    expect((await call()).statusCode).toBe(500);
    expect(schritte(updates)).toEqual(['gestartet', 'bilder', 'ki']);
    expect(updates.at(-1)).toEqual({ ki_status: 'fehler', ki_fehler: 'Auf dem Screenshot waren keine Kennzahlen lesbar.' });
  });

  it('Claude-Fehler landet am Post und im Protokoll', async () => {
    const { call, updates, ki } = setup({ claudeFehler: new Error('Anthropic API: overloaded') });
    await call();
    expect(ki.fehlgeschlagen).toHaveBeenCalled();
    expect(updates.at(-1)).toEqual({ ki_status: 'fehler', ki_fehler: 'Anthropic API: overloaded' });
  });

  it('Zeitüberschreitung bei Claude: verständlicher Grund am Post', async () => {
    const { call, updates } = setup({ claudeFehler: new ClaudeTimeoutError(60000) });
    await call();
    expect(updates.at(-1).ki_fehler).toBe('Die KI hat nicht innerhalb von 60 s geantwortet.');
  });

  it('vor dem Claude-Call abgebrochen: kein Call, kein Fehler am Post', async () => {
    const { call, updates, callClaude } = setup({ trifftBis: 2 });
    expect((await call()).statusCode).toBe(409);
    expect(callClaude).not.toHaveBeenCalled();
    expect(updates.some(u => u.ki_status === 'fehler')).toBe(false);
  });

  it('während Claude abgebrochen: das Ergebnis fällt weg', async () => {
    const { call, updates, callClaude } = setup({ trifftBis: 3 });
    expect((await call()).statusCode).toBe(409);
    expect(callClaude).toHaveBeenCalled();
    expect(updates.some(u => u.status === 'draft')).toBe(false);
  });

  it('ohne angeforderten Lauf 409, kein Claude-Call', async () => {
    const { call, callClaude, updates } = setup({ zeile: { ki_status: null } });
    expect((await call()).statusCode).toBe(409);
    expect(callClaude).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });
});

describe('Bild für Claude', () => {
  const service = (bytes, type = '') => ({
    storage: { from: () => ({ download: async () => ({ data: { type, arrayBuffer: async () => new ArrayBuffer(bytes) }, error: null }) }) }
  });

  it('Medientyp aus der Endung, ohne Umrechnen', async () => {
    const bild = await bildFuerClaude(service(10), `k1/${POST_ID}/a.jpg`);
    expect(bild).toMatchObject({ mediaType: 'image/jpeg', bytes: 10, base64: Buffer.alloc(10).toString('base64') });
    expect((await bildFuerClaude(service(10), `k1/${POST_ID}/a.png`)).mediaType).toBe('image/png');
  });

  it('zu große Altbilder werden abgelehnt statt die API zu sprengen', async () => {
    await expect(bildFuerClaude(service(4 * 1024 * 1024), `k1/${POST_ID}/a.png`)).rejects.toThrow(/zu groß für die KI/);
  });

  it('die Function lädt kein natives Bildmodul', () => {
    const quelle = readFileSync(require.resolve('../../netlify/functions/post-screenshot-background.js'), 'utf8');
    expect(quelle).not.toMatch(/require\(['"]sharp['"]\)/);
  });
});
