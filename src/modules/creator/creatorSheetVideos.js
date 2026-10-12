// Videos in der Creator-Schublade: Tabelle, Laden der Assets und
// die readOnly-Fassade fuer den Media-Viewer.

import { icon } from '../../core/icons/IconSystem.js';
import { renderEmptyState, renderSectionHeader } from '../../core/components/EmptyState.js';
import { pickLatestAsset } from '../../core/stills/stillAssets.js';
import { VideoTableDataLoader } from '../kampagne/VideoTableDataLoader.js';

const PLAY_ICON = `${icon('play-circle')}`;
const FOLDER_ICON = `${icon('folder-open')}`;
const STORYS_ICON = `${icon('device-phone')}`;

const esc = (value) => window.validatorSystem?.sanitizeHtml?.(String(value ?? '')) ?? String(value ?? '');
const escUrl = (value) => window.validatorSystem?.sanitizeUrl?.(value) || '';

// Gleiche Button-Zeile wie renderContentCell der Kampagnen-Videotabelle,
// aber ohne Upload-/Verwalten-Knoepfe (die Akte ist readOnly).
function renderVideoContentCell(koop, video) {
  const videoUrl = video.file_url || video.link_content || video.asset_url;
  const buttons = [];

  if (videoUrl) {
    buttons.push(`<button type="button" class="external-link-btn media-action-btn play-btn" data-action="play-video" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Video abspielen">${PLAY_ICON}</button>`);
  } else if (video.folder_url) {
    buttons.push(`<a href="${escUrl(video.folder_url)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Ordner öffnen">${FOLDER_ICON}</a>`);
  }
  if (video.story_folder_url) {
    buttons.push(`<button type="button" class="external-link-btn media-action-btn" data-action="view-storys" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Storys ansehen">${STORYS_ICON}</button>`);
  }

  if (!buttons.length) return '<span class="no-content-placeholder">—</span>';
  return `<div class="content-cell-actions">${buttons.join('')}</div>`;
}

export function renderVideosSection(detail, videosByKoop) {
  const rows = [];
  for (const koop of detail.kooperationen || []) {
    for (const video of videosByKoop[koop.id] || []) {
      const titel = video.video_name || video.thema || (video.position ? `Video ${video.position}` : 'Video');
      rows.push(`
        <tr>
          <td>${esc(titel)}</td>
          <td>
            <a href="/kooperation/${koop.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/kooperation/${koop.id}')">
              ${esc(koop.name || 'Kooperation')}
            </a>
          </td>
          <td>${video.stats_views != null ? Number(video.stats_views).toLocaleString('de-DE') : '–'}</td>
          <td>${renderVideoContentCell(koop, video)}</td>
        </tr>
      `);
    }
  }

  if (!rows.length) {
    return renderEmptyState({
      icon: 'video',
      title: 'Keine Videos',
      text: 'Für diesen Creator wurden noch keine Videos hochgeladen.'
    });
  }

  return `
    ${renderSectionHeader({ title: 'Videos' })}
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Video</th>
            <th>Kooperation</th>
            <th>Aufrufe</th>
            <th>Content</th>
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
  `;
}

// Alle Videos der Kooperationen inkl. Assets, angereichert wie in der
// Kampagnen-Videotabelle (currentAsset/file_url/finalAssets).
export async function loadSheetVideos(kooperationen) {
  const koopIds = (kooperationen || []).map((k) => k.id).filter(Boolean);
  if (!koopIds.length || !window.supabase) return { byKoop: {}, total: 0 };

  const { data: videoRows, error } = await window.supabase
    .from('kooperation_videos')
    .select('id, kooperation_id, position, video_name, thema, asset_url, link_content, folder_url, story_folder_url, content_art, posting_datum, stats_views')
    .in('kooperation_id', koopIds)
    .order('position', { ascending: true });
  if (error) throw error;

  const videos = videoRows || [];
  const byKoop = {};
  for (const video of videos) {
    video.currentAsset = null;
    video.file_url = video.asset_url || null;
    video.finalAssets = [];
    (byKoop[video.kooperation_id] ||= []).push(video);
  }

  const videoIds = videos.map((v) => v.id);
  if (videoIds.length) {
    const [loopResult, finalResult] = await Promise.all([
      window.supabase
        .from('kooperation_video_asset')
        .select('id, video_id, file_url, file_path, version_number, is_current, created_at')
        .in('video_id', videoIds)
        .eq('is_final', false),
      window.supabase
        .from('kooperation_video_asset')
        .select('id, video_id, file_url, file_path, variant_name, is_final, source_asset_id, created_at')
        .in('video_id', videoIds)
        .eq('is_final', true)
        .order('created_at', { ascending: true })
    ]);

    const loopByVideo = {};
    for (const asset of loopResult.data || []) (loopByVideo[asset.video_id] ||= []).push(asset);
    const finalsByVideo = {};
    for (const asset of finalResult.data || []) (finalsByVideo[asset.video_id] ||= []).push(asset);

    for (const video of videos) {
      const current = pickLatestAsset(loopByVideo[video.id] || []) || pickLatestAsset(finalsByVideo[video.id] || []);
      if (current) {
        video.currentAsset = current;
        video.file_url = current.file_url || video.asset_url || null;
      }
      video.finalAssets = finalsByVideo[video.id] || [];
    }
  }

  return { byKoop, total: videos.length };
}

// Minimale Tabellen-Fassade fuer den Media-Viewer: gleiche Form wie die
// Kampagnen-Videotabelle, aber readOnly (kein Feedback, keine Uploads).
// loadStorySlots kommt vom echten VideoTableDataLoader - ohne Store schreibt
// er die Slots direkt auf die Videos der Fassade.
export function buildPlayerFacade(detail, videosByKoop) {
  const facade = {
    videos: videosByKoop,
    videoComments: {},
    stillComments: {},
    isKundeRole: () => false,
    isFieldEditableForUser: () => false,
    renderer: { getFilteredKooperationen: () => detail.kooperationen || [] }
  };
  facade.dataLoader = new VideoTableDataLoader(facade);
  return facade;
}
