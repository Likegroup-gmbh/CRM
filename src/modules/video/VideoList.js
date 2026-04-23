// VideoList.js
// Controller/Orchestrator fuer Video-Uebersicht
// 3-stufige Navigation: Unternehmen → Kampagnen → Video-Tabelle
// Delegiert Datenladen, Rendering und Events an separate Module.

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { VideoDataLoader } from './VideoDataLoader.js';
import { VideoFolderRenderer } from './VideoFolderRenderer.js';
import { VideoTableRenderer } from './VideoTableRenderer.js';
import { VideoEventHandler } from './VideoEventHandler.js';

export class VideoList {
  constructor() {
    this.viewMode = 'unternehmen';   // 'unternehmen' | 'kampagnen' | 'videos'
    this.listViewMode = 'grid';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentKampagneId = null;
    this.currentKampagneName = null;

    this.unternehmenFolders = [];
    this.kampagnenFolders = [];
    this.videos = [];

    this.pagination = new PaginationSystem();
    this.events = new VideoEventHandler();

    this.isAdmin = false;
    this.isKunde = false;
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  async init() {
    window.setHeadline('Videos');

    this.isAdmin = KampagneUtils.isUserAdmin();
    this.isKunde = KampagneUtils.isUserKunde();

    const canView = (window.canViewPage && window.canViewPage('videos')) ||
                    await window.checkUserPermission('videos', 'can_view');

    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Videos anzuzeigen.</p>
        </div>
      `;
      return;
    }

    this.viewMode = this.isKunde ? 'kampagnen' : 'unternehmen';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentKampagneId = null;
    this.currentKampagneName = null;

    this._updateBreadcrumb();

    this.pagination.init('pagination-videos', {
      itemsPerPage: 25,
      onPageChange: () => this.reloadData(),
      onItemsPerPageChange: () => this.loadAndRender(),
      dynamicResize: true,
      tbodySelector: '.data-table tbody'
    });

    await this.loadAndRender();
  }

  destroy() {
    this.events.destroy();
    this.pagination?.destroy();

    this.videos = [];
    this.unternehmenFolders = [];
    this.kampagnenFolders = [];
    this.viewMode = 'unternehmen';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentKampagneId = null;
    this.currentKampagneName = null;
  }

  // ============================================
  // RENDER-ORCHESTRATION
  // ============================================

  async loadAndRender() {
    try {
      this._renderSkeleton();

      const tbody = document.querySelector('.data-table tbody');
      if (tbody) TableAnimationHelper.showLoadingOverlay(tbody);

      if (this.viewMode === 'videos') {
        this.pagination.init('pagination-videos', {
          itemsPerPage: 25,
          onPageChange: () => this.reloadData(),
          onItemsPerPageChange: () => this.loadAndRender()
        });
      }

      if (this.viewMode === 'unternehmen') {
        this.unternehmenFolders = await VideoDataLoader.loadUnternehmenFolders();
        this._renderUnternehmen();
      } else if (this.viewMode === 'kampagnen') {
        this.kampagnenFolders = await VideoDataLoader.loadKampagnenFolders(
          this.currentUnternehmenId,
          this.isKunde
        );
        this._renderKampagnen();
      } else {
        await this._initFilterBar();
        await this._loadAndRenderVideos();
      }

      if (tbody) TableAnimationHelper.hideLoadingOverlay(tbody);
      this._bindAllEvents();
    } catch (error) {
      const tbodyErr = document.querySelector('.data-table tbody');
      if (tbodyErr) TableAnimationHelper.hideLoadingOverlay(tbodyErr);
      window.ErrorHandler?.handle(error, 'VideoList.loadAndRender');
      console.error('❌ VideoList.loadAndRender:', error);
    }
  }

  async reloadData() {
    try {
      if (this.viewMode === 'unternehmen') {
        this.unternehmenFolders = await VideoDataLoader.loadUnternehmenFolders();
        this._renderUnternehmen();
        this._bindAllEvents();
      } else if (this.viewMode === 'kampagnen') {
        this.kampagnenFolders = await VideoDataLoader.loadKampagnenFolders(
          this.currentUnternehmenId,
          this.isKunde
        );
        this._renderKampagnen();
        this._bindAllEvents();
      } else {
        await this._loadAndRenderVideos();
      }
    } catch (error) {
      window.ErrorHandler?.handle(error, 'VideoList.reloadData');
    }
  }

  // ============================================
  // RENDER (interne Dispatcher)
  // ============================================

  _renderSkeleton() {
    let html;
    if (this.viewMode === 'unternehmen') {
      html = VideoFolderRenderer.renderUnternehmenView(this.listViewMode);
    } else if (this.viewMode === 'kampagnen') {
      html = VideoFolderRenderer.renderKampagnenView(this.listViewMode, this.isKunde);
    } else {
      html = VideoTableRenderer.renderVideosView(this.isKunde);
    }
    window.setContentSafely(window.content, html);
  }

  _renderUnternehmen() {
    if (this.listViewMode === 'grid') {
      VideoFolderRenderer.updateUnternehmenGrid(this.unternehmenFolders);
    } else {
      VideoFolderRenderer.updateUnternehmenTable(this.unternehmenFolders);
    }
  }

  _renderKampagnen() {
    if (this.listViewMode === 'grid') {
      VideoFolderRenderer.updateKampagnenGrid(this.kampagnenFolders);
    } else {
      VideoFolderRenderer.updateKampagnenTable(this.kampagnenFolders);
    }
  }

  async _loadAndRenderVideos() {
    const { currentPage, itemsPerPage } = this.pagination.getState();
    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;
    const activeFilters = filterSystem.getFilters('video');

    const { videos, total } = await VideoDataLoader.loadVideos({
      kampagneId: this.currentKampagneId,
      activeFilters,
      from,
      to
    });

    this.videos = videos;
    this.pagination.updateTotal(total);
    this.pagination.render();

    VideoTableRenderer.updateTable(videos, this.isKunde);
    this.events.bindDragToScroll();
  }

  // ============================================
  // EVENTS / NAVIGATION
  // ============================================

  _bindAllEvents() {
    this.events.bindEvents({
      onViewModeChange: (mode) => this._handleViewModeChange(mode),
      onBackToUnternehmen: () => this._switchToUnternehmen(),
      onBackToKampagnen: () => this._switchToKampagnen(this.currentUnternehmenId, this.currentUnternehmenName),
      onUnternehmenSelect: (id, name) => this._switchToKampagnen(id, name),
      onKampagneSelect: (id, name) => this._switchToVideos(id, name)
    });
  }

  _handleViewModeChange(mode) {
    if (this.listViewMode === mode) return;
    this.listViewMode = mode;
    this.loadAndRender();
  }

  _switchToUnternehmen() {
    this.viewMode = 'unternehmen';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentKampagneId = null;
    this.currentKampagneName = null;
    this._updateBreadcrumb();
    this.loadAndRender();
  }

  _switchToKampagnen(unternehmenId, unternehmenName) {
    this.viewMode = 'kampagnen';
    this.currentUnternehmenId = unternehmenId;
    this.currentUnternehmenName = unternehmenName;
    this.currentKampagneId = null;
    this.currentKampagneName = null;
    this._updateBreadcrumb();
    this.loadAndRender();
  }

  _switchToVideos(kampagneId, kampagneName) {
    this.viewMode = 'videos';
    this.currentKampagneId = kampagneId;
    this.currentKampagneName = kampagneName;
    this.pagination.currentPage = 1;
    this._updateBreadcrumb();
    this.loadAndRender();
  }

  _updateBreadcrumb() {
    if (!window.breadcrumbSystem) return;
    if (this.viewMode === 'unternehmen') return; // Router handled es
    if (this.viewMode === 'kampagnen') {
      window.breadcrumbSystem.updateDetailLabel(this.currentUnternehmenName || 'Unternehmen');
    } else {
      window.breadcrumbSystem.updateDetailLabel(this.currentKampagneName || 'Kampagne');
    }
  }

  // ============================================
  // FILTER
  // ============================================

  async _initFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (!filterContainer) return;
    await filterDropdown.init('video', filterContainer, {
      onFilterApply: (filters) => this._onFiltersApplied(filters),
      onFilterReset: () => this._onFiltersReset()
    });
  }

  _onFiltersApplied(filters) {
    filterSystem.applyFilters('video', filters);
    this.pagination.reset();
    this.loadAndRender();
  }

  _onFiltersReset() {
    filterSystem.resetFilters('video');
    this.pagination.reset();
    this.loadAndRender();
  }
}

export const videoList = new VideoList();
