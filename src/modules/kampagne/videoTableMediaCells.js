// videoTableMediaCells.js
// Idee, Skript und Medien-Zellen der Kampagnen-Video-Tabelle

import { icon } from '../../core/icons/IconSystem.js';
import { finalStills, stillsForVideoCell } from '../../core/stills/stillAssets.js';
import { STILL_FINAL_VARIANT } from '../../core/PromoteFinalAsset.js';
import { toRawDropboxUrl, canPreviewImageAsset } from '../../core/VideoUploadUtils.js';
import { escapeHtml } from './videoTableFieldCells.js';

const LINK_ICON = `${icon('link')}`;
const PLAY_ICON = `${icon('play-circle')}`;
const FOLDER_ICON = `${icon('folder-open')}`;
const STORYS_ICON = `${icon('device-phone')}`;
const BILDER_ICON = `${icon('photo')}`;
const GEAR_ICON = `${icon('cog')}`;
const UPLOAD_ICON = `${icon('upload')}`;
const SKRIPT_ICON = `${icon('skripte', { className: 'w-4 h-4' })}`;
const SKRIPT_EDIT_ICON = `${icon('pencil-square', { className: 'w-4 h-4' })}`;

export function renderIdeeStrategieInner(ctx, video) {
  const koop = ctx.koop;
  const canLink = window.permissionSystem?.canEditField('video', 'strategie_item_id') ?? false;
  const item = video.strategie_item;
  if (item && (item.screenshot_url || item.video_link)) {
    const videoLink = item.video_link;
    const screenshotUrl = item.screenshot_url;
    const beschreibung = item.beschreibung || 'Konzept-Idee';
    const thumbHtml = screenshotUrl
      ? `<img src="${screenshotUrl}" alt="Thema" class="thema-thumbnail" />`
      : `<span class="thema-thumbnail thema-thumbnail--placeholder">${PLAY_ICON}</span>`;
    if (canLink) {
      // Verlinkte Videoidee: Bild oeffnet das Video in neuem Tab,
      // der Verknuepfungs-Drawer wandert auf das Link-Icon daneben.
      if (videoLink) {
        return `
            <span class="thema-item-actions">
              <a href="${videoLink}" class="thema-thumbnail-link thema-thumbnail-link--playable"
                title="${escapeHtml(beschreibung)}" target="_blank" rel="noopener noreferrer">
                ${thumbHtml}
              </a>
              <button type="button" class="thema-relink-btn"
                data-action="link-strategie-item"
                data-video-id="${video.id}"
                data-kooperation-id="${koop.id}"
                title="Verknüpfung ändern">${LINK_ICON}</button>
            </span>
          `;
      }
      // Reine Idee ohne Video-Link: Klick oeffnet weiterhin den Drawer.
      return `
          <button type="button" class="thema-link-btn thema-link-btn--linked"
            data-action="link-strategie-item"
            data-video-id="${video.id}"
            data-kooperation-id="${koop.id}"
            title="${escapeHtml(beschreibung)}">
            ${thumbHtml}
          </button>
        `;
    }
    const href = videoLink || `/konzepte/${item.strategie_id}`;
    const targetAttr = videoLink ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `
        <a href="${href}" class="thema-thumbnail-link${videoLink ? ' thema-thumbnail-link--playable' : ''}" title="${escapeHtml(beschreibung)}"${targetAttr}>
          ${thumbHtml}
        </a>
      `;
  }
  if (canLink) {
    return `
        <button type="button" class="thema-link-btn"
          data-action="link-strategie-item"
          data-video-id="${video.id}"
          data-kooperation-id="${koop.id}">
          Idee verknüpfen
        </button>
      `;
  }
  return `<span class="no-strategie-hint">Noch kein Thema/Konzept verknüpft</span>`;
}

export function renderSkriptCell(koop, video) {
  const canLink = window.permissionSystem?.canEditField('video', 'skript_id') ?? false;
  // Share-Gaeste duerfen nicht in den Skript-Editor durchgreifen -
  // Skripte werden nur ueber eigene Skript-Links geteilt.
  const isGast = Boolean(window.isGast?.());
  const skript = video.skript;
  const skriptId = video.skript_id || skript?.id;
  const titel = (skript?.titel || '').trim() || 'Skript';

  if (skriptId) {
    const href = `/skripte/${skriptId}`;
    if (isGast) {
      return `
          <span class="skript-link-cell skript-link-cell--static">
            ${SKRIPT_ICON}<span class="skript-link-title">${escapeHtml(titel)}</span>
          </span>
        `;
    }
    if (canLink) {
      return `
          <div class="skript-link-cell">
            <button type="button" class="thema-link-btn skript-link-open"
              data-action="open-skript"
              data-skript-id="${skriptId}"
              title="${escapeHtml(titel)}">
              ${SKRIPT_ICON}<span class="skript-link-title">${escapeHtml(titel)}</span>
            </button>
            <button type="button" class="skript-link-edit-btn"
              data-action="link-skript"
              data-video-id="${video.id}"
              data-kooperation-id="${koop.id}"
              title="Verknüpfung ändern"
              aria-label="Verknüpfung ändern">
              ${SKRIPT_EDIT_ICON}
            </button>
          </div>
        `;
    }
    return `
        <a href="${href}" class="thema-link-btn skript-link-open"
          data-action="open-skript"
          data-skript-id="${skriptId}"
          title="${escapeHtml(titel)}">
          ${SKRIPT_ICON}<span class="skript-link-title">${escapeHtml(titel)}</span>
        </a>
      `;
  }

  if (canLink) {
    return `
        <button type="button" class="thema-link-btn"
          data-action="link-skript"
          data-video-id="${video.id}"
          data-kooperation-id="${koop.id}">
          Skript verknüpfen
        </button>
      `;
  }
  return `<span class="no-strategie-hint">Noch kein Skript verknüpft</span>`;
}

export function renderContentCell(koop, video) {
  const canUpload = window.canFeature?.('mediaUpload') ?? false;
  const folderUrl = video.folder_url;
  const storyFolderUrl = video.story_folder_url;
  const videoUrl = video.file_url || video.link_content || video.asset_url;
  const hasPlayable = !!videoUrl;
  const hasStorys = !!storyFolderUrl;
  const hasContent = hasPlayable || !!folderUrl || hasStorys;

  const buttons = [];

  if (hasPlayable) {
    buttons.push(`<button type="button" class="external-link-btn media-action-btn play-btn" data-action="play-video" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Video abspielen">${PLAY_ICON}</button>`);
  } else if (folderUrl) {
    buttons.push(`<a href="${folderUrl}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Ordner öffnen">${FOLDER_ICON}</a>`);
  }

  if (hasStorys) {
    buttons.push(`<button type="button" class="external-link-btn media-action-btn" data-action="view-storys" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Storys ansehen">${STORYS_ICON}</button>`);
  }

  if (canUpload) {
    if (hasContent) {
      buttons.push(`<button type="button" class="video-settings-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" data-file-path="${video.currentAsset?.file_path || ''}" data-video-url="${videoUrl || ''}" title="Video verwalten">${GEAR_ICON}</button>`);
    } else {
      buttons.push(`<button type="button" class="video-upload-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Video hochladen">${UPLOAD_ICON} Upload</button>`);
    }
  }

  if (buttons.length === 0) {
    return `<span class="no-content-placeholder">—</span>`;
  }

  return `<div class="content-cell-actions">${buttons.join('')}</div>`;
}

export function renderStillsCell(koop, video) {
  const canUpload = window.canFeature?.('mediaUpload') ?? false;
  const stills = stillsForVideoCell(koop, video);
  const hasStills = stills.length > 0
    || (!Array.isArray(koop._bilder) && !!koop.bilder_folder_url);

  const buttons = [];
  if (hasStills) {
    const countBadge = stills.length > 0 ? `<span class="filter-count-badge">${stills.length}</span>` : '';
    const stillsTitle = stills.length > 0
      ? `${stills.length} Still${stills.length !== 1 ? 's' : ''} ansehen`
      : 'Stills ansehen';
    buttons.push(`<button type="button" class="external-link-btn media-action-btn" data-action="view-bilder" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="${stillsTitle}">${BILDER_ICON}${countBadge}</button>`);
  }

  if (canUpload) {
    if (hasStills) {
      buttons.push(`<button type="button" class="video-settings-btn stills-settings-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" data-file-path="" data-video-url="" title="Stills verwalten">${GEAR_ICON}</button>`);
    } else {
      buttons.push(`<button type="button" class="video-upload-btn stills-upload-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Stills hochladen">${UPLOAD_ICON} Upload</button>`);
    }
  }

  if (buttons.length === 0) {
    return `<span class="no-content-placeholder">—</span>`;
  }

  return `<div class="content-cell-actions stills-cell-actions">${buttons.join('')}</div>`;
}

export function renderFinaleVersionCell(koop, video) {
  const canUpload = window.canFeature?.('mediaUpload') ?? false;
  const finals = video.finalAssets || [];
  const stillFinals = finalStills(stillsForVideoCell(koop, video));

  const buttons = finals.map(asset => {
    const label = asset.variant_name || 'Final';
    return `<button type="button" class="external-link-btn media-action-btn finale-play-btn" data-action="play-final" data-video-id="${video.id}" data-kooperation-id="${koop.id}" data-asset-id="${asset.id}" title="Finale Version ${escapeHtml(label)} abspielen">${PLAY_ICON}<span class="finale-variant-label">${escapeHtml(label)}</span></button>`;
  });

  stillFinals.forEach(asset => {
    const label = asset.variant_name || STILL_FINAL_VARIANT;
    // Icon liegt unter dem Bild: laedt das Thumb nicht, entfernt sich das
    // <img> und das Icon bleibt stehen.
    const thumb = canPreviewImageAsset(asset)
      ? `<span class="finale-still-media">${BILDER_ICON}<img class="finale-still-thumb" src="${escapeHtml(toRawDropboxUrl(asset.file_url) || '')}" alt="" loading="lazy" onerror="this.remove()"></span>`
      : BILDER_ICON;
    buttons.push(`<button type="button" class="external-link-btn media-action-btn finale-play-btn finale-still-btn" data-action="play-final-still" data-video-id="${video.id}" data-kooperation-id="${koop.id}" data-asset-id="${asset.id}" title="Finales Still ansehen">${thumb}<span class="finale-variant-label">${escapeHtml(label)}</span></button>`);
  });

  if (canUpload) {
    buttons.push(`<button type="button" class="video-upload-btn finale-upload-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Finale Version hochladen">${UPLOAD_ICON}${finals.length === 0 && stillFinals.length === 0 ? ' Upload' : ''}</button>`);
  }

  if (buttons.length === 0) {
    return `<span class="no-content-placeholder">—</span>`;
  }

  return `<div class="content-cell-actions finale-cell-actions">${buttons.join('')}</div>`;
}
