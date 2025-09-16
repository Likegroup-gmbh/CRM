// KooperationList.js (ES6-Modul)
// Kooperations-Liste mit neuem Filtersystem

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { actionsDropdown } from '../../core/ActionsDropdown.js';

export class KooperationList {
  constructor() {
    this.selectedKooperation = new Set();
    this._boundEventListeners = new Set();
    this.statusOptions = [];
  }

  // Initialisiere Kooperations-Liste
  async init() {
    window.setHeadline('Kooperationen Übersicht');
    
    // Verstecke Bulk-Actions für Kunden
    if (window.bulkActionSystem) {
      window.bulkActionSystem.hideForKunden();
    }
    
    const canView = (window.canViewPage && window.canViewPage('kooperation')) || await window.checkUserPermission('kooperation', 'can_view');
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Kooperationen anzuzeigen.</p>
        </div>
      `;
      return;
    }

    // Binde Events sofort
    this.bindEvents();
    
    await this.loadAndRender();
  }

  // Lade und rendere Kooperations-Liste
  async loadAndRender() {
    try {
      // Lade Filter-Daten separat
      const filterData = await window.dataService.loadFilterData('kooperation');
      
      // Rendere die Seite mit Filter-Daten (asynchron)
      await this.render(filterData);
      
      // Initialisiere Filterbar mit neuem System
      await this.initializeFilterBar();
      
      // Lade gefilterte Kooperationen für die Anzeige
      const currentFilters = filterSystem.getFilters('kooperation');
      console.log('🔍 Lade Kooperationen mit Filter:', currentFilters);
      const filteredKooperationen = await this.loadKooperationenWithRelations();
      console.log('📊 Kooperationen geladen:', filteredKooperationen?.length || 0);
      
      // Aktualisiere nur die Tabelle mit gefilterten Daten
      this.updateTable(filteredKooperationen);
      
    } catch (error) {
      window.ErrorHandler.handle(error, 'KooperationList.loadAndRender');
    }
  }

  // Lade Kooperationen mit Beziehungen
  async loadKooperationenWithRelations() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return await window.dataService.loadEntities('kooperation');
      }

      // Status-Optionen dynamisch laden (wie Kampagnen)
      try {
        const { data: statusRows } = await window.supabase
          .from('kampagne_status')
          .select('id, name, sort_order')
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });
        this.statusOptions = statusRows || [];
      } catch (e) {
        console.warn('⚠️ Konnte Status-Optionen nicht laden', e);
        this.statusOptions = [];
      }

      // Sichtbarkeit: Nicht-Admins nur eigene (assignee_id) ODER solche aus zugewiesenen Kampagnen/Marken
      const isAdmin = window.currentUser?.rolle === 'admin';
      let allowedKampagneIds = [];
      if (!isAdmin) {
        try {
          // 1. Direkt zugeordnete Kampagnen
          const { data: assignedKampagnen } = await window.supabase
            .from('kampagne_mitarbeiter')
            .select('kampagne_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          const directKampagnenIds = (assignedKampagnen || []).map(r => r.kampagne_id).filter(Boolean);
          
          // 2. Kampagnen über zugeordnete Marken
          const { data: assignedMarken } = await window.supabase
            .from('marke_mitarbeiter')
            .select('marke_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          const markenIds = (assignedMarken || []).map(r => r.marke_id).filter(Boolean);
          
          let markenKampagnenIds = [];
          if (markenIds.length > 0) {
            const { data: markenKampagnen } = await window.supabase
              .from('kampagne')
              .select('id')
              .in('marke_id', markenIds);
            markenKampagnenIds = (markenKampagnen || []).map(k => k.id).filter(Boolean);
          }
          
          // Kombiniere beide Listen und entferne Duplikate
          allowedKampagneIds = [...new Set([...directKampagnenIds, ...markenKampagnenIds])];
          
          console.log(`🔍 KOOPERATIONLIST: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`, {
            direkteKampagnen: directKampagnenIds.length,
            markenKampagnen: markenKampagnenIds.length,
            gesamt: allowedKampagneIds.length
          });
        } catch (error) {
          console.error('❌ Fehler beim Laden der Kampagnen-Zuordnungen:', error);
        }
      }

      let coopQuery = window.supabase
        .from('kooperationen')
        .select('id, name, status, status_id, videoanzahl, gesamtkosten, kampagne_id, creator_id, assignee_id, skript_deadline, content_deadline, created_at')
        .order('created_at', { ascending: false });

      // Für Mitarbeiter: Filtere nach zugewiesenen Kampagnen
      // Für Kunden: RLS-Policies filtern automatisch
      if (!isAdmin && window.currentUser?.rolle !== 'kunde') {
        coopQuery = coopQuery.or(`assignee_id.eq.${window.currentUser?.id}${allowedKampagneIds.length ? `,kampagne_id.in.(${allowedKampagneIds.join(',')})` : ''}`);
      }

      const { data, error } = await coopQuery;

      if (error) {
        console.error('❌ Fehler beim Laden der Kooperationen mit Beziehungen:', error);
        throw error;
      }

      // IDs sammeln und zugehörige Datensätze separat laden
      const kampagneIds = Array.from(new Set((data || []).map(k => k.kampagne_id).filter(Boolean)));
      const creatorIds = Array.from(new Set((data || []).map(k => k.creator_id).filter(Boolean)));

      let kampagneMap = {};
      let creatorMap = {};
      try {
        if (kampagneIds.length > 0) {
          const { data: kampagnen } = await window.supabase
            .from('kampagne')
            .select('id, kampagnenname, status, start, deadline')
            .in('id', kampagneIds);
          kampagneMap = (kampagnen || []).reduce((acc, k) => { acc[k.id] = k; return acc; }, {});
        }
        if (creatorIds.length > 0) {
          const { data: creators } = await window.supabase
            .from('creator')
            .select('id, vorname, nachname, instagram')
            .in('id', creatorIds);
          creatorMap = (creators || []).reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
        }
      } catch (relErr) {
        console.warn('⚠️ Beziehungen konnten nicht vollständig geladen werden:', relErr);
      }

      // Daten anreichern
      const formattedData = (data || []).map(k => ({
        ...k,
        creator: creatorMap[k.creator_id] || null,
        kampagne: kampagneMap[k.kampagne_id] || null
      }));

      // Maps für Renderer speichern (Fallbacks im UI möglich)
      this._kampagneMap = kampagneMap;
      this._creatorMap = creatorMap;

      console.log('✅ Kooperationen mit Beziehungen geladen:', formattedData);
      return formattedData;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Kooperationen mit Beziehungen:', error);
      // Fallback zu normalem Laden
      return await window.dataService.loadEntities('kooperation');
    }
  }

  // Rendere Kooperations-Liste
  async render(filterData) {
    const canEdit = window.currentUser?.permissions?.kooperation?.can_edit || false;
    
    // Aktive Filter als Tags
    let tags = '';
    const currentFilters = filterSystem.getFilters('kooperation');
    
    // Filter-Tags rendern (vereinfacht)
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        tags += `<span class="filter-tag" data-key="${key}">${key}: ${value} <b class="tag-x" data-key="${key}">×</b></span>`;
      }
    });
    
    // Filter-UI über dem Tabellen-Header
    let filterHtml = `<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters() ? 'inline-block' : 'none'};">Filter zurücksetzen</button>
      </div>
    </div>`;
    
    // Haupt-HTML
    let html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kooperationen</h1>
          <p>Verwalten Sie alle Kooperationen zwischen Creators und Kampagnen</p>
        </div>
        <div class="page-header-right">
          ${canEdit ? '<button id="btn-kooperation-new" class="primary-btn">Neue Kooperation anlegen</button>' : ''}
        </div>
      </div>

      ${filterHtml}

      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
        </div>
        <div class="table-actions-right">
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-kooperationen"></th>
              <th>Name</th>
              <th>Kampagne</th>
              <th>Creator</th>
              <th>Videos</th>
              <th>Status</th>
           <th>Gesamtkosten</th>
              <th>Start</th>
              <th>Ende</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="kooperationen-table-body">
            <tr>
              <td colspan="9" class="loading">Lade Kooperationen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Initialisiere Filterbar mit neuem Filtersystem
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
      // Nutze das neue Filtersystem für die Filterbar (asynchron)
      await filterSystem.renderFilterBar('kooperation', filterContainer, 
        (filters) => this.onFiltersApplied(filters),
        () => this.onFiltersReset()
      );
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('🔍 KooperationList: Filter angewendet:', filters);
    filterSystem.applyFilters('kooperation', filters);
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('🔄 KooperationList: Filter zurückgesetzt');
    filterSystem.resetFilters('kooperation');
    this.loadAndRender();
  }

  // Binde Events
  bindEvents() {
    // Reset All Button - spezifisch für dieses Modul
    this.boundFilterResetHandler = (e) => {
      if (e.target.id === 'btn-filter-reset') {
        this.onFiltersReset();
      }
    };
    document.addEventListener('click', this.boundFilterResetHandler);

    // Neue Kooperation anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-kooperation-new' || e.target.id === 'btn-kooperation-new-filter') {
        e.preventDefault();
        window.navigateTo('/kooperation/new');
      }
    });

    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.kooperation-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedKooperation.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-kooperationen');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = true;
        }
        this.updateSelection();
      }
    });

    // Auswahl aufheben Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-deselect-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.kooperation-check');
        checkboxes.forEach(cb => { cb.checked = false; });
        this.selectedKooperation.clear();
        const selectAllHeader = document.getElementById('select-all-kooperationen');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = false;
        }
        this.updateSelection();
      }
    });

    // Kooperation Detail Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'kooperation') {
        e.preventDefault();
        const kooperationId = e.target.dataset.id;
        console.log('🎯 KOOPERATIONLIST: Navigiere zu Kooperation Details:', kooperationId);
        window.navigateTo(`/kooperation/${kooperationId}`);
      }
    });

    // ActionsDropdown: Video hochladen Direkt-Navigation
    document.addEventListener('click', (e) => {
      const item = e.target.closest && e.target.closest('.action-item');
      if (!item) return;
      if (item.dataset.action === 'video-create' && item.dataset.id) {
        e.preventDefault();
        const koopId = item.dataset.id;
        window.navigateTo(`/video/new?kooperation=${koopId}`);
      }
    });

    // Entity Updated Event
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'kooperation') {
        this.loadAndRender();
      }
    });

    // Filter-Tag X-Buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-x')) {
        e.preventDefault();
        e.stopPropagation();
        
        const tagElement = e.target.closest('.filter-tag');
        const key = tagElement.dataset.key;
        
        // Entferne Filter
        const currentFilters = filterSystem.getFilters('kooperation');
        delete currentFilters[key];
        filterSystem.applyFilters('kooperation', currentFilters);
        this.loadAndRender();
      }
    });

    // Select-All Checkbox
    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-kooperationen') {
        const checkboxes = document.querySelectorAll('.kooperation-check');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
          if (e.target.checked) {
            this.selectedKooperation.add(cb.dataset.id);
          } else {
            this.selectedKooperation.delete(cb.dataset.id);
          }
        });
        this.updateSelection();
      }
    });

    // Kooperation Checkboxes
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('kooperation-check')) {
        if (e.target.checked) {
          this.selectedKooperation.add(e.target.dataset.id);
        } else {
          this.selectedKooperation.delete(e.target.dataset.id);
        }
        this.updateSelection();
      }
    });
  }

  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = filterSystem.getFilters('kooperation');
    return Object.keys(filters).length > 0;
  }

  // Update Selection
  updateSelection() {
    const selectedCount = this.selectedKooperation.size;
    const selectedCountElement = document.getElementById('selected-count');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    
    if (selectedCountElement) {
      selectedCountElement.textContent = `${selectedCount} ausgewählt`;
      selectedCountElement.style.display = selectedCount > 0 ? 'inline' : 'none';
    }
    
    if (deselectBtn) {
      deselectBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
    
    if (deleteBtn) {
      deleteBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
  }

  // Update Tabelle
  async updateTable(kooperationen) {
    const tbody = document.getElementById('kooperationen-table-body');
    if (!tbody) return;

    if (!kooperationen || kooperationen.length === 0) {
      const { renderEmptyState } = await import('../../core/FilterUI.js');
      renderEmptyState(tbody);
      return;
    }

    const rowsHtml = kooperationen.map(kooperation => {
      // Hilfsfunktionen für Formatierung
      const formatCurrency = (value) => {
        return value ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value) : '-';
      };
      
      const formatDate = (date) => {
        return date ? new Date(date).toLocaleDateString('de-DE') : '-';
      };

      return `
        <tr data-id="${kooperation.id}">
          <td><input type="checkbox" class="kooperation-check" data-id="${kooperation.id}"></td>
          <td>
            <a href="#" class="table-link" data-table="kooperation" data-id="${kooperation.id}">
              ${window.validatorSystem.sanitizeHtml(kooperation.name || '—')}
            </a>
          </td>
          <td>${window.validatorSystem.sanitizeHtml((kooperation.kampagne?.kampagnenname) || (this._kampagneMap?.[kooperation.kampagne_id]?.kampagnenname) || 'Unbekannt')}</td>
          <td>
            ${window.validatorSystem.sanitizeHtml(kooperation.creator ? `${kooperation.creator.vorname} ${kooperation.creator.nachname}` : (this._creatorMap?.[kooperation.creator_id] ? `${this._creatorMap[kooperation.creator_id].vorname} ${this._creatorMap[kooperation.creator_id].nachname}` : 'Unbekannt'))}
          </td>
          <td>${kooperation.videoanzahl || 0}</td>
          <td>
            <span class="status-badge status-${(kooperation.status || (this.statusOptions.find(s=>s.id===kooperation.status_id)?.name) || 'unknown').toLowerCase()}">
              ${kooperation.status || (this.statusOptions.find(s=>s.id===kooperation.status_id)?.name) || '-'}
            </span>
          </td>
          <td>${formatCurrency(kooperation.gesamtkosten)}</td>
          <td>${formatDate(kooperation.skript_deadline)}</td>
          <td>${formatDate(kooperation.content_deadline)}</td>
          <td>
            <div class="actions-dropdown-container" data-entity-type="kooperation">
              <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                </svg>
              </button>
              <div class="actions-dropdown">
                <div class="action-submenu">
                  <a href="#" class="action-item has-submenu" data-submenu="status">${actionsDropdown.getHeroIcon('invoice')}<span>Status ändern</span></a>
                  <div class="submenu" data-submenu="status">
                    ${ (this.statusOptions || []).map(st => `
                      <a href=\"#\" class=\"submenu-item\" data-action=\"set-field\" data-field=\"status_id\" data-value=\"${st.id}\" data-status-name=\"${st.name.replace(/\"/g,'\\\"')}\" data-id=\"${kooperation.id}\">${actionsDropdown.getStatusIcon(st.name)}<span>${st.name}</span>${(kooperation.status_id === st.id || kooperation.status === st.name) ? '<span class=\\"submenu-check\\">'+actionsDropdown.getHeroIcon('check')+'</span>' : ''}</a>
                    `).join('') }
                  </div>
                </div>
                <a href="#" class="action-item" data-action="view" data-id="${kooperation.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
                  </svg>
                  Details anzeigen
                </a>
                <a href="#" class="action-item" data-action="edit" data-id="${kooperation.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
                    <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
                  </svg>
                  Bearbeiten
                </a>
                <a href="#" class="action-item" data-action="video-create" data-id="${kooperation.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  Video hochladen
                </a>
                <a href="#" class="action-item" data-action="notiz" data-id="${kooperation.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.117C2.688 12.31 2 11.104 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
                  </svg>
                  Notiz hinzufügen
                </a>
                <a href="#" class="action-item" data-action="quickview" data-id="${kooperation.id}">
                  ${actionsDropdown.getHeroIcon('quickview')}
                  Schnellansicht öffnen
                </a>
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete" data-id="${kooperation.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
                  </svg>
                  Löschen
                </a>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
  }

  // Cleanup
  destroy() {
    console.log('KooperationList: Cleaning up...');
    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();
    
    // Event-Listener entfernen
    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
      this.boundFilterResetHandler = null;
    }
  }

  // Show Create Form (für Routing)
  showCreateForm() {
    console.log('🎯 Zeige Kooperations-Erstellungsformular');
    window.setHeadline('Neue Kooperation anlegen');
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('kooperation');
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Kooperation anlegen</h1>
          <p>Erstellen Sie eine neue Kooperation zwischen Creator und Kampagne</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kooperation')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('kooperation', null);
    
    // Custom Submit Handler für Seiten-Formular
    const form = document.getElementById('kooperation-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
    }
  }

  // Handle Form Submit für Seiten-Formular
  async handleFormSubmit() {
    try {
      const form = document.getElementById('kooperation-form');
      const formData = new FormData(form);
      const submitData = {};

      // FormData zu Objekt konvertieren
      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          // Multi-Select behandeln
          const cleanKey = key.replace('[]', '');
          if (!submitData[cleanKey]) {
            submitData[cleanKey] = [];
          }
          submitData[cleanKey].push(value);
        } else {
          submitData[key] = value;
        }
      }

      console.log('📝 Kooperation Submit-Daten:', submitData);

      // Validierung
      const validationResult = window.validatorSystem.validateForm(submitData, 'kooperation');
      if (!validationResult.isValid) {
        this.showValidationErrors(validationResult.errors);
        return;
      }

      // Erstelle Kooperation
      const result = await window.dataService.createEntity('kooperation', submitData);
      // Speichere Video-Items in Verknüpfungstabelle
      if (result.success && window.formSystem) {
        await window.formSystem.handleKooperationVideos(result.id, form);
      }
      
      if (result.success) {
        this.showSuccessMessage('Kooperation erfolgreich erstellt!');
        
        // Event auslösen für Listen-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'kooperation', action: 'created', id: result.id }
        }));
        
        // Zurück zur Liste
        setTimeout(() => {
          window.navigateTo('/kooperation');
        }, 1500);
      } else {
        this.showErrorMessage(`Fehler beim Erstellen: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Fehler beim Erstellen der Kooperation:', error);
      this.showErrorMessage('Ein unerwarteter Fehler ist aufgetreten.');
    }
  }

  // Zeige Validierungsfehler
  showValidationErrors(errors) {
    console.error('❌ Validierungsfehler:', errors);
    
    // Alle bestehenden Fehlermeldungen entfernen
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
    
    // Neue Fehlermeldungen anzeigen
    Object.entries(errors).forEach(([field, message]) => {
      const fieldElement = document.querySelector(`[name="${field}"]`);
      if (fieldElement) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.textContent = message;
        fieldElement.parentNode.appendChild(errorDiv);
      }
    });
  }

  // Zeige Erfolgsmeldung
  showSuccessMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success';
    alertDiv.textContent = message;
    
    const form = document.getElementById('kooperation-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }

  // Zeige Fehlermeldung
  showErrorMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger';
    alertDiv.textContent = message;
    
    const form = document.getElementById('kooperation-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }
}

// Exportiere Instanz für globale Nutzung
export const kooperationList = new KooperationList(); 