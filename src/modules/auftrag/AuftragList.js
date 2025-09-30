// AuftragList.js (ES6-Modul)
// Auftrags-Liste mit Filter und Verwaltung

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { AuftragsDetailsManager, auftragsDetailsManager } from './logic/AuftragsDetailsManager.js';

export class AuftragList {
  constructor() {
    this.selectedAuftraege = new Set();
    this._boundEventListeners = new Set();
    this.boundFilterResetHandler = null;
  }

  // Initialisiere Auftrags-Liste
  async init() {
    console.log('📋 AUFTRAGLIST: Initialisiere Auftrags-Liste');
    
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
      // Filter-Daten laden
      const filterData = await window.dataService.loadFilterData('auftrag');
      console.log('✅ AUFTRAGLIST: Filter-Daten geladen:', filterData);
      
      // Seite rendern
      await this.render(filterData);
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
  async render(filterData) {
    window.setHeadline('Aufträge');
    
    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Aufträge</h1>
          <p>Verwalten Sie alle Aufträge und Projekte</p>
        </div>
        <div class="page-header-right">
          <button id="btn-auftrag-new" class="primary-btn">
            <i class="icon-plus"></i>
            Neuen Auftrag anlegen
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Filter-Bar -->
        <div class="filter-bar">
          <div class="filter-left">
            <div id="filter-container"></div>
          </div>
          <div class="filter-right">
            <button id="btn-filter-reset" class="secondary-btn" style="display:none;">Filter zurücksetzen</button>
          </div>
        </div>

        <div class="table-actions">
          <div class="table-actions-left">
            <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
            <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          </div>
          <div class="table-actions-right">
            <span id="selected-count" style="display:none;">0 ausgewählt</span>
            <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
          </div>
        </div>

        <!-- Daten-Tabelle -->
        <div class="data-table-container">
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
                <th>Brutto</th>
                <th>Netto</th>
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
          unternehmen:unternehmen_id(firmenname),
          marke:marke_id(markenname),
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
        unternehmen: auftrag.unternehmen ? { firmenname: auftrag.unternehmen.firmenname } : null,
        marke: auftrag.marke ? { markenname: auftrag.marke.markenname } : null
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
    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
      // Nutze das neue Filtersystem für die Filterbar (asynchron)
      await filterSystem.renderFilterBar('auftrag', filterContainer, 
        (filters) => this.onFiltersApplied(filters),
        () => this.onFiltersReset()
      );
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
    // Reset All Button - spezifisch für dieses Modul
    this.boundFilterResetHandler = (e) => {
      if (e.target.id === 'btn-filter-reset') {
        this.onFiltersReset();
      }
    };
    document.addEventListener('click', this.boundFilterResetHandler);

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
          <td colspan="20" class="no-data">
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
        const displayName = fullName || 'Unbekannt';
        return `<div class="tags tags-compact"><span class="tag tag--green">${window.validatorSystem.sanitizeHtml(displayName)}</span></div>`;
      };

      const formatUnternehmenTag = (unternehmen) => {
        if (!unternehmen) return '-';
        const name = unternehmen.firmenname || 'Unbekannt';
        return `<div class="tags tags-compact"><span class="tag tag--purple">${window.validatorSystem.sanitizeHtml(name)}</span></div>`;
      };

      const formatMarkeTag = (marke) => {
        if (!marke) return '-';
        const name = marke.markenname || 'Unbekannt';
        return `<div class="tags tags-compact"><span class="tag tag--orange">${window.validatorSystem.sanitizeHtml(name)}</span></div>`;
      };

      const formatMitarbeiterTags = (entries) => {
        if (!entries || entries.length === 0) return '-';
        const tags = entries.map(item => {
          const name = item?.mitarbeiter?.name || item?.name || 'Unbekannt';
          return `<span class="tag tag--blue">${window.validatorSystem.sanitizeHtml(name)}</span>`;
        }).join('');
        return `<div class="tags tags-compact">${tags}</div>`;
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
          <td>${formatCurrency(auftrag.bruttobetrag)}</td>
          <td>${formatCurrency(auftrag.nettobetrag)}</td>
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
            <div class="actions-dropdown-container" data-entity-type="auftrag">
              <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                </svg>
              </button>
              <div class="actions-dropdown">
                <a href="#" class="action-item" data-action="view" data-id="${auftrag.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
                  </svg>
                  Details anzeigen
                </a>
                <a href="#" class="action-item" data-action="edit" data-id="${auftrag.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
                    <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
                  </svg>
                  Bearbeiten
                </a>
                <a href="#" class="action-item" data-action="details" data-id="${auftrag.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Auftragsdetails
                </a>
                <a href="#" class="action-item" data-action="notiz" data-id="${auftrag.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.117C2.688 12.31 2 11.104 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
                  </svg>
                  Notiz hinzufügen
                </a>
                
                <a href="#" class="action-item" data-action="rechnung" data-id="${auftrag.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 11.625h4.5m-4.5 2.25h4.5m2.121 1.527c-1.171 1.464-3.07 1.464-4.242 0-1.172-1.465-1.172-3.84 0-5.304 1.171-1.464 3.07-1.464 4.242 0M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  Rechnung anlegen
                </a>
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete" data-id="${auftrag.id}">
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

    const formHtml = window.formSystem.renderFormOnly('auftrag');
    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neuen Auftrag anlegen</h1>
          <p>Erstellen Sie einen neuen Auftrag für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/auftrag')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
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