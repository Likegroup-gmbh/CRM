import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractJson } from '../../netlify/functions/_shared/anthropic.js';

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
