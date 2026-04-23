import { VideoTableRealtimeHandler } from './VideoTableRealtimeHandler.js';
import { VideoTableUIHelpers } from './VideoTableUIHelpers.js';
import { VideoTableRenderer } from './VideoTableRenderer.js';
import { VideoTableDataLoader } from './VideoTableDataLoader.js';
import { VideoTableFieldHandler } from './VideoTableFieldHandler.js';
import { VideoUploadDrawer } from './VideoUploadDrawer.js';
import { VideoSettingsDrawer } from './VideoSettingsDrawer.js';
import { deleteVideoFile } from '../../core/VideoDeleteHelper.js';

export class KampagneKooperationenVideoTable {
  constructor(kampagneId, store) {
    this.kampagneId = kampagneId;
    this.store = store || null;
    this.containerId = null;
    this.columnWidths = new Map();
    this.isResizing = false;
    this.resizeCol = null;
    this.resizeStartX = 0;
    this.resizeStartWidth = 0;
    this.storageKey = `kampagne_koops_videos_column_widths_v3_${kampagneId}`;
    this.hiddenColumns = [];
    this._abortController = null;
    
    this.activeFilterTab = 'offen';
    
    this._isLoading = false;
    this._dataLoaded = false;
    
    this.performanceMetrics = {
      startTime: null,
      stages: {},
      errors: []
    };
    
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.dragScrollContainer = null;
    this._entityUpdatedHandler = null;

    this.realtimeHandler = new VideoTableRealtimeHandler(this);
    this.uiHelpers = new VideoTableUIHelpers(this);
    this.renderer = new VideoTableRenderer(this);
    this.dataLoader = new VideoTableDataLoader(this);
    this.fieldHandler = new VideoTableFieldHandler(this);
    this._uploadDrawer = new VideoUploadDrawer();
    this._settingsDrawer = new VideoSettingsDrawer();
  }

  // Store-backed getters (Proxy zum Store, Fallback auf lokale Daten für Kompatibilität)
  get kooperationen() { return this.store?.kooperationen || this._kooperationen || []; }
  set kooperationen(val) { if (this.store) this.store.setKooperationen(val); else this._kooperationen = val; }

  get videos() { return this.store?.videos || this._videos || {}; }
  set videos(val) { if (this.store) this.store.setVideos(val); else this._videos = val; }

  get videoComments() { return this.store?.videoComments || this._videoComments || {}; }
  set videoComments(val) { if (this.store) this.store.setVideoComments(val); else this._videoComments = val; }

  get versandInfos() { return this.store?.versandInfos || this._versandInfos || {}; }
  set versandInfos(val) { if (this.store) this.store.setVersandInfos(val); else this._versandInfos = val; }

  get creators() { return this.store?.creators || this._creators || new Map(); }
  set creators(val) { if (this.store) this.store.setCreators(val); else this._creators = val; }

  get kampagneInfo() { return this.store?.kampagneInfo || this._kampagneInfo || null; }
  set kampagneInfo(val) { if (this.store) this.store.setKampagneInfo(val); else this._kampagneInfo = val; }

  // ========================================
  // PERMISSIONS / ROLE
  // ========================================

  getCurrentUserRole() {
    return String(window.currentUser?.rolle || '').trim().toLowerCase();
  }

  isKundeRole() {
    const role = this.getCurrentUserRole();
    return role === 'kunde' || role === 'kunde_editor';
  }

  canDeleteKooperation() {
    if (this.isKundeRole()) return false;
    const canDelete = window.currentUser?.permissions?.kooperation?.can_delete;
    if (typeof canDelete === 'boolean') return canDelete;
    const role = this.getCurrentUserRole();
    return role === 'admin' || role === 'mitarbeiter';
  }

  isFieldEditableForUser(entity, field) {
    const userRole = this.getCurrentUserRole();
    if (userRole === 'admin' || userRole === 'mitarbeiter') return true;
    
    if (this.isKundeRole()) {
      const readOnlyFieldsForKunden = {
        'kooperation': ['vertrag_unterschrieben', 'typ', 'nutzungsrechte'],
        'versand': ['versendet', 'tracking_nummer', 'produkt_name', 'produkt_link'],
        'video': ['thema', 'link_produkte', 'link_skript', 'skript_freigegeben', 'feedback_creatorjobs', 'caption', 'posting_datum', 'drehort', 'content_art', 'video_name']
      };
      return !readOnlyFieldsForKunden[entity]?.includes(field);
    }
    
    return false;
  }

  // ========================================
  // FILTER / VISIBILITY
  // ========================================

  areAllVideosApproved(kooperationId) {
    if (this.store) return this.store.areAllVideosApproved(kooperationId);
    const videos = this.videos[kooperationId] || [];
    if (videos.length === 0) return false;
    return videos.every(video => video.freigabe === true);
  }

  setFilterTab(tabName) {
    if (!['offen', 'abgeschlossen', 'alle'].includes(tabName)) return;
    this.activeFilterTab = tabName;
    this.refilter();
  }

  getOpenCount() {
    return this.kooperationen.filter(koop => !this.areAllVideosApproved(koop.id)).length;
  }

  getClosedCount() {
    return this.kooperationen.filter(koop => this.areAllVideosApproved(koop.id)).length;
  }

  getAllCount() {
    return this.kooperationen.length;
  }

  updateTabCounts() {
    const openEl = document.getElementById('tab-count-offen');
    const closedEl = document.getElementById('tab-count-abgeschlossen');
    const allEl = document.getElementById('tab-count-alle');
    if (openEl) openEl.textContent = this.getOpenCount();
    if (closedEl) closedEl.textContent = this.getClosedCount();
    if (allEl) allEl.textContent = this.getAllCount();
  }

  isColumnVisibleForCustomer(columnClass) {
    if (columnClass === 'col-nr' || columnClass === 'col-creator' || columnClass === 'col-status') return true;
    if ((columnClass === 'col-kosten' || columnClass === 'col-ek-video') && this.isKundeRole()) return false;
    if ((columnClass === 'col-actions' || columnClass === 'col-vertrag') && this.isKundeRole()) return false;
    if (columnClass === 'col-actions') return true;
    return !this.hiddenColumns.includes(columnClass);
  }

  // ========================================
  // PERFORMANCE (delegiert an uiHelpers)
  // ========================================

  _startPerformanceTracking(stageName) { return this.uiHelpers.startPerformanceTracking(stageName); }
  _endPerformanceTracking(stageName, success, error) { return this.uiHelpers.endPerformanceTracking(stageName, success, error); }
  _logPerformanceSummary() { this.uiHelpers.logPerformanceSummary(); }
  _updateLoadingProgress(message, percent) { this.uiHelpers.updateLoadingProgress(message, percent); }
  _removeLoadingProgress() { this.uiHelpers.removeLoadingProgress(); }

  // ========================================
  // DATEN-LOADING (delegiert an dataLoader)
  // ========================================

  async loadData() { return this.dataLoader.loadData(); }
  getVersandForVideo(videoId) {
    if (this.store) return this.store.getVersandForVideo(videoId);
    return this.dataLoader.getVersandForVideo(videoId);
  }
  async loadColumnVisibilitySettings() { return this.dataLoader.loadColumnVisibilitySettings(); }

  async loadAssetsAndCommentsForVisible() {
    const allVideoIds = Object.values(this.videos).flat().map(v => v.id);
    if (allVideoIds.length === 0) return;

    const unloaded = this.store
      ? this.store.getUnloadedVideoIds(allVideoIds)
      : allVideoIds;

    if (unloaded.length === 0) return;
    await this.dataLoader.loadAssetsAndComments(unloaded);
    if (this.store) this.store.markAssetsLoaded(unloaded);
  }

  // ========================================
  // RENDERING (delegiert an renderer)
  // ========================================

  renderSkeletonLoading() { return this.renderer.renderSkeletonLoading(); }
  render() { return this.renderer.render(); }
  renderVideoFieldStack(videos, fieldRenderer) { return this.renderer.renderVideoFieldStack(videos, fieldRenderer); }
  escapeHtml(text) { return this.renderer.escapeHtml(text); }

  // ========================================
  // FIELD UPDATE (delegiert an fieldHandler)
  // ========================================

  async handleFieldUpdate(field) { return this.fieldHandler.handleFieldUpdate(field); }

  // ========================================
  // EVENTS
  // ========================================

  bindEvents() {
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const container = document.querySelector('.kooperation-video-grid');
    if (!container) return;

    container.addEventListener('blur', async (e) => {
      if (e.target.classList.contains('grid-input') || e.target.classList.contains('grid-textarea')) {
        await this.handleFieldUpdate(e.target);
      }
    }, true);

    container.addEventListener('change', async (e) => {
      if (e.target.classList.contains('grid-checkbox') || e.target.classList.contains('grid-select')) {
        if (e.target.classList.contains('grid-checkbox') && e.target.dataset.field === 'freigabe') {
          this.toggleVideoRowApproval(e.target.dataset.id, e.target.checked);
          const videoId = e.target.dataset.id;
          if (this.store) {
            this.store.updateVideo(videoId, { freigabe: e.target.checked });
          }
          this.updateTabCounts();
        }
        await this.handleFieldUpdate(e.target);

        if (e.target.dataset.field === 'freigabe' && this.activeFilterTab !== 'alle') {
          const koopRow = e.target.closest('[data-kooperation-id]');
          const koopId = koopRow?.dataset?.kooperationId || e.target.dataset.kooperationId;
          if (koopId) {
            const allApproved = this.areAllVideosApproved(koopId);
            const shouldBeVisible = this.activeFilterTab === 'offen' ? !allApproved : allApproved;
            if (!shouldBeVisible) {
              clearTimeout(this._refilterTimer);
              this._refilterTimer = setTimeout(() => this.refilter(), 600);
            }
          }
        }
      }
    });
    
    this.initAutoResizeTextareas();

    container.addEventListener('click', (e) => {
      const uploadBtn = e.target.closest('.video-upload-btn');
      if (uploadBtn) {
        e.preventDefault();
        this._openUploadDrawer(uploadBtn.dataset.videoId, uploadBtn.dataset.kooperationId);
      }
    });

    container.addEventListener('click', (e) => {
      const settingsBtn = e.target.closest('.video-settings-btn');
      if (settingsBtn) {
        e.preventDefault();
        this._openSettingsDrawer(settingsBtn);
      }
    });

    window.addEventListener('kooperationStatusChanged', (e) => {
      const { kooperationId, statusId, statusName } = e.detail;
      this._updateStatusInline(kooperationId, statusId, statusName);
    }, { signal });

    this.bindResizeEvents();
    this.bindDragToScroll();
  }

  // ========================================
  // UPLOAD / SETTINGS / DELETE
  // ========================================

  _openUploadDrawer(videoId, kooperationId, { initialTab = 'video' } = {}) {
    const koop = this.kooperationen.find(k => k.id === kooperationId);
    const videos = this.videos[kooperationId] || [];
    const video = videos.find(v => v.id === videoId);
    const creator = koop?.creator;
    const creatorName = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();

    const metadaten = {
      kooperationId,
      kooperationName: koop?.name || 'Kooperation',
      videoTitel: video?.thema || 'Video',
      videoName: video?.video_name || '',
      videoPosition: video?.position || 1,
      videoThema: video?.thema || '',
      unternehmen: this.kampagneInfo?.unternehmen || '',
      marke: this.kampagneInfo?.marke || '',
      kampagne: this.kampagneInfo?.name || '',
      creatorName,
      bilderFolderUrl: koop?.bilder_folder_url || null
    };

    this._uploadDrawer.open(videoId, metadaten, (fileUrl, filePath, videoName, folderUrl) => {
      this._updateContentCellAfterUpload(videoId, kooperationId, fileUrl, videoName, folderUrl);
    }, (bilderFolderUrl) => {
      if (koop) koop.bilder_folder_url = bilderFolderUrl;
      this.refilter();
    }, (storysFolderUrl) => {
      const patch = { story_folder_url: storysFolderUrl };
      if (this.store) {
        this.store.updateVideo(videoId, patch);
      } else {
        if (video) video.story_folder_url = storysFolderUrl;
      }
      this.refilter();
    }, { initialTab,
      onBilderCleared: () => {
        if (koop) koop.bilder_folder_url = null;
        this.refilter();
      },
      onStorysCleared: () => {
        if (this.store) this.store.updateVideo(videoId, { story_folder_url: null });
        else if (video) video.story_folder_url = null;
        this.refilter();
      },
    });
  }

  _updateContentCellAfterUpload(videoId, kooperationId, fileUrl, videoName, folderUrl) {
    const patch = { file_url: fileUrl, link_content: fileUrl };
    if (folderUrl) patch.folder_url = folderUrl;
    if (videoName !== undefined) patch.video_name = videoName;

    if (this.store) {
      this.store.updateVideo(videoId, patch);
    } else {
      const videos = this.videos[kooperationId];
      if (videos) {
        const v = videos.find(vid => vid.id === videoId);
        if (v) Object.assign(v, patch);
      }
    }
    this.refilter();
  }

  async _openSettingsDrawer(btn) {
    const videoId = btn.dataset.videoId;
    const kooperationId = btn.dataset.kooperationId;
    const filePath = btn.dataset.filePath || '';
    const videoUrl = btn.dataset.videoUrl || '';
    const koop = this.kooperationen.find(k => k.id === kooperationId);
    const videos = this.videos[kooperationId] || [];
    const video = videos.find(v => v.id === videoId);

    await this._settingsDrawer.open({
      videoId,
      kooperationId,
      videoUrl,
      filePath,
      videoTitel: video?.thema || 'Video',
      videoName: video?.video_name || '',
      onReupload: () => this._openUploadDrawer(videoId, kooperationId),
      onStorysReupload: () => this._openUploadDrawer(videoId, kooperationId, { initialTab: 'storys' }),
      onBilderReupload: () => this._openUploadDrawer(videoId, kooperationId, { initialTab: 'bilder' }),
      onDelete: () => this._executeVideoDelete(videoId, kooperationId),
      onNameUpdated: (newVideoName) => {
        if (this.store) {
          this.store.updateVideo(videoId, { video_name: newVideoName });
        } else {
          const targetVideos = this.videos[kooperationId];
          if (!targetVideos) return;
          const targetVideo = targetVideos.find(v => v.id === videoId);
          if (!targetVideo) return;
          targetVideo.video_name = newVideoName;
        }
        this.refilter();
      },
    });
  }

  async _executeVideoDelete(videoId, kooperationId) {
    const { hasRemainingAssets } = await deleteVideoFile(videoId);
    const patch = { file_url: null, link_content: null, currentAsset: null };
    if (!hasRemainingAssets) patch.folder_url = null;
    if (this.store) {
      this.store.updateVideo(videoId, patch);
    } else {
      const videos = this.videos[kooperationId];
      if (videos) {
        const v = videos.find(vid => vid.id === videoId);
        if (v) Object.assign(v, patch);
      }
    }
    this.refilter();
  }

  // ========================================
  // UI HELPERS (delegiert)
  // ========================================

  initAutoResizeTextareas() { /* Feste Höhe via CSS */ }
  bindResizeEvents() { this.uiHelpers.bindResizeEvents(); }
  bindDragToScroll() { this.uiHelpers.bindDragToScroll(); }
  loadColumnWidths() { this.uiHelpers.loadColumnWidths(); }
  initFloatingScrollbar() { this.uiHelpers.initFloatingScrollbar(); }

  // ========================================
  // REALTIME (delegiert an realtimeHandler)
  // ========================================

  initRealtimeSubscription() { this.realtimeHandler.initRealtimeSubscription(); }
  cleanupRealtimeSubscription() { this.realtimeHandler.cleanup(); }
  toggleVideoRowApproval(videoId, isApproved) { this.realtimeHandler.toggleVideoRowApproval(videoId, isApproved); }
  async handleKooperationDeletedById(id, source) { await this.realtimeHandler.handleKooperationDeletedById(id, source); }

  // ========================================
  // LIFECYCLE
  // ========================================

  async init(containerId) {
    if (this._isLoading && this.containerId === containerId) return;

    if (this._dataLoaded && this.containerId === containerId) {
      await this.refresh();
      return;
    }

    if (this.containerId !== containerId) {
      this._isLoading = false;
      this._dataLoaded = false;
    }

    this.containerId = containerId;
    let container = document.getElementById(containerId);
    
    if (container) {
      container.innerHTML = this.renderSkeletonLoading();
    } else {
      console.error('❌ Container nicht gefunden:', containerId);
      return;
    }
    
    await Promise.all([
      this.loadData(),
      this.loadColumnVisibilitySettings()
    ]);
    
    const html = this.render();
    const currentContainer = document.getElementById(containerId);
    if (currentContainer) {
      currentContainer.innerHTML = html;
      container = currentContainer;
      
      this.bindEvents();
      
      window.addEventListener('video-column-visibility-changed', (e) => {
        if (e.detail.kampagneId === this.kampagneId) {
          this.hiddenColumns = e.detail.hiddenColumns;
          this.refilter();
        }
      }, { signal: this._abortController.signal });

      if (!this._entityUpdatedHandler) {
        this._entityUpdatedHandler = async (e) => {
          const detail = e.detail || {};
          if (detail.entity === 'kooperation' && detail.action === 'deleted' && detail.id) {
            await this.handleKooperationDeletedById(detail.id, 'entityUpdated');
          }
        };
        window.addEventListener('entityUpdated', this._entityUpdatedHandler);
      }
      
      this.initFloatingScrollbar();
      this.initRealtimeSubscription();
      this.loadColumnWidths();
    } else {
      console.error('❌ Container nicht mehr im DOM nach async Laden:', containerId);
    }
  }

  _updateStatusInline(kooperationId, statusId, statusName) {
    const koop = this.kooperationen.find(k => k.id === kooperationId);
    if (koop) {
      koop.status_id = statusId || null;
      koop.status_name = statusName || null;
      koop.status_ref = statusId ? { id: statusId, name: statusName } : null;
    }
    
    const row = document.querySelector(`tr[data-kooperation-id="${kooperationId}"]`);
    if (row) {
      const cell = row.querySelector('.col-status');
      if (cell && this.renderer) {
        cell.innerHTML = this.renderer.renderStatusBadge(koop || { id: kooperationId, status_id: statusId, status_name: statusName });
      }
    }
  }

  refilter() {
    const container = this.containerId ? document.getElementById(this.containerId) : null;
    if (!container) return;

    const scrollY = window.scrollY;
    const containerScrollTop = container.scrollTop;
    const gridWrapper = container.querySelector('.grid-wrapper');
    const gridScrollLeft = gridWrapper?.scrollLeft ?? 0;
    const floatingBar = document.getElementById('floating-scrollbar-kampagne');
    const floatingLeft = floatingBar?.scrollLeft ?? 0;

    container.innerHTML = this.render();
    this.bindEvents();
    this.initFloatingScrollbar();
    this.loadColumnWidths();
    this.updateTabCounts();

    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      container.scrollTop = containerScrollTop;
      const newGrid = container.querySelector('.grid-wrapper');
      if (newGrid) newGrid.scrollLeft = gridScrollLeft;
      const newBar = document.getElementById('floating-scrollbar-kampagne');
      if (newBar) newBar.scrollLeft = floatingLeft;
    });

    this.loadAssetsAndCommentsForVisible();
  }

  async refresh() {
    const container = this.containerId ? document.getElementById(this.containerId) : null;
    if (!container) return;

    if (this.store) {
      this.refilter();
      return;
    }
    
    this._dataLoaded = false;
    await this.loadData();
    
    container.innerHTML = this.render();
    this.bindEvents();
    this.initFloatingScrollbar();
    this.loadColumnWidths();
    this.updateTabCounts();
  }

  destroy() {
    if (this.dragScrollContainer) {
      this.dragScrollContainer.style.cursor = '';
      this.isDragging = false;
      this.dragScrollContainer = null;
    }

    this.uiHelpers.destroy();

    clearTimeout(this._refilterTimer);
    clearTimeout(this._loadingProgressTimer);
    
    this.cleanupRealtimeSubscription();

    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }

    if (this._entityUpdatedHandler) {
      window.removeEventListener('entityUpdated', this._entityUpdatedHandler);
      this._entityUpdatedHandler = null;
    }
    
    this.store = null;

    const floatingScrollbar = document.getElementById('floating-scrollbar-kampagne');
    if (floatingScrollbar && floatingScrollbar.parentNode) {
      floatingScrollbar.parentNode.removeChild(floatingScrollbar);
    }
  }
}

export async function renderKooperationenVideoTable(kampagneId, containerId) {
  const table = new KampagneKooperationenVideoTable(kampagneId);
  await table.init(containerId);
  return table;
}
