import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  isWhisperAuthError,
  isRetryableWhisperAuth,
  whisperFehler,
  withWhisperRetry
} = require('../../netlify/functions/_shared/video-transcribe.js');
const { verarbeitungAbschluss } = require('../../netlify/functions/_shared/verarbeitung-abschluss.js');

function softAuthError() {
  const err = new Error('Whisper fehlgeschlagen: Authentication error (HTTP 200)');
  err.status = 200;
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

describe('isRetryableWhisperAuth', () => {
  it('wiederholt nur die Meldung ohne echten 401', () => {
    expect(isRetryableWhisperAuth(401, 'Authentication error')).toBe(false);
    expect(isRetryableWhisperAuth(200, 'Authentication error')).toBe(true);
    expect(isRetryableWhisperAuth(400, 'audio too long')).toBe(false);
  });
});

describe('whisperFehler', () => {
  it('nennt bei 401 den Token und haengt keinen Retry daran', () => {
    const err = whisperFehler(401, 'Authentication error');
    expect(err.message).toBe('Whisper fehlgeschlagen: Cloudflare-Token abgelehnt (401), CLOUDFLARE_AI_TOKEN pruefen');
    expect(err.status).toBe(401);
    expect(isRetryableWhisperAuth(err.status, err.message)).toBe(false);
  });
});

describe('withWhisperRetry', () => {
  it('wiederholt eine sporadische Auth-Meldung und gibt beim zweiten Versuch zurueck', async () => {
    const calls = [];
    const text = await withWhisperRetry(async (i) => {
      calls.push(i);
      if (i === 1) throw softAuthError();
      return 'transkript';
    }, { sleep: async () => {} });
    expect(text).toBe('transkript');
    expect(calls).toEqual([1, 2]);
  });

  it('gibt nach drei sporadischen Auth-Meldungen auf', async () => {
    let calls = 0;
    await expect(withWhisperRetry(async () => {
      calls += 1;
      throw softAuthError();
    }, { sleep: async () => {} })).rejects.toThrow(/Authentication error/);
    expect(calls).toBe(3);
  });

  it('wiederholt einen echten HTTP 401 nicht', async () => {
    let calls = 0;
    await expect(withWhisperRetry(async () => {
      calls += 1;
      throw whisperFehler(401, 'Authentication error');
    }, { sleep: async () => {} })).rejects.toThrow(/CLOUDFLARE_AI_TOKEN pruefen/);
    expect(calls).toBe(1);
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
