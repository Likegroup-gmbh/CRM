// ablageUpload.js
// Jeder Upload holt sich beim Server eine Upload-Session in SharePoint. Die Bytes gehen direkt
// in die Session, danach bestätigt der Commit die Datei und liefert die Asset-Felder.

import { uploadToSession } from '../AblageUploader.js';
import { ablagePost } from './ablageApi.js';
import { ABLAGE_SELECT } from './ablageLink.js';

/**
 * @param {{ typ: 'video'|'story'|'still'|'roh'|'spalte', kooperation_id?: string, kooperation_video_id?: string|null,
 *           story_id?: string|null, version_number?: number, is_final?: boolean, variant_name?: string|null,
 *           custom_column_id?: string, entity_id?: string,
 *           file_name: string, file_size: number, ersetzen?: { typ: string, id: string } }} body
 * @returns {Promise<{ ziel: 'sharepoint', upload_id: string, upload_url: string,
 *           chunk_bytes: number, file_name: string, ordner: { item_id: string, pfad: string, web_url: string } }>}
 */
export async function ablageZielHolen(body) {
  const data = await ablagePost('ablage-upload-ziel', body);
  if (data.ziel === 'sharepoint' && data.upload_id && data.upload_url) return data;
  throw new Error('Ablage-Ziel konnte nicht bestimmt werden');
}

/** Upload-Session des Servers verwerfen (Datei und offener Upload werden entfernt). Best effort. */
export async function uploadVerwerfen(uploadId) {
  if (!uploadId) return;
  try {
    await ablagePost('ablage-datei', { aktion: 'upload_verwerfen', upload_id: uploadId });
  } catch (err) {
    console.warn('Ablage: Upload konnte nicht verworfen werden', err?.message || err);
  }
}

/**
 * Bytes hochladen und bestätigen. Scheitert Upload oder Commit, wird der Upload verworfen.
 * @returns {Promise<object>} Commit ({ ablage, drive_id, item_id, etag, ctag, file_path, file_name,
 *          file_size, file_url, folder_url, breite, hoehe, video_id, kooperation_id }). video_id: Video,
 *          in dessen Runde die Datei liegt (Bilder ohne Video landen beim ersten Video).
 */
export async function hochladenNachSharePoint({ ziel, file, signal, onProgress }) {
  try {
    let item;
    try {
      item = await uploadToSession({
        file,
        uploadUrl: ziel.upload_url,
        chunkBytes: ziel.chunk_bytes,
        signal,
        onProgress,
      });
    } catch (err) {
      // 404 nach dem letzten Stück: die Datei ist oft schon da, nur die Antwort ging verloren.
      // Der Commit ohne item_id sucht sie über Name und Größe.
      if (err?.status !== 404) throw err;
      try {
        return await ablagePost('ablage-upload-commit', { upload_id: ziel.upload_id });
      } catch {
        throw err;
      }
    }
    if (!item?.id) throw new Error('SharePoint hat keine Datei zurückgegeben');
    return await ablagePost('ablage-upload-commit', { upload_id: ziel.upload_id, item_id: item.id });
  } catch (err) {
    await uploadVerwerfen(ziel.upload_id);
    throw err;
  }
}

/** Spalten einer Asset-Zeile aus dem Commit. */
export function sharePointAssetFelder(commit) {
  return {
    ablage: 'sharepoint',
    drive_id: commit.drive_id,
    item_id: commit.item_id,
    etag: commit.etag ?? null,
    ctag: commit.ctag ?? null,
    breite: commit.breite ?? null,
    hoehe: commit.hoehe ?? null,
    file_path: commit.file_path,
    file_name: commit.file_name ?? null,
    file_size: commit.file_size ?? null,
    file_url: commit.file_url ?? null,
  };
}

const ABLAGE_FELDER = ABLAGE_SELECT.split(',').map(s => s.trim());

/** Ablage-Spalten einer Quelle für einen Verweis auf dieselbe Datei (Finale). Fehlende Spalten → DB-Default. */
export function ablageVonQuelle(source) {
  const felder = {};
  for (const key of ABLAGE_FELDER) {
    if (source?.[key] !== undefined) felder[key] = source[key];
  }
  return felder;
}
