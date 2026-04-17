// VideoDeleteHelper.js
// Zentrale Funktionen für Video-Lösch-Operationen (Dropbox + Assets + DB)
// kooperation_video_asset ist die Single Source of Truth für Datei-URLs.

async function dropboxDelete(filePath, fetchFn) {
  const resp = await fetchFn('/.netlify/functions/dropbox-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  });
  if (!resp.ok && resp.status !== 404) {
    const err = await resp.json().catch(() => ({}));
    if (!err.alreadyDeleted) {
      console.warn('Dropbox-Delete Warnung:', err.error || resp.status);
    }
  }
}

async function loadAssets(supabase, videoId) {
  const { data } = await supabase
    .from('kooperation_video_asset')
    .select('id, video_id, file_url, file_path, is_current')
    .eq('video_id', videoId);
  return data || [];
}

/**
 * Soft-Delete: Löscht die aktuelle Datei (Dropbox + Asset), Video-Zeile bleibt.
 * Setzt link_content auf null. Schreibt NICHT file_url (existiert nicht in kooperation_videos).
 */
export async function deleteVideoFile(videoId, { supabase: sb, fetch: fetchFn } = {}) {
  const supabase = sb || window.supabase;
  const _fetch = fetchFn || globalThis.fetch;

  const assets = await loadAssets(supabase, videoId);
  const currentAsset = assets.find(a => a.is_current);

  if (currentAsset?.file_path) {
    await dropboxDelete(currentAsset.file_path, _fetch);
  }

  if (currentAsset) {
    await supabase
      .from('kooperation_video_asset')
      .delete()
      .eq('video_id', videoId)
      .eq('is_current', true);
  }

  const { count } = await supabase
    .from('kooperation_video_asset')
    .select('id', { count: 'exact', head: true })
    .eq('video_id', videoId);

  const hasRemainingAssets = (count ?? 0) > 0;

  const updatePatch = { link_content: null };
  if (!hasRemainingAssets) {
    updatePatch.folder_url = null;
    if (currentAsset?.file_path) {
      const folderPath = currentAsset.file_path.substring(0, currentAsset.file_path.lastIndexOf('/'));
      await _fetch('/.netlify/functions/dropbox-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: folderPath }),
      }).catch(() => {});
    }
  }

  await supabase
    .from('kooperation_videos')
    .update(updatePatch)
    .eq('id', videoId);

  return { success: true, hasRemainingAssets };
}

/**
 * Hard-Delete: Löscht Dropbox-Dateien (alle Assets) + alle Asset-Rows + Video-Zeile.
 */
export async function deleteVideoFull(videoId, { supabase: sb, fetch: fetchFn } = {}) {
  const supabase = sb || window.supabase;
  const _fetch = fetchFn || globalThis.fetch;

  try {
    const assets = await loadAssets(supabase, videoId);

    const assetsWithPath = assets.filter(a => a.file_path);
    await Promise.allSettled(
      assetsWithPath.map(a => dropboxDelete(a.file_path, _fetch))
    );

    if (assets.length > 0) {
      await supabase
        .from('kooperation_video_asset')
        .delete()
        .in('video_id', [videoId]);
    }

    const { error } = await supabase
      .from('kooperation_videos')
      .delete()
      .eq('id', videoId);

    if (error) {
      return { success: false, error: error.message || String(error) };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Cascade-Delete: Ruft den serverseitigen Orchestrator auf, der alle Dropbox-Dateien
 * für eine Kampagne/Kooperation/Video löscht, BEVOR die DB-Zeile entfernt wird.
 * Gibt ein Summary-Objekt zurück.
 */
export async function deleteDropboxCascade(entityType, entityId, { fetch: fetchFn } = {}) {
  const _fetch = fetchFn || globalThis.fetch;

  try {
    const resp = await _fetch('/.netlify/functions/dropbox-delete-cascade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityId }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('dropbox-delete-cascade fehlgeschlagen:', err);
      return { success: false, error: err.error || `HTTP ${resp.status}` };
    }

    const result = await resp.json();
    console.log(`Dropbox-Cascade für ${entityType} ${entityId}:`, result);
    return result;
  } catch (err) {
    console.error('dropbox-delete-cascade Fehler:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Löscht eine einzelne Dropbox-Datei über den filePath.
 * Exportiert für Nutzung in VideoUploadDrawer beim Versions-Overwrite.
 */
export async function deleteSingleDropboxFile(filePath, { fetch: fetchFn } = {}) {
  const _fetch = fetchFn || globalThis.fetch;
  await dropboxDelete(filePath, _fetch);
}
