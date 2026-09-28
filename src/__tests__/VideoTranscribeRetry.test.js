import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { isWhisperAuthError, withWhisperRetry } = require('../../netlify/functions/_shared/video-transcribe.js');
const { verarbeitungAbschluss } = require('../../netlify/functions/_shared/verarbeitung-abschluss.js');

function authError() {
  const err = new Error('Whisper fehlgeschlagen: Authentication error (HTTP 401)');
  err.status = 401;
  return err;
}

describe('isWhisperAuthError', () => {
  it('erkennt HTTP 401 und Authentication error', () => {
    expect(isWhisperAuthError(401, 'nope')).toBe(true);
    expect(isWhisperAuthError(403, 'Authentication error')).toBe(true);
  });

  it('laesst andere Fehler in Ruhe', () => {
    expect(isWhisperAuthError(400, 'audio too long')).toBe(false);
    expect(isWhisperAuthError(200, '')).toBe(false);
  });
});

describe('withWhisperRetry', () => {
  it('wiederholt einen Auth-Fehler und gibt beim zweiten Versuch zurueck', async () => {
    const calls = [];
    const text = await withWhisperRetry(async (i) => {
      calls.push(i);
      if (i === 1) throw authError();
      return 'transkript';
    }, { sleep: async () => {} });
    expect(text).toBe('transkript');
    expect(calls).toEqual([1, 2]);
  });

  it('gibt nach drei Auth-Fehlern auf', async () => {
    let calls = 0;
    await expect(withWhisperRetry(async () => {
      calls += 1;
      throw authError();
    }, { sleep: async () => {} })).rejects.toThrow(/Authentication error/);
    expect(calls).toBe(3);
  });

  it('wiederholt einen anderen Fehler nicht', async () => {
    let calls = 0;
    await expect(withWhisperRetry(async () => {
      calls += 1;
      const err = new Error('Whisper fehlgeschlagen: audio too long (HTTP 400)');
      err.status = 400;
      throw err;
    }, { sleep: async () => {} })).rejects.toThrow(/audio too long/);
    expect(calls).toBe(1);
  });
});

describe('verarbeitungAbschluss', () => {
  it('laesst einen reinen Adaptionsfehler auf done', () => {
    expect(verarbeitungAbschluss({ adaptionFehler: 'keine Antwort' })).toEqual({
      verarbeitung_status: 'done',
      verarbeitung_fehler: 'Kundenadaption: keine Antwort'
    });
  });

  it('setzt error nur fuer Screenshot, Transkript oder Beschreibung', () => {
    expect(verarbeitungAbschluss({
      transcriptError: 'Whisper fehlgeschlagen',
      adaptionFehler: 'zu spaet'
    })).toEqual({
      verarbeitung_status: 'error',
      verarbeitung_fehler: 'Transkript: Whisper fehlgeschlagen | Kundenadaption: zu spaet'
    });
    expect(verarbeitungAbschluss({ beschreibungFehler: 'Spalte fehlt' }).verarbeitung_status).toBe('error');
    expect(verarbeitungAbschluss({}).verarbeitung_status).toBe('done');
    expect(verarbeitungAbschluss({}).verarbeitung_fehler).toBeNull();
  });
});
