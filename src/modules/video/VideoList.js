// VideoList.js (ES6-Modul)
// Video-Übersichtsseite mit allen Videos aller Kampagnen

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { VideoFilterLogic } from './filters/VideoFilterLogic.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';

export class VideoList {
  constructor() {
    this.videos = [];
    this.statusOptions = ['produktion', 'abgeschlossen'];
    
    // Pagination
    this.pagination = new PaginationSystem();
    
    // Drag-to-Scroll State
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.dragScrollContainer = null;
  }

  // Initialisiere Video-Liste
  async init() {
    window.setHeadline('Videos Übersicht');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Videos', url: '/videos', clickable: false }
      ]);
    }
    
    // Berechtigungsprüfung über PermissionSystem
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

    // Pagination initialisieren mit dynamicResize
    this.pagination.init('pagination-videos', {
      itemsPerPage: 25,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: () => this.loadAndRender(),
      dynamicResize: true,
      tbodySelector: '.data-table tbody'
    });

    // Events binden
    this.bindEvents();
    
    await this.loadAndRender();
  }

  // Seitenwechsel Handler
  handlePageChange(page) {
    this.loadAndRender();
  }

  // Lade und rendere Video-Liste
  async loadAndRender() {
    try {
      // Rendere die Seiten-Struktur
      await this.render();
      
      // Initialisiere Filterbar
      await this.initializeFilterBar();
      
      // Lade gefilterte Videos
      const filteredVideos = await this.loadVideosWithRelations();
      
      // Aktualisiere Tabelle
      this.updateTable(filteredVideos);
      
    } catch (error) {
      window.ErrorHandler?.handle(error, 'VideoList.loadAndRender');
      console.error('❌ Fehler beim Laden der Videos:', error);
    }
  }

  // Lade Videos mit Beziehungen (optimiert mit Promise.all und JOINs)
  async loadVideosWithRelations() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        return [];
      }

      const isAdmin = window.currentUser?.rolle === 'admin';
      const isMitarbeiter = window.currentUser?.rolle === 'mitarbeiter';
      const userId = window.currentUser?.id;
      
      // Für Mitarbeiter: Lade erlaubte Kampagnen-IDs (parallelisiert)
      let allowedKampagneIds = [];
      if (!isAdmin && isMitarbeiter && userId) {
        try {
          // Alle 3 Basis-Queries parallel ausführen
          const [kampagnenRes, markenRes, unternehmenRes] = await Promise.all([
            window.supabase
              .from('kampagne_mitarbeiter')
              .select('kampagne_id')
              .eq('mitarbeiter_id', userId),
            window.supabase
              .from('marke_mitarbeiter')
              .select('marke_id')
              .eq('mitarbeiter_id', userId),
            window.supabase
              .from('mitarbeiter_unternehmen')
              .select('unternehmen_id')
              .eq('mitarbeiter_id', userId)
          ]);

          const directKampagnenIds = (kampagnenRes.data || []).map(r => r.kampagne_id).filter(Boolean);
          const markenIds = (markenRes.data || []).map(r => r.marke_id).filter(Boolean);
          const unternehmenIds = (unternehmenRes.data || []).map(r => r.unternehmen_id).filter(Boolean);

          // Zweite Runde: Kampagnen aus Marken und Marken aus Unternehmen parallel
          const secondaryQueries = [];
          
          if (markenIds.length > 0) {
            secondaryQueries.push(
              window.supabase.from('kampagne').select('id').in('marke_id', markenIds)
            );
          }
          
          if (unternehmenIds.length > 0) {
            secondaryQueries.push(
              window.supabase.from('marke').select('id').in('unternehmen_id', unternehmenIds)
            );
          }

          if (secondaryQueries.length > 0) {
            const secondaryResults = await Promise.all(secondaryQueries);
            
            // Kampagnen aus Marken
            if (markenIds.length > 0 && secondaryResults[0]) {
              const markenKampagnenIds = (secondaryResults[0].data || []).map(k => k.id).filter(Boolean);
              directKampagnenIds.push(...markenKampagnenIds);
            }
            
            // Marken aus Unternehmen -> dann Kampagnen aus diesen Marken
            const unternehmenMarkenIdx = markenIds.length > 0 ? 1 : 0;
            if (unternehmenIds.length > 0 && secondaryResults[unternehmenMarkenIdx]) {
              const unternehmenMarkenIds = (secondaryResults[unternehmenMarkenIdx].data || []).map(m => m.id).filter(Boolean);
              
              if (unternehmenMarkenIds.length > 0) {
                const { data: kampagnen } = await window.supabase
                  .from('kampagne')
                  .select('id')
                  .in('marke_id', unternehmenMarkenIds);
                
                const unternehmenKampagnenIds = (kampagnen || []).map(k => k.id).filter(Boolean);
                directKampagnenIds.push(...unternehmenKampagnenIds);
              }
            }
          }
          
          allowedKampagneIds = [...new Set(directKampagnenIds)];
        } catch (error) {
          console.error('❌ Fehler beim Laden der Kampagnen-Zuordnungen:', error);
        }
      }

      // Pagination State abrufen
      const { currentPage, itemsPerPage } = this.pagination.getState();
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // Filter aus FilterSystem abrufen
      const activeFilters = filterSystem.getFilters('video');

      // Total Count für Pagination abfragen (parallel zum Haupt-Query)
      let countQuery = window.supabase
        .from('kooperation_videos')
        .select('*', { count: 'exact', head: true });
      countQuery = VideoFilterLogic.buildSupabaseQuery(countQuery, activeFilters);

      // Videos mit allen Relationen in einem einzigen Query laden
      let videoQuery = window.supabase
        .from('kooperation_videos')
        .select(`
          id, 
          kooperation_id, 
          position, 
          titel,
          content_art, 
          status, 
          posting_datum, 
          thema,
          strategie_item:strategie_item_id (
            id, 
            screenshot_url
          ),
          kooperation:kooperation_id (
            id, 
            name, 
            kampagne_id,
            kampagne:kampagne_id (
              id, 
              kampagnenname,
              eigener_name
            ),
            creator:creator_id (
              id, 
              vorname, 
              nachname
            )
          )
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      // Filter anwenden
      videoQuery = VideoFilterLogic.buildSupabaseQuery(videoQuery, activeFilters);

      // Beide Queries parallel ausführen
      const [countResult, videoResult] = await Promise.all([countQuery, videoQuery]);

      const { count } = countResult;
      const { data: videos, error: videoError } = videoResult;

      // Pagination aktualisieren
      this.pagination.updateTotal(count || 0);
      this.pagination.render();

      if (videoError) {
        console.error('❌ Fehler beim Laden der Videos:', videoError);
        throw videoError;
      }

      if (!videos || videos.length === 0) {
        return [];
      }

      // Für Mitarbeiter: Filtere auf erlaubte Kampagnen
      let filteredVideos = videos;
      if (!isAdmin && isMitarbeiter && allowedKampagneIds.length > 0) {
        filteredVideos = videos.filter(v => 
          v.kooperation?.kampagne_id && allowedKampagneIds.includes(v.kooperation.kampagne_id)
        );
      }

      // Für Kunden: RLS-Policies filtern automatisch
      
      this.videos = filteredVideos;
      return filteredVideos;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Videos:', error);
      return [];
    }
  }

  // Rendere Seiten-Struktur
  async render() {
    const filterHtml = `
      <div class="filter-bar">
        <div class="filter-left">
          <div id="filter-dropdown-container"></div>
        </div>
      </div>
    `;

    const html = `
      <div class="page-header">
        <div class="page-header-right"></div>
      </div>

      <div class="table-filter-wrapper">
        ${filterHtml}
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-name">Thema</th>
              <th>Kampagne</th>
              <th>Kooperation</th>
              <th>Creator</th>
              <th>Content Art</th>
              <th>Status</th>
              <th class="video-posting-datum-cell">Posting Datum</th>
            </tr>
          </thead>
          <tbody id="videos-table-body">
            <tr>
              <td colspan="7" class="loading">Lade Videos...</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="pagination-container" id="pagination-videos"></div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Initialisiere Filterbar
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('video', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    filterSystem.applyFilters('video', filters);
    // Reset pagination auf Seite 1 bei neuen Filtern
    this.pagination.reset();
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    filterSystem.resetFilters('video');
    // Reset pagination auf Seite 1
    this.pagination.reset();
    this.loadAndRender();
  }

  // Binde Events
  bindEvents() {
    // Video Detail Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'video') {
        e.preventDefault();
        const videoId = e.target.dataset.id;
        window.navigateTo(`/video/${videoId}`);
      }
    });

    // Kooperation Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'kooperation') {
        e.preventDefault();
        const koopId = e.target.dataset.id;
        window.navigateTo(`/kooperation/${koopId}`);
      }
    });

    // Kampagne Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'kampagne') {
        e.preventDefault();
        const kampagneId = e.target.dataset.id;
        window.navigateTo(`/kampagne/${kampagneId}`);
      }
    });

    // Creator Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'creator') {
        e.preventDefault();
        const creatorId = e.target.dataset.id;
        window.navigateTo(`/creator/${creatorId}`);
      }
    });
  }

  // Update Tabelle
  updateTable(videos) {
    const tbody = document.getElementById('videos-table-body');
    if (!tbody) return;

    if (!videos || videos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-icon">🎬</div>
            <h3>Keine Videos vorhanden</h3>
            <p>Es wurden noch keine Videos erstellt.</p>
          </td>
        </tr>
      `;
      return;
    }

    const formatDate = (date) => {
      return date ? new Date(date).toLocaleDateString('de-DE') : '-';
    };

    const escapeHtml = (text) => {
      if (!text) return '';
      return window.validatorSystem?.sanitizeHtml(text) || text;
    };

    const rowsHtml = videos.map(video => {
      const kooperation = video.kooperation || {};
      const kampagne = kooperation.kampagne || {};
      const creator = kooperation.creator || {};
      const strategieItem = video.strategie_item || {};

      // Thema: Screenshot oder Titel
      let themaHtml = '-';
      if (strategieItem.screenshot_url) {
        themaHtml = `<img src="${escapeHtml(strategieItem.screenshot_url)}" alt="Thema" class="video-list-thumbnail" />`;
      } else if (video.thema) {
        themaHtml = escapeHtml(video.thema);
      } else if (video.titel) {
        themaHtml = escapeHtml(video.titel);
      }

      // Creator Name
      const creatorName = creator.vorname 
        ? `${escapeHtml(creator.vorname)} ${escapeHtml(creator.nachname || '')}`.trim()
        : '-';

      // Status Badge
      const statusClass = video.status === 'abgeschlossen' ? 'status-abgeschlossen' : 'status-produktion';

      // Content Art als Tag
      const contentArtHtml = video.content_art 
        ? `<div class="tags tags-compact"><span class="tag tag--type">${escapeHtml(video.content_art)}</span></div>`
        : '-';

      return `
        <tr data-id="${video.id}">
          <td class="col-name video-thema-cell">${themaHtml}</td>
          <td>
            ${kampagne.id ? `
              <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
                ${escapeHtml(KampagneUtils.getDisplayName(kampagne))}
              </a>
            ` : '-'}
          </td>
          <td>
            ${kooperation.id ? `
              <a href="#" class="table-link" data-table="kooperation" data-id="${kooperation.id}">
                ${escapeHtml(kooperation.name || '—')}
              </a>
            ` : '-'}
          </td>
          <td>
            ${creator.id ? `
              <a href="#" class="table-link" data-table="creator" data-id="${creator.id}">
                ${creatorName}
              </a>
            ` : '-'}
          </td>
          <td>${contentArtHtml}</td>
          <td>
            <span class="status-badge ${statusClass}">
              ${escapeHtml(video.status) || 'produktion'}
            </span>
          </td>
          <td>${formatDate(video.posting_datum)}</td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
    
    // Drag-to-Scroll initialisieren
    this.bindDragToScroll();
  }

  // Drag-to-Scroll für horizontales Scrollen
  bindDragToScroll() {
    const container = document.querySelector('.data-table-container');
    if (!container) return;
    
    this.dragScrollContainer = container;
    
    // Entferne alte Event-Listener
    if (this._dragMouseDown) {
      container.removeEventListener('mousedown', this._dragMouseDown);
      container.removeEventListener('mousemove', this._dragMouseMove);
      container.removeEventListener('mouseup', this._dragMouseUp);
      container.removeEventListener('mouseleave', this._dragMouseUp);
    }
    
    this._dragMouseDown = (e) => {
      if (
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'BUTTON' ||
        e.target.classList.contains('status-badge') ||
        e.target.closest('a')
      ) {
        return;
      }
      
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
      const walk = (x - this.startX) * 1.5;
      container.scrollLeft = this.scrollLeft - walk;
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

  // Cleanup
  destroy() {
    if (this.pagination) {
      this.pagination.destroy();
    }
    
    if (this.dragScrollContainer) {
      this.dragScrollContainer.classList.remove('is-dragging');
      this.isDragging = false;
      this.dragScrollContainer = null;
    }
  }
}

// Exportiere Instanz für globale Nutzung
export const videoList = new VideoList();
