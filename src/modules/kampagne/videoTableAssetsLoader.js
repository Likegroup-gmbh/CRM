// videoTableAssetsLoader.js
// Nachladen der Medien zur Kooperationen-Videotabelle (`dl` = VideoTableDataLoader):
// aktuelle und finale Video-Assets mit Kommentaren, Story-Slots, Stills; danach die
// bereits gerenderten Zellen patchen.

import {
  createEmptyVideoFeedbackComments,
  formatVideoFeedbackValue,
  getVideoFeedbackBucket,
  VIDEO_FEEDBACK_FIELDS
} from '../../core/VideoFeedbackBuckets.js';
import { BILDER_ASSET_SELECT, pickLatestAsset } from '../../core/stills/stillAssets.js';
import { mitAblage } from '../../core/ablage/ablageLink.js';
import { batchInQuery } from './videoTableQueries.js';

const settledOk = (result) => result.status === 'fulfilled' && !result.value?.error;

function groupBy(list, key) {
  const out = {};
  for (const item of list) {
    if (!out[item[key]]) out[item[key]] = [];
    out[item[key]].push(item);
  }
  return out;
}

function warnFailures(assetsResult, commentsResult, finalAssetsResult, finalsOk) {
  if (assetsResult.status === 'rejected') {
    console.warn('⚠️ Assets konnten nicht geladen werden:', assetsResult.reason);
  } else if (assetsResult.value?.error) {
    console.warn('⚠️ Assets konnten nicht geladen werden:', assetsResult.value.error);
  }
  if (commentsResult.status === 'rejected') {
    console.warn('⚠️ Comments konnten nicht geladen werden:', commentsResult.reason);
  }
  if (!finalsOk) {
    console.warn(
      '⚠️ Finale Assets konnten nicht geladen werden:',
      finalAssetsResult.reason || finalAssetsResult.value?.error
    );
  }
}

/** Ohne Store: Assets und Kommentare direkt an die Videos bzw. Kommentar-Maps hängen. */
function applyWithoutStore(t, { assetsByVideoId, finalsByVideoId, finalsOk, comments, stillComments }) {
  for (const koopVideos of Object.values(t.videos)) {
    for (const video of koopVideos) {
      const asset = assetsByVideoId.get(video.id);
      if (asset) {
        video.currentAsset = asset;
        video.file_url = asset.file_url || video.asset_url || null;
      }
      if (finalsOk) video.finalAssets = finalsByVideoId[video.id] || [];
    }
  }

  comments.forEach(comment => {
    if (!t.videoComments[comment.video_id]) {
      t.videoComments[comment.video_id] = createEmptyVideoFeedbackComments();
    }
    t.videoComments[comment.video_id][getVideoFeedbackBucket(comment)].push(comment);
  });
  stillComments.forEach(comment => {
    if (!t.stillComments[comment.video_id]) {
      t.stillComments[comment.video_id] = createEmptyVideoFeedbackComments();
    }
    t.stillComments[comment.video_id][getVideoFeedbackBucket(comment)].push(comment);
  });
}

export async function loadAssetsAndComments(dl, videoIds) {
  const t = dl.table;
  if (!videoIds || videoIds.length === 0) return { finalsOk: true };

  try {
    const sb = window.supabase;

    const [assetsResult, commentsResult, finalAssetsResult, stillCommentsResult] = await Promise.allSettled([
      batchInQuery(
        sb.from('kooperation_video_asset'),
        mitAblage('id, video_id, file_url, file_path, version_number, is_current, created_at'),
        'video_id', videoIds,
        q => q.eq('is_final', false)
      ),
      dl.loadVideoFeedbackComments(videoIds),
      batchInQuery(
        sb.from('kooperation_video_asset'),
        mitAblage('id, video_id, file_url, file_path, variant_name, is_final, source_asset_id, created_at'),
        'video_id', videoIds,
        q => q.eq('is_final', true).order('created_at', { ascending: true })
      ),
      dl.loadStillFeedbackComments(videoIds)
    ]);

    const assets = settledOk(assetsResult) ? (assetsResult.value.data || []) : [];
    const comments = settledOk(commentsResult) ? (commentsResult.value.data || []) : [];
    const stillComments = settledOk(stillCommentsResult) ? (stillCommentsResult.value.data || []) : [];
    const finalsOk = settledOk(finalAssetsResult);
    const finalAssets = finalsOk ? (finalAssetsResult.value.data || []) : [];
    warnFailures(assetsResult, commentsResult, finalAssetsResult, finalsOk);

    const assetsByVideoId = new Map();
    for (const [videoId, list] of Object.entries(groupBy(assets, 'video_id'))) {
      const current = pickLatestAsset(list);
      if (current) assetsByVideoId.set(videoId, current);
    }
    const finalsByVideoId = groupBy(finalAssets, 'video_id');
    if (finalsOk) {
      for (const [videoId, finals] of Object.entries(finalsByVideoId)) {
        if (!assetsByVideoId.has(videoId)) {
          const fallback = pickLatestAsset(finals);
          if (fallback) assetsByVideoId.set(videoId, fallback);
        }
      }
    }

    if (t.store) {
      t.store.applyAssets(assetsByVideoId);
      t.store.applyComments(comments);
      t.store.applyStillComments(stillComments);
      if (finalsOk) t.store.applyFinalAssets(finalsByVideoId);
    } else {
      applyWithoutStore(t, { assetsByVideoId, finalsByVideoId, finalsOk, comments, stillComments });
    }

    dl.patchRenderedAssetsAndComments(assetsByVideoId);

    console.log(`✅ Assets (${assets.length}) + Comments (${comments.length}) nachgeladen`);
    return { finalsOk };
  } catch (error) {
    console.error('❌ Fehler beim Nachladen von Assets/Comments:', error);
    return { finalsOk: false };
  }
}

export async function loadStorySlots(dl, videoIds) {
  const t = dl.table;
  if (!videoIds || videoIds.length === 0) return;

  try {
    const sb = window.supabase;

    const slotsResult = await batchInQuery(
      sb.from('kooperation_story'),
      'id, video_id, slot_index, slot_name, created_at',
      'video_id', videoIds,
      q => q.order('slot_index', { ascending: true })
    ).catch(err => ({ data: [], error: err }));

    const slots = slotsResult?.data || [];

    // Assets ueber den FK story_id laden (nicht ueber video_id, das auf
    // aelteren Story-Assets fehlen/falsch sein kann -> sonst leere Slots).
    const slotIds = slots.map(s => s.id);
    const assetsResult = slotIds.length > 0
      ? await batchInQuery(
          sb.from('kooperation_story_asset'),
          mitAblage('id, video_id, story_id, file_url, file_path, file_name, file_size, version_number, is_current, is_final, variant_name, created_at'),
          'story_id', slotIds
        ).catch(err => ({ data: [], error: err }))
      : { data: [] };

    const assets = assetsResult?.data || [];
    const assetsByStoryId = groupBy(assets, 'story_id');

    const slotsByVideoId = {};
    for (const slot of slots) {
      const slotAssets = assetsByStoryId[slot.id] || [];
      const loopAssets = slotAssets.filter(a => !a.is_final);
      const currentAsset = pickLatestAsset(loopAssets) || pickLatestAsset(slotAssets.filter(a => a.is_final));
      const versions = [...new Set(loopAssets.map(a => a.version_number))].sort((a, b) => a - b);

      const enrichedSlot = {
        ...slot,
        assets: slotAssets,
        currentAsset,
        currentVersion: currentAsset?.version_number || 0,
        existingVersions: versions,
      };

      if (!slotsByVideoId[slot.video_id]) slotsByVideoId[slot.video_id] = [];
      slotsByVideoId[slot.video_id].push(enrichedSlot);
    }

    if (t.store) {
      t.store.applyStorySlots(slotsByVideoId);
    } else {
      for (const koopVideos of Object.values(t.videos)) {
        for (const video of koopVideos) {
          video.story_slots = slotsByVideoId[video.id] || [];
        }
      }
    }

    console.log(`✅ Story-Slots (${slots.length}) + Assets (${assets.length}) geladen`);
  } catch (error) {
    console.error('❌ Fehler beim Laden der Story-Slots:', error);
  }
}

/**
 * Zieht die Stills der geladenen Koops nach. Die Kampagnen-Detailseite laedt
 * Koops/Videos selbst und setzt _dataLoaded, wodurch loadData() – und damit
 * loadBilder() – dort nie laeuft. Ohne diesen Aufruf bleiben Stills- und
 * Finale-Spalte leer, obwohl der Drawer die Stills findet.
 */
export async function loadBilderForVisible(dl) {
  const missing = (dl.table.kooperationen || [])
    .filter(koop => !Array.isArray(koop._bilder))
    .map(koop => koop.id);
  if (missing.length === 0) return;
  await dl.loadBilder(missing);
}

export async function loadBilder(dl, koopIds) {
  const t = dl.table;
  if (!koopIds || koopIds.length === 0) return;

  try {
    const result = await batchInQuery(
      window.supabase.from('kooperation_bilder_asset'),
      BILDER_ASSET_SELECT,
      'kooperation_id', koopIds,
      q => q.order('created_at', { ascending: true })
    );

    if (result?.error) {
      console.error('❌ Fehler beim Laden der Bilder-Assets:', result.error);
      return;
    }

    const images = result?.data || [];
    const byKoop = groupBy(images, 'kooperation_id');

    // Nur die angefragten Koops aktualisieren (loadBilder wird auch fuer
    // einzelne Koops als Refresh nach Upload/Zuordnung aufgerufen).
    const idSet = new Set(koopIds);
    for (const koop of t.kooperationen) {
      if (idSet.has(koop.id)) koop._bilder = byKoop[koop.id] || [];
    }

    dl.patchRenderedBilderCells();
    console.log(`✅ Bilder-Assets (${images.length}) geladen`);
  } catch (error) {
    console.error('❌ Fehler beim Laden der Bilder-Assets:', error);
  }
}

function tableContainer(t) {
  return t.containerId ? document.getElementById(t.containerId) : null;
}

export function patchRenderedAssetsAndComments(dl, assetsByVideoId) {
  const t = dl.table;
  const container = tableContainer(t);
  if (!container) return;

  for (const [videoId, asset] of assetsByVideoId) {
    const thumbnail = container.querySelector(`[data-video-id="${videoId}"] .video-thumbnail-img`);
    if (thumbnail && asset.file_url) {
      thumbnail.src = asset.file_url;
      thumbnail.closest('.video-thumbnail')?.classList.remove('no-asset');
    }
  }

  const commentsSource = t.store?.videoComments || t.videoComments || {};
  for (const [videoId, comments] of Object.entries(commentsSource)) {
    VIDEO_FEEDBACK_FIELDS.forEach(slot => {
      const field = container.querySelector(`[data-entity="video"][data-id="${videoId}"][data-field="${slot.field}"]`);
      if (field && !field.value) field.value = formatVideoFeedbackValue(comments, slot.bucket);
    });
  }

  dl.patchRenderedBilderCells();
}

export function patchRenderedBilderCells(dl) {
  const t = dl.table;
  const container = tableContainer(t);
  if (!container || !t.renderer) return;

  for (const koop of t.kooperationen || []) {
    for (const video of (t.videos[koop.id] || [])) {
      const cell = container.querySelector(`.col-finale-version .video-field-wrapper[data-video-id="${video.id}"]`);
      if (cell) cell.innerHTML = t.renderer.renderFinaleVersionCell(koop, video);
      const stillsCell = container.querySelector(`.col-stills .video-field-wrapper[data-video-id="${video.id}"]`);
      if (stillsCell) stillsCell.innerHTML = t.renderer.renderStillsCell(koop, video);
    }
  }
}
