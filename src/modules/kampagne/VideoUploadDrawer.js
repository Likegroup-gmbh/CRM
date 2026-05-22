import { VideoTabHandler } from './VideoTabHandler.js';
import { StorysTabHandler } from './StorysTabHandler.js';
import { BilderTabHandler } from './BilderTabHandler.js';
import { backgroundUploadService, UPLOAD_EVENTS } from '../../core/BackgroundUploadService.js';

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
    this.useExternalLinks = false;

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
  async open(videoId, metadaten, onSuccess, onBilderSuccess, onStorysSuccess, { initialTab = 'video', onBilderCleared, onStorysCleared } = {}) {
    this.videoId = videoId;
    this.kooperationId = metadaten.kooperationId;
    this.metadaten = metadaten;
    this.onSuccess = onSuccess;
    this.onBilderSuccess = onBilderSuccess || null;
    this.onStorysSuccess = onStorysSuccess || null;
    this.onBilderCleared = onBilderCleared || null;
    this.onStorysCleared = onStorysCleared || null;
    this.useExternalLinks = !!metadaten.keinDropbox;

    this.videoTab.reset();
    this.storysTab.reset();
    this.bilderTab.reset();

    const [videoVersions, storySlots] = await Promise.all([
      this.videoTab._loadExistingVersions(),
      this.storysTab._loadStorySlots()
    ]);
    this._activeTab = initialTab;

    this.createDrawer();
    this.renderForm();
    this.bindEvents();
    this._syncExternalLinksChip();

    this.videoTab._existingVersions = videoVersions;
    this.videoTab._loadExistingVideoAssets();

    this.storysTab._storySlots = storySlots;
    this.storysTab._initialized = true;

    if (initialTab === 'storys') {
      this.storysTab._renderExistingSlots();
    } else if (initialTab === 'bilder') {
      await this.bilderTab.ensureInitialized();
    }
  }

  // ─── Drawer Shell ──────────────────────────────────────────

  createDrawer() {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel drawer-panel--upload';
    panel.id = this.drawerId;

    const header = document.createElement('div');
    header.className = 'drawer-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'drawer-header-left';
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Datei hochladen';
    headerLeft.appendChild(title);

    const externalLinksChip = document.createElement('button');
    externalLinksChip.type = 'button';
    externalLinksChip.id = 'external-links-chip';
    externalLinksChip.className = 'drawer-mode-chip';
    externalLinksChip.textContent = 'Kein Dropbox';
    externalLinksChip.setAttribute('aria-label', 'Kein Dropbox – nur externe Links');
    externalLinksChip.addEventListener('click', () => {
      if (externalLinksChip.disabled || this.isAnyUploadActive()) return;
      this._onExternalLinksToggle(!this.useExternalLinks);
    });

    const headerRight = document.createElement('div');
    headerRight.className = 'drawer-header-right';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    headerRight.appendChild(closeBtn);

    header.appendChild(headerLeft);
    header.appendChild(externalLinksChip);
    header.appendChild(headerRight);

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;

    panel.appendChild(header);
    panel.appendChild(body);

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    this._syncExternalLinksChip();

    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
  }

  // ─── External Links Toggle (Header-Chip) ───────────────────

  _syncExternalLinksChip() {
    const chip = document.getElementById('external-links-chip');
    if (!chip) return;
    chip.classList.toggle('is-active', this.useExternalLinks);
    chip.setAttribute('aria-pressed', String(this.useExternalLinks));
    chip.disabled = this.isAnyUploadActive();
  }

  _onExternalLinksToggle(checked) {
    if (this.isAnyUploadActive()) return;
    this.useExternalLinks = checked;
    this.videoTab.reset();
    this.storysTab.reset();
    this.bilderTab.reset();
    this.renderForm();
    this.bindEvents();
    this._syncExternalLinksChip();
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
      ${this._renderActiveJobsBanner()}
      ${this._renderTabNav()}
      ${this.videoTab.renderTab(this._activeTab)}
      ${this.storysTab.renderTab(this._activeTab)}
      ${this.bilderTab.renderTab(this._activeTab)}
    `;
  }

  _renderActiveJobsBanner() {
    const active = backgroundUploadService.getActiveJobsForVideo(this.videoId);
    if (!active.length) return '';
    const types = new Set(active.map(j => j.kind));
    const labels = [];
    if (types.has('video') || types.has('video-replace')) labels.push('Video');
    if (types.has('storys')) labels.push('Storys');
    return `<div class="video-upload-active-banner">Es läuft bereits ein Upload im Hintergrund (${labels.join(' + ')}). Status siehst du im Panel links unten.</div>`;
  }

  _updateActiveJobsBanner() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    const existing = body.querySelector('.video-upload-active-banner');
    const html = this._renderActiveJobsBanner();
    if (existing) existing.remove();
    if (html) body.insertAdjacentHTML('afterbegin', html);
    this._syncExternalLinksChip();
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

    // Banner aktuell halten, falls sich Jobs ändern, während Drawer offen ist
    this._onJobsChangedBound = () => this._updateActiveJobsBanner();
    window.addEventListener(UPLOAD_EVENTS.QUEUE_CHANGED, this._onJobsChangedBound);
  }

  // ─── Shared State ──────────────────────────────────────────

  isAnyUploadActive() {
    // Nur Bilder-Tab blockiert noch das Drawer-Close (inline, nicht im Background-Service).
    return this.bilderTab.isUploading;
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

    if (this._onJobsChangedBound) {
      window.removeEventListener(UPLOAD_EVENTS.QUEUE_CHANGED, this._onJobsChangedBound);
      this._onJobsChangedBound = null;
    }

    setTimeout(() => this.removeDrawer(), 300);
  }

  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }
}
