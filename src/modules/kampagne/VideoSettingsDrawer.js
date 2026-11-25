import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
import { renderBilderTab, renderStorysTab, renderTabNav, renderVideosTab } from './videoSettingsRender.js';
import { bindSettingsEvents } from './videoSettingsEvents.js';
import { mitAblage } from '../../core/ablage/ablageLink.js';

const VIDEO_ASSET_COLUMNS = mitAblage('id, video_id, file_url, file_path, version_number, is_current, is_final, variant_name, source_asset_id, created_at');
const STORY_ASSET_COLUMNS = `${mitAblage('id, file_url, file_path, file_name, file_size, version_number, is_current, is_final, variant_name, created_at, story_id')}, kooperation_story(slot_index, slot_name)`;
const BILDER_ASSET_COLUMNS = mitAblage('id, kooperation_id, video_id, file_url, file_path, file_name, file_size, version_number, is_current, is_final, variant_name, source_asset_id, created_at');

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

  async open({ videoId, kooperationId, videoUrl, filePath, videoTitel, folderUrl, videos, onReupload, onStorysReupload, onBilderReupload, onDelete, onBilderChanged, onFinaleChanged, onFolderCleared, initialTab = 'videos' }) {
    this.videoId = videoId;
    this.kooperationId = kooperationId;
    this.videoUrl = videoUrl;
    this.filePath = filePath;
    this.videoTitel = videoTitel || 'Video';
    this.folderUrl = folderUrl || '';
    this.videos = (videos || []).slice().sort((a, b) => (a.position || 1) - (b.position || 1));
    this.onReupload = onReupload;
    this.onStorysReupload = onStorysReupload;
    this.onBilderReupload = onBilderReupload;
    this.onDelete = onDelete;
    this.onBilderChanged = onBilderChanged || null;
    this.onFinaleChanged = onFinaleChanged || null;
    this.onFolderCleared = onFolderCleared || null;
    this._activeTab = initialTab === 'bilder' ? 'bilder' : (initialTab === 'storys' ? 'storys' : 'videos');
    this._expandedRounds = new Set();
    this.assets = [];
    this.storyAssets = [];
    this.bilderAssets = [];

    this.createDrawer();
    this._renderLoading();
    await this._loadAssets();
    this._expandCurrentRounds();

    this.renderContent();
    this.bindEvents();
  }

  async _loadAssets() {
    try {
      const [videoResult, storyResult, bilderResult] = await Promise.allSettled([
        window.supabase
          .from('kooperation_video_asset')
          .select(VIDEO_ASSET_COLUMNS)
          .eq('video_id', this.videoId)
          .order('version_number', { ascending: true }),
        window.supabase
          .from('kooperation_story_asset')
          .select(STORY_ASSET_COLUMNS)
          .eq('video_id', this.videoId)
          .order('version_number', { ascending: true })
          .order('file_name', { ascending: true }),
        this.kooperationId
          ? window.supabase
              .from('kooperation_bilder_asset')
              .select(BILDER_ASSET_COLUMNS)
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
  }

  /** Die jüngste Feedbackschleife ist beim Öffnen aufgeklappt. */
  _expandCurrentRounds() {
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

  _switchTab(tabName) {
    this._activeTab = tabName;
    const panel = document.getElementById(this.drawerId);
    panel?.querySelectorAll('.drawer-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.settingsTab === tabName);
    });
    for (const tab of ['videos', 'storys', 'bilder']) {
      const pane = document.getElementById(`settings-tab-${tab}`);
      if (pane) pane.style.display = tabName === tab ? '' : 'none';
    }
  }

  renderContent() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    body.innerHTML = `
      <div class="video-settings-drawer-content">
        ${renderTabNav(this)}
        ${renderVideosTab(this)}
        ${renderStorysTab(this)}
        ${renderBilderTab(this)}
        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" id="video-settings-close-btn">Schließen</button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    bindSettingsEvents(this);
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    panel?.classList.remove('show');
    setTimeout(() => this.removeDrawer(), DRAWER_EXIT_MS);
  }

  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }
}
