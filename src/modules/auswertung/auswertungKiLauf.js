// auswertungKiLauf.js
// KI-Lauf eines Posts beobachten (ADR 0078): Die Function meldet ihre Schritte in ki_schritt,
// hier wird abgefragt, bis sie fertig ist. Jeder Wechsel landet mit Zeit in der Konsole
// ([Auswertung KI xxxxxxxx]), damit man sieht, wo ein Lauf hängt. Zwei Fristen: meldet sich die
// Function nicht (Crash beim Laden, Sitzung weg), gilt der Lauf nach 20 s als nicht gestartet,
// sonst nach 120 s als gescheitert. Gemessen wird mit der lokalen Uhr ab Beobachtungsbeginn.

import { ladePost } from './auswertungPostsDaten.js';
import { plural } from './auswertungFormat.js';

const POLL_MS = 2000;
export const START_FRIST_MS = 20 * 1000;
export const LAUF_FRIST_MS = 120 * 1000;
export const LANGSAM_AB_MS = 30 * 1000;

export const SCHRITTE = {
  wartet: { nr: 1, label: 'Wird gestartet' },
  gestartet: { nr: 2, label: 'Screenshots werden geladen' },
  bilder: { nr: 2, label: 'Screenshots werden geladen' },
  ki: { nr: 3, label: 'KI liest die Zahlen' },
  speichern: { nr: 4, label: 'Wird gespeichert' }
};
export const SCHRITTE_GESAMT = 4;

export const schrittLabel = (schritt) => SCHRITTE[schritt]?.label || 'KI liest …';

/** Frist abgelaufen; `nichtGestartet`, wenn sich die Function nie gemeldet hat. */
export class KiFristError extends Error {
  constructor(message, { schritt = null, nichtGestartet = false } = {}) {
    super(message);
    this.name = 'KiFristError';
    this.schritt = schritt;
    this.nichtGestartet = nichtGestartet;
  }
}

export const sekunden = (ms) => `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
/** Ganze Sekunden für die Anzeige im Prüfbereich. */
export const laufzeitText = (ms) => `${Math.floor(Math.max(0, ms) / 1000)} s`;

/** Eine Zeile in der Konsole, `art` ist info, warn oder error. */
export function logKi(postId, text, daten, art = 'info') {
  const zeile = `[Auswertung KI ${String(postId || '').slice(0, 8)}] ${text}`;
  if (daten === undefined) console[art](zeile);
  else console[art](zeile, daten);
}

// Beginn der Beobachtung je Post, für die Sekunden im Prüfbereich
const beginn = new Map();

/** Millisekunden, seit dieser Lauf beobachtet wird; 0, wenn niemand zusieht. */
export function laufDauer(postId, jetzt = Date.now()) {
  const start = beginn.get(postId);
  return start == null ? 0 : Math.max(0, jetzt - start);
}

const schlafe = (ms, signal) => new Promise((resolve) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
});

function meldeEnde(post, dauer) {
  if (post.kiStatus === 'fehler') {
    logKi(post.id, `gescheitert nach ${sekunden(dauer)} bei Schritt „${post.kiSchritt || '–'}“: ${post.kiFehler || 'ohne Grund'}`, { schritt: post.kiSchritt, fehler: post.kiFehler }, 'error');
    return;
  }
  const felder = Object.keys(post.confidence || {});
  logKi(post.id, `fertig nach ${sekunden(dauer)}: ${plural(felder.length, 'Feld', 'Felder')} gelesen`, felder);
}

/**
 * Post abfragen, bis die KI fertig ist, und jeden Schrittwechsel an `onSchritt` melden. Ein neuer
 * Lauf (anderes ki_gestartet_at, etwa nach einem weiteren Screenshot) startet die Fristen neu.
 * Ein Abbruch über `signal` gibt null zurück.
 * @param {string} postId
 * @param {{ signal?: AbortSignal, onSchritt?: (post: object) => void, schritt?: string|null, lauf?: string|null }} [opts]
 * @returns {Promise<object|null>} der fertige oder gescheiterte Post
 * @throws {KiFristError}
 */
export async function warteAufKi(postId, { signal, onSchritt, schritt = null, lauf = null } = {}) {
  const t0 = Date.now();
  let start = t0;
  let seitSchritt = t0;
  let aktuell = schritt;
  let laufId = lauf;
  beginn.set(postId, t0);
  logKi(postId, `beobachte Lauf (Schritt „${aktuell || '–'}“)`);
  try {
    for (;;) {
      await schlafe(POLL_MS, signal);
      if (signal?.aborted) return null;
      let post = null;
      try {
        post = await ladePost(postId);
      } catch (error) {
        logKi(postId, 'Abfrage fehlgeschlagen, versuche weiter', error?.message || error, 'warn');
      }
      if (signal?.aborted) return null;
      const jetzt = Date.now();
      if (post) {
        if (post.kiStatus !== 'laeuft') {
          meldeEnde(post, jetzt - start);
          return post;
        }
        if (post.kiGestartetAt && laufId && post.kiGestartetAt !== laufId) {
          logKi(postId, 'neuer Lauf angefordert, Fristen beginnen neu');
          start = jetzt;
          beginn.set(postId, jetzt);
        }
        laufId = post.kiGestartetAt || laufId;
        if (post.kiSchritt !== aktuell) {
          logKi(postId, `Schritt „${aktuell || '–'}“ → „${post.kiSchritt || '–'}“ nach ${sekunden(jetzt - start)}`);
          aktuell = post.kiSchritt;
          seitSchritt = jetzt;
          onSchritt?.(post);
        }
      }
      if ((aktuell == null || aktuell === 'wartet') && jetzt - seitSchritt > START_FRIST_MS) {
        logKi(postId, `Function hat sich nach ${sekunden(jetzt - seitSchritt)} nicht gemeldet. Netlify-Logs von post-screenshot-background prüfen (Crash beim Laden, z. B. natives Modul, oder Sitzung abgelaufen).`, undefined, 'error');
        throw new KiFristError('Die KI ist nicht gestartet. Erneut versuchen oder manuell eintragen.', { schritt: aktuell, nichtGestartet: true });
      }
      if (jetzt - start > LAUF_FRIST_MS) {
        logKi(postId, `keine Antwort nach ${sekunden(jetzt - start)}, hängt bei Schritt „${aktuell || '–'}“`, undefined, 'error');
        throw new KiFristError(`Die KI hat nach ${LAUF_FRIST_MS / 1000} s nicht geantwortet.`, { schritt: aktuell });
      }
    }
  } finally {
    beginn.delete(postId);
  }
}
