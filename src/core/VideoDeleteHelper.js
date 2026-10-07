// VideoDeleteHelper.js
// Zentrale Funktionen für Video-Lösch-Operationen (Dropbox + Assets + DB)
// kooperation_video_asset ist die Single Source of Truth für Datei-URLs.

import { pickLatestAsset } from './stills/stillAssets.js';

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
 * Gleicht ein Video nach dem Löschen EINER Asset-Zeile mit den verbleibenden
 * Assets ab (Datei + Zeile sind bereits weg). Kein Dropbox-Zugriff, kein Ordner-Delete.
 *
 * - is_current: Loop-Assets der höchsten verbleibenden Feedbackschleife = true, Rest false.
 * - link_content: nur neu gesetzt, wenn die gelöschte Datei ein Loop-Asset der
 *   (bisher) höchsten Schleife war. Löschen aus älterer Runde / Finale fasst ihn nicht an.
 * - folder_url: nur geleert, wenn gar kein Asset (Loop oder Final) übrig ist.
 */
export async function syncVideoAssetsAfterDelete(videoId, deletedAsset, { supabase: sb } = {}) {
  const supabase = sb || window.supabase;

  const { data } = await supabase
    .from('kooperation_video_asset')
    .select('id, version_number, is_current, is_final, file_url, file_path, created_at')
    .eq('video_id', videoId);
  const remaining = data || [];
  const loops = remaining.filter(a => !a.is_final);
  const finals = remaining.filter(a => a.is_final);

  const maxVersion = loops.length ? Math.max(...loops.map(a => a.version_number || 1)) : 0;
  const isTop = a => (a.version_number || 1) === maxVersion;
  const setFlag = async (ids, is_current) => {
    if (ids.length) await supabase.from('kooperation_video_asset').update({ is_current }).in('id', ids);
  };
  await setFlag(loops.filter(a => !isTop(a) && a.is_current).map(a => a.id), false);
  await setFlag(loops.filter(a => isTop(a) && !a.is_current).map(a => a.id), true);

  const hasRemainingAssets = remaining.length > 0;
  const patch = {};
  const wasTopLoop = !!deletedAsset && !deletedAsset.is_final
    && (loops.length === 0 || (deletedAsset.version_number || 1) >= maxVersion);
  if (wasTopLoop) {
    patch.link_content = pickLatestAsset(loops.filter(a => a.file_url))?.file_url ?? null;
  }
  if (!hasRemainingAssets) patch.folder_url = null;
  if (Object.keys(patch).length) {
    await supabase.from('kooperation_videos').update(patch).eq('id', videoId);
  }

  return {
    currentAsset: pickLatestAsset(loops) || pickLatestAsset(finals),
    linkContentChanged: 'link_content' in patch,
    linkContent: patch.link_content ?? null,
    hasRemainingAssets,
  };
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
