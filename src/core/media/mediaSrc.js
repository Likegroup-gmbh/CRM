import { ablageLink, istSharePoint } from '../ablage/ablageLink.js';

async function sharePointUrl({ typ, id, etag }) {
  const link = await ablageLink({ typ, id, etag });
  return link?.url || null;
}

/**
 * Loest die abspielbare/anzeigbare URL eines Assets auf. SharePoint-Dateien laufen ueber
 * ablage-link (gecacht in ablageLink), alles andere ist ein gespeicherter externer Link.
 *
 * @param {{ file_path?: string|null, file_url?: string|null, typ?: string|null, id?: string|null,
 *           ablage?: string|null, etag?: string|null }} asset - Lookup aus lookupFor
 * @param {{ werfen?: boolean }} [opts] - werfen: Netz-/Serverfehler von ablage-link werfen statt
 *        null, damit der Aufrufer „keine Datei“ von „nicht erreichbar“ trennen kann
 * @returns {Promise<string|null>}
 */
export async function resolveStreamUrl(asset, { werfen = false } = {}) {
  if (istSharePoint(asset)) {
    const url = sharePointUrl(asset);
    return werfen ? url : url.catch(() => null);
  }
  return asset?.file_url || null;
}

/**
 * Startet die Aufloesung ohne zu warten (fuellt den Link-Cache fuer spaeteres
 * sofortiges Abspielen, z.B. Nachbar-Videos). Externe Links brauchen nichts.
 * @param {{ file_path?: string|null, file_url?: string|null }} asset - Lookup aus lookupFor
 */
export function prefetchStreamUrl(asset) {
  if (istSharePoint(asset)) sharePointUrl(asset).catch(() => {});
}
