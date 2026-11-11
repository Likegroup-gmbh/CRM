// videoTableMediaRefresh.js
// Medien einer Kooperation frisch laden und nur deren Medien-Zellen neu zeichnen
// (Content, Stills, Finale). Ausloeser ist eine neue, geaenderte oder geloeschte Datei,
// etwa aus SharePoint. Kein refilter(): Scroll, Fokus und offene Eingaben bleiben.

import { mitAblage } from '../../core/ablage/ablageLink.js';
import { pickLatestAsset } from '../../core/stills/stillAssets.js';
import { batchInQuery } from './videoTableQueries.js';
import { groupBy } from './videoTableAssetsLoader.js';
import { renderContentCell } from './videoTableMediaCells.js';

const VIDEO_ASSET_SELECT = mitAblage('id, video_id, file_url, file_path, version_number, variant_name, is_current, is_final, source_asset_id, created_at');
const MEDIA_COLS = ['col-link-content', 'col-stills', 'col-finale-version'];
const FLASH_MS = 2000;

function findRow(t, koopId) {
  const container = t.containerId ? document.getElementById(t.containerId) : null;
  return container?.querySelector(`tr.kooperation-row[data-kooperation-id="${koopId}"]`) || null;
}

function mediaSnapshot(row) {
  if (!row) return '';
  return MEDIA_COLS.map(col => row.querySelector(`td[data-col-id="${col}"]`)?.innerHTML || '').join('\u0000');
}

function patchVideo(t, koopId, videoId, patch) {
  if (t.store) {
    t.store.updateVideo(videoId, patch);
    return;
  }
  const video = t.videos?.[koopId]?.find(v => v.id === videoId);
  if (video) Object.assign(video, patch);
}

async function refreshVideoAssets(t, koopId, videos) {
  const videoIds = videos.map(v => v.id);
  if (!videoIds.length) return;

  const { data, error } = await batchInQuery(
    window.supabase.from('kooperation_video_asset'),
    VIDEO_ASSET_SELECT,
    'video_id', videoIds,
    q => q.order('created_at', { ascending: true })
  );
  if (error) {
    console.warn('Medien der Kooperation konnten nicht nachgeladen werden:', error);
    return;
  }

  const byVideo = groupBy(data || [], 'video_id');
  for (const video of videos) {
    const list = byVideo[video.id] || [];
    const finals = list.filter(a => a.is_final);
    const currentAsset = pickLatestAsset(list.filter(a => !a.is_final)) || pickLatestAsset(finals);
    patchVideo(t, koopId, video.id, {
      currentAsset,
      file_url: currentAsset?.file_url || video.asset_url || null,
      finalAssets: finals,
      // undefined: Player und Drawer laden die Story-Slots beim naechsten Oeffnen frisch
      story_slots: undefined
    });
    t._mediaViewer?.assetLoader?.invalidate(video.id);
  }
  t.store?.markAssetsLoaded(videoIds);
}

/**
 * @param {object} t KampagneKooperationenVideoTable
 * @param {string} koopId
 * @returns {Promise<boolean>} false, wenn die Kooperation nicht (mehr) in der Tabelle ist
 */
export async function refreshKoopMedia(t, koopId) {
  if (!(t.kooperationen || []).some(k => k.id === koopId)) return false;
  const before = mediaSnapshot(findRow(t, koopId));

  await refreshVideoAssets(t, koopId, t.videos?.[koopId] || []);
  // Holt die Stills der Kooperation und patcht Stills- und Finale-Zellen selbst
  await t.dataLoader?.loadBilder([koopId]);

  // Nach den awaits frisch greifen: ein Resync kann Store und Zeile ersetzt haben
  const koop = (t.kooperationen || []).find(k => k.id === koopId);
  const row = findRow(t, koopId);
  if (!koop || !row) return !!koop;

  for (const video of t.videos?.[koopId] || []) {
    const cell = row.querySelector(`.col-link-content .video-field-wrapper[data-video-id="${video.id}"]`);
    if (cell) cell.innerHTML = renderContentCell(koop, video);
  }

  if (mediaSnapshot(row) !== before) {
    row.classList.add('realtime-updated');
    setTimeout(() => row.classList.remove('realtime-updated'), FLASH_MS);
  }
  t._rowHeightSync?.schedule(row);
  return true;
}
