import { MAX_VERSIONS } from '../../core/VideoUploadUtils.js';
import { VideoTabHandler } from './VideoTabHandler.js';
import { StorysTabHandler } from './StorysTabHandler.js';
import { BilderTabHandler } from './BilderTabHandler.js';

export class VideoUploadDrawer {
  constructor() {
    this.drawerId = 'video-upload-drawer';
    this.videoId = null;
    this.kooperationId = null;
    this.metadaten = null;
    this.onSuccess = null;
    this.onBilderSuccess = null;
    this.onStorysSuccess = null;

    this._activeTab = 'video';

    this.videoTab = new VideoTabHandler(this);
    this.storysTab = new StorysTabHandler(this);
    this.bilderTab = new BilderTabHandler(this);
  }

  /**
   * @param {string} videoId
   * @param {object} metadaten
   * @param {function} onSuccess
   * @param {function} [onBilderSuccess]
   * @param {function} [onStorysSuccess]
   */
  async open(videoId, metadaten, onSuccess, onBilderSuccess, onStorysSuccess) {
    this.videoId = videoId;
    this.kooperationId = metadaten.kooperationId;
    this.metadaten = metadaten;
    this.onSuccess = onSuccess;
    this.onBilderSuccess = onBilderSuccess || null;
    this.onStorysSuccess = onStorysSuccess || null;
    this._activeTab = 'video';

    this.videoTab.reset();
    this.storysTab.reset();
    this.bilderTab.reset();

    // Show drawer immediately for perceived performance, then load data
    this.createDrawer();
    this.renderForm();
    this.bindEvents();

    // Only load video versions upfront (the active tab).
    // Storys + Bilder load lazily on tab switch.
    await this.videoTab.init();

    // Re-render just the version dropdown after data arrives
    this._refreshVideoVersionDropdown();
  }

  _refreshVideoVersionDropdown() {
    const select = document.getElementById('video-upload-version');
    if (!select) return;
    const allVersions = Array.from({ length: MAX_VERSIONS }, (_, i) => i + 1);
    select.innerHTML = allVersions.map(v => {
      const exists = !this.videoTab._availableVersions.includes(v);
      const label = exists ? `Version ${v} (ersetzen)` : `Version ${v}`;
      const selected = v === this.videoTab._selectedVersion ? ' selected' : '';
      return `<option value="${v}"${selected}>${label}</option>`;
    }).join('');
  }

  // ─── Drawer Shell ──────────────────────────────────────────

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
    title.textContent = 'Datei hochladen';
    headerLeft.appendChild(title);

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

  // ─── Tab Navigation ────────────────────────────────────────

  _renderTabNav() {
    return `
      <div class="drawer-tab-nav">
        <button type="button" class="drawer-tab-btn ${this._activeTab === 'video' ? 'active' : ''}" data-drawer-tab="video">Video</button>
        <button type="button" class="drawer-tab-btn ${this._activeTab === 'storys' ? 'active' : ''}" data-drawer-tab="storys">Storys</button>
        <button type="button" class="drawer-tab-btn ${this._activeTab === 'bilder' ? 'active' : ''}" data-drawer-tab="bilder">Bilder</button>
      </div>
    `;
  }

  _switchTab(tabName) {
    if (this.isAnyUploadActive()) return;
    this._activeTab = tabName;

    const panel = document.getElementById(this.drawerId);
    panel?.querySelectorAll('.drawer-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.drawerTab === tabName);
    });

    const videoPane = document.getElementById('upload-tab-video');
    const storysPane = document.getElementById('upload-tab-storys');
    const bilderPane = document.getElementById('upload-tab-bilder');
    if (videoPane) videoPane.style.display = tabName === 'video' ? '' : 'none';
    if (storysPane) storysPane.style.display = tabName === 'storys' ? '' : 'none';
    if (bilderPane) bilderPane.style.display = tabName === 'bilder' ? '' : 'none';

    if (tabName === 'bilder') {
      this.bilderTab.ensureInitialized();
    }
    if (tabName === 'storys') {
      this.storysTab.ensureInitialized().then(() => {
        this.storysTab._refreshStoryVersionDropdown();
        this.storysTab._loadExistingStorys();
      });
    }
  }

  // ─── Main Render ───────────────────────────────────────────

  renderForm() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    body.innerHTML = `
      ${this._renderTabNav()}
      ${this.videoTab.renderTab(this._activeTab)}
      ${this.storysTab.renderTab(this._activeTab)}
      ${this.bilderTab.renderTab(this._activeTab)}
    `;
  }

  // ─── Event Binding ─────────────────────────────────────────

  bindEvents() {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const closeBtn = panel?.querySelector('.drawer-close-btn');

    overlay?.addEventListener('click', () => this.close());
    closeBtn?.addEventListener('click', () => this.close());

    panel?.querySelectorAll('.drawer-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.drawerTab));
    });

    this.videoTab.bindEvents(panel);
    this.storysTab.bindEvents(panel);
    this.bilderTab.bindEvents(panel);
  }

  // ─── Shared State ──────────────────────────────────────────

  isAnyUploadActive() {
    return this.videoTab.isUploading || this.storysTab.isUploading || this.bilderTab.isUploading;
  }

  // ─── Proxy methods for backwards compatibility (tests) ────

  saveAssetVersion(...args) {
    return this.videoTab.saveAssetVersion(...args);
  }

  _updateSubmitButtonState() {
    return this.videoTab._updateSubmitButtonState();
  }

  // ─── Close / Cleanup ──────────────────────────────────────

  close() {
    if (this.isAnyUploadActive()) return;

    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);

    panel?.classList.remove('show');

    setTimeout(() => this.removeDrawer(), 300);
  }

  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }
}
