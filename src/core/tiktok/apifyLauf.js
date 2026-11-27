// apifyLauf.js
// Apify-Laeufe hinter einer Netlify-Function: starten, dann den Stand abfragen, bis der Lauf
// fertig ist. Die Function wartet je Abfrage selbst auf Apify, die Pause greift nur bei schnellen
// Antworten. Genutzt von der TikTok-Testseite (Admin) und vom Profilabruf (tiktokProfil.js).

import { authorizedFetch } from '../auth/getAccessToken.js';

export const POLL_PAUSE_MS = 1500;
export const POLL_MAX_MS = 6 * 60 * 1000;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POST an eine Function. Bei HTTP-Fehler wirft sie mit der Meldung der Function;
 * status und die ganze Antwort (daten) haengen am Fehler.
 */
export async function postFunction(endpoint, body) {
  const res = await authorizedFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
  const daten = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(daten?.error || `Fehler (${res.status})`);
    err.status = res.status;
    err.daten = daten;
    throw err;
  }
  return daten;
}

/**
 * @param {(body: object) => Promise<object>} post
 * @param {object} startBody
 * @param {object} opts
 * @param {(antwort: object) => boolean} opts.istFertig
 * @param {(antwort: object) => object} opts.standBody Body der naechsten Abfrage aus der letzten Antwort
 * @param {(antwort: object) => void} [opts.onStand] nach jeder Antwort
 * @param {() => boolean} [opts.istAbgebrochen] z. B. Seite verlassen; dann endet die Schleife still
 * @param {string} [opts.zeitText] Meldung, wenn maxMs ueberschritten ist
 * @returns {Promise<object|null>} letzte Antwort, null wenn abgebrochen
 */
export async function laufBisFertig(post, startBody, {
  istFertig,
  standBody,
  onStand,
  istAbgebrochen = () => false,
  pauseMs = POLL_PAUSE_MS,
  maxMs = POLL_MAX_MS,
  zeitText,
}) {
  let antwort = await post(startBody);
  if (istAbgebrochen()) return null;
  onStand?.(antwort);
  const bis = Date.now() + maxMs;
  while (!istFertig(antwort)) {
    if (Date.now() > bis) throw new Error(zeitText || `Nach ${Math.round(maxMs / 60000)} Minuten noch nicht fertig.`);
    await pause(pauseMs);
    if (istAbgebrochen()) return null;
    antwort = await post(standBody(antwort));
    if (istAbgebrochen()) return null;
    onStand?.(antwort);
  }
  return antwort;
}
