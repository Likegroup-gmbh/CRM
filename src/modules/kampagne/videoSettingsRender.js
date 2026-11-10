// videoSettingsRender.js
// HTML der Tabs im VideoSettingsDrawer (Videos, Storys, Stills). Reine Funktionen, die den
// Drawer-Zustand `d` lesen (assets, storyAssets, bilderAssets, _expandedRounds, _activeTab).

import {
  escapeHtml,
  getAssetDisplayLabel,
  isExternalAsset,
  isDirectImageUrl,
  toRawDropboxUrl,
  FINAL_VARIANTS,
} from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';
import { markedSlotsForSource } from '../../core/PromoteFinalAsset.js';

const DELETE_ICON = `${icon('trash-alt')}`;
const LINK_ICON = `${icon('external-link')}`;
const STORY_ICON = `${icon('device-phone')}`;
const IMAGE_ICON = `${icon('photo')}`;
const CHEVRON_ICON = `${icon('chevron-down')}`;

// ─── Bausteine ──────────────────────────────────────────────

function formatUploadDate(createdAt) {
  if (!createdAt) return '–';
  return new Date(createdAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const formatSize = (bytes) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '');

function fileLinkBlock(url) {
  if (!url) return '';
  return `
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="video-settings-file-link" title="Link öffnen">
      ${LINK_ICON}
      <span class="video-settings-path">${escapeHtml(url)}</span>
    </a>
  `;
}

function linkIcon(url) {
  return url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="video-version-link-icon" title="Öffnen">${LINK_ICON}</a>`
    : '<span class="video-version-nofile">–</span>';
}

function assetThumb(url) {
  if (!isDirectImageUrl(url)) return '';
  return `<img src="${escapeHtml(toRawDropboxUrl(url))}" alt="" class="settings-asset-thumb" loading="lazy" onerror="this.style.display='none'">`;
}

function externalBadge(asset) {
  return isExternalAsset(asset)
    ? ' <span class="settings-external-badge">Externer Link</span>'
    : '';
}

function deleteButton(cls, asset) {
  return `<button type="button" class="${cls}" data-asset-id="${asset.id}" data-file-path="${escapeHtml(asset.file_path || '')}" title="Löschen">${DELETE_ICON}</button>`;
}

function storySlotLabel(asset) {
  const story = asset.kooperation_story;
  if (!story) return 'Story';
  const name = story.slot_name ? ` · ${story.slot_name}` : '';
  return `Story ${story.slot_index}${name}`;
}

function promoteActions(d, asset, kind) {
  if (!kind || asset.is_final) return '';
  const finals = kind === 'video'
    ? d.assets.filter(a => a.is_final)
    : d.bilderAssets.filter(a => a.is_final && a.video_id === asset.video_id);
  const marked = markedSlotsForSource(finals, asset.id);
  if (kind === 'still') {
    const isMarked = marked.length > 0 || finals.some(f => f.source_asset_id === asset.id);
    return isMarked
      ? `<button type="button" class="promote-final-btn" data-kind="still" data-asset-id="${asset.id}" data-unmark="1" title="Finale Version aufheben">Final aufheben</button>`
      : `<button type="button" class="promote-final-btn" data-kind="still" data-asset-id="${asset.id}" title="Als finale Version auswählen">Als final</button>`;
  }
  const buttons = FINAL_VARIANTS.map(slot => {
    const on = marked.includes(slot);
    const title = on
      ? `Finale Version ${slot} aufheben`
      : `Als finale Version auswählen (${slot})`;
    return `<button type="button" class="promote-final-btn${on ? ' is-active' : ''}" data-kind="video" data-asset-id="${asset.id}" data-slot="${slot}" title="${title}" ${on ? 'data-unmark="1"' : ''}>${on ? `Final ${slot} ✓` : slot}</button>`;
  }).join('');
  return `<span class="promote-final-group"><span class="promote-final-label">Finale Version</span>${buttons}</span>`;
}

function accordionAssetRow(d, asset, { deleteBtnClass, showSize = false, showThumb = false, promoteKind = null }) {
  const url = asset.file_url || '';
  const sizeMB = showSize ? formatSize(asset.file_size) : '';
  return `
    <div class="settings-accordion-file-row">
      <div class="settings-accordion-file-row-top">
        <span class="settings-file-variant">${escapeHtml(getAssetDisplayLabel(asset))}${externalBadge(asset)}</span>
        ${sizeMB ? `<span class="settings-file-size">${sizeMB}</span>` : ''}
        <span class="settings-file-date">${formatUploadDate(asset.created_at)}</span>
        <span class="settings-file-actions">
          ${promoteActions(d, asset, promoteKind)}
          ${linkIcon(url)}
          ${deleteButton(deleteBtnClass, asset)}
        </span>
      </div>
      ${url ? fileLinkBlock(url) : ''}
      ${showThumb ? assetThumb(url) : ''}
    </div>
  `;
}

function accordionItem({ key, title, count, expanded, body }) {
  return `
    <div class="settings-accordion-item">
      <button type="button" class="settings-accordion-header ${expanded ? 'expanded' : ''}" data-accordion="${key}">
        <span class="settings-accordion-chevron">${CHEVRON_ICON}</span>
        <span>${title}</span>
        <span class="settings-accordion-count">${count} Datei${count !== 1 ? 'en' : ''}</span>
      </button>
      <div class="settings-accordion-body" style="${expanded ? '' : 'display:none;'}">
        ${body}
      </div>
    </div>
  `;
}

/** Ein Accordion-Eintrag je Feedbackschleife; die jüngste trägt das Badge "Aktuell". */
function roundItems(d, prefix, assets, renderBody) {
  const grouped = {};
  for (const asset of assets) {
    const v = asset.version_number || 1;
    if (!grouped[v]) grouped[v] = [];
    grouped[v].push(asset);
  }
  const rounds = Object.keys(grouped).map(Number).sort((a, b) => a - b);
  const maxRound = rounds.length > 0 ? Math.max(...rounds) : 0;
  return rounds.map(round => accordionItem({
    key: `${prefix}-${round}`,
    title: `Feedbackschleife ${round}${round === maxRound ? ' <span class="video-version-current">Aktuell</span>' : ''}`,
    count: grouped[round].length,
    expanded: d._expandedRounds.has(`${prefix}-${round}`),
    body: renderBody(grouped[round]),
  })).join('');
}

function finalItem(d, prefix, assets, renderBody) {
  if (!assets.length) return '';
  return accordionItem({
    key: `${prefix}-final`,
    title: 'Finale Version',
    count: assets.length,
    expanded: d._expandedRounds.has(`${prefix}-final`),
    body: renderBody(assets),
  });
}

function tabPane(d, tab, contentHtml, actionsHtml) {
  return `
    <div id="settings-tab-${tab}" style="${d._activeTab !== tab ? 'display:none' : ''}">
      <div class="video-settings-section">
        ${contentHtml}
      </div>
      <div class="video-settings-actions">
        ${actionsHtml}
      </div>
    </div>
  `;
}

// ─── Tab-Navigation ─────────────────────────────────────────

export function renderTabNav(d) {
  const tabBtn = (tab, label, count) =>
    `<button type="button" class="drawer-tab-btn ${d._activeTab === tab ? 'active' : ''}" data-settings-tab="${tab}">${label}${count ? ` (${count})` : ''}</button>`;
  return `
    <div class="drawer-tab-nav">
      ${tabBtn('videos', 'Videos', d.assets.length)}
      ${tabBtn('storys', 'Storys', d.storyAssets.length)}
      ${tabBtn('bilder', 'Stills', d.bilderAssets.length)}
    </div>
  `;
}

// ─── Videos ─────────────────────────────────────────────────

function legacyVideoBlock(url) {
  return `
    <div class="settings-accordion settings-accordion--legacy">
      <div class="settings-accordion-item">
        <button type="button" class="settings-accordion-header expanded" data-accordion="video-legacy">
          <span class="settings-accordion-chevron">${CHEVRON_ICON}</span>
          <span>Legacy-Link</span>
        </button>
        <div class="settings-accordion-body">
          <p class="video-settings-hint">Älterer Content-Link ohne Asset-Eintrag in der Datenbank.</p>
          ${fileLinkBlock(url)}
        </div>
      </div>
    </div>
  `;
}

export function renderVideosTab(d) {
  const loopAssets = d.assets.filter(a => !a.is_final);
  const finalAssets = d.assets.filter(a => a.is_final);
  const hasAssets = loopAssets.length > 0;
  const hasLegacy = !hasAssets && !finalAssets.length && !!d.videoUrl;
  const uploadBtnText = hasAssets || hasLegacy
    ? 'Weiteren Video-Content hinzufügen'
    : 'Video-Content hinzufügen';

  let contentHtml;
  if (hasLegacy) {
    contentHtml = legacyVideoBlock(d.videoUrl || '');
  } else if (!hasAssets && !finalAssets.length) {
    contentHtml = d.folderUrl ? '' : '<p class="video-settings-no-file">Noch kein Video vorhanden</p>';
  } else {
    const rows = (promoteKind) => (assets) => assets
      .map(asset => accordionAssetRow(d, asset, { deleteBtnClass: 'video-version-delete-btn', promoteKind }))
      .join('');
    contentHtml = `<div class="settings-accordion">
      ${roundItems(d, 'video', loopAssets, rows('video'))}
      ${finalItem(d, 'video', finalAssets, rows(null))}
    </div>`;
  }

  const folderHtml = d.folderUrl ? `
    <div class="video-settings-folder">
      <span class="existing-images-title">Geteilter Ordner</span>
      ${fileLinkBlock(d.folderUrl)}
    </div>
  ` : '';

  const removeFolderBtn = d.folderUrl
    ? '<button type="button" class="mdc-btn mdc-btn--danger" id="video-settings-folder-remove">Ordner entfernen</button>'
    : '';

  return tabPane(d, 'videos', `${folderHtml}${contentHtml}`, `
    <button type="button" class="mdc-btn mdc-btn--primary" id="video-settings-reupload-btn">
      ${icon('upload')}
      ${uploadBtnText}
    </button>
    ${removeFolderBtn}
  `);
}

// ─── Storys ─────────────────────────────────────────────────

function groupStoryAssetsBySlot(assets) {
  const bySlot = {};
  for (const asset of assets) {
    const key = asset.story_id || '__unknown__';
    if (!bySlot[key]) bySlot[key] = [];
    bySlot[key].push(asset);
  }
  return Object.entries(bySlot).sort(([, a], [, b]) => {
    const idxA = a[0]?.kooperation_story?.slot_index ?? 999;
    const idxB = b[0]?.kooperation_story?.slot_index ?? 999;
    return idxA - idxB;
  });
}

function storySlotRows(d, assets) {
  return groupStoryAssetsBySlot(assets).map(([, slotAssets]) => `
    <div class="settings-story-slot-header">${escapeHtml(storySlotLabel(slotAssets[0]))}</div>
    ${slotAssets.map(asset => accordionAssetRow(d, asset, {
      deleteBtnClass: 'story-asset-delete-btn',
      showSize: true,
      showThumb: isDirectImageUrl(asset.file_url),
    })).join('')}
  `).join('');
}

export function renderStorysTab(d) {
  const hasStorys = d.storyAssets.length > 0;
  const rows = (assets) => storySlotRows(d, assets);
  const contentHtml = hasStorys
    ? `<div class="settings-accordion">
        ${roundItems(d, 'story', d.storyAssets.filter(a => !a.is_final), rows)}
        ${finalItem(d, 'story', d.storyAssets.filter(a => a.is_final), rows)}
      </div>`
    : '<p class="video-settings-no-file">Keine Storys vorhanden</p>';

  return tabPane(d, 'storys', contentHtml, `
    <button type="button" class="mdc-btn mdc-btn--primary" id="storys-settings-reupload-btn">
      ${STORY_ICON}
      ${hasStorys ? 'Weiteren Story-Content hinzufügen' : 'Story-Content hinzufügen'}
    </button>
  `);
}

// ─── Stills ─────────────────────────────────────────────────

function bilderTableRow(d, asset) {
  const url = asset.file_url || '';
  const versionLabel = asset.is_final ? 'Finale' : `FS${asset.version_number || 1}`;
  const promoteHtml = asset.is_final ? '' : promoteActions(d, asset, 'still');
  let html = `<tr>
    <td class="settings-asset-name">${escapeHtml(getAssetDisplayLabel(asset))} · ${versionLabel}${externalBadge(asset)}</td>
    <td>${formatSize(asset.file_size)}</td>
    <td class="u-text-center">${linkIcon(url)}</td>
    <td>${formatUploadDate(asset.created_at)}</td>
    <td class="u-text-center">
      ${promoteHtml}
      ${deleteButton('bilder-asset-delete-btn', asset)}
    </td>
  </tr>`;

  if (url) {
    html += `<tr class="settings-asset-url-row">
      <td colspan="5">
        ${fileLinkBlock(url)}
        ${assetThumb(url)}
      </td>
    </tr>`;
  }

  return html;
}

/** Nach Video gruppiert (wie im Upload-Drawer); Altbilder ohne video_id landen unter "Nicht zugeordnet". */
function bilderRows(d) {
  const videos = d.videos || [];
  if (videos.length === 0) return d.bilderAssets.map(asset => bilderTableRow(d, asset)).join('');

  const videoLabel = v => `Video ${v.position || 1}${v.thema ? ` – ${v.thema}` : ''}`;
  const groups = [];
  for (const v of videos) {
    const assets = d.bilderAssets.filter(a => a.video_id === v.id);
    if (assets.length) groups.push({ label: videoLabel(v), assets });
  }
  const unassigned = d.bilderAssets.filter(a => !a.video_id || !videos.some(v => v.id === a.video_id));
  if (unassigned.length) groups.push({ label: 'Nicht zugeordnet', assets: unassigned });

  return groups.map(g => `
    <tr class="settings-bilder-group-row"><td colspan="5">${escapeHtml(g.label)}</td></tr>
    ${g.assets.map(asset => bilderTableRow(d, asset)).join('')}
  `).join('');
}

export function renderBilderTab(d) {
  const hasBilder = d.bilderAssets.length > 0;
  const contentHtml = hasBilder
    ? `
      <table class="data-table video-versions-table">
        <thead><tr><th>Datei</th><th>Größe</th><th>Link</th><th>Upload</th><th></th></tr></thead>
        <tbody>${bilderRows(d)}</tbody>
      </table>`
    : '<p class="video-settings-no-file">Keine Bilder vorhanden</p>';

  return tabPane(d, 'bilder', contentHtml, `
    <button type="button" class="mdc-btn mdc-btn--primary" id="bilder-settings-reupload-btn">
      ${IMAGE_ICON}
      ${hasBilder ? 'Weiteren Bild-Content hinzufügen' : 'Bild-Content hinzufügen'}
    </button>
  `);
}
