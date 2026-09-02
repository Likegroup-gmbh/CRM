// VideoList.js
// Controller/Orchestrator fuer Video-Uebersicht
// Navigation intern: Unternehmen → Kampagnen → Videos|Rohmaterial → Tabelle/Dateien
// Navigation Kunde:  Kampagnen → Video-Tabelle (kein Rohmaterial, kein Split)
// Delegiert Datenladen, Rendering und Events an separate Module.

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { VideoDataLoader } from './VideoDataLoader.js';
import { VideoFolderRenderer } from './VideoFolderRenderer.js';
import { VideoTableRenderer } from './VideoTableRenderer.js';
import { VideoRohmaterialRenderer } from './VideoRohmaterialRenderer.js';
import { VideoEventHandler } from './VideoEventHandler.js';
import { RohmaterialService } from './RohmaterialService.js';

export class VideoList {
  constructor() {
    // 'unternehmen' | 'kampagnen' | 'kampagneRoot' | 'videos' | 'rohmaterial'
    this.viewMode = 'unternehmen';
    this.listViewMode = 'grid';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentKampagneId = null;
    this.currentKampagneName = null;

    this.unternehmenFolders = [];
    this.kampagnenFolders = [];
    this.videos = [];
    this.rohmaterialGroups = [];

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

    this.isAdmin = window.isAdmin();
    this.isKunde = window.isKunde();

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
    this.rohmaterialGroups = [];
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
      } else if (this.viewMode === 'kampagneRoot') {
        // Reine Ordner-Auswahl, nichts nachzuladen
        VideoFolderRenderer.fillKampagneRootGrid();
      } else if (this.viewMode === 'rohmaterial') {
        await this._loadAndRenderRohmaterial();
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
      } else if (this.viewMode === 'kampagneRoot') {
        VideoFolderRenderer.fillKampagneRootGrid();
        this._bindAllEvents();
      } else if (this.viewMode === 'rohmaterial') {
        await this._loadAndRenderRohmaterial();
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
    } else if (this.viewMode === 'kampagneRoot') {
      html = VideoFolderRenderer.renderKampagneRootView();
    } else if (this.viewMode === 'rohmaterial') {
      html = VideoRohmaterialRenderer.renderRohmaterialView();
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

  async _loadAndRenderRohmaterial() {
    this.rohmaterialGroups = await RohmaterialService.loadGroups(this.currentKampagneId);
    VideoRohmaterialRenderer.updateGroups(this.rohmaterialGroups);
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
      // Aus der Video-Tabelle fuehrt "Zurück" intern auf den Videos|Rohmaterial-
      // Split, den der Kunde nie gesehen hat.
      onBackToKampagnen: () => this.viewMode === 'videos' && !this.isKunde
        ? this._switchToKampagneRoot(this.currentKampagneId, this.currentKampagneName)
        : this._switchToKampagnen(this.currentUnternehmenId, this.currentUnternehmenName),
      onBackToKampagneRoot: () => this._switchToKampagneRoot(this.currentKampagneId, this.currentKampagneName),
      onUnternehmenSelect: (id, name) => this._switchToKampagnen(id, name),
      // Kunden haben keinen Rohmaterial-Zweig: direkt in die Video-Tabelle.
      onKampagneSelect: (id, name) => this.isKunde
        ? this._switchToVideos(id, name)
        : this._switchToKampagneRoot(id, name),
      onKampagneRootSelect: (target) => target === 'rohmaterial'
        ? this._switchToRohmaterial()
        : this._switchToVideos(this.currentKampagneId, this.currentKampagneName),
      onRohmaterialUpload: (koopId) => this._handleRohmaterialUpload(koopId),
      onRohmaterialDelete: (assetId) => this._handleRohmaterialDelete(assetId)
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

  _switchToKampagneRoot(kampagneId, kampagneName) {
    this.viewMode = 'kampagneRoot';
    this.currentKampagneId = kampagneId;
    this.currentKampagneName = kampagneName;
    this.rohmaterialGroups = [];
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

  _switchToRohmaterial() {
    this.viewMode = 'rohmaterial';
    this._updateBreadcrumb();
    this.loadAndRender();
  }

  _updateBreadcrumb() {
    if (!window.breadcrumbSystem) return;
    if (this.viewMode === 'unternehmen') return; // Router handled es
    if (this.viewMode === 'kampagnen') {
      window.breadcrumbSystem.updateDetailLabel(this.currentUnternehmenName || 'Unternehmen');
    } else if (this.viewMode === 'rohmaterial') {
      window.breadcrumbSystem.updateDetailLabel(
        `${this.currentKampagneName || 'Kampagne'} · Rohmaterial`
      );
    } else {
      window.breadcrumbSystem.updateDetailLabel(this.currentKampagneName || 'Kampagne');
    }
  }

  // ============================================
  // ROHMATERIAL (Mitarbeiter-Fallback)
  // ============================================

  async _handleRohmaterialUpload(koopId) {
    const group = this.rohmaterialGroups.find(g => g.id === koopId);
    if (!group) return;

    const files = await this._pickFiles();
    if (files.length === 0) return;

    VideoRohmaterialRenderer.setProgress(koopId, `Lade hoch... 0/${files.length}`);

    try {
      const { uploaded, errors } = await RohmaterialService.uploadFiles(
        group,
        files,
        (done, total, name) => VideoRohmaterialRenderer.setProgress(
          koopId,
          done < total ? `Lade hoch... ${done + 1}/${total}: ${name}` : 'Fertig'
        )
      );

      if (uploaded > 0) {
        window.toastSystem?.success(
          `${uploaded} ${uploaded === 1 ? 'Datei' : 'Dateien'} hochgeladen`
        );
      }
      errors.forEach(e => window.toastSystem?.error(e));
    } catch (error) {
      window.ErrorHandler?.handle(error, 'VideoList._handleRohmaterialUpload');
    } finally {
      VideoRohmaterialRenderer.setProgress(koopId, null);
      await this._loadAndRenderRohmaterial();
      this._bindAllEvents();
    }
  }

  async _handleRohmaterialDelete(assetId) {
    const asset = this.rohmaterialGroups
      .flatMap(g => g.files || [])
      .find(f => f.id === assetId);
    if (!asset) return;

    const message = `"${asset.file_name || 'Diese Datei'}" wird auch in Dropbox gelöscht.`;
    let confirmed;
    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({
        title: 'Rohmaterial löschen',
        message,
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      confirmed = !!res?.confirmed;
    } else {
      confirmed = confirm(message);
    }
    if (!confirmed) return;

    try {
      await RohmaterialService.deleteAsset(asset);
      window.toastSystem?.success('Rohmaterial gelöscht');
    } catch (error) {
      window.ErrorHandler?.handle(error, 'VideoList._handleRohmaterialDelete');
    } finally {
      await this._loadAndRenderRohmaterial();
      this._bindAllEvents();
    }
  }

  _pickFiles() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,application/zip,.mp4,.mov,.avi,.mkv,.webm,.zip';
      input.onchange = () => resolve([...(input.files || [])]);
      // Ein abgebrochener Dialog feuert kein change-Event; cancel wird von allen
      // Zielbrowsern unterstuetzt, sonst bliebe das Promise offen.
      input.oncancel = () => resolve([]);
      input.click();
    });
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
