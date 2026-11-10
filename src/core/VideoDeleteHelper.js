// VideoDeleteHelper.js
// Zentrale Funktionen für Video-Lösch-Operationen (Dropbox + Assets + DB)
// kooperation_video_asset ist die Single Source of Truth für Datei-URLs.

import { pickLatestAsset } from './stills/stillAssets.js';
import { authorizedFetch } from './auth/getAccessToken.js';
import { ablageDateiLoeschen, ablageEntityLoeschen } from './ablage/ablageApi.js';
import { istSharePoint, mitAblage } from './ablage/ablageLink.js';

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
    .select(mitAblage('id, video_id, file_url, file_path, is_current', 'ablage'))
    .eq('video_id', videoId);
  return data || [];
}

/**
 * Gleicht ein Video nach dem Löschen einer Asset-Zeile ab (Datei + Zeile sind bereits weg).
 * is_current und link_content setzt der Trigger auf kooperation_video_asset; hier wird nur
 * zurückgelesen, was die UI braucht, und folder_url geleert, wenn gar kein Asset
 * (Loop oder Final) übrig ist.
 */
export async function syncVideoAssetsAfterDelete(videoId, { supabase: sb } = {}) {
  const supabase = sb || window.supabase;

  const [{ data }, { data: video }] = await Promise.all([
    supabase
      .from('kooperation_video_asset')
      .select('id, version_number, is_current, is_final, file_url, file_path, created_at')
      .eq('video_id', videoId),
    supabase.from('kooperation_videos').select('link_content').eq('id', videoId).maybeSingle(),
  ]);
  const remaining = data || [];
  const loops = remaining.filter(a => !a.is_final);
  const finals = remaining.filter(a => a.is_final);

  const hasRemainingAssets = remaining.length > 0;
  if (!hasRemainingAssets) {
    await supabase.from('kooperation_videos').update({ folder_url: null }).eq('id', videoId);
  }

  return {
    currentAsset: pickLatestAsset(loops) || pickLatestAsset(finals),
    linkContent: video?.link_content ?? null,
    hasRemainingAssets,
  };
}

/**
 * Hard-Delete: Löscht Dropbox-Dateien (alle Assets) + alle Asset-Rows + Video-Zeile.
 */
export async function deleteVideoFull(videoId, { supabase: sb, fetch: fetchFn } = {}) {
  const supabase = sb || window.supabase;
  const _fetch = fetchFn || authorizedFetch;

  try {
    const assets = await loadAssets(supabase, videoId);

    const assetsWithPath = assets.filter(a => a.file_path && !istSharePoint(a));
    await Promise.allSettled(
      assetsWithPath.map(a => dropboxDelete(a.file_path, _fetch))
    );

    // Nacheinander, Zeile direkt nach der Datei: Quelle und Finale teilen sich die Datei,
    // und der Server löscht sie erst, wenn keine andere Zeile mehr auf sie zeigt.
    for (const a of assets.filter(istSharePoint)) {
      await ablageDateiLoeschen('video', a.id, { fetch: _fetch });
      const { error } = await supabase.from('kooperation_video_asset').delete().eq('id', a.id);
      if (error) throw error;
    }

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
 * für eine Kampagne/Kooperation/Video löscht, BEVOR die DB-Zeile entfernt wird. Parallel
 * räumt ablage-loeschen den SharePoint-Bestand ab.
 * Gibt das Summary-Objekt der Dropbox-Cascade zurück.
 */
export async function deleteDropboxCascade(entityType, entityId, { fetch: fetchFn } = {}) {
  const _fetch = fetchFn || authorizedFetch;
  const [result] = await Promise.all([
    dropboxCascade(entityType, entityId, _fetch),
    ablageCascade(entityType, entityId, _fetch),
  ]);
  return result;
}

/** SharePoint-Bestand derselben Entität; ein Fehler bricht das Löschen nicht ab. */
async function ablageCascade(entityType, entityId, fetchFn) {
  try {
    const result = await ablageEntityLoeschen(entityType, entityId, { fetch: fetchFn });
    if (result?.fehler?.length) console.warn(`ablage-loeschen für ${entityType} ${entityId} mit Fehlern:`, result.fehler);
  } catch (err) {
    console.error('ablage-loeschen fehlgeschlagen:', err);
  }
}

async function dropboxCascade(entityType, entityId, _fetch) {
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
  const _fetch = fetchFn || authorizedFetch;
  await dropboxDelete(filePath, _fetch);
}
