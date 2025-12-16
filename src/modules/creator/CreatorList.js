// CreatorList.js (ES6-Modul)
// Creator-Liste mit neuem Filtersystem

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';

export class CreatorList {
  constructor() {
    this.selectedCreator = new Set();
    this._boundEventListeners = new Set();
    this.pagination = new PaginationSystem();
  }

  // Initialisiere Creator-Liste
  async init() {
    window.setHeadline('Creator Übersicht');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Creator', url: '/creator', clickable: false }
      ]);
    }
    
    const canView = (window.canViewPage && window.canViewPage('creator')) || await window.checkUserPermission('creator', 'can_view');
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Creator anzuzeigen.</p>
        </div>
      `;
      return;
    }

    // Pagination initialisieren
    this.pagination.init('pagination-container-creator', {
      onPageChange: (page) => this.handlePageChange(page)
    });

    // Binde Events sofort
    this.bindEvents();
    
    await this.loadAndRender();
  }

  // Handler für Seiten-Wechsel
  handlePageChange(page) {
    console.log(`📄 CREATORLIST: Wechsle zu Seite ${page}`);
    this.pagination.currentPage = page;
    this.loadAndRender();
  }

  // Lade und rendere Creator-Liste
  async loadAndRender() {
    const startTime = performance.now();
    
    try {
      // Rendere die Seite-Struktur
      await this.render();
      
      // Lade gefilterte Creator mit Pagination
      const currentFilters = filterSystem.getFilters('creator');
      const { currentPage, itemsPerPage } = this.pagination.getState();
      
      console.log('🔍 Lade Creator mit Filter und Pagination:', {
        filters: currentFilters,
        page: currentPage,
        limit: itemsPerPage
      });
      
      const result = await window.dataService.loadEntitiesWithPagination(
        'creator',
        currentFilters,
        currentPage,
        itemsPerPage
      );
      
      console.log('📊 Creator geladen:', result);
      
      // Pagination Total aktualisieren
      this.pagination.updateTotal(result.total);
      this.pagination.render();
      
      // Aktualisiere nur die Tabelle mit gefilterten Daten
      this.updateTable(result.data);
      
      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ CREATORLIST: Creator geladen in ${loadTime}ms`);
      
    } catch (error) {
      window.ErrorHandler.handle(error, 'CreatorList.loadAndRender');
    }
  }

  // Rendere Creator-Liste
  async render() {
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
    
    // Filter-Dropdown über dem Tabellen-Header
    let filterHtml = `<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-dropdown-container"></div>
      </div>
    </div>`;
    
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    
    // Haupt-HTML
    let html = `
      <div class="table-filter-wrapper">
        ${filterHtml}
        <div class="table-actions">
          ${isAdmin ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>` : ''}
          ${canEdit ? '<button id="btn-creator-new" class="primary-btn">Neuen Creator anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${isAdmin ? `<th><input type="checkbox" id="select-all-creators"></th>` : ''}
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
              <td colspan="${isAdmin ? '10' : '9'}" class="no-data">Lade Creator...</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination Container -->
      <div class="pagination-container" id="pagination-container-creator"></div>
    `;

    window.setContentSafely(window.content, html);
    
    // Initialisiere Filterbar mit neuem System
    await this.initializeFilterBar();
  }

  // Initialisiere Filter-Dropdown
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      // Nutze das neue Filter-Dropdown System
      await filterDropdown.init('creator', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
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
    // Filter-Events werden vom FilterDropdown gehandelt

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
    const selectBtn = document.getElementById('btn-select-all');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    
    if (selectedCountElement) {
      selectedCountElement.textContent = `${selectedCount} ausgewählt`;
      selectedCountElement.style.display = selectedCount > 0 ? 'inline' : 'none';
    }
    
    if (selectBtn) {
      selectBtn.style.display = selectedCount > 0 ? 'none' : 'inline-block';
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
    
    // Optimistisches UI-Update: Zeilen ausblenden
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      // Batch-Delete für bessere Performance
      const result = await window.dataService.deleteEntities('creator', selectedIds);
      
      if (result.success) {
        // Entferne Zeilen aus DOM
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        alert(`✅ ${result.deletedCount} Creator erfolgreich gelöscht.`);
        
        this.deselectAll();
        
        // Nur neu laden wenn Liste leer ist
        const tbody = document.querySelector('.data-table tbody');
        if (tbody && tbody.children.length === 0) {
          await this.loadAndRender();
        }
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'creator', action: 'bulk-deleted', count: result.deletedCount }
        }));
      } else {
        throw new Error(result.error || 'Löschen fehlgeschlagen');
      }
    } catch (error) {
      // Bei Fehler: Zeilen wiederherstellen
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

  // Update Tabelle
  async updateTable(creators) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';

    if (!creators || creators.length === 0) {
      const { renderEmptyState } = await import('../../core/FilterUI.js');
      renderEmptyState(tbody);
      return;
    }

    const rowsHtml = creators.map(creator => `
      <tr data-id="${creator.id}">
        ${isAdmin ? `<td><input type="checkbox" class="creator-check" data-id="${creator.id}"></td>` : ''}
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
        <td>${this.renderLocationTag(creator.lieferadresse_stadt, 'stadt')}</td>
        <td>${this.renderLocationTag(creator.lieferadresse_land, 'land')}</td>
        <td>
          ${actionBuilder.create('creator', creator.id)}
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

  // Render Location Tags (Stadt/Land)
  renderLocationTag(value, type) {
    if (!value || value.trim() === '') return '-';
    const sanitized = window.validatorSystem?.sanitizeHtml(value) || value;
    return `<div class="tags tags-compact"><span class="tag tag--${type}">${sanitized}</span></div>`;
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
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Creator', url: '/creator', clickable: true },
        { label: 'Neuer Creator', url: '/creator/new', clickable: false }
      ]);
    }
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('creator');
    window.content.innerHTML = `
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
      
      // Duplikat-Validierung auf Vor- und Nachname
      this.setupDuplicateValidation(form);
    }
  }

  // Setup Duplikat-Validierung für Creator (Vor- und Nachname)
  setupDuplicateValidation(form) {
    const vornameField = form.querySelector('#vorname, input[name="vorname"]');
    const nachnameField = form.querySelector('#nachname, input[name="nachname"]');
    
    if (!vornameField || !nachnameField) {
      console.warn('⚠️ CREATORLIST: Vorname- oder Nachname-Feld nicht gefunden');
      return;
    }

    // Container für Duplicate-Messages (nach Nachname-Feld)
    let messageContainer = nachnameField.parentElement.querySelector('.duplicate-message-container');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.className = 'duplicate-message-container';
      nachnameField.parentElement.appendChild(messageContainer);
    }

    // Blur Events für beide Felder
    [vornameField, nachnameField].forEach(field => {
      field.addEventListener('blur', async () => {
        const vorname = vornameField.value.trim();
        const nachname = nachnameField.value.trim();
        
        if (vorname && nachname) {
          await this.validateCreatorDuplicate(vorname, nachname, messageContainer);
        } else {
          this.clearDuplicateMessages(messageContainer);
        }
      });

      // Clear beim Tippen
      field.addEventListener('input', () => {
        this.clearDuplicateMessages(messageContainer);
        this.enableSubmitButton();
      });
    });
  }

  // Validiere Creator Duplikat
  async validateCreatorDuplicate(vorname, nachname, messageContainer) {
    if (!vorname || !nachname || vorname.trim().length < 1 || nachname.trim().length < 1) {
      this.clearDuplicateMessages(messageContainer);
      return;
    }

    if (!window.duplicateChecker) {
      console.warn('⚠️ CREATORLIST: DuplicateChecker nicht verfügbar');
      return;
    }

    try {
      const result = await window.duplicateChecker.checkCreator(vorname, nachname, null);

      if (result.exact) {
        // Exakt vorhanden → Button disablen, Fehler anzeigen
        this.showDuplicateError(messageContainer, result.similar);
        this.disableSubmitButton(true);
      } else if (result.similar.length > 0) {
        // Ähnlich → Info-Box (nicht blockierend)
        this.showDuplicateWarning(messageContainer, result.similar);
        this.enableSubmitButton();
      } else {
        // Alles gut
        this.clearDuplicateMessages(messageContainer);
        this.enableSubmitButton();
      }
    } catch (error) {
      console.error('❌ CREATORLIST: Fehler bei Duplikat-Validierung:', error);
    }
  }

  // Zeige Duplikat-Fehler
  showDuplicateError(container, entries) {
    container.innerHTML = `
      <div class="duplicate-error">
        <strong>Dieser Creator existiert bereits!</strong>
        ${entries.length > 0 ? `
          <ul class="duplicate-list">
            ${entries.map(entry => `
              <li class="duplicate-list-item">
                <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${entry.id}">
                  ${entry.profilbild_url ? `<img src="${entry.profilbild_url}" alt="${entry.vorname} ${entry.nachname}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                  <span class="duplicate-name">${entry.vorname} ${entry.nachname}${entry.instagram ? ` <span class="duplicate-meta">(@${entry.instagram})</span>` : ''}</span>
                </a>
              </li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    `;
    
    // Event-Listener für Links
    this.bindDuplicateLinks(container, 'creator');
  }

  // Zeige Duplikat-Warnung
  showDuplicateWarning(container, entries) {
    container.innerHTML = `
      <div class="duplicate-warning">
        <strong>Folgende ähnliche Einträge gefunden:</strong>
        <ul class="duplicate-list">
          ${entries.map(entry => `
            <li class="duplicate-list-item">
              <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${entry.id}">
                ${entry.profilbild_url ? `<img src="${entry.profilbild_url}" alt="${entry.vorname} ${entry.nachname}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                <span class="duplicate-name">${entry.vorname} ${entry.nachname}${entry.instagram ? ` <span class="duplicate-meta">(@${entry.instagram})</span>` : ''}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
    
    // Event-Listener für Links
    this.bindDuplicateLinks(container, 'creator');
  }

  // Bind Click-Events für Duplikat-Links
  bindDuplicateLinks(container, entityType) {
    const links = container.querySelectorAll('.duplicate-link[data-entity-id]');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.currentTarget.dataset.entityId;
        if (id) {
          // Internes Routing verwenden (ohne Reload, im gleichen Tab)
          const route = `/${entityType}/${id}`;
          if (window.navigationSystem) {
            window.navigationSystem.navigateTo(route);
          }
        }
      });
    });
  }

  // Lösche Duplikat-Messages
  clearDuplicateMessages(container) {
    if (container) {
      container.innerHTML = '';
    }
  }

  // Disable Submit Button
  disableSubmitButton(disable) {
    const form = document.getElementById('creator-form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = disable;
        if (disable) {
          submitBtn.style.opacity = '0.5';
          submitBtn.style.cursor = 'not-allowed';
        }
      }
    }
  }

  // Enable Submit Button
  enableSubmitButton() {
    const form = document.getElementById('creator-form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }
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

      // Duplikate aus Array-Feldern entfernen
      for (const [key, value] of Object.entries(submitData)) {
        if (Array.isArray(value)) {
          submitData[key] = [...new Set(value)];
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
