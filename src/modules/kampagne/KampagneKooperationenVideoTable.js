import { VideoTableRealtimeHandler } from './VideoTableRealtimeHandler.js';
import { VideoTableUIHelpers } from './VideoTableUIHelpers.js';
import { VideoTableRenderer } from './VideoTableRenderer.js';
import { VideoTableDataLoader } from './VideoTableDataLoader.js';
import { VideoTableFieldHandler } from './VideoTableFieldHandler.js';
import { VideoUploadDrawer } from './VideoUploadDrawer.js';
import { VideoSettingsDrawer } from './VideoSettingsDrawer.js';
import { LinkStrategieItemDrawer } from '../strategie/LinkStrategieItemDrawer.js';
import { VideoPlayerLightbox } from '../../core/media/VideoPlayerLightbox.js';
import { VIDEO_FEEDBACK_FIELDS } from '../../core/VideoFeedbackBuckets.js';
import { VideoFeedbackSaveController } from '../../core/videoFeedback/VideoFeedbackSaveController.js';
import { VideoFeedbackBinding } from './VideoFeedbackBinding.js';
import { VideoTableEventBinder } from './VideoTableEventBinder.js';
import { VideoTableStatusDropdown } from './VideoTableStatusDropdown.js';
import { VideoTableDrawerActions } from './VideoTableDrawerActions.js';
import { UPLOAD_EVENTS } from '../../core/BackgroundUploadService.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { ColumnDragHandler } from './columns/ColumnDragHandler.js';

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
    this.feedbackSaveController = new VideoFeedbackSaveController(this);
    this._feedbackBinding = new VideoFeedbackBinding(this.feedbackSaveController);
    this._eventBinder = new VideoTableEventBinder(this);
    this._statusDropdown = new VideoTableStatusDropdown(this);
    this._drawerActions = new VideoTableDrawerActions(this);
    this.columnDragHandler = new ColumnDragHandler(this);
    this._uploadDrawer = new VideoUploadDrawer();
    this._settingsDrawer = new VideoSettingsDrawer();
    this._linkStrategieDrawer = new LinkStrategieItemDrawer();
    this._mediaViewer = new VideoPlayerLightbox(this);
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
    return window.isKunde();
  }

  canDeleteKooperation() {
    if (this.isKundeRole()) return false;
    const canDelete = window.currentUser?.permissions?.kooperation?.can_delete;
    if (typeof canDelete === 'boolean') return canDelete;
    return window.canSeePricing();
  }

  isFieldEditableForUser(entity, field) {
    if (window.canSeePricing()) return true;
    
    if (this.isKundeRole()) {
      const readOnlyFieldsForKunden = {
        'kooperation': ['vertrag_unterschrieben', 'typ', 'nutzungsrechte'],
        'versand': ['versendet', 'tracking_nummer', 'produkt_name', 'produkt_link'],
        'video': [
          'thema', 'link_produkte', 'link_skript',
          ...VIDEO_FEEDBACK_FIELDS.filter(slot => slot.feedback_typ === 'cj').map(slot => slot.field),
          'caption', 'posting_datum', 'drehort', 'content_art', 'video_name'
        ]
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

  _isGoLiveSortActive() {
    const sort = this.store?.kooperationSort;
    return sort === 'posting_asc' || sort === 'posting_desc';
  }

  _applyTagFilter(list) {
    const tags = this.store?.selectedTags;
    if (!tags || tags.length === 0) return list;
    return list.filter(k => (k._tags || []).some(t => tags.includes(t)));
  }

  getOpenCount() {
    return this._applyTagFilter(
      this.kooperationen.filter(koop => !this.areAllVideosApproved(koop.id))
    ).length;
  }

  getClosedCount() {
    return this._applyTagFilter(
      this.kooperationen.filter(koop => this.areAllVideosApproved(koop.id))
    ).length;
  }

  getAllCount() {
    return this._applyTagFilter(this.kooperationen).length;
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

  bindEvents() { this._eventBinder.bind(); }

  // Status-Dropdown delegiert an VideoTableStatusDropdown (Portal + Update).
  positionStatusDropdown(wrapper) { return this._statusDropdown.positionStatusDropdown(wrapper); }
  _closeStatusPortal() { return this._statusDropdown.closePortal(); }
  _openStatusPortal(wrapper) { return this._statusDropdown.openPortal(wrapper); }
  _positionStatusPortal(trigger, portal) { return this._statusDropdown._positionPortal(trigger, portal); }
  _updateStatusInline(kooperationId, statusId, statusName) {
    return this._statusDropdown.updateInline(kooperationId, statusId, statusName);
  }

  // ========================================
  // UPLOAD / SETTINGS / DELETE
  // ========================================

  _openUploadDrawer(videoId, kooperationId, opts) { return this._drawerActions.openUploadDrawer(videoId, kooperationId, opts); }
  _openCustomUploadDrawer(btn) { return this._drawerActions.openCustomUploadDrawer(btn); }
  _openSettingsDrawer(btn) { return this._drawerActions.openSettingsDrawer(btn); }
  _openLinkStrategieDrawer(btn) { return this._drawerActions.openLinkStrategieDrawer(btn); }
  _reloadAfterStrategieLink() { return this._drawerActions.reloadAfterStrategieLink(); }

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

    // Background-Upload-Done Listener registrieren (einmalig pro init)
    if (!this._uploadDoneHandler) {
      this._uploadDoneHandler = () => {
        this._reloadAfterStrategieLink();
      };
      window.addEventListener(UPLOAD_EVENTS.VIDEO_DONE, this._uploadDoneHandler);
      window.addEventListener(UPLOAD_EVENTS.STORYS_DONE, this._uploadDoneHandler);
    }

    if (!this._customUploadDoneHandler) {
      this._customUploadDoneHandler = (e) => {
        const { result } = e.detail || {};
        if (result?.columnId && result?.entityId && result?.folderUrl) {
          if (this.store) this.store.setCustomColumnValue(result.entityId, result.columnId, result.folderUrl);
          this.refilter();
        }
      };
      window.addEventListener(UPLOAD_EVENTS.CUSTOM_DONE, this._customUploadDoneHandler);
    }

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

  _handleStatusDropdownChange(kooperationId, newStatusId) {
    return this._statusDropdown.handleChange(kooperationId, newStatusId);
  }

  async refilter() {
    if (!this.containerId || !document.getElementById(this.containerId)) return;

    // Serialisieren: laeuft bereits ein refilter (wartet z.B. auf flushAll),
    // wird genau ein Folge-Lauf vorgemerkt statt parallel zu rendern.
    if (this._refilterRunning) { this._refilterQueued = true; return; }
    this._refilterRunning = true;
    try {
      // Offene Feedback-Saves sichern, BEVOR das DOM (inkl. Textareas) ersetzt
      // wird -> kein getippter Text geht beim Re-Render verloren.
      if (this.feedbackSaveController?.hasPending()) {
        await this.feedbackSaveController.flushAll();
      }

      const container = this.containerId ? document.getElementById(this.containerId) : null;
      if (!container) return;

      this._closeStatusPortal();

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
    } finally {
      this._refilterRunning = false;
      if (this._refilterQueued) {
        this._refilterQueued = false;
        this.refilter();
      }
    }
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
    // Offene Feedback-Saves noch ausloesen, bevor State/Listener abgebaut werden.
    this.feedbackSaveController?.flushAll();

    this._closeStatusPortal();

    this._rowHeightSync?.disconnect();
    this._rowHeightSync = null;

    this._mediaViewer?.lightbox?.close();

    // Drawer-eigene window-Listener (VIDEO_DONE/STORYS_DONE/CUSTOM_DONE,
    // QUEUE_CHANGED) freigeben, sonst bleiben sie pro Tabellen-Instanz haengen.
    this._uploadDrawer?.destroy();

    const container = document.querySelector('.kooperation-video-grid');
    if (container) CustomDatePicker.destroy(container);

    if (this.dragScrollContainer) {
      this.dragScrollContainer.style.cursor = '';
      this.isDragging = false;
      this.dragScrollContainer = null;
    }

    this.uiHelpers.destroy();
    this.columnDragHandler.destroy();

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

    if (this._uploadDoneHandler) {
      window.removeEventListener(UPLOAD_EVENTS.VIDEO_DONE, this._uploadDoneHandler);
      window.removeEventListener(UPLOAD_EVENTS.STORYS_DONE, this._uploadDoneHandler);
      this._uploadDoneHandler = null;
    }
    if (this._customUploadDoneHandler) {
      window.removeEventListener(UPLOAD_EVENTS.CUSTOM_DONE, this._customUploadDoneHandler);
      this._customUploadDoneHandler = null;
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
