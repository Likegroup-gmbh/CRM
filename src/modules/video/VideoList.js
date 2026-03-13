// VideoList.js (ES6-Modul)
// Video-Übersichtsseite mit 3-stufiger Ordnerstruktur:
// Level 1: Unternehmen-Ordner
// Level 2: Kampagnen-Ordner (pro Unternehmen)
// Level 3: Video-Tabelle (pro Kampagne)

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { VideoFilterLogic } from './filters/VideoFilterLogic.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';

export class VideoList {
  constructor() {
    this.videos = [];
    this.unternehmenFolders = [];
    this.kampagnenFolders = [];
    this.statusOptions = ['produktion', 'abgeschlossen'];

    // View state: 'unternehmen' → 'kampagnen' → 'videos'
    this.viewMode = 'unternehmen';
    this.listViewMode = 'grid';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentKampagneId = null;
    this.currentKampagneName = null;

    this.pagination = new PaginationSystem();
    this._boundEventListeners = new Set();

    // Drag-to-Scroll
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.dragScrollContainer = null;
  }

  // ============================================
  // INIT & LIFECYCLE
  // ============================================

  async init() {
    window.setHeadline('Videos');

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

    this.viewMode = 'unternehmen';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentKampagneId = null;
    this.currentKampagneName = null;

    this.updateBreadcrumb();

    this.pagination.init('pagination-videos', {
      itemsPerPage: 25,
      onPageChange: () => this.reloadData(),
      onItemsPerPageChange: () => this.loadAndRender(),
      dynamicResize: true,
      tbodySelector: '.data-table tbody'
    });

    await this.loadAndRender();
  }

  updateBreadcrumb() {
    if (!window.breadcrumbSystem) return;

    if (this.viewMode === 'unternehmen') {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Videos', url: '/videos', clickable: false }
      ]);
    } else if (this.viewMode === 'kampagnen') {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Videos', url: '/videos', clickable: true },
        { label: this.currentUnternehmenName || 'Unternehmen', clickable: false }
      ]);
    } else {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Videos', url: '/videos', clickable: true },
        { label: this.currentUnternehmenName || 'Unternehmen', clickable: false },
        { label: this.currentKampagneName || 'Kampagne', clickable: false }
      ]);
    }
  }

  // ============================================
  // LOAD & RENDER
  // ============================================

  async loadAndRender() {
    try {
      await this.render();

      const tbody = document.querySelector('.data-table tbody');
      if (tbody) TableAnimationHelper.showLoadingOverlay(tbody);

      if (this.viewMode === 'videos') {
        this.pagination.init('pagination-videos', {
          itemsPerPage: 25,
          onPageChange: () => this.reloadData(),
          onItemsPerPageChange: () => this.loadAndRender()
        });
      }

      this.bindEvents();

      if (this.viewMode === 'unternehmen') {
        await this.loadUnternehmenFolders();
        this.listViewMode === 'grid' ? this.updateFoldersView() : this.updateUnternehmenListTable();
        if (tbody) TableAnimationHelper.hideLoadingOverlay(tbody);

      } else if (this.viewMode === 'kampagnen') {
        await this.loadKampagnenFolders();
        this.listViewMode === 'grid' ? this.updateKampagnenGridView() : this.updateKampagnenListTable();
        if (tbody) TableAnimationHelper.hideLoadingOverlay(tbody);

      } else {
        await this.initializeFilterBar();
        const videos = await this.loadVideosWithRelations();
        this.updateTable(videos);
        if (tbody) TableAnimationHelper.hideLoadingOverlay(tbody);
      }

    } catch (error) {
      const tbodyErr = document.querySelector('.data-table tbody');
      if (tbodyErr) TableAnimationHelper.hideLoadingOverlay(tbodyErr);
      window.ErrorHandler?.handle(error, 'VideoList.loadAndRender');
      console.error('❌ Fehler beim Laden der Videos:', error);
    }
  }

  async reloadData() {
    try {
      if (this.viewMode === 'unternehmen') {
        await this.loadUnternehmenFolders();
        this.listViewMode === 'grid' ? this.updateFoldersView() : this.updateUnternehmenListTable();
      } else if (this.viewMode === 'kampagnen') {
        await this.loadKampagnenFolders();
        this.listViewMode === 'grid' ? this.updateKampagnenGridView() : this.updateKampagnenListTable();
      } else {
        const videos = await this.loadVideosWithRelations();
        this.updateTable(videos);
      }
    } catch (error) {
      window.ErrorHandler?.handle(error, 'VideoList.reloadData');
    }
  }

  // ============================================
  // DATA LOADING: Unternehmen Folders
  // ============================================

  async loadUnternehmenFolders() {
    try {
      if (!window.supabase) return [];

      const { data, error } = await window.supabase
        .from('kooperation_videos')
        .select(`
          id,
          kooperation:kooperation_id (
            kampagne:kampagne_id (
              id,
              marke:marke_id (
                unternehmen:unternehmen_id (id, firmenname, logo_url)
              )
            )
          )
        `);

      if (error) throw error;

      const allowedKampagneIds = await KampagneUtils.loadAllowedKampagneIds();

      const unternehmenMap = new Map();
      (data || []).forEach(video => {
        const kampagne = video.kooperation?.kampagne;
        const unternehmen = kampagne?.marke?.unternehmen;
        if (!unternehmen?.id) return;
        if (allowedKampagneIds !== null && !allowedKampagneIds.includes(kampagne.id)) return;

        const existing = unternehmenMap.get(unternehmen.id);
        if (existing) {
          existing.count++;
        } else {
          unternehmenMap.set(unternehmen.id, {
            id: unternehmen.id,
            firmenname: unternehmen.firmenname,
            logo_url: unternehmen.logo_url,
            count: 1
          });
        }
      });

      this.unternehmenFolders = Array.from(unternehmenMap.values())
        .sort((a, b) => (a.firmenname || '').localeCompare(b.firmenname || '', 'de'));

      return this.unternehmenFolders;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Unternehmen:', error);
      return [];
    }
  }

  // ============================================
  // DATA LOADING: Kampagnen Folders
  // ============================================

  async loadKampagnenFolders() {
    try {
      if (!window.supabase || !this.currentUnternehmenId) return [];

      const { data, error } = await window.supabase
        .from('kooperation_videos')
        .select(`
          id,
          kooperation:kooperation_id (
            kampagne:kampagne_id (
              id,
              kampagnenname,
              eigener_name,
              marke:marke_id (
                unternehmen:unternehmen_id (id)
              )
            )
          )
        `);

      if (error) throw error;

      const allowedKampagneIds = await KampagneUtils.loadAllowedKampagneIds();

      const kampagnenMap = new Map();
      (data || []).forEach(video => {
        const kampagne = video.kooperation?.kampagne;
        const unternehmenId = kampagne?.marke?.unternehmen?.id;
        if (!kampagne?.id || unternehmenId !== this.currentUnternehmenId) return;
        if (allowedKampagneIds !== null && !allowedKampagneIds.includes(kampagne.id)) return;

        const existing = kampagnenMap.get(kampagne.id);
        if (existing) {
          existing.count++;
        } else {
          kampagnenMap.set(kampagne.id, {
            id: kampagne.id,
            name: KampagneUtils.getDisplayName(kampagne),
            count: 1
          });
        }
      });

      this.kampagnenFolders = Array.from(kampagnenMap.values())
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));

      return this.kampagnenFolders;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Kampagnen:', error);
      return [];
    }
  }

  // ============================================
  // DATA LOADING: Videos (Level 3)
  // ============================================

  async loadVideosWithRelations() {
    try {
      if (!window.supabase) return [];

      const isAdmin = window.currentUser?.rolle === 'admin';
      const isMitarbeiter = window.currentUser?.rolle === 'mitarbeiter';
      const userId = window.currentUser?.id;

      let allowedKampagneIds = [];
      if (!isAdmin && isMitarbeiter && userId) {
        try {
          const [kampagnenRes, markenRes, unternehmenRes] = await Promise.all([
            window.supabase.from('kampagne_mitarbeiter').select('kampagne_id').eq('mitarbeiter_id', userId),
            window.supabase.from('marke_mitarbeiter').select('marke_id').eq('mitarbeiter_id', userId),
            window.supabase.from('mitarbeiter_unternehmen').select('unternehmen_id').eq('mitarbeiter_id', userId)
          ]);

          const directKampagnenIds = (kampagnenRes.data || []).map(r => r.kampagne_id).filter(Boolean);
          const markenIds = (markenRes.data || []).map(r => r.marke_id).filter(Boolean);
          const unternehmenIds = (unternehmenRes.data || []).map(r => r.unternehmen_id).filter(Boolean);

          const secondaryQueries = [];
          if (markenIds.length > 0) {
            secondaryQueries.push(window.supabase.from('kampagne').select('id').in('marke_id', markenIds));
          }
          if (unternehmenIds.length > 0) {
            secondaryQueries.push(window.supabase.from('marke').select('id').in('unternehmen_id', unternehmenIds));
          }

          if (secondaryQueries.length > 0) {
            const secondaryResults = await Promise.all(secondaryQueries);

            if (markenIds.length > 0 && secondaryResults[0]) {
              directKampagnenIds.push(...(secondaryResults[0].data || []).map(k => k.id).filter(Boolean));
            }

            const unternehmenMarkenIdx = markenIds.length > 0 ? 1 : 0;
            if (unternehmenIds.length > 0 && secondaryResults[unternehmenMarkenIdx]) {
              const unternehmenMarkenIds = (secondaryResults[unternehmenMarkenIdx].data || []).map(m => m.id).filter(Boolean);
              if (unternehmenMarkenIds.length > 0) {
                const { data: kampagnen } = await window.supabase.from('kampagne').select('id').in('marke_id', unternehmenMarkenIds);
                directKampagnenIds.push(...(kampagnen || []).map(k => k.id).filter(Boolean));
              }
            }
          }

          allowedKampagneIds = [...new Set(directKampagnenIds)];
        } catch (error) {
          console.error('❌ Fehler beim Laden der Kampagnen-Zuordnungen:', error);
        }
      }

      const { currentPage, itemsPerPage } = this.pagination.getState();
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const activeFilters = filterSystem.getFilters('video');

      // Conditional inner join for kampagne filtering
      const koopJoin = this.currentKampagneId ? '!inner' : '';

      const selectFields = `
        id, kooperation_id, position, titel, content_art, status, posting_datum, thema,
        strategie_item:strategie_item_id (id, screenshot_url),
        kooperation:kooperation_id${koopJoin} (
          id, name, kampagne_id,
          kampagne:kampagne_id (id, kampagnenname, eigener_name),
          creator:creator_id (id, vorname, nachname)
        )
      `;

      // Count query
      let countSelect = this.currentKampagneId
        ? 'id, kooperation:kooperation_id!inner(kampagne_id)'
        : '*';

      let countQuery = window.supabase
        .from('kooperation_videos')
        .select(countSelect, { count: 'exact', head: true });

      if (this.currentKampagneId) {
        countQuery = countQuery.eq('kooperation.kampagne_id', this.currentKampagneId);
      }
      countQuery = VideoFilterLogic.buildSupabaseQuery(countQuery, activeFilters);

      // Main query
      let videoQuery = window.supabase
        .from('kooperation_videos')
        .select(selectFields)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (this.currentKampagneId) {
        videoQuery = videoQuery.eq('kooperation.kampagne_id', this.currentKampagneId);
      }
      videoQuery = VideoFilterLogic.buildSupabaseQuery(videoQuery, activeFilters);

      const [countResult, videoResult] = await Promise.all([countQuery, videoQuery]);

      const { count } = countResult;
      const { data: videos, error: videoError } = videoResult;

      this.pagination.updateTotal(count || 0);
      this.pagination.render();

      if (videoError) throw videoError;
      if (!videos || videos.length === 0) return [];

      let filteredVideos = videos;
      if (!isAdmin && isMitarbeiter && allowedKampagneIds.length > 0) {
        filteredVideos = videos.filter(v =>
          v.kooperation?.kampagne_id && allowedKampagneIds.includes(v.kooperation.kampagne_id)
        );
      }

      this.videos = filteredVideos;
      return filteredVideos;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Videos:', error);
      return [];
    }
  }

  // ============================================
  // RENDER: Main Dispatcher
  // ============================================

  async render() {
    let html;
    if (this.viewMode === 'unternehmen') {
      html = this.renderFoldersView();
    } else if (this.viewMode === 'kampagnen') {
      html = this.renderKampagnenView();
    } else {
      html = this.renderVideosView();
    }
    window.setContentSafely(window.content, html);
  }

  // ============================================
  // RENDER: Level 1 – Unternehmen Folders
  // ============================================

  renderFoldersView() {
    const viewToggleHtml = ViewModeToggle.render([
      { buttonId: 'btn-view-list', label: 'Liste', icon: 'list', active: this.listViewMode === 'list' },
      { buttonId: 'btn-view-grid', label: 'Grid', icon: 'grid', active: this.listViewMode === 'grid' }
    ]);

    return `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">
              ${viewToggleHtml}
            </div>
          </div>
        </div>
        <div class="table-container">
          ${this.listViewMode === 'grid'
            ? `<div class="folders-grid" id="folders-grid">
                <div class="loading-placeholder">Lade Unternehmens-Ordner...</div>
              </div>`
            : this.renderUnternehmenListTableHtml()
          }
        </div>
      </div>
    `;
  }

  renderUnternehmenListTableHtml() {
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Unternehmen</th>
            <th>Videos</th>
          </tr>
        </thead>
        <tbody id="unternehmen-list-table-body">
          <tr><td colspan="2" class="no-data">Lade Unternehmen...</td></tr>
        </tbody>
      </table>
    `;
  }

  updateFoldersView() {
    const grid = document.getElementById('folders-grid');
    if (!grid) return;

    if (!this.unternehmenFolders || this.unternehmenFolders.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: var(--space-xxl);">
          <div class="empty-icon">🎬</div>
          <h3>Keine Videos vorhanden</h3>
          <p>Es wurden noch keine Videos mit Unternehmen verknüpft.</p>
        </div>
      `;
      return;
    }

    const esc = (t) => window.validatorSystem?.sanitizeHtml(t) || t || '';
    const folderSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="folder-svg">
      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>`;

    grid.innerHTML = this.unternehmenFolders.map(f => `
      <div class="folder-card" data-unternehmen-id="${f.id}" data-unternehmen-name="${esc(f.firmenname)}">
        <div class="folder-icon">
          ${f.logo_url
            ? `<img src="${esc(f.logo_url)}" alt="${esc(f.firmenname)}" class="folder-logo">`
            : folderSvg
          }
        </div>
        <div class="folder-info">
          <span class="folder-name">${esc(f.firmenname)}</span>
          <span class="folder-count">${f.count} ${f.count === 1 ? 'Video' : 'Videos'}</span>
        </div>
      </div>
    `).join('');
  }

  updateUnternehmenListTable() {
    const tbody = document.getElementById('unternehmen-list-table-body');
    if (!tbody) return;

    if (!this.unternehmenFolders || this.unternehmenFolders.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="2" class="no-data">
          <div class="empty-state">
            <div class="empty-icon">🎬</div>
            <h3>Keine Videos vorhanden</h3>
            <p>Es wurden noch keine Videos mit Unternehmen verknüpft.</p>
          </div>
        </td></tr>
      `;
      return;
    }

    const esc = (t) => window.validatorSystem?.sanitizeHtml(t) || t || '';

    tbody.innerHTML = this.unternehmenFolders.map(f => `
      <tr class="table-row-clickable unternehmen-row" data-unternehmen-id="${f.id}" data-unternehmen-name="${esc(f.firmenname)}">
        <td>
          <div style="display: flex; align-items: center; gap: var(--space-sm);">
            ${f.logo_url ? `<img src="${esc(f.logo_url)}" alt="${esc(f.firmenname)}" class="table-logo">` : ''}
            <a href="#" class="table-link unternehmen-link" data-unternehmen-id="${f.id}" data-unternehmen-name="${esc(f.firmenname)}">${esc(f.firmenname)}</a>
          </div>
        </td>
        <td>${f.count}</td>
      </tr>
    `).join('');

    this.bindUnternehmenRowEvents();
  }

  bindUnternehmenRowEvents() {
    document.querySelectorAll('.unternehmen-row').forEach(row => {
      const handler = (e) => {
        if (e.target.closest('.unternehmen-link')) e.preventDefault();
        const id = row.dataset.unternehmenId;
        const name = row.dataset.unternehmenName;
        if (id) this.switchToKampagnenView(id, name);
      };
      row.addEventListener('click', handler);
      this._boundEventListeners.add(() => row.removeEventListener('click', handler));
    });
  }

  // ============================================
  // RENDER: Level 2 – Kampagnen Folders
  // ============================================

  renderKampagnenView() {
    const viewToggleHtml = ViewModeToggle.render([
      { buttonId: 'btn-view-list', label: 'Liste', icon: 'list', active: this.listViewMode === 'list' },
      { buttonId: 'btn-view-grid', label: 'Grid', icon: 'grid', active: this.listViewMode === 'grid' }
    ]);

    const backSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
      <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>`;

    return `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">
              <button id="btn-back-to-unternehmen" class="secondary-btn">${backSvg} Zurück</button>
              ${viewToggleHtml}
            </div>
          </div>
        </div>
        <div class="table-container">
          ${this.listViewMode === 'grid'
            ? `<div class="folders-grid" id="kampagnen-grid">
                <div class="loading-placeholder">Lade Kampagnen...</div>
              </div>`
            : this.renderKampagnenListTableHtml()
          }
        </div>
      </div>
    `;
  }

  renderKampagnenListTableHtml() {
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Kampagne</th>
            <th>Videos</th>
          </tr>
        </thead>
        <tbody id="kampagnen-list-table-body">
          <tr><td colspan="2" class="no-data">Lade Kampagnen...</td></tr>
        </tbody>
      </table>
    `;
  }

  updateKampagnenGridView() {
    const grid = document.getElementById('kampagnen-grid');
    if (!grid) return;

    if (!this.kampagnenFolders || this.kampagnenFolders.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: var(--space-xxl);">
          <div class="empty-icon">📂</div>
          <h3>Keine Kampagnen</h3>
          <p>Für dieses Unternehmen gibt es noch keine Videos.</p>
        </div>
      `;
      return;
    }

    const esc = (t) => window.validatorSystem?.sanitizeHtml(t) || t || '';
    const folderSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="folder-svg">
      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>`;

    grid.innerHTML = this.kampagnenFolders.map(f => `
      <div class="folder-card" data-kampagne-id="${f.id}" data-kampagne-name="${esc(f.name)}">
        <div class="folder-icon">${folderSvg}</div>
        <div class="folder-info">
          <span class="folder-name">${esc(f.name)}</span>
          <span class="folder-count">${f.count} ${f.count === 1 ? 'Video' : 'Videos'}</span>
        </div>
      </div>
    `).join('');
  }

  updateKampagnenListTable() {
    const tbody = document.getElementById('kampagnen-list-table-body');
    if (!tbody) return;

    if (!this.kampagnenFolders || this.kampagnenFolders.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="2" class="no-data">
          <div class="empty-state">
            <div class="empty-icon">📂</div>
            <h3>Keine Kampagnen</h3>
            <p>Für dieses Unternehmen gibt es noch keine Videos.</p>
          </div>
        </td></tr>
      `;
      return;
    }

    const esc = (t) => window.validatorSystem?.sanitizeHtml(t) || t || '';

    tbody.innerHTML = this.kampagnenFolders.map(f => `
      <tr class="table-row-clickable kampagne-row" data-kampagne-id="${f.id}" data-kampagne-name="${esc(f.name)}">
        <td>
          <a href="#" class="table-link kampagne-folder-link" data-kampagne-id="${f.id}" data-kampagne-name="${esc(f.name)}">${esc(f.name)}</a>
        </td>
        <td>${f.count}</td>
      </tr>
    `).join('');

    this.bindKampagnenRowEvents();
  }

  bindKampagnenRowEvents() {
    document.querySelectorAll('.kampagne-row').forEach(row => {
      const handler = (e) => {
        if (e.target.closest('.kampagne-folder-link')) e.preventDefault();
        const id = row.dataset.kampagneId;
        const name = row.dataset.kampagneName;
        if (id) this.switchToVideosView(id, name);
      };
      row.addEventListener('click', handler);
      this._boundEventListeners.add(() => row.removeEventListener('click', handler));
    });
  }

  // ============================================
  // RENDER: Level 3 – Video-Tabelle
  // ============================================

  renderVideosView() {
    const backSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
      <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>`;

    return `
      <div class="page-header">
        <div class="page-header-right"></div>
      </div>
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            <button id="btn-back-to-kampagnen" class="secondary-btn">${backSvg} Zurück</button>
            <div id="filter-dropdown-container"></div>
          </div>
        </div>
      </div>
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-name">Thema</th>
              <th>Kooperation</th>
              <th>Creator</th>
              <th>Content Art</th>
              <th>Status</th>
              <th class="video-posting-datum-cell">Posting Datum</th>
            </tr>
          </thead>
          <tbody id="videos-table-body">
            <tr><td colspan="6" class="loading">Lade Videos...</td></tr>
          </tbody>
        </table>
      </div>
      <div class="pagination-container" id="pagination-videos"></div>
    `;
  }

  updateTable(videos) {
    const tbody = document.getElementById('videos-table-body');
    if (!tbody) return;

    if (!videos || videos.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="6" class="empty-state">
          <div class="empty-icon">🎬</div>
          <h3>Keine Videos vorhanden</h3>
          <p>Es wurden noch keine Videos erstellt.</p>
        </td></tr>
      `;
      return;
    }

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
    const esc = (t) => window.validatorSystem?.sanitizeHtml(t) || t || '';

    const rowsHtml = videos.map(video => {
      const kooperation = video.kooperation || {};
      const creator = kooperation.creator || {};
      const strategieItem = video.strategie_item || {};

      let themaHtml = '-';
      if (strategieItem.screenshot_url) {
        themaHtml = `<img src="${esc(strategieItem.screenshot_url)}" alt="Thema" class="video-list-thumbnail" />`;
      } else if (video.thema) {
        themaHtml = esc(video.thema);
      } else if (video.titel) {
        themaHtml = esc(video.titel);
      }

      const creatorName = creator.vorname
        ? `${esc(creator.vorname)} ${esc(creator.nachname || '')}`.trim()
        : '-';

      const statusClass = video.status === 'abgeschlossen' ? 'status-abgeschlossen' : 'status-produktion';

      const contentArtHtml = video.content_art
        ? `<div class="tags tags-compact"><span class="tag tag--type">${esc(video.content_art)}</span></div>`
        : '-';

      return `
        <tr data-id="${video.id}">
          <td class="col-name video-thema-cell">${themaHtml}</td>
          <td>
            ${kooperation.id ? `<a href="#" class="table-link" data-table="kooperation" data-id="${kooperation.id}">${esc(kooperation.name || '—')}</a>` : '-'}
          </td>
          <td>
            ${creator.id ? `<a href="#" class="table-link" data-table="creator" data-id="${creator.id}">${creatorName}</a>` : '-'}
          </td>
          <td>${contentArtHtml}</td>
          <td><span class="status-badge ${statusClass}">${esc(video.status) || 'produktion'}</span></td>
          <td>${formatDate(video.posting_datum)}</td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
    this.bindDragToScroll();
  }

  // ============================================
  // FILTER
  // ============================================

  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('video', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  onFiltersApplied(filters) {
    filterSystem.applyFilters('video', filters);
    this.pagination.reset();
    this.loadAndRender();
  }

  onFiltersReset() {
    filterSystem.resetFilters('video');
    this.pagination.reset();
    this.loadAndRender();
  }

  // ============================================
  // VIEW SWITCHING
  // ============================================

  switchToUnternehmenView() {
    this.viewMode = 'unternehmen';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentKampagneId = null;
    this.currentKampagneName = null;
    this.updateBreadcrumb();
    this.loadAndRender();
  }

  switchToKampagnenView(unternehmenId, unternehmenName) {
    this.viewMode = 'kampagnen';
    this.currentUnternehmenId = unternehmenId;
    this.currentUnternehmenName = unternehmenName;
    this.currentKampagneId = null;
    this.currentKampagneName = null;
    this.updateBreadcrumb();
    this.loadAndRender();
  }

  switchToVideosView(kampagneId, kampagneName) {
    this.viewMode = 'videos';
    this.currentKampagneId = kampagneId;
    this.currentKampagneName = kampagneName;
    this.pagination.currentPage = 1;
    this.updateBreadcrumb();
    this.loadAndRender();
  }

  // ============================================
  // EVENTS
  // ============================================

  bindEvents() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();

    // View-Toggle (Grid / Liste)
    const btnViewList = document.getElementById('btn-view-list');
    const btnViewGrid = document.getElementById('btn-view-grid');

    if (btnViewList) {
      const handler = (e) => {
        e.preventDefault();
        if (this.listViewMode === 'list') return;
        this.listViewMode = 'list';
        this.loadAndRender();
      };
      btnViewList.addEventListener('click', handler);
      this._boundEventListeners.add(() => btnViewList.removeEventListener('click', handler));
    }

    if (btnViewGrid) {
      const handler = (e) => {
        e.preventDefault();
        if (this.listViewMode === 'grid') return;
        this.listViewMode = 'grid';
        this.loadAndRender();
      };
      btnViewGrid.addEventListener('click', handler);
      this._boundEventListeners.add(() => btnViewGrid.removeEventListener('click', handler));
    }

    // Back buttons
    const backToUnternehmen = document.getElementById('btn-back-to-unternehmen');
    if (backToUnternehmen) {
      const handler = (e) => { e.preventDefault(); this.switchToUnternehmenView(); };
      backToUnternehmen.addEventListener('click', handler);
      this._boundEventListeners.add(() => backToUnternehmen.removeEventListener('click', handler));
    }

    const backToKampagnen = document.getElementById('btn-back-to-kampagnen');
    if (backToKampagnen) {
      const handler = (e) => { e.preventDefault(); this.switchToKampagnenView(this.currentUnternehmenId, this.currentUnternehmenName); };
      backToKampagnen.addEventListener('click', handler);
      this._boundEventListeners.add(() => backToKampagnen.removeEventListener('click', handler));
    }

    // Folder clicks (Grid)
    const foldersGrid = document.getElementById('folders-grid');
    if (foldersGrid) {
      const handler = (e) => {
        const card = e.target.closest('.folder-card');
        if (card) {
          this.switchToKampagnenView(card.dataset.unternehmenId, card.dataset.unternehmenName);
        }
      };
      foldersGrid.addEventListener('click', handler);
      this._boundEventListeners.add(() => foldersGrid.removeEventListener('click', handler));
    }

    const kampagnenGrid = document.getElementById('kampagnen-grid');
    if (kampagnenGrid) {
      const handler = (e) => {
        const card = e.target.closest('.folder-card');
        if (card) {
          this.switchToVideosView(card.dataset.kampagneId, card.dataset.kampagneName);
        }
      };
      kampagnenGrid.addEventListener('click', handler);
      this._boundEventListeners.add(() => kampagnenGrid.removeEventListener('click', handler));
    }

    // Table link handlers (video detail, kooperation, kampagne, creator)
    const linkHandler = (e) => {
      const link = e.target.closest('.table-link[data-table]');
      if (!link) return;
      e.preventDefault();
      const table = link.dataset.table;
      const id = link.dataset.id;
      if (!id) return;
      const routes = {
        video: `/video/${id}`,
        kooperation: `/kooperation/${id}`,
        kampagne: `/kampagne/${id}`,
        creator: `/creator/${id}`
      };
      if (routes[table]) window.navigateTo(routes[table]);
    };
    document.addEventListener('click', linkHandler);
    this._boundEventListeners.add(() => document.removeEventListener('click', linkHandler));
  }

  // Drag-to-Scroll
  bindDragToScroll() {
    const container = document.querySelector('.data-table-container');
    if (!container) return;

    this.dragScrollContainer = container;

    if (this._dragMouseDown) {
      container.removeEventListener('mousedown', this._dragMouseDown);
      container.removeEventListener('mousemove', this._dragMouseMove);
      container.removeEventListener('mouseup', this._dragMouseUp);
      container.removeEventListener('mouseleave', this._dragMouseUp);
    }

    this._dragMouseDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' ||
          e.target.classList.contains('status-badge') || e.target.closest('a')) return;
      this.isDragging = true;
      this.startX = e.pageX - container.offsetLeft;
      this.scrollLeft = container.scrollLeft;
      container.classList.add('is-dragging');
      e.preventDefault();
    };

    this._dragMouseMove = (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      container.scrollLeft = this.scrollLeft - (x - this.startX) * 1.5;
    };

    this._dragMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        container.classList.remove('is-dragging');
      }
    };

    container.addEventListener('mousedown', this._dragMouseDown);
    container.addEventListener('mousemove', this._dragMouseMove);
    container.addEventListener('mouseup', this._dragMouseUp);
    container.addEventListener('mouseleave', this._dragMouseUp);
  }

  // ============================================
  // CLEANUP
  // ============================================

  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();

    if (this.pagination) this.pagination.destroy();

    if (this.dragScrollContainer) {
      this.dragScrollContainer.classList.remove('is-dragging');
      this.isDragging = false;
      this.dragScrollContainer = null;
    }

    this.videos = [];
    this.unternehmenFolders = [];
    this.kampagnenFolders = [];
    this.viewMode = 'unternehmen';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentKampagneId = null;
    this.currentKampagneName = null;
  }
}

export const videoList = new VideoList();
