// KooperationList.js (ES6-Modul)
// Kooperations-Liste mit neuem Filtersystem

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { KooperationFilterLogic } from './filters/KooperationFilterLogic.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { deleteDropboxCascade } from '../../core/VideoDeleteHelper.js';

export class KooperationList {
  constructor() {
    this.selectedKooperation = new Set();
    this._boundEventListeners = new Set();
    // Drag-to-Scroll State
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.dragScrollContainer = null;
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
      // PERFORMANCE: Keine separate loadFilterData() Query mehr!
      
      // Rendere die Seite-Struktur
      await this.render();
      
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

      // Sichtbarkeit: Nicht-Admins nur eigene (assignee_id) ODER solche aus zugewiesenen Kampagnen/Marken/Unternehmen
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
          
          // 3. NEU: Kampagnen über zugeordnete Unternehmen
          const { data: mitarbeiterUnternehmen } = await window.supabase
            .from('mitarbeiter_unternehmen')
            .select('unternehmen_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          
          const unternehmenIds = (mitarbeiterUnternehmen || [])
            .map(r => r.unternehmen_id)
            .filter(Boolean);
          
          let unternehmenKampagnenIds = [];
          if (unternehmenIds.length > 0) {
            // Alle Marken dieser Unternehmen finden
            const { data: unternehmenMarken } = await window.supabase
              .from('marke')
              .select('id')
              .in('unternehmen_id', unternehmenIds);
            
            const unternehmenMarkenIds = (unternehmenMarken || []).map(m => m.id).filter(Boolean);
            
            if (unternehmenMarkenIds.length > 0) {
              // Alle Kampagnen dieser Marken laden
              const { data: kampagnen } = await window.supabase
                .from('kampagne')
                .select('id')
                .in('marke_id', unternehmenMarkenIds);
              
              unternehmenKampagnenIds = (kampagnen || []).map(k => k.id).filter(Boolean);
            }
          }
          
          // Alle zusammenführen und Duplikate entfernen
          allowedKampagneIds = [...new Set([
            ...directKampagnenIds,
            ...markenKampagnenIds,
            ...unternehmenKampagnenIds
          ])];
          
          console.log(`🔍 KOOPERATIONLIST: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`, {
            direkteKampagnen: directKampagnenIds.length,
            markenKampagnen: markenKampagnenIds.length,
            unternehmenKampagnen: unternehmenKampagnenIds.length,
            gesamt: allowedKampagneIds.length
          });
        } catch (error) {
          console.error('❌ Fehler beim Laden der Kampagnen-Zuordnungen:', error);
        }
      }

      let coopQuery = window.supabase
        .from('kooperationen')
        .select('id, name, videoanzahl, einkaufspreis_gesamt, verkaufspreis_gesamt, verkaufspreis_zusatzkosten, kampagne_id, creator_id, assignee_id, skript_deadline, content_deadline, created_at')
        .order('created_at', { ascending: false });

      // Für Mitarbeiter: Filtere nach zugewiesenen Kampagnen
      // Für Kunden: RLS-Policies filtern automatisch
      if (!isAdmin && window.currentUser?.rolle !== 'kunde') {
        coopQuery = coopQuery.or(`assignee_id.eq.${window.currentUser?.id}${allowedKampagneIds.length ? `,kampagne_id.in.(${allowedKampagneIds.join(',')})` : ''}`);
      }

      // Filter aus FilterSystem anwenden
      const activeFilters = filterSystem.getFilters('kooperation');
      console.log('🔍 KOOPERATIONLIST: Wende Filter an:', activeFilters);
      coopQuery = KooperationFilterLogic.buildSupabaseQuery(coopQuery, activeFilters);

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
            .select('id, kampagnenname, eigener_name, status, start, deadline')
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
        <div id="filter-dropdown-container"></div>
      </div>
      
    </div>`;

    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    const canBulkDelete = isAdmin || window.currentUser?.rolle?.toLowerCase() === 'mitarbeiter';
    
    // Haupt-HTML
    let html = `
      <div class="page-header">
        <div class="page-header-right">
          ${canEdit ? '<button id="btn-kooperation-new" class="primary-btn">Neue Kooperation anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-filter-wrapper">
        ${filterHtml}
        <div class="table-actions">
          ${canBulkDelete ? '<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>' : ''}
          ${canBulkDelete ? '<button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>' : ''}
          ${canBulkDelete ? '<button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>' : ''}
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${canBulkDelete ? '<th class="col-checkbox"><input type="checkbox" id="select-all-kooperationen"></th>' : ''}
              <th class="col-name">Name</th>
              <th>Kampagne</th>
              <th>Creator</th>
              <th>Videos</th>
              <th>Einkaufspreis</th>
              <th>Verkaufspreis</th>
              <th>Extra Kosten (VK)</th>
              <th>Erstellt</th>
              <th>Script Deadline</th>
              <th>Content Deadline</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody id="kooperationen-table-body">
            <tr>
              <td colspan="13" class="loading">Lade Kooperationen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Initialisiere Filterbar mit neuem Filtersystem
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      // Nutze das neue Filter-Dropdown System
      await filterDropdown.init('kooperation', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
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
    // Filter-Events werden vom FilterDropdown gehandelt

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
        return value ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR'}).format(value) : '-';
      };
      
      const formatDate = (date) => {
        return date ? new Date(date).toLocaleDateString('de-DE') : '-';
      };

      const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
      const canBulkDelete = isAdmin || window.currentUser?.rolle?.toLowerCase() === 'mitarbeiter';

      return `
        <tr data-id="${kooperation.id}">
          ${canBulkDelete ? `<td class="col-checkbox"><input type="checkbox" class="kooperation-check" data-id="${kooperation.id}"></td>` : ''}
          <td class="col-name">
            <a href="#" class="table-link" data-table="kooperation" data-id="${kooperation.id}">
              ${window.validatorSystem.sanitizeHtml(kooperation.name || '—')}
            </a>
          </td>
          <td>${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(kooperation.kampagne) !== 'Unbenannte Kampagne' ? KampagneUtils.getDisplayName(kooperation.kampagne) : (this._kampagneMap?.[kooperation.kampagne_id] ? KampagneUtils.getDisplayName(this._kampagneMap[kooperation.kampagne_id]) : 'Unbekannt'))}</td>
          <td>
            ${window.validatorSystem.sanitizeHtml(kooperation.creator ? `${kooperation.creator.vorname} ${kooperation.creator.nachname}` : (this._creatorMap?.[kooperation.creator_id] ? `${this._creatorMap[kooperation.creator_id].vorname} ${this._creatorMap[kooperation.creator_id].nachname}` : 'Unbekannt'))}
          </td>
          <td>${kooperation.videoanzahl || 0}</td>
          <td>${formatCurrency(kooperation.einkaufspreis_gesamt)}</td>
          <td>${formatCurrency(kooperation.verkaufspreis_gesamt)}</td>
          <td>${formatCurrency(kooperation.verkaufspreis_zusatzkosten)}</td>
          <td>${formatDate(kooperation.created_at)}</td>
          <td>${formatDate(kooperation.skript_deadline)}</td>
          <td>${formatDate(kooperation.content_deadline)}</td>
          <td class="col-actions">
            ${actionBuilder.create('kooperation', kooperation.id, window.currentUser)}
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
    
    // Drag-to-Scroll nach dem Rendern initialisieren
    this.bindDragToScroll();
  }
  
  // Drag-to-Scroll für horizontales Scrollen der Tabelle
  bindDragToScroll() {
    const container = document.querySelector('.data-table-container');
    if (!container) return;
    
    this.dragScrollContainer = container;
    
    // Entferne alte Event-Listener, falls vorhanden
    if (this._dragMouseDown) {
      container.removeEventListener('mousedown', this._dragMouseDown);
      container.removeEventListener('mousemove', this._dragMouseMove);
      container.removeEventListener('mouseup', this._dragMouseUp);
      container.removeEventListener('mouseleave', this._dragMouseUp);
    }
    
    // Mousedown - Prüfe ob auf nicht-editierbarem Bereich
    this._dragMouseDown = (e) => {
      // Ignoriere wenn auf Input, Checkbox, Link, Button geklickt wird
      if (
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'BUTTON' ||
        e.target.classList.contains('status-badge') ||
        e.target.closest('a') ||
        e.target.closest('.actions-dropdown-container')
      ) {
        return;
      }
      
      this.isDragging = true;
      this.startX = e.pageX - container.offsetLeft;
      this.scrollLeft = container.scrollLeft;
      
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
      
      e.preventDefault();
    };
    
    // Mousemove - Scrolle wenn dragging aktiv ist
    this._dragMouseMove = (e) => {
      if (!this.isDragging) return;
      
      e.preventDefault();
      
      const x = e.pageX - container.offsetLeft;
      const walk = (x - this.startX) * 1.5; // Multiplikator für Scroll-Geschwindigkeit
      container.scrollLeft = this.scrollLeft - walk;
    };
    
    // Mouseup - Beende Dragging
    this._dragMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        container.style.cursor = 'grab';
        container.style.userSelect = '';
      }
    };
    
    container.addEventListener('mousedown', this._dragMouseDown);
    container.addEventListener('mousemove', this._dragMouseMove);
    container.addEventListener('mouseup', this._dragMouseUp);
    container.addEventListener('mouseleave', this._dragMouseUp);
    
    // Setze initialen Cursor
    container.style.cursor = 'grab';
  }

  // Bestätigungsdialog für Bulk-Delete
  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedKooperation.size;
    
    if (selectedCount === 0) {
      alert('Keine Kooperationen ausgewählt.');
      return;
    }

    const message = selectedCount === 1 
      ? 'Möchten Sie die ausgewählte Kooperation wirklich löschen?' 
      : `Möchten Sie die ${selectedCount} ausgewählten Kooperationen wirklich löschen?`;

    const res = await window.confirmationModal.open({
      title: 'Löschvorgang bestätigen',
      message: message,
      confirmText: 'Endgültig löschen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (res?.confirmed) {
      this.deleteSelectedKooperationen();
    }
  }

  // Ausgewählte Kooperationen löschen
  async deleteSelectedKooperationen() {
    if (window.currentUser?.rolle !== 'admin' && window.currentUser?.rolle?.toLowerCase() !== 'admin' && window.currentUser?.rolle?.toLowerCase() !== 'mitarbeiter') return;
    
    const selectedIds = Array.from(this.selectedKooperation);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Kooperationen...`);
    
    // Optimistisches UI-Update: Zeilen ausblenden
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      await Promise.allSettled(
        selectedIds.map(id => deleteDropboxCascade('kooperation', id))
      );

      const result = await window.dataService.deleteEntities('kooperation', selectedIds);
      
      if (result.success) {
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        alert(`✅ ${result.deletedCount} Kooperationen erfolgreich gelöscht.`);
        
        this.selectedKooperation.clear();
        this.updateSelection();
        
        const tbody = document.querySelector('#kooperationen-table-body');
        if (tbody && tbody.children.length === 0) {
          await this.loadAndRender();
        }
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'kooperation', action: 'bulk-deleted', count: result.deletedCount }
        }));
      } else {
        throw new Error(result.error || 'Löschen fehlgeschlagen');
      }
    } catch (error) {
      selectedIds.forEach(id => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) row.style.opacity = '1';
      });
      
      console.error('❌ Fehler beim Löschen:', error);
      alert(`❌ Fehler beim Löschen: ${error.message}`);
      
      // Liste neu laden um konsistenten Zustand herzustellen
      await this.loadAndRender();
    }
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
  async showCreateForm() {
    console.log('🎯 Zeige Kooperations-Erstellungsformular');
    window.setHeadline('Neue Kooperation anlegen');
    
    // Prüfe auf kampagne_id Query-Parameter
    const urlParams = new URLSearchParams(window.location.search);
    const kampagneId = urlParams.get('kampagne_id');
    
    let formData = null;
    let kampagne = null;
    
    // Wenn kampagne_id vorhanden, versuche Prefill
    if (kampagneId) {
      // PERFORMANCE: Prüfe zuerst den Cache (gesetzt von KampagneDetail beim Button-Click)
      const cache = window.kooperationPrefillCache;
      if (cache && cache.kampagne_id === kampagneId && (Date.now() - cache.timestamp) < 30000) {
        // Cache ist gültig (max 30 Sekunden alt) - nutze gecachte Daten
        console.log('⚡ KOOPERATION-PREFILL: Nutze gecachte Kampagne-Daten (SCHNELL!)');
        kampagne = {
          id: cache.kampagne_id,
          kampagnenname: cache.kampagnenname,
          eigener_name: cache.eigener_name,
          unternehmen_id: cache.unternehmen_id,
          marke_id: cache.marke_id,
          unternehmen: cache.unternehmen,
          marke: cache.marke
        };
        // Cache leeren nach Verwendung
        delete window.kooperationPrefillCache;
      } else {
        // Kein Cache oder abgelaufen - lade aus Supabase
        console.log('📦 KOOPERATION-PREFILL: Lade Kampagne aus Supabase...', kampagneId);
        
        const { data, error } = await window.supabase
          .from('kampagne')
          .select(`
            id, kampagnenname, eigener_name, unternehmen_id, marke_id,
            unternehmen:unternehmen_id ( id, firmenname ),
            marke:marke_id ( id, markenname )
          `)
          .eq('id', kampagneId)
          .single();
        
        if (!error && data) {
          kampagne = data;
          console.log('📋 KOOPERATION-PREFILL: Kampagne aus DB geladen:', kampagne);
        } else {
          console.warn('⚠️ KOOPERATION-PREFILL: Kampagne konnte nicht geladen werden:', error);
        }
      }
      
      // Wenn Kampagne verfügbar, formData erstellen
      if (kampagne) {
        if (window.breadcrumbSystem) {
          window.breadcrumbSystem.updateDetailLabel('Neue Kooperation');
        }
        
        // formData mit allen Prefill-Daten erstellen
        formData = {
          kampagne_id: kampagneId,
          unternehmen_id: kampagne.unternehmen_id,
          marke_id: kampagne.marke_id || null,
          _prefillFromKampagne: true,
          _kampagneName: KampagneUtils.getDisplayName(kampagne),
          _unternehmenName: kampagne.unternehmen?.firmenname || '',
          _markeName: kampagne.marke?.markenname || null,
          _hasMarke: !!kampagne.marke_id
        };
        
        console.log('📦 KOOPERATION-PREFILL: formData erstellt:', formData);
      } else {
        if (window.breadcrumbSystem) {
          window.breadcrumbSystem.updateDetailLabel('Neue Kooperation');
        }
      }
    } else {
      if (window.breadcrumbSystem) {
        window.breadcrumbSystem.updateDetailLabel('Neue Kooperation');
      }
    }
    
    // Formular direkt in content rendern (form-split Layout für kompaktere Darstellung)
    const formHtml = window.formSystem.renderFormOnly('kooperation', formData);
    window.content.innerHTML = `
      <div class="form-split-container">
        <div class="form-split-left">
          <div class="form-page">
            ${formHtml}
          </div>
        </div>
      </div>
    `;

    // Formular-Events binden (inkl. Prefill-Logik)
    await window.formSystem.bindFormEvents('kooperation', formData);
    
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

      // Prefill-Fallback: disabled selects landen nicht in FormData
      if (form?.dataset?.prefillFromKampagne === 'true' && form.dataset.prefillData) {
        try {
          const prefill = JSON.parse(form.dataset.prefillData);
          if (!submitData.kampagne_id && prefill.kampagne_id) {
            submitData.kampagne_id = prefill.kampagne_id;
          }
          if (!submitData.unternehmen_id && prefill.unternehmen_id) {
            submitData.unternehmen_id = prefill.unternehmen_id;
          }
          if (!submitData.marke_id && prefill._hasMarke && prefill.marke_id) {
            submitData.marke_id = prefill.marke_id;
          }
        } catch (e) {
          console.warn('⚠️ KOOPERATION: Prefill-Daten konnten nicht gelesen werden', e);
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
        await window.formSystem.handleKooperationTags(result.id, form);
      }
      
      if (result.success) {
        this.showSuccessMessage('Kooperation erfolgreich erstellt!');
        
        // Event auslösen für Listen-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'kooperation', action: 'created', id: result.id }
        }));
        
        // Wenn kampagne_id vorhanden, zurück zur Kampagnen-Detailseite
        if (submitData.kampagne_id) {
          setTimeout(() => {
            window.navigateTo(`/kampagne/${submitData.kampagne_id}`);
          }, 1500);
        } else {
          // Sonst zur Kooperations-Detailseite
          setTimeout(() => {
            window.navigateTo(`/kooperation/${result.id}`);
          }, 1500);
        }
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