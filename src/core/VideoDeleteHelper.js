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

  await supabase
    .from('kooperation_videos')
    .update({ link_content: null })
    .eq('id', videoId);

  return { success: true };
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
