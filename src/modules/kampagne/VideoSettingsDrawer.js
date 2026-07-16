import { deleteSingleDropboxFile } from '../../core/VideoDeleteHelper.js';
import {
  escapeHtml,
  getAssetDisplayLabel,
  isExternalAsset,
  isDirectImageUrl,
} from '../../core/VideoUploadUtils.js';

const DELETE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="15" height="15">
  <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
</svg>`;

const LINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
</svg>`;

const STORY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`;

const IMAGE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"/></svg>`;

const CHEVRON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>`;

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

  async open({ videoId, kooperationId, videoUrl, filePath, videoTitel, videos, onReupload, onStorysReupload, onBilderReupload, onDelete, onBilderChanged }) {
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
    this._activeTab = 'videos';
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
          .select('id, file_url, file_path, version_number, is_current, is_final, variant_name, created_at')
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
              .select('id, video_id, file_url, file_path, file_name, file_size, created_at')
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
          <div class="skeleton skeleton-text" style="max-width:80px;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-text" style="max-width:100%;height:36px;"></div>
        </div>
        <div class="video-settings-section">
          <div class="skeleton skeleton-text" style="max-width:60px;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-text" style="max-width:100%;height:20px;margin-bottom:6px;"></div>
          <div class="skeleton skeleton-text" style="max-width:100%;height:20px;"></div>
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
        <button type="button" class="drawer-tab-btn ${this._activeTab === 'bilder' ? 'active' : ''}" data-settings-tab="bilder">Bilder${bilderCount ? ` (${bilderCount})` : ''}</button>
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

  _renderAccordionAssetRow(asset, { deleteBtnClass, showSize = false, showThumb = false }) {
    const url = asset.file_url || '';
    const label = getAssetDisplayLabel(asset);
    const uploadDate = this._formatUploadDate(asset.created_at);
    const sizeMB = showSize && asset.file_size
      ? `${(asset.file_size / 1024 / 1024).toFixed(1)} MB`
      : '';
    const linkIcon = url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="video-version-link-icon" title="Öffnen">${LINK_ICON}</a>`
      : '<span class="video-version-nofile">–</span>';

    return `
      <div class="settings-accordion-file-row">
        <div class="settings-accordion-file-row-top">
          <span class="settings-file-variant">${escapeHtml(label)}${this._renderExternalBadge(asset)}</span>
          ${sizeMB ? `<span class="settings-file-size">${sizeMB}</span>` : ''}
          <span class="settings-file-date">${uploadDate}</span>
          <span class="settings-file-actions">
            ${linkIcon}
            <button type="button" class="${deleteBtnClass}" data-asset-id="${asset.id}" data-file-path="${escapeHtml(asset.file_path || '')}" title="Löschen">${DELETE_ICON}</button>
          </span>
        </div>
        ${url ? this._renderFileLinkBlock(url) : ''}
        ${showThumb ? this._renderAssetThumb(url) : ''}
      </div>
    `;
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
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
            </svg>
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

    let html = `<tr>
      <td class="settings-asset-name">${escapeHtml(name)}${externalBadge}</td>
      <td>${sizeMB}</td>
      <td style="text-align:center;">${linkIcon}</td>
      <td>${uploadDate}</td>
      <td style="text-align:center;">
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
        <div class="drawer-footer" style="padding:16px 0 0;">
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
