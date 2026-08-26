import { deleteSingleDropboxFile } from '../../core/VideoDeleteHelper.js';
import {
  escapeHtml,
  getAssetDisplayLabel,
  isExternalAsset,
  isDirectImageUrl,
  FINAL_VARIANTS,
} from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';
import { promoteAssetToFinal, unmarkFinalSlot, markedSlotsForSource } from '../../core/PromoteFinalAsset.js';

const DELETE_ICON = `${icon('trash-alt')}`;

const LINK_ICON = `${icon('external-link')}`;

const STORY_ICON = `${icon('device-phone')}`;

const IMAGE_ICON = `${icon('photo')}`;

const CHEVRON_ICON = `${icon('chevron-down')}`;

export class VideoSettingsDrawer {
  constructor() {
    this.drawerId = 'video-settings-drawer';
    this.videoId = null;
    this.kooperationId = null;
    this.videoUrl = null;
    this.filePath = null;
    this.videoTitel = null;
    this.onReupload = null;
    this.onStorysReupload = null;
    this.onBilderReupload = null;
    this.onDelete = null;
    this._activeTab = 'videos';
    this._expandedRounds = new Set();
  }

  async open({ videoId, kooperationId, videoUrl, filePath, videoTitel, videos, onReupload, onStorysReupload, onBilderReupload, onDelete, onBilderChanged, onFinaleChanged, initialTab = 'videos' }) {
    this.videoId = videoId;
    this.kooperationId = kooperationId;
    this.videoUrl = videoUrl;
    this.filePath = filePath;
    this.videoTitel = videoTitel || 'Video';
    this.videos = (videos || []).slice().sort((a, b) => (a.position || 1) - (b.position || 1));
    this.onReupload = onReupload;
    this.onStorysReupload = onStorysReupload;
    this.onBilderReupload = onBilderReupload;
    this.onDelete = onDelete;
    this.onBilderChanged = onBilderChanged || null;
    this.onFinaleChanged = onFinaleChanged || null;
    this._activeTab = initialTab === 'bilder' ? 'bilder' : (initialTab === 'storys' ? 'storys' : 'videos');
    this._expandedRounds = new Set();
    this.assets = [];
    this.storyAssets = [];
    this.bilderAssets = [];

    this.createDrawer();
    this._renderLoading();

    try {
      const [videoResult, storyResult, bilderResult] = await Promise.allSettled([
        window.supabase
          .from('kooperation_video_asset')
          .select('id, video_id, file_url, file_path, version_number, is_current, is_final, variant_name, source_asset_id, created_at')
          .eq('video_id', this.videoId)
          .order('version_number', { ascending: true }),
        window.supabase
          .from('kooperation_story_asset')
          .select('id, file_url, file_path, file_name, file_size, version_number, is_current, is_final, variant_name, created_at, story_id, kooperation_story(slot_index, slot_name)')
          .eq('video_id', this.videoId)
          .order('version_number', { ascending: true })
          .order('file_name', { ascending: true }),
        this.kooperationId
          ? window.supabase
              .from('kooperation_bilder_asset')
              .select('id, kooperation_id, video_id, file_url, file_path, file_name, file_size, version_number, is_current, is_final, variant_name, source_asset_id, created_at')
              .eq('kooperation_id', this.kooperationId)
              .order('file_name', { ascending: true })
          : Promise.resolve({ data: [] }),
      ]);

      this.assets = videoResult.status === 'fulfilled' ? (videoResult.value.data || []) : [];
      this.storyAssets = storyResult.status === 'fulfilled' ? (storyResult.value.data || []) : [];
      this.bilderAssets = bilderResult.status === 'fulfilled' ? (bilderResult.value.data || []) : [];
    } catch (err) {
      console.warn('Assets konnten nicht geladen werden:', err);
    }

    if (this.assets.length > 0) {
      const maxV = Math.max(...this.assets.map(a => a.version_number));
      this._expandedRounds.add(`video-${maxV}`);
    } else if (this.videoUrl) {
      this._expandedRounds.add('video-legacy');
    }
    if (this.storyAssets.length > 0) {
      const loopStoryAssets = this.storyAssets.filter(a => !a.is_final);
      if (loopStoryAssets.length > 0) {
        const maxV = Math.max(...loopStoryAssets.map(a => a.version_number));
        this._expandedRounds.add(`story-${maxV}`);
      } else {
        this._expandedRounds.add('story-final');
      }
    }

    this.renderContent();
    this.bindEvents();
  }

  _renderLoading() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    body.innerHTML = `
      <div class="video-settings-drawer-content">
        <div class="video-settings-section">
          <div class="skeleton skeleton-text skeleton-text--settings-label"></div>
          <div class="skeleton skeleton-text skeleton-text--settings-input"></div>
        </div>
        <div class="video-settings-section">
          <div class="skeleton skeleton-text skeleton-text--settings-label-sm"></div>
          <div class="skeleton skeleton-text skeleton-text--settings-line-spaced"></div>
          <div class="skeleton skeleton-text skeleton-text--settings-line"></div>
        </div>
      </div>
    `;
  }

  createDrawer() {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    const header = document.createElement('div');
    header.className = 'drawer-header';

    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Content verwalten';

    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = this.videoTitel;

    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);

    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    headerRight.appendChild(closeBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;

    panel.appendChild(header);
    panel.appendChild(body);

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
  }

  // ─── Tab Navigation ─────────────────────────────────────────

  _renderTabNav() {
    const videoCount = this.assets.length;
    const storyCount = this.storyAssets.length;
    const bilderCount = this.bilderAssets.length;
    return `
      <div class="drawer-tab-nav">
        <button type="button" class="drawer-tab-btn ${this._activeTab === 'videos' ? 'active' : ''}" data-settings-tab="videos">Videos${videoCount ? ` (${videoCount})` : ''}</button>
        <button type="button" class="drawer-tab-btn ${this._activeTab === 'storys' ? 'active' : ''}" data-settings-tab="storys">Storys${storyCount ? ` (${storyCount})` : ''}</button>
        <button type="button" class="drawer-tab-btn ${this._activeTab === 'bilder' ? 'active' : ''}" data-settings-tab="bilder">Stills${bilderCount ? ` (${bilderCount})` : ''}</button>
      </div>
    `;
  }

  _switchTab(tabName) {
    this._activeTab = tabName;
    const panel = document.getElementById(this.drawerId);
    panel?.querySelectorAll('.drawer-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.settingsTab === tabName);
    });
    const videosPane = document.getElementById('settings-tab-videos');
    const storysPane = document.getElementById('settings-tab-storys');
    const bilderPane = document.getElementById('settings-tab-bilder');
    if (videosPane) videosPane.style.display = tabName === 'videos' ? '' : 'none';
    if (storysPane) storysPane.style.display = tabName === 'storys' ? '' : 'none';
    if (bilderPane) bilderPane.style.display = tabName === 'bilder' ? '' : 'none';
  }

  _formatUploadDate(createdAt) {
    if (!createdAt) return '–';
    return new Date(createdAt).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  _renderFileLinkBlock(url) {
    if (!url) return '';
    return `
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="video-settings-file-link" title="Link öffnen">
        ${LINK_ICON}
        <span class="video-settings-path">${escapeHtml(url)}</span>
      </a>
    `;
  }

  _renderAssetThumb(url) {
    if (!isDirectImageUrl(url)) return '';
    return `<img src="${escapeHtml(url)}" alt="" class="settings-asset-thumb" loading="lazy" onerror="this.style.display='none'">`;
  }

  _renderExternalBadge(asset) {
    return isExternalAsset(asset)
      ? ' <span class="settings-external-badge">Externer Link</span>'
      : '';
  }

  _getStorySlotLabel(asset) {
    const story = asset.kooperation_story;
    if (!story) return 'Story';
    const name = story.slot_name ? ` · ${story.slot_name}` : '';
    return `Story ${story.slot_index}${name}`;
  }

  _renderAccordionAssetRow(asset, { deleteBtnClass, showSize = false, showThumb = false, promoteKind = null }) {
    const url = asset.file_url || '';
    const label = getAssetDisplayLabel(asset);
    const uploadDate = this._formatUploadDate(asset.created_at);
    const sizeMB = showSize && asset.file_size
      ? `${(asset.file_size / 1024 / 1024).toFixed(1)} MB`
      : '';
    const linkIcon = url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="video-version-link-icon" title="Öffnen">${LINK_ICON}</a>`
      : '<span class="video-version-nofile">–</span>';
    const promoteHtml = this._renderPromoteActions(asset, promoteKind);

    return `
      <div class="settings-accordion-file-row">
        <div class="settings-accordion-file-row-top">
          <span class="settings-file-variant">${escapeHtml(label)}${this._renderExternalBadge(asset)}</span>
          ${sizeMB ? `<span class="settings-file-size">${sizeMB}</span>` : ''}
          <span class="settings-file-date">${uploadDate}</span>
          <span class="settings-file-actions">
            ${promoteHtml}
            ${linkIcon}
            <button type="button" class="${deleteBtnClass}" data-asset-id="${asset.id}" data-file-path="${escapeHtml(asset.file_path || '')}" title="Löschen">${DELETE_ICON}</button>
          </span>
        </div>
        ${url ? this._renderFileLinkBlock(url) : ''}
        ${showThumb ? this._renderAssetThumb(url) : ''}
      </div>
    `;
  }

  _renderPromoteActions(asset, kind) {
    if (!kind || asset.is_final) return '';
    const finals = kind === 'video'
      ? this.assets.filter(a => a.is_final)
      : this.bilderAssets.filter(a => a.is_final && a.video_id === asset.video_id);
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

  _renderLegacyVideoBlock() {
    const url = this.videoUrl || '';
    return `
      <div class="settings-accordion settings-accordion--legacy">
        <div class="settings-accordion-item">
          <button type="button" class="settings-accordion-header expanded" data-accordion="video-legacy">
            <span class="settings-accordion-chevron">${CHEVRON_ICON}</span>
            <span>Legacy-Link</span>
          </button>
          <div class="settings-accordion-body">
            <p class="video-settings-hint">Älterer Content-Link ohne Asset-Eintrag in der Datenbank.</p>
            ${this._renderFileLinkBlock(url)}
          </div>
        </div>
      </div>
    `;
  }

  _groupStoryAssetsBySlot(assets) {
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

  // ─── Videos Tab (Accordion) ────────────────────────────────

  _renderVideosTab() {
    const loopAssets = this.assets.filter(a => !a.is_final);
    const finalAssets = this.assets.filter(a => a.is_final);
    const hasAssets = loopAssets.length > 0;
    const hasLegacy = !hasAssets && !finalAssets.length && !!this.videoUrl;
    const uploadBtnText = hasAssets || hasLegacy
      ? 'Weiteren Video-Content hinzufügen'
      : 'Video-Content hinzufügen';

    let contentHtml;
    if (hasLegacy) {
      contentHtml = this._renderLegacyVideoBlock();
    } else if (!hasAssets && !finalAssets.length) {
      contentHtml = '<p class="video-settings-no-file">Noch kein Video vorhanden</p>';
    } else {
      const grouped = {};
      for (const asset of loopAssets) {
        const v = asset.version_number || 1;
        if (!grouped[v]) grouped[v] = [];
        grouped[v].push(asset);
      }

      const rounds = Object.keys(grouped).map(Number).sort((a, b) => a - b);
      const maxRound = rounds.length > 0 ? Math.max(...rounds) : 0;

      contentHtml = '<div class="settings-accordion">';
      for (const round of rounds) {
        const assets = grouped[round];
        const isCurrent = round === maxRound;
        const isExpanded = this._expandedRounds.has(`video-${round}`);
        const badge = isCurrent ? ' <span class="video-version-current">Aktuell</span>' : '';

        contentHtml += `
          <div class="settings-accordion-item">
            <button type="button" class="settings-accordion-header ${isExpanded ? 'expanded' : ''}" data-accordion="video-${round}">
              <span class="settings-accordion-chevron">${CHEVRON_ICON}</span>
              <span>Feedbackschleife ${round}${badge}</span>
              <span class="settings-accordion-count">${assets.length} Datei${assets.length !== 1 ? 'en' : ''}</span>
            </button>
            <div class="settings-accordion-body" style="${isExpanded ? '' : 'display:none;'}">
        `;

        for (const asset of assets) {
          contentHtml += this._renderAccordionAssetRow(asset, {
            deleteBtnClass: 'video-version-delete-btn',
            promoteKind: 'video',
          });
        }

        contentHtml += `
            </div>
          </div>
        `;
      }

      if (finalAssets.length > 0) {
        const isExpanded = this._expandedRounds.has('video-final');
        contentHtml += `
          <div class="settings-accordion-item">
            <button type="button" class="settings-accordion-header ${isExpanded ? 'expanded' : ''}" data-accordion="video-final">
              <span class="settings-accordion-chevron">${CHEVRON_ICON}</span>
              <span>Finale Version</span>
              <span class="settings-accordion-count">${finalAssets.length} Datei${finalAssets.length !== 1 ? 'en' : ''}</span>
            </button>
            <div class="settings-accordion-body" style="${isExpanded ? '' : 'display:none;'}">
        `;
        for (const asset of finalAssets) {
          contentHtml += this._renderAccordionAssetRow(asset, {
            deleteBtnClass: 'video-version-delete-btn',
          });
        }
        contentHtml += `
            </div>
          </div>
        `;
      }

      contentHtml += '</div>';
    }

    return `
      <div id="settings-tab-videos" style="${this._activeTab !== 'videos' ? 'display:none' : ''}">
        <div class="video-settings-section">
          ${contentHtml}
        </div>
        <div class="video-settings-actions">
          <button type="button" class="mdc-btn mdc-btn--primary" id="video-settings-reupload-btn">
            ${icon('upload')}
            ${uploadBtnText}
          </button>
        </div>
      </div>
    `;
  }

  // ─── Storys Tab (Accordion) ────────────────────────────────

  _renderStorysTab() {
    let contentHtml;

    if (this.storyAssets.length === 0) {
      contentHtml = '<p class="video-settings-no-file">Keine Storys vorhanden</p>';
    } else {
      const loopStoryAssets = this.storyAssets.filter(a => !a.is_final);
      const finalStoryAssets = this.storyAssets.filter(a => a.is_final);

      const grouped = {};
      for (const asset of loopStoryAssets) {
        const v = asset.version_number || 1;
        if (!grouped[v]) grouped[v] = [];
        grouped[v].push(asset);
      }

      const rounds = Object.keys(grouped).map(Number).sort((a, b) => a - b);
      const maxRound = rounds.length > 0 ? Math.max(...rounds) : 0;

      contentHtml = '<div class="settings-accordion">';
      for (const round of rounds) {
        const assets = grouped[round];
        const isCurrent = round === maxRound;
        const isExpanded = this._expandedRounds.has(`story-${round}`);
        const badge = isCurrent ? ' <span class="video-version-current">Aktuell</span>' : '';

        contentHtml += `
          <div class="settings-accordion-item">
            <button type="button" class="settings-accordion-header ${isExpanded ? 'expanded' : ''}" data-accordion="story-${round}">
              <span class="settings-accordion-chevron">${CHEVRON_ICON}</span>
              <span>Feedbackschleife ${round}${badge}</span>
              <span class="settings-accordion-count">${assets.length} Datei${assets.length !== 1 ? 'en' : ''}</span>
            </button>
            <div class="settings-accordion-body" style="${isExpanded ? '' : 'display:none;'}">
        `;

        for (const [, slotAssets] of this._groupStoryAssetsBySlot(assets)) {
          contentHtml += `<div class="settings-story-slot-header">${escapeHtml(this._getStorySlotLabel(slotAssets[0]))}</div>`;
          for (const asset of slotAssets) {
            contentHtml += this._renderAccordionAssetRow(asset, {
              deleteBtnClass: 'story-asset-delete-btn',
              showSize: true,
              showThumb: isDirectImageUrl(asset.file_url),
            });
          }
        }

        contentHtml += `
            </div>
          </div>
        `;
      }

      if (finalStoryAssets.length > 0) {
        const isExpanded = this._expandedRounds.has('story-final');
        contentHtml += `
          <div class="settings-accordion-item">
            <button type="button" class="settings-accordion-header ${isExpanded ? 'expanded' : ''}" data-accordion="story-final">
              <span class="settings-accordion-chevron">${CHEVRON_ICON}</span>
              <span>Finale Version</span>
              <span class="settings-accordion-count">${finalStoryAssets.length} Datei${finalStoryAssets.length !== 1 ? 'en' : ''}</span>
            </button>
            <div class="settings-accordion-body" style="${isExpanded ? '' : 'display:none;'}">
        `;
        for (const [, slotAssets] of this._groupStoryAssetsBySlot(finalStoryAssets)) {
          contentHtml += `<div class="settings-story-slot-header">${escapeHtml(this._getStorySlotLabel(slotAssets[0]))}</div>`;
          for (const asset of slotAssets) {
            contentHtml += this._renderAccordionAssetRow(asset, {
              deleteBtnClass: 'story-asset-delete-btn',
              showSize: true,
              showThumb: isDirectImageUrl(asset.file_url),
            });
          }
        }
        contentHtml += `
            </div>
          </div>
        `;
      }

      contentHtml += '</div>';
    }

    const hasStorys = this.storyAssets.length > 0;
    const storysUploadText = hasStorys ? 'Weiteren Story-Content hinzufügen' : 'Story-Content hinzufügen';

    return `
      <div id="settings-tab-storys" style="${this._activeTab !== 'storys' ? 'display:none' : ''}">
        <div class="video-settings-section">
          ${contentHtml}
        </div>
        <div class="video-settings-actions">
          <button type="button" class="mdc-btn mdc-btn--primary" id="storys-settings-reupload-btn">
            ${STORY_ICON}
            ${storysUploadText}
          </button>
        </div>
      </div>
    `;
  }

  // ─── Bilder Tab ─────────────────────────────────────────────

  _renderBilderTableRow(asset) {
    const url = asset.file_url || '';
    const name = getAssetDisplayLabel(asset);
    const sizeMB = asset.file_size ? `${(asset.file_size / 1024 / 1024).toFixed(1)} MB` : '';
    const linkIcon = url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="video-version-link-icon" title="Öffnen">${LINK_ICON}</a>`
      : '<span class="video-version-nofile">–</span>';
    const uploadDate = this._formatUploadDate(asset.created_at);
    const externalBadge = this._renderExternalBadge(asset);

    const versionLabel = asset.is_final ? 'Finale' : `FS${asset.version_number || 1}`;
    const promoteHtml = asset.is_final ? '' : this._renderPromoteActions(asset, 'still');
    let html = `<tr>
      <td class="settings-asset-name">${escapeHtml(name)} · ${versionLabel}${externalBadge}</td>
      <td>${sizeMB}</td>
      <td class="u-text-center">${linkIcon}</td>
      <td>${uploadDate}</td>
      <td class="u-text-center">
        ${promoteHtml}
        <button type="button" class="bilder-asset-delete-btn" data-asset-id="${asset.id}" data-file-path="${escapeHtml(asset.file_path || '')}" title="Löschen">${DELETE_ICON}</button>
      </td>
    </tr>`;

    if (url) {
      html += `<tr class="settings-asset-url-row">
        <td colspan="5">
          ${this._renderFileLinkBlock(url)}
          ${this._renderAssetThumb(url)}
        </td>
      </tr>`;
    }

    return html;
  }

  _renderBilderTab() {
    let contentHtml;

    if (this.bilderAssets.length === 0) {
      contentHtml = '<p class="video-settings-no-file">Keine Bilder vorhanden</p>';
    } else {
      // Nach Video gruppieren (wie im Upload-Drawer); Altbilder ohne video_id
      // landen unter "Nicht zugeordnet".
      const videos = this.videos || [];
      const videoLabel = v => `Video ${v.position || 1}${v.thema ? ` – ${v.thema}` : ''}`;
      let rows = '';

      if (videos.length === 0) {
        rows = this.bilderAssets.map(asset => this._renderBilderTableRow(asset)).join('');
      } else {
        const groups = [];
        for (const v of videos) {
          const assets = this.bilderAssets.filter(a => a.video_id === v.id);
          if (assets.length) groups.push({ label: videoLabel(v), assets });
        }
        const unassigned = this.bilderAssets.filter(a => !a.video_id || !videos.some(v => v.id === a.video_id));
        if (unassigned.length) groups.push({ label: 'Nicht zugeordnet', assets: unassigned });

        rows = groups.map(g => `
          <tr class="settings-bilder-group-row"><td colspan="5">${escapeHtml(g.label)}</td></tr>
          ${g.assets.map(asset => this._renderBilderTableRow(asset)).join('')}
        `).join('');
      }

      contentHtml = `
        <table class="data-table video-versions-table">
          <thead><tr><th>Datei</th><th>Größe</th><th>Link</th><th>Upload</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }

    const hasBilder = this.bilderAssets.length > 0;
    const bilderUploadText = hasBilder ? 'Weiteren Bild-Content hinzufügen' : 'Bild-Content hinzufügen';

    return `
      <div id="settings-tab-bilder" style="${this._activeTab !== 'bilder' ? 'display:none' : ''}">
        <div class="video-settings-section">
          ${contentHtml}
        </div>
        <div class="video-settings-actions">
          <button type="button" class="mdc-btn mdc-btn--primary" id="bilder-settings-reupload-btn">
            ${IMAGE_ICON}
            ${bilderUploadText}
          </button>
        </div>
      </div>
    `;
  }

  // ─── Main Render ────────────────────────────────────────────

  renderContent() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    body.innerHTML = `
      <div class="video-settings-drawer-content">
        ${this._renderTabNav()}
        ${this._renderVideosTab()}
        ${this._renderStorysTab()}
        ${this._renderBilderTab()}
        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" id="video-settings-close-btn">Schließen</button>
        </div>
      </div>
    `;
  }

  // ─── Events ─────────────────────────────────────────────────

  bindEvents() {
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    const closeBtn = panel?.querySelector('.drawer-close-btn');
    const closeBtnFooter = document.getElementById('video-settings-close-btn');
    const reuploadBtn = document.getElementById('video-settings-reupload-btn');

    overlay?.addEventListener('click', () => this.close());
    closeBtn?.addEventListener('click', () => this.close());
    closeBtnFooter?.addEventListener('click', () => this.close());

    panel?.querySelectorAll('.drawer-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.settingsTab));
    });

    // Accordion toggle
    panel?.querySelectorAll('.settings-accordion-header').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.accordion;
        const body = btn.nextElementSibling;
        const isExpanded = btn.classList.contains('expanded');

        if (isExpanded) {
          btn.classList.remove('expanded');
          if (body) body.style.display = 'none';
          this._expandedRounds.delete(key);
        } else {
          btn.classList.add('expanded');
          if (body) body.style.display = '';
          this._expandedRounds.add(key);
        }
      });
    });

    reuploadBtn?.addEventListener('click', () => {
      this.close();
      if (typeof this.onReupload === 'function') {
        setTimeout(() => this.onReupload(), 350);
      }
    });

    const storysReuploadBtn = document.getElementById('storys-settings-reupload-btn');
    storysReuploadBtn?.addEventListener('click', () => {
      this.close();
      if (typeof this.onStorysReupload === 'function') {
        setTimeout(() => this.onStorysReupload(), 350);
      }
    });

    const bilderReuploadBtn = document.getElementById('bilder-settings-reupload-btn');
    bilderReuploadBtn?.addEventListener('click', () => {
      this.close();
      if (typeof this.onBilderReupload === 'function') {
        setTimeout(() => this.onBilderReupload(), 350);
      }
    });

    panel?.querySelectorAll('.promote-final-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const kind = btn.dataset.kind;
        const assetId = btn.dataset.assetId;
        const slot = btn.dataset.slot;
        const unmark = btn.dataset.unmark === '1';
        const source = kind === 'still'
          ? {
              ...this.bilderAssets.find(a => a.id === assetId),
              video_id: (this.bilderAssets.find(a => a.id === assetId)?.video_id) || this.videoId,
              kooperation_id: (this.bilderAssets.find(a => a.id === assetId)?.kooperation_id) || this.kooperationId,
            }
          : {
              ...this.assets.find(a => a.id === assetId),
              video_id: (this.assets.find(a => a.id === assetId)?.video_id) || this.videoId,
            };
        if (!source?.id) return;
        btn.disabled = true;
        try {
          if (unmark) {
            await unmarkFinalSlot(kind, source.video_id || this.videoId, slot || undefined);
          } else {
            await promoteAssetToFinal(kind, source, slot);
          }
          this.onFinaleChanged?.();
          this.onBilderChanged?.();
          await this.open({
            videoId: this.videoId,
            kooperationId: this.kooperationId,
            videoUrl: this.videoUrl,
            filePath: this.filePath,
            videoTitel: this.videoTitel,
            videos: this.videos,
            onReupload: this.onReupload,
            onStorysReupload: this.onStorysReupload,
            onBilderReupload: this.onBilderReupload,
            onDelete: this.onDelete,
            onBilderChanged: this.onBilderChanged,
            onFinaleChanged: this.onFinaleChanged,
            initialTab: this._activeTab,
          });
        } catch (err) {
          alert('Markieren fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler'));
          btn.disabled = false;
        }
      });
    });

    // Video version delete
    document.querySelectorAll('.video-version-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const assetId = btn.dataset.assetId;
        const fp = btn.dataset.filePath || '';
        if (!confirm('Diese Datei wirklich löschen?')) return;

        btn.disabled = true;
        try {
          if (fp) {
            await deleteSingleDropboxFile(fp).catch(err =>
              console.warn('Dropbox-Löschung fehlgeschlagen:', err)
            );
          }

          const { error } = await window.supabase
            .from('kooperation_video_asset')
            .delete()
            .eq('id', assetId);
          if (error) throw error;

          this.assets = this.assets.filter(a => a.id !== assetId);

          if (typeof this.onDelete === 'function') {
            await this.onDelete();
          }

          this.renderContent();
          this.bindEvents();
        } catch (err) {
          alert('Löschen fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler'));
          btn.disabled = false;
        }
      });
    });

    // Story asset delete
    document.querySelectorAll('.story-asset-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const assetId = btn.dataset.assetId;
        const fp = btn.dataset.filePath || '';
        if (!confirm('Diese Story-Datei wirklich löschen?')) return;

        btn.disabled = true;
        try {
          if (fp) {
            await fetch('/.netlify/functions/dropbox-delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath: fp }),
            }).catch(err => console.warn('Dropbox-Löschung fehlgeschlagen:', err));
          }

          await window.supabase.from('kooperation_story_asset').delete().eq('id', assetId);
          this.storyAssets = this.storyAssets.filter(a => a.id !== assetId);

          this.renderContent();
          this.bindEvents();
        } catch (err) {
          alert('Löschen fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler'));
          btn.disabled = false;
        }
      });
    });

    // Bilder asset delete
    document.querySelectorAll('.bilder-asset-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const assetId = btn.dataset.assetId;
        const fp = btn.dataset.filePath || '';
        if (!confirm('Dieses Bild wirklich löschen?')) return;

        btn.disabled = true;
        try {
          if (fp) {
            await fetch('/.netlify/functions/dropbox-delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath: fp }),
            }).catch(err => console.warn('Dropbox-Löschung fehlgeschlagen:', err));
          }

          await window.supabase.from('kooperation_bilder_asset').delete().eq('id', assetId);
          this.bilderAssets = this.bilderAssets.filter(a => a.id !== assetId);

          this.onBilderChanged?.();
          this.renderContent();
          this.bindEvents();
        } catch (err) {
          alert('Löschen fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler'));
          btn.disabled = false;
        }
      });
    });
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    panel?.classList.remove('show');
    setTimeout(() => this.removeDrawer(), 300);
  }

  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }
}
