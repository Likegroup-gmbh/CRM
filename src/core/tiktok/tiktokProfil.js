// tiktokProfil.js
// Einstieg fuer jeden TikTok-Profilabruf im Frontend (ADR 0083). Mit itemId schreibt die Function
// netlify/functions/tiktok-profil.js die Casting-Zeile und liefert sie zurueck, mit link allein
// nur die Felder als Vorschau (Pool wird trotzdem gefuellt). Bekannte Creator kommen sofort aus
// dem Pool, sonst laeuft ein Apify-Lauf, der eine halbe bis ganze Minute dauern kann.

import { laufBisFertig, postFunction } from './apifyLauf.js';

export const TIKTOK_PROFIL_ENDPOINT = '/.netlify/functions/tiktok-profil';
const MAX_MS = 4 * 60 * 1000;

/**
 * @param {object} args
 * @param {string} [args.itemId] Casting-Zeile, die geschrieben wird
 * @param {string} [args.link] Profil-Link fuer die Vorschau ohne Zeile
 * @param {boolean} [args.force] Pool ueberspringen und frisch abrufen
 * @param {() => boolean} [args.istAbgebrochen]
 * @param {() => void} [args.beimWarten] einmal, wenn kein Pool-Treffer da ist und ein Lauf startet
 * @returns {Promise<{ item: object|null, fields: object|null, source: 'pool'|'apify',
 *   username: string|null, poolFetchedAt: string|null } | null>} null, wenn abgebrochen
 */
export async function tiktokProfilAbrufen({ itemId, link, force = false, istAbgebrochen, beimWarten, pauseMs } = {}) {
  const ziel = itemId ? { item_id: itemId } : { link };
  const post = (body) => postFunction(TIKTOK_PROFIL_ENDPOINT, body);
  let wartet = false;
  try {
    const antwort = await laufBisFertig(post, { aktion: 'starten', ...ziel, force }, {
      istFertig: (a) => a?.fertig === true,
      standBody: (a) => ({ aktion: 'stand', runId: a.runId, ...ziel }),
      onStand: (a) => {
        if (wartet || a?.fertig) return;
        wartet = true;
        beimWarten?.();
      },
      istAbgebrochen,
      pauseMs,
      maxMs: MAX_MS,
      zeitText: 'Der TikTok-Abruf dauert ungewöhnlich lange, bitte später erneut versuchen',
    });
    if (!antwort) return null;
    return {
      item: antwort.item || null,
      fields: antwort.fields || null,
      source: antwort.source || 'apify',
      username: antwort.username || null,
      poolFetchedAt: antwort.pool_fetched_at || null,
    };
  } catch (err) {
    err.hint = err.daten?.hint || null;
    throw err;
  }
}
