// VideoDeleteHelper.js
// Zentrale Funktionen für Video-Lösch-Operationen (SharePoint + Assets + DB)
// kooperation_video_asset ist die Single Source of Truth für Datei-URLs.
// Altbestand außerhalb von SharePoint ist nur ein Link: dort fällt nur die Zeile weg.

import { pickLatestAsset } from './stills/stillAssets.js';
import { authorizedFetch } from './auth/getAccessToken.js';
import { ablageDateiLoeschen, ablageEntityLoeschen } from './ablage/ablageApi.js';
import { istSharePoint, mitAblage } from './ablage/ablageLink.js';

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
 * Hard-Delete: Löscht SharePoint-Dateien (alle Assets) + alle Asset-Rows + Video-Zeile.
 */
export async function deleteVideoFull(videoId, { supabase: sb, fetch: fetchFn } = {}) {
  const supabase = sb || window.supabase;
  const _fetch = fetchFn || authorizedFetch;

  try {
    const assets = await loadAssets(supabase, videoId);

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
 * Löschkaskade vor dem DB-Delete einer Entität: ablage-loeschen räumt den SharePoint-Bestand
 * (Ordner und Dateien) ab. Ein Fehler bricht das Löschen nicht ab.
 * @param {'unternehmen'|'kampagne'|'kooperation'|'video'|'spalte'} entityType
 * @returns {Promise<{ success: boolean, fehler: Array }>}
 */
export async function ablageCascade(entityType, entityId, { fetch: fetchFn } = {}) {
  try {
    const result = await ablageEntityLoeschen(entityType, entityId, { fetch: fetchFn || authorizedFetch });
    const fehler = result?.fehler || [];
    if (fehler.length) console.warn(`ablage-loeschen für ${entityType} ${entityId} mit Fehlern:`, fehler);
    return { success: fehler.length === 0, fehler };
  } catch (err) {
    console.error('ablage-loeschen fehlgeschlagen:', err);
    return { success: false, fehler: [err.message || String(err)] };
  }
}
