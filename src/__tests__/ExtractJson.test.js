import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractJson, extractByKeys } from '../../netlify/functions/_shared/anthropic.js';

describe('extractJson', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parst sauberes JSON', () => {
    const result = extractJson('{"antwort": "Passt so.", "vorschlag_text": null}');
    expect(result).toEqual({ antwort: 'Passt so.', vorschlag_text: null });
  });

  it('parst JSON aus einem ```json-Fence samt Text drumherum', () => {
    const text = 'Hier das Ergebnis:\n```json\n{"fertig": true, "nachricht": "Alles klar"}\n```\nViel Erfolg!';
    expect(extractJson(text)).toEqual({ fertig: true, nachricht: 'Alles klar' });
  });

  it('repariert unescapte Anfuehrungszeichen mitten im Wert', () => {
    const text = '{"antwort": "Die Hannoversche ist Testsieger mit "sehr gut".", "sektion": "hauptteil"}';
    expect(extractJson(text)).toEqual({
      antwort: 'Die Hannoversche ist Testsieger mit "sehr gut".',
      sektion: 'hauptteil'
    });
  });

  it('haelt ein Zitat, auf das ein Komma folgt, zusammen', () => {
    const text = '{"antwort": "Er sagte "Hallo", und ging wieder.", "sektion": null}';
    expect(extractJson(text)).toEqual({
      antwort: 'Er sagte "Hallo", und ging wieder.',
      sektion: null
    });
  });

  it('repariert rohe Zeilenumbrueche in Werten', () => {
    const text = '{"hauptteil": "Erste Zeile\nZweite Zeile", "cta": "Jetzt sichern"}';
    expect(extractJson(text)).toEqual({
      hauptteil: 'Erste Zeile\nZweite Zeile',
      cta: 'Jetzt sichern'
    });
  });

  it('repariert unescapte Quotes ueber mehrere Felder hinweg', () => {
    const text = '{\n  "antwort": "Ich habe den "Hook" geschaerft.",\n  "sektion": "hook",\n'
      + '  "vorschlag_text": "Stiftung Warentest sagt "sehr gut" - und das merkst du."\n}';
    expect(extractJson(text)).toEqual({
      antwort: 'Ich habe den "Hook" geschaerft.',
      sektion: 'hook',
      vorschlag_text: 'Stiftung Warentest sagt "sehr gut" - und das merkst du.'
    });
  });

  it('laesst korrekt escapte Quotes unveraendert', () => {
    const text = '{"antwort": "Er nannte es \\"Hook\\" und blieb dabei."}';
    expect(extractJson(text)).toEqual({ antwort: 'Er nannte es "Hook" und blieb dabei.' });
  });

  it('repariert ein Zitat vor einer eckigen Klammer im Objekt-Value (Overlay-Text)', () => {
    const text = '{"hauptteil": "Text [Overlay: "Nur heute"] und weiter.", "cta": "Jetzt"}';
    expect(extractJson(text)).toEqual({
      hauptteil: 'Text [Overlay: "Nur heute"] und weiter.',
      cta: 'Jetzt'
    });
  });

  it('repariert ein Zitat, auf das ein Doppelpunkt folgt', () => {
    const text = '{"hauptteil": "Sie fragte "Warum": keiner wusste es.", "cta": "Jetzt"}';
    expect(extractJson(text)).toEqual({
      hauptteil: 'Sie fragte "Warum": keiner wusste es.',
      cta: 'Jetzt'
    });
  });

  it('loest das mehrdeutige Komma-Zitat mit bekannten Keys auf', () => {
    const text = '{"hauptteil": "Er sagte "Hallo", "Tschuess": das war es.", "cta": "Jetzt"}';
    expect(extractJson(text, { keys: ['titel', 'hook', 'hauptteil', 'cta'] })).toEqual({
      hauptteil: 'Er sagte "Hallo", "Tschuess": das war es.',
      cta: 'Jetzt'
    });
  });

  it('laesst Arrays intakt (site-extract Regression)', () => {
    const text = '{"_varianten": ["a", "b"], "_hinweise": ["x"], "name": "Firma"}';
    expect(extractJson(text)).toEqual({
      _varianten: ['a', 'b'],
      _hinweise: ['x'],
      name: 'Firma'
    });
  });

  it('repariert unescapte Quotes in einem Array-Element', () => {
    const text = '{"_hinweise": ["Der Slogan "Jetzt neu" steht gross auf der Seite"]}';
    expect(extractJson(text)).toEqual({
      _hinweise: ['Der Slogan "Jetzt neu" steht gross auf der Seite']
    });
  });

  it('meldet Reparaturen ueber onWarn', () => {
    const onWarn = vi.fn();
    extractJson('{"hook": "Er sagte "Stopp" und ging."}', { onWarn });
    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('repariert'));
  });

  it('wirft, wenn gar keine JSON-Struktur enthalten ist', () => {
    expect(() => extractJson('Tut mir leid, das kann ich nicht.')).toThrow(/Keine JSON-Struktur/);
  });

  it('wirft den urspruenglichen Fehler, wenn auch die Reparatur scheitert', () => {
    expect(() => extractJson('{antwort: "abc"}')).toThrow(SyntaxError);
  });

  it('loggt die Rohantwort, wenn nichts mehr zu retten ist', () => {
    expect(() => extractJson('{antwort: "abc"}')).toThrow();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('{antwort: "abc"}'));
  });
});

describe('extractByKeys (letzte Fallback-Schicht)', () => {
  it('birgt Felder aus hoffnungslos kaputtem Quoting', () => {
    const raw = '{"titel": "Test", "hook": "Er: "geht "nicht" mehr", echt", "cta": "Jetzt "hier" klicken"}';
    expect(extractByKeys(raw, ['titel', 'hook', 'hauptteil', 'cta'])).toEqual({
      titel: 'Test',
      hook: 'Er: "geht "nicht" mehr", echt',
      cta: 'Jetzt "hier" klicken'
    });
  });

  it('mappt null/boolean/Zahl-Werte korrekt', () => {
    const raw = '{"nachricht": "Alles klar", "fertig": true, "sektion": null}';
    expect(extractByKeys(raw, ['nachricht', 'fertig', 'sektion'])).toEqual({
      nachricht: 'Alles klar',
      fertig: true,
      sektion: null
    });
  });

  it('gibt null zurueck, wenn keiner der Keys vorkommt', () => {
    expect(extractByKeys('voellig anderer Text', ['hook', 'cta'])).toBeNull();
    expect(extractByKeys('{"a": 1}', [])).toBeNull();
  });

  it('greift in extractJson, wenn auch die Reparatur scheitert', () => {
    // Kaputter Key (unquoted) macht das JSON irreparabel, aber die
    // restlichen Marker sind intakt -> Feld-Extraktion birgt die Werte
    const raw = '{titel: kaputt, "hook": "Der Einstieg", "cta": "Jetzt klicken"}';
    expect(extractJson(raw, { keys: ['titel', 'hook', 'hauptteil', 'cta'] })).toEqual({
      hook: 'Der Einstieg',
      cta: 'Jetzt klicken'
    });
  });
});
