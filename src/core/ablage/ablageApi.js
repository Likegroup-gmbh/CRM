// ablageApi.js
// Aufrufe an die Medienablage-Functions (SharePoint). Dropbox-Zeilen laufen nie hierüber.

import { authorizedFetch } from '../auth/getAccessToken.js';

export async function ablagePost(fn, body, { fetch: fetchFn } = {}) {
  const _fetch = fetchFn || authorizedFetch;
  const resp = await _fetch(`/.netlify/functions/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data?.error || `Ablage-Anfrage fehlgeschlagen (${resp.status})`);
    err.status = resp.status;
    err.code = data?.code || null;
    if (data?.max_bytes) err.maxBytes = data.max_bytes;
    throw err;
  }
  return data || {};
}

/**
 * SharePoint-Datei einer Asset-Zeile löschen. Muss vor dem Löschen der Zeile laufen: der
 * Server prüft die Rechte an der Zeile und lässt die Datei stehen, solange eine andere
 * Zeile auf sie zeigt.
 * @param {'video'|'story'|'still'|'roh'} typ
 */
export function ablageDateiLoeschen(typ, id, opts) {
  return ablagePost('ablage-datei', { aktion: 'loeschen', typ, id }, opts);
}

/** @returns {Promise<{ file_name: string, file_path: string, etag: string }>} */
export function ablageDateiUmbenennen(typ, id, name) {
  return ablagePost('ablage-datei', { aktion: 'umbenennen', typ, id, name });
}

/**
 * Bild in den Ordner eines anderen Videos (oder ohne Video in den Bilder-Ordner) verschieben.
 * Der Server zieht file_path/file_name aller Zeilen dieser Datei nach.
 * @returns {Promise<{ file_name: string, file_path: string, etag: string }>}
 */
export function ablageBildVerschieben(id, kooperationVideoId) {
  return ablagePost('ablage-datei', { aktion: 'verschieben', typ: 'still', id, kooperation_video_id: kooperationVideoId || null });
}

/**
 * SharePoint-Ordner und -Dateien einer Entität entfernen, vor dem DB-Delete. Ohne
 * SharePoint-Bestand oder ohne Konfiguration liefert der Server nur Nullen.
 * @param {'unternehmen'|'kampagne'|'kooperation'|'video'} entity
 * @returns {Promise<{ ordner: number, dateien: number, fehler: Array }>}
 */
export function ablageEntityLoeschen(entity, id, opts) {
  return ablagePost('ablage-loeschen', { entity, id }, opts);
}
