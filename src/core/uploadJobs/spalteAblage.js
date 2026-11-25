// spalteAblage.js
// Gemeinsame Schritte der Upload-Spalten-Jobs (neu, ersetzen): Ziel holen, nach SharePoint
// hochladen, Ordner-Link der Zelle in custom_column_values merken.

import { ablageZielHolen, hochladenNachSharePoint } from '../ablage/ablageUpload.js';
import { trackUploadProgress } from './uploadFortschritt.js';

/** Datei in den Spalten-Ordner der Zelle; liefert Ziel (upload_id) und Commit. */
export async function spalteHochladen({ columnId, entityId, file, ersetzenId = null, item, signal, updateItem }) {
  const ziel = await ablageZielHolen({
    typ: 'spalte',
    custom_column_id: columnId,
    entity_id: entityId,
    file_name: file.name,
    file_size: file.size,
    ...(ersetzenId ? { ersetzen: { typ: 'spalte', id: ersetzenId } } : {}),
  });
  const commit = await hochladenNachSharePoint({ ziel, file, signal, onProgress: trackUploadProgress(item, updateItem) });
  return { ziel, commit };
}

/** Ordner-Link der Zelle setzen (der Abgleich setzt ihn sonst nach, wenn die Datei ohne Zeile ankam). */
export async function spaltenWertSetzen(columnId, entityId, folderUrl) {
  if (!folderUrl) return;
  const { error } = await window.supabase.from('custom_column_values').upsert(
    {
      custom_column_id: columnId,
      entity_id: entityId,
      value: folderUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'custom_column_id,entity_id' }
  );
  if (error) console.warn('[Spalte] Ordner-Link nicht gespeichert:', error.message || error);
}
