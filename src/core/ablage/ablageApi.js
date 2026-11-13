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
 * Unterordner im Rohmaterial einer Kooperation anlegen (ohne parentItemId direkt in Rohmaterial/).
 * Gibt es den Ordner schon, kommt der bestehende zurück.
 * @returns {Promise<{ ordner: { item_id: string, parent_item_id: string, name: string, pfad: string } }>}
 */
export function ablageRohOrdnerAnlegen(kooperationId, name, parentItemId = null) {
  return ablagePost('ablage-datei', { aktion: 'ordner_anlegen', kooperation_id: kooperationId, name, parent_item_id: parentItemId });
}

const ROH_BATCH = 10;

/** Rohmaterial-Aktion je Datei in Paketen; ein Teilfehler stoppt die übrigen nicht. */
async function rohInPaketen(ids, body) {
  const ergebnisse = [];
  for (let i = 0; i < ids.length; i += ROH_BATCH) {
    const paket = ids.slice(i, i + ROH_BATCH);
    try {
      const { ergebnisse: teil } = await ablagePost('ablage-datei', { ...body, ids: paket });
      ergebnisse.push(...(teil || []));
    } catch (err) {
      // Frühere Pakete sind schon verschoben: deren Ergebnis darf nicht verloren gehen
      ergebnisse.push(...paket.map(id => ({ id, ok: false, fehler: err.message || 'Verschieben fehlgeschlagen' })));
    }
  }
  return ergebnisse;
}

/**
 * Rohmaterial in eine Feedbackschleife verschieben; Videos und Bilder werden dort zu Dateien der Runde.
 * @returns {Promise<Array<{ id: string, ok: boolean, typ?: 'video'|'still', asset_id?: string, fehler?: string }>>}
 */
export function ablageRohVerschieben(ids, kooperationVideoId, versionNumber) {
  return rohInPaketen(ids, { aktion: 'roh_verschieben', kooperation_video_id: kooperationVideoId, version_number: versionNumber });
}

/**
 * Rohmaterial in einen anderen Ordner im Rohmaterial verschieben, ohne ordnerItemId in die Wurzel.
 * Die Dateien bleiben Rohmaterial.
 * @returns {Promise<Array<{ id: string, ok: boolean, file_name?: string, file_path?: string, fehler?: string }>>}
 */
export function ablageRohUmordnen(ids, kooperationId, ordnerItemId = null) {
  return rohInPaketen(ids, { aktion: 'roh_umordnen', kooperation_id: kooperationId, ordner_item_id: ordnerItemId });
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
