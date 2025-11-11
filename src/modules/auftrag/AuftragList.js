// AuftragList.js (ES6-Modul)
// Auftrags-Liste mit Filter und Verwaltung

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { AuftragsDetailsManager, auftragsDetailsManager } from './logic/AuftragsDetailsManager.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';

export class AuftragList {
  constructor() {
    this.selectedAuftraege = new Set();
    this._boundEventListeners = new Set();
    this.boundFilterResetHandler = null;
  }

  // Initialisiere Auftrags-Liste
  async init() {
    console.log('📋 AUFTRAGLIST: Initialisiere Auftrags-Liste');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Auftrag', url: '/auftrag', clickable: false }
      ]);
    }
    
    try {
      // BulkActionSystem für Auftrag registrieren
      window.bulkActionSystem?.registerList('auftrag', this);
      
      await this.loadAndRender();
      this.bindEvents();
      console.log('✅ AUFTRAGLIST: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ AUFTRAGLIST: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'AuftragList.init');
    }
  }

  // Lade und rendere Aufträge
  async loadAndRender() {
    console.log('🔄 AUFTRAGLIST: Lade und rendere Aufträge');
    
    try {
      // PERFORMANCE: Keine separate loadFilterData() Query mehr!
      console.log('✅ AUFTRAGLIST: Rendere Seite');
      
      // Seite rendern
      await this.render();
      console.log('✅ AUFTRAGLIST: Content gesetzt');
      
      // Filter-Bar initialisieren
      await this.initializeFilterBar();
      
      // Aufträge mit Beziehungen laden
      console.log('🔍 AUFTRAGLIST: Lade Aufträge mit Beziehungen');
      const auftraege = await this.loadAuftraegeWithRelations();
      console.log('📊 AUFTRAGLIST: Aufträge mit Beziehungen geladen:', auftraege.length, auftraege);
      
      this.updateTable(auftraege);
      console.log('✅ AUFTRAGLIST: Tabelle aktualisiert');
      
    } catch (error) {
      console.error('❌ AUFTRAGLIST: Fehler beim Laden und Rendern:', error);
      window.ErrorHandler.handle(error, 'AuftragList.loadAndRender');
    }
  }

  // Rendere Auftrags-Liste
  async render() {
    window.setHeadline('Aufträge');
    
    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <button id="btn-auftrag-new" class="primary-btn">
            <i class="icon-plus"></i>
            Neuen Auftrag anlegen
          </button>
        </div>
      </div>

      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div id="filter-dropdown-container"></div>
          
        </div>
        <div class="table-actions">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <!-- Daten-Tabelle -->
      <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" id="select-all-auftraege">
                </th>
                <th>Auftragsname</th>
                <th>Unternehmen</th>
                <th>Marke</th>
                <th>PO</th>
                <th>RE. Nr</th>
                <th>RE-Fälligkeit</th>
                <th>Art der Kampagne</th>
                <th>Start</th>
                <th>Ende</th>
                <th>Netto</th>
                <th>UST</th>
                <th>Brutto</th>
                <th>Ansprechpartner</th>
                <th>Mitarbeiter</th>
                <th>Cutter</th>
                <th>Copywriter</th>
                <th>Rechnung gestellt</th>
                <th>Überwiesen</th>
                <th>Status</th>
                <th>Zugewiesen an</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="auftraege-table-body">
              <tr>
                <td colspan="10" class="loading">Lade Aufträge...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Lade Aufträge mit Beziehungen
  async loadAuftraegeWithRelations() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return await window.dataService.loadEntities('auftrag');
      }

      const { data, error } = await window.supabase
        .from('auftrag')
        .select(`
          *,
          unternehmen:unternehmen_id(id, firmenname, logo_url),
          marke:marke_id(id, markenname, logo_url),
          ansprechpartner:ansprechpartner_id(id, vorname, nachname, email),
          cutter:auftrag_cutter(mitarbeiter:mitarbeiter_id(id, name)),
          copywriter:auftrag_copywriter(mitarbeiter:mitarbeiter_id(id, name)),
          mitarbeiter:auftrag_mitarbeiter(mitarbeiter:mitarbeiter_id(id, name))
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Fehler beim Laden der Aufträge mit Beziehungen:', error);
        throw error;
      }

      // Daten für Kompatibilität formatieren
      const formattedData = data.map(auftrag => ({
        ...auftrag,
        unternehmen: auftrag.unternehmen ? { 
          id: auftrag.unternehmen.id,
          firmenname: auftrag.unternehmen.firmenname,
          logo_url: auftrag.unternehmen.logo_url
        } : null,
        marke: auftrag.marke ? { 
          id: auftrag.marke.id,
          markenname: auftrag.marke.markenname,
          logo_url: auftrag.marke.logo_url
        } : null
      }));

      console.log('✅ Aufträge mit Beziehungen geladen:', formattedData);
      console.log('🔍 Debug - Erster Auftrag:', formattedData[0]);
      return formattedData;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Aufträge mit Beziehungen:', error);
      // Fallback zu normalem Laden
      return await window.dataService.loadEntities('auftrag');
    }
  }

  // Initialisiere Filterbar mit neuem Filtersystem
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      // Nutze das neue Filter-Dropdown System
      await filterDropdown.init('auftrag', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('🔍 AUFTRAGLIST: Filter angewendet:', filters);
    filterSystem.applyFilters('auftrag', filters);
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('🔄 AUFTRAGLIST: Filter zurückgesetzt');
    filterSystem.resetFilters('auftrag');
    this.loadAndRender();
  }

  // Binde Events
  bindEvents() {
    // Filter-Events werden vom FilterDropdown gehandelt

    // Neuen Auftrag anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-auftrag-new' || e.target.id === 'btn-auftrag-new-filter') {
        e.preventDefault();
        window.navigateTo('/auftrag/new');
      }
    });

    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.auftrag-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedAuftraege.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-auftraege');
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
        const checkboxes = document.querySelectorAll('.auftrag-check');
        checkboxes.forEach(cb => { cb.checked = false; });
        this.selectedAuftraege.clear();
        const selectAllHeader = document.getElementById('select-all-auftraege');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = false;
        }
        this.updateSelection();
      }
    });

    // Auftrag Detail Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'auftrag') {
        e.preventDefault();
        const auftragId = e.target.dataset.id;
        console.log('🎯 AUFTRAGLIST: Navigiere zu Auftrag Details:', auftragId);
        window.navigateTo(`/auftrag/${auftragId}`);
      }
    });

    // Entity Updated Event
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'auftrag') {
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
        const currentFilters = window.filterSystem.getFilters('auftrag');
        delete currentFilters[key];
        window.filterSystem.applyFilters('auftrag', currentFilters);
        this.loadAndRender();
      }
    });

    // Select-All Checkbox
    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-auftraege') {
        const checkboxes = document.querySelectorAll('.auftrag-check');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
          if (e.target.checked) {
            this.selectedAuftraege.add(cb.dataset.id);
          } else {
            this.selectedAuftraege.delete(cb.dataset.id);
          }
        });
        this.updateSelection();
      }
    });

    // Auftrag Checkboxes
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('auftrag-check')) {
        if (e.target.checked) {
          this.selectedAuftraege.add(e.target.dataset.id);
        } else {
          this.selectedAuftraege.delete(e.target.dataset.id);
        }
        this.updateSelection();
      }
    });
  }

  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = window.filterSystem.getFilters('auftrag');
    return Object.keys(filters).length > 0;
  }

  // Update Selection
  updateSelection() {
    const selectedCount = this.selectedAuftraege.size;
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
  updateTable(auftraege) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    if (!auftraege || auftraege.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="21" class="no-data">
            <div style="text-align: center; padding: 40px 20px;">
              <div style="font-size: 48px; color: #ccc; margin-bottom: 16px;">📋</div>
              <h3 style="color: #666; margin-bottom: 8px;">Keine Aufträge vorhanden</h3>
              <p style="color: #999; margin-bottom: 20px;">Es wurden noch keine Aufträge erstellt.</p>
              <button id="btn-create-first-auftrag" class="primary-btn">
                Ersten Auftrag anlegen
              </button>
            </div>
          </td>
        </tr>
      `;
      
      // Event für den "Ersten Auftrag anlegen" Button
      const createBtn = document.getElementById('btn-create-first-auftrag');
      if (createBtn) {
        createBtn.addEventListener('click', (e) => {
          e.preventDefault();
          window.navigateTo('/auftrag/new');
        });
      }
      return;
    }

    const rowsHtml = auftraege.map(auftrag => {
      // Hilfsfunktionen für Formatierung
      const formatCurrency = (value) => {
        return value ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value) : '-';
      };
      
      const formatDate = (date) => {
        return date ? new Date(date).toLocaleDateString('de-DE') : '-';
      };
      
      const formatArray = (array) => {
        return array && Array.isArray(array) ? array.join(', ') : '-';
      };
      
      const formatBoolean = (value) => {
        return value ? '✅' : '❌';
      };
      
      const formatAssignee = (assigneeId) => {
        return assigneeId ? '👤' : '-';
      };

      const formatAnsprechpartner = (person) => {
        if (!person) return '-';
        const fullName = [person.vorname, person.nachname].filter(Boolean).join(' ');
        if (!fullName) return '-';
        
        const items = [{
          name: fullName,
          type: 'person',
          id: person.id,
          entityType: 'ansprechpartner'
        }];
        return avatarBubbles.renderBubbles(items);
      };

      const formatUnternehmenTag = (unternehmen) => {
        if (!unternehmen) return '-';
        const name = unternehmen.firmenname;
        if (!name) return '-';
        
        const items = [{
          name: name,
          type: 'org',
          id: unternehmen.id,
          entityType: 'unternehmen',
          logo_url: unternehmen.logo_url || null
        }];
        return avatarBubbles.renderBubbles(items);
      };

      const formatMarkeTag = (marke) => {
        if (!marke) return '-';
        const name = marke.markenname;
        if (!name) return '-';
        
        const items = [{
          name: name,
          type: 'org',
          id: marke.id,
          entityType: 'marke',
          logo_url: marke.logo_url || null
        }];
        return avatarBubbles.renderBubbles(items);
      };

      const formatMitarbeiterTags = (entries) => {
        if (!entries || entries.length === 0) return '-';
        
        const items = entries
          .map(item => {
            const name = item?.mitarbeiter?.name || item?.name;
            const id = item?.mitarbeiter?.id || item?.id;
            if (!name) return null;
            return {
              name: name,
              type: 'person',
              id: id,
              entityType: 'mitarbeiter'
            };
          })
          .filter(Boolean);
        
        return items.length > 0 ? avatarBubbles.renderBubbles(items) : '-';
      };

      return `
        <tr data-id="${auftrag.id}">
          <td><input type="checkbox" class="auftrag-check" data-id="${auftrag.id}"></td>
          <td>
            <a href="#" class="table-link" data-table="auftrag" data-id="${auftrag.id}">
              ${window.validatorSystem.sanitizeHtml(auftrag.auftragsname || 'Unbekannt')}
            </a>
          </td>
          <td>${formatUnternehmenTag(auftrag.unternehmen)}</td>
          <td>${formatMarkeTag(auftrag.marke)}</td>
          <td>${auftrag.po || '-'}</td>
          <td>${auftrag.re_nr || '-'}</td>
          <td>${formatDate(auftrag.re_faelligkeit)}</td>
          <td>${formatArray(auftrag.art_der_kampagne)}</td>
          <td>${formatDate(auftrag.start)}</td>
          <td>${formatDate(auftrag.ende)}</td>
          <td>${formatCurrency(auftrag.nettobetrag)}</td>
          <td>${formatCurrency(auftrag.ust_betrag)}</td>
          <td>${formatCurrency(auftrag.bruttobetrag)}</td>
          <td>${formatAnsprechpartner(auftrag.ansprechpartner)}</td>
          <td>${formatMitarbeiterTags(auftrag.mitarbeiter)}</td>
          <td>${formatMitarbeiterTags(auftrag.cutter)}</td>
          <td>${formatMitarbeiterTags(auftrag.copywriter)}</td>
          <td>${formatBoolean(auftrag.rechnung_gestellt)}</td>
          <td>${formatBoolean(auftrag.ueberwiesen)}</td>
          <td>
            <span class="status-badge status-${auftrag.status?.toLowerCase() || 'unknown'}">
              ${auftrag.status || '-'}
            </span>
          </td>
          <td>${formatAssignee(auftrag.assignee_id)}</td>
          <td>
            ${actionBuilder.create('auftrag', auftrag.id)}
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
  }

  // Cleanup
  destroy() {
    console.log('AuftragList: Cleaning up...');
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
    console.log('🎯 Zeige Auftrag-Erstellungsformular');
    window.setHeadline('Neuen Auftrag anlegen');
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Aufträge', url: '/auftrag', clickable: true },
        { label: 'Neuer Auftrag', url: '/auftrag/new', clickable: false }
      ]);
    }

    const formHtml = window.formSystem.renderFormOnly('auftrag');
    const html = `
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    window.content.innerHTML = html;
    window.formSystem.bindFormEvents('auftrag', null);
  }
}

const auftragListInstance = new AuftragList();
export { auftragListInstance as auftragList };