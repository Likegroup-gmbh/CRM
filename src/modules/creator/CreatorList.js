// CreatorList.js (ES6-Modul)
// Creator-Liste mit neuem Filtersystem

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';

export class CreatorList {
  constructor() {
    this.selectedCreator = new Set();
    this._boundEventListeners = new Set();
  }

  // Initialisiere Creator-Liste
  async init() {
    window.setHeadline('Creator Übersicht');
    
    const canView = (window.canViewPage && window.canViewPage('creator')) || await window.checkUserPermission('creator', 'can_view');
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Creator anzuzeigen.</p>
        </div>
      `;
      return;
    }

    // Binde Events sofort
    this.bindEvents();
    
    await this.loadAndRender();
  }

  // Lade und rendere Creator-Liste
  async loadAndRender() {
    try {
      // Lade Filter-Daten separat
      const filterData = await window.dataService.loadFilterData('creator');
      
          // Rendere die Seite mit Filter-Daten (asynchron)
    await this.render(filterData);
      
      // Lade gefilterte Creator für die Anzeige
      const currentFilters = filterSystem.getFilters('creator');
      console.log('🔍 Lade Creator mit Filter:', currentFilters);
      const filteredCreators = await window.dataService.loadEntities('creator', currentFilters);
      console.log('📊 Creator geladen:', filteredCreators?.length || 0);
      
      // Aktualisiere nur die Tabelle mit gefilterten Daten
      this.updateTable(filteredCreators);
      
    } catch (error) {
      window.ErrorHandler.handle(error, 'CreatorList.loadAndRender');
    }
  }

  // Rendere Creator-Liste
  async render(filterData) {
    const canEdit = window.currentUser?.permissions?.creator?.can_edit || false;
    
    // Aktive Filter als Tags
    let tags = '';
    const currentFilters = filterSystem.getFilters('creator');
    
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
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters() ? 'inline-block' : 'none'};">Alle Filter zurücksetzen</button>
      </div>
    </div>`;
    
    // Haupt-HTML
    let html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Creator</h1>
          <p>Verwalten Sie alle Creator und deren Profile</p>
        </div>
        <div class="page-header-right">
          ${canEdit ? '<button id="btn-creator-new" class="primary-btn">Neuen Creator anlegen</button>' : ''}
        </div>
      </div>

      ${filterHtml}

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

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-creators"></th>
              <th>Name</th>
              <th>Typen</th>
              <th>Sprachen</th>
              <th>Branchen</th>
              <th>Instagram</th>
              <th>TikTok</th>
              <th>Stadt</th>
              <th>Land</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="10" class="no-data">Lade Creator...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
    
    // Initialisiere Filterbar mit neuem System
    await this.initializeFilterBar();
  }

  // Initialisiere Filterbar mit neuem Filtersystem
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
      // Nutze das neue Filtersystem für die Filterbar (asynchron)
      await filterSystem.renderFilterBar('creator', filterContainer, 
        (filters) => this.onFiltersApplied(filters),
        () => this.onFiltersReset()
      );
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('Filter angewendet:', filters);
    filterSystem.applyFilters('creator', filters);
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('Filter zurückgesetzt');
    filterSystem.resetFilters('creator');
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

    // Neuen Creator anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-creator-new') {
        e.preventDefault();
        window.navigateTo('/creator/new');
      }
    });

    // Creator Detail Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'creator') {
        e.preventDefault();
        const creatorId = e.target.dataset.id;
        console.log('🎯 CREATORLIST: Navigiere zu Creator Details:', creatorId);
        window.navigateTo(`/creator/${creatorId}`);
      }
    });

    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.creator-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedCreator.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-creators');
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
        const checkboxes = document.querySelectorAll('.creator-check');
        checkboxes.forEach(cb => { cb.checked = false; });
        this.selectedCreator.clear();
        const selectAllHeader = document.getElementById('select-all-creators');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = false;
        }
        this.updateSelection();
      }
    });

    // Entity Updated Event
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'creator') {
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
        const currentFilters = filterSystem.getFilters('creator');
        delete currentFilters[key];
        filterSystem.applyFilters('creator', currentFilters);
        this.loadAndRender();
      }
    });



    // Select-All Checkbox (Tabellen-Header)
    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-creators') {
        const checkboxes = document.querySelectorAll('.creator-check');
        const isChecked = e.target.checked;
        
        checkboxes.forEach(cb => {
          cb.checked = isChecked;
          if (isChecked) {
            this.selectedCreator.add(cb.dataset.id);
          } else {
            this.selectedCreator.delete(cb.dataset.id);
          }
        });
        
        this.updateSelection();
        console.log(`${isChecked ? '✅ Alle Creator ausgewählt' : '❌ Alle Creator abgewählt'}: ${this.selectedCreator.size}`);
      }
    });

    // Creator Checkboxes (einzelne Zeilen)
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('creator-check')) {
        if (e.target.checked) {
          this.selectedCreator.add(e.target.dataset.id);
        } else {
          this.selectedCreator.delete(e.target.dataset.id);
        }
        this.updateSelection();
        this.updateSelectAllCheckbox();
      }
    });

    // Bulk-Actions werden jetzt vom BulkActionSystem verwaltet
    // Registriere diese Liste beim BulkActionSystem
    if (window.bulkActionSystem) {
      window.bulkActionSystem.registerList('creator', this);
    }
  }

  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = filterSystem.getFilters('creator');
    return Object.keys(filters).length > 0;
  }

  // Update Selection
  updateSelection() {
    const selectedCount = this.selectedCreator.size;
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

  // Update Select-All Checkbox Status
  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-creators');
    const individualCheckboxes = document.querySelectorAll('.creator-check');
    
    if (!selectAllCheckbox || individualCheckboxes.length === 0) return;
    
    const checkedBoxes = document.querySelectorAll('.creator-check:checked');
    const allChecked = checkedBoxes.length === individualCheckboxes.length;
    const someChecked = checkedBoxes.length > 0;
    
    // Setze den Status des Select-All Checkbox
    selectAllCheckbox.checked = allChecked;
    
    // Setze indeterminate Status für "teilweise ausgewählt"
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
    
    console.log(`🔧 Select-All Status: ${allChecked ? 'Alle' : someChecked ? 'Teilweise' : 'Keine'} (${checkedBoxes.length}/${individualCheckboxes.length})`);
  }

  // Deselect All - alle Auswahlen aufheben
  deselectAll() {
    this.selectedCreator.clear();
    
    // Alle Checkboxen deaktivieren
    const checkboxes = document.querySelectorAll('.creator-check');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    
    // Select-All Checkbox auch zurücksetzen
    const selectAllCheckbox = document.getElementById('select-all-creators');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
    
    this.updateSelection();
    console.log('✅ Alle Creator-Auswahlen aufgehoben');
  }

  // Bestätigungsdialog für Bulk-Delete
  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedCreator.size;
    if (selectedCount === 0) {
      alert('Keine Creator ausgewählt.');
      return;
    }

    const message = selectedCount === 1 
      ? 'Möchten Sie den ausgewählten Creator wirklich löschen?' 
      : `Möchten Sie die ${selectedCount} ausgewählten Creator wirklich löschen?`;

    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({ title: 'Löschvorgang bestätigen', message, confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', danger: true });
      if (res?.confirmed) this.deleteSelectedCreators();
    } else {
      const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
      if (confirmed) this.deleteSelectedCreators();
    }
  }

  // Ausgewählte Creator löschen
  async deleteSelectedCreators() {
    const selectedIds = Array.from(this.selectedCreator);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Creator...`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Lösche jeden Creator einzeln
    for (const creatorId of selectedIds) {
      try {
        const result = await window.dataService.deleteEntity('creator', creatorId);
        
        if (result.success) {
          successCount++;
          console.log(`✅ Creator ${creatorId} gelöscht`);
        } else {
          errorCount++;
          errors.push(`Creator ${creatorId}: ${result.error}`);
          console.error(`❌ Fehler beim Löschen von Creator ${creatorId}:`, result.error);
        }
      } catch (error) {
        errorCount++;
        errors.push(`Creator ${creatorId}: ${error.message}`);
        console.error(`❌ Unerwarteter Fehler beim Löschen von Creator ${creatorId}:`, error);
      }
    }

    // Ergebnis anzeigen
    let message = '';
    if (successCount > 0) {
      message += `✅ ${successCount} Creator erfolgreich gelöscht.`;
    }
    if (errorCount > 0) {
      message += `\n❌ ${errorCount} Creator konnten nicht gelöscht werden.`;
      if (errors.length > 0) {
        message += `\n\nFehler:\n${errors.join('\n')}`;
      }
    }
    
    alert(message);

    // Auswahl zurücksetzen und Liste neu laden
    this.deselectAll();
    await this.loadAndRender();

    // Event für andere Komponenten auslösen
    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'creator', action: 'bulk-deleted', count: successCount }
    }));
  }

  // Update Tabelle
  async updateTable(creators) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    if (!creators || creators.length === 0) {
      const { renderEmptyState } = await import('../../core/FilterUI.js');
      renderEmptyState(tbody);
      return;
    }

    const rowsHtml = creators.map(creator => `
      <tr data-id="${creator.id}">
        <td><input type="checkbox" class="creator-check" data-id="${creator.id}"></td>
        <td>
          <a href="#" class="table-link" data-table="creator" data-id="${creator.id}">
            ${window.CreatorUtils.sanitizeHtml(`${creator.vorname} ${creator.nachname}`)}
          </a>
        </td>
        <td>${this.renderCreatorTypeTags(creator.creator_types)}</td>
        <td>${this.renderSprachenTags(creator.sprachen)}</td>
        <td>${this.renderBrancheTags(creator.branchen)}</td>
        <td>${creator.instagram_follower ? new Intl.NumberFormat('de-DE').format(creator.instagram_follower) : '-'}</td>
        <td>${creator.tiktok_follower ? new Intl.NumberFormat('de-DE').format(creator.tiktok_follower) : '-'}</td>
        <td>${creator.lieferadresse_stadt || '-'}</td>
        <td>${creator.lieferadresse_land || '-'}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
              </svg>
            </button>
            <div class="actions-dropdown">
                              <a href="#" class="action-item" data-action="view" data-id="${creator.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
                  </svg>
                  Profil ansehen
                </a>
                <a href="#" class="action-item" data-action="add_to_list" data-id="${creator.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                  Zur Liste hinzufügen
                </a>
                <a href="#" class="action-item" data-action="edit" data-id="${creator.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
                    <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
                  </svg>
                  Profil bearbeiten
                </a>
                <div class="action-separator"></div>
                <a href="#" class="action-item" data-action="add_to_campaign" data-id="${creator.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
                  </svg>
                  Zu Kampagne hinzufügen
                </a>
                <a href="#" class="action-item action-danger" data-action="delete" data-id="${creator.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
                  </svg>
                  Löschen
                </a>
            </div>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.innerHTML = rowsHtml;
  }

  // Render Sprachen Tags (neue JOIN-Struktur)
  renderSprachenTags(sprachen) {
    if (!sprachen || sprachen.length === 0) return '-';
    if (Array.isArray(sprachen)) {
      const inner = sprachen.map(s => {
        const label = typeof s === 'object' ? (s.name || s.label || s) : s;
        return `<span class="tag tag--lang">${String(label).trim()}</span>`;
      }).join('');
      return `<div class="tags tags-compact">${inner}</div>`;
    }
    if (typeof sprachen === 'object') {
      const label = sprachen.name || sprachen.label;
      return label ? `<div class="tags tags-compact"><span class="tag tag--lang">${label}</span></div>` : '-';
    }
    return `<div class="tags tags-compact"><span class="tag tag--lang">${String(sprachen)}</span></div>`;
  }

  // Render Branche Tags (neue JOIN-Struktur)
  renderBrancheTags(branchen) {
    if (!branchen || branchen.length === 0) return '-';
    if (Array.isArray(branchen)) {
      const inner = branchen.map(b => {
        const label = typeof b === 'object' ? (b.name || b.label || b) : b;
        return `<span class="tag tag--branche">${String(label).trim()}</span>`;
      }).join('');
      return `<div class="tags tags-compact">${inner}</div>`;
    }
    if (typeof branchen === 'object') {
      const label = branchen.name || branchen.label;
      return label ? `<div class="tags tags-compact"><span class="tag tag--branche">${label}</span></div>` : '-';
    }
    return `<div class="tags tags-compact"><span class="tag tag--branche">${String(branchen)}</span></div>`;
  }

  renderCreatorTypeTags(typen) {
    if (!typen || typen.length === 0) return '-';
    if (Array.isArray(typen)) {
      const inner = typen.map(t => {
        const label = typeof t === 'object' ? (t.name || t.label || t) : t;
        return `<span class="tag tag--type">${String(label).trim()}</span>`;
      }).join('');
      return `<div class="tags tags-compact">${inner}</div>`;
    }
    if (typeof typen === 'object') {
      const label = typen.name || typen.label;
      return label ? `<div class="tags tags-compact"><span class="tag tag--type">${label}</span></div>` : '-';
    }
    return `<div class="tags tags-compact"><span class="tag tag--type">${String(typen)}</span></div>`;
  }

  // Cleanup
  destroy() {
    console.log('CreatorList: Cleaning up...');
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
    console.log('🎯 Zeige Creator-Erstellungsformular');
    window.setHeadline('Neuen Creator anlegen');
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('creator');
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neuen Creator anlegen</h1>
          <p>Erstellen Sie einen neuen Creator für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/creator')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('creator', null);
    
    // Custom Submit Handler für Seiten-Formular
    const form = document.getElementById('creator-form');
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
      const form = document.getElementById('creator-form');
      const formData = new FormData(form);
      const submitData = {};

      // Tag-basierte Multi-Selects aus Hidden-Selects sammeln
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      tagBasedSelects.forEach(select => {
        const fieldName = select.name;
        
        // Suche das versteckte Select mit den tatsächlichen Werten
        let hiddenSelect = form.querySelector(`select[name="${fieldName}[]"][style*="display: none"]`);
        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${fieldName}"][style*="display: none"]`);
        }
        
        // Alternative: Suche nach Tag-Container und sammle Werte aus Tags
        if (!hiddenSelect) {
          const tagContainer = form.querySelector(`select[name="${fieldName}"]`)?.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            const tags = tagContainer.querySelectorAll('.tag[data-value]');
            const tagValues = Array.from(tags).map(tag => tag.dataset.value).filter(Boolean);
            if (tagValues.length > 0) {
              submitData[fieldName] = tagValues;
              console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Tags gesammelt:`, tagValues);
              return;
            }
          }
        }
        
        if (hiddenSelect) {
          const values = Array.from(hiddenSelect.selectedOptions).map(opt => opt.value).filter(Boolean);
          if (values.length > 0) {
            submitData[fieldName] = values;
            console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Hidden-Select gesammelt:`, values);
          }
        } else {
          console.warn(`⚠️ Kein Hidden-Select oder Tags für ${fieldName} gefunden`);
        }
      });

      // FormData zu Objekt konvertieren (aber Tag-basierte Felder nicht überschreiben)
      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          // Multi-Select behandeln
          const cleanKey = key.replace('[]', '');
          if (!submitData[cleanKey]) {
            submitData[cleanKey] = [];
          }
          submitData[cleanKey].push(value);
        } else {
          // Nur setzen wenn nicht bereits als Array von Tag-basierten Feldern gesetzt
          if (!submitData.hasOwnProperty(key) || !Array.isArray(submitData[key])) {
            submitData[key] = value;
          } else {
            console.log(`⚠️ Überspringe ${key}, bereits als Array gesetzt:`, submitData[key]);
          }
        }
      }

      // Validierung
      const validation = window.validatorSystem.validateForm(submitData, {
        vorname: { type: 'text', minLength: 2, required: true },
        nachname: { type: 'text', minLength: 2, required: true },
        mail: { type: 'email' },
        telefonnummer: { type: 'phone' },
        portfolio_link: { type: 'url' }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      // Creator erstellen
      const result = await window.dataService.createEntity('creator', submitData);

      if (result.success) {
        this.showSuccessMessage('Creator erfolgreich erstellt!');
        
        // Event auslösen für Listen-Update statt Navigation
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'creator', id: result.id, action: 'created' } 
        }));
        
        // Optional: Zurück zur Übersicht navigieren (nur wenn gewünscht)
        // setTimeout(() => {
        //   window.navigateTo('/creator');
        // }, 1500);
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }

    } catch (error) {
      console.error('❌ Formular-Submit Fehler:', error);
      this.showErrorMessage(error.message);
    }
  }

  // Validierungsfehler anzeigen
  showValidationErrors(errors) {
    // Alte Fehler entfernen
    document.querySelectorAll('.field-error').forEach(el => el.remove());

    // Neue Fehler anzeigen
    Object.entries(errors).forEach(([field, message]) => {
      const fieldElement = document.querySelector(`[name="${field}"]`);
      if (fieldElement) {
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        fieldElement.parentNode.appendChild(errorElement);
      }
    });
  }

  // Erfolgsmeldung anzeigen
  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.textContent = message;
    
    const form = document.getElementById('creator-form');
    if (form) {
      form.parentNode.insertBefore(successDiv, form);
    }
  }

  // Fehlermeldung anzeigen
  showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.textContent = message;
    
    const form = document.getElementById('creator-form');
    if (form) {
      form.parentNode.insertBefore(errorDiv, form);
    }
  }
}

// Exportiere Instanz für globale Nutzung
export const creatorList = new CreatorList();
